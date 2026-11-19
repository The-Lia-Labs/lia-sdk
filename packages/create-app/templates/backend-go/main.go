package main

import (
	"encoding/json"
	lia "github.com/The-Lia-Labs/lia-server-go"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	client, err := lia.NewClient(os.Getenv("LIA_SERVER_KEY"), lia.Options{BaseURL: os.Getenv("LIA_API_BASE_URL")})
	if err != nil {
		log.Fatal(err)
	}
	inventory, err := newStore(client)
	if err != nil {
		log.Fatal("inventory initialization failed")
	}
	defer inventory.db.Close()
	reply := func(w http.ResponseWriter, status int, value any) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(value)
	}
	failure := func(w http.ResponseWriter, err error) {
		status := 503
		code := "temporarily_unavailable"
		if e, ok := err.(*lia.Error); ok {
			code = e.Code
			if e.Status >= 400 && e.Status < 600 {
				status = e.Status
			}
		}
		reply(w, status, map[string]string{"error": code})
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) { reply(w, 200, map[string]bool{"ok": true}) })
	mux.HandleFunc("POST /webhooks/lia", func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 20000))
		if err != nil {
			reply(w, 413, map[string]string{"error": "body_too_large"})
			return
		}
		event, err := lia.ConstructWebhookEvent(os.Getenv("LIA_WEBHOOK_SECRET"), raw, r.Header.Get("Lia-Signature"), time.Now())
		if err != nil {
			failure(w, err)
			return
		}
		if event.Test {
			reply(w, 200, map[string]bool{"received": true, "probe": true})
			return
		}
		var data struct {
			ID string `json:"id"`
		}
		if json.Unmarshal(event.Data, &data) != nil || data.ID == "" {
			reply(w, 400, map[string]string{"error": "invalid_event"})
			return
		}
		if event.Type == "charge.paid" {
			_, err = inventory.settle(r.Context(), data.ID, "")
		} else if event.Type == "charge.refunded" {
			err = inventory.refund(r.Context(), data.ID)
		}
		if err != nil {
			failure(w, err)
			return
		}
		reply(w, 200, map[string]bool{"received": true})
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			reply(w, 401, map[string]string{"error": "session_required"})
			return
		}
		player, err := client.RequireSession(r.Context(), auth[7:])
		if err != nil {
			failure(w, err)
			return
		}
		if r.Method == "GET" && r.URL.Path == "/shop" {
			products, err := client.ListProducts(r.Context(), lia.Params{}, lia.RequestOptions{})
			if err != nil {
				failure(w, err)
				return
			}
			balance, err := inventory.inventory(r.Context(), player.PlayerID)
			if err != nil {
				failure(w, err)
				return
			}
			result := products.(map[string]any)
			result["inventory"] = balance
			reply(w, 200, result)
			return
		}
		if r.Method == "POST" && r.URL.Path == "/purchases/settle" {
			var body struct {
				ChargeID string `json:"chargeId"`
			}
			if json.NewDecoder(http.MaxBytesReader(w, r.Body, 20000)).Decode(&body) != nil {
				reply(w, 400, map[string]string{"error": "invalid_body"})
				return
			}
			result, err := inventory.settle(r.Context(), body.ChargeID, player.PlayerID)
			if err != nil {
				failure(w, err)
				return
			}
			reply(w, 200, result)
			return
		}
		reply(w, 404, map[string]string{"error": "not_found"})
	})
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		frontend := os.Getenv("FRONTEND_ORIGIN")
		if frontend == "" {
			frontend = "http://localhost:5173"
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if r.Header.Get("Origin") == frontend {
			w.Header().Set("Access-Control-Allow-Origin", frontend)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization,Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		}
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		mux.ServeHTTP(w, r)
	})
	address := os.Getenv("LISTEN_ADDR")
	if address == "" {
		address = "127.0.0.1:3001"
	}
	server := &http.Server{Addr: address, Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 25 * time.Second, IdleTimeout: 60 * time.Second}
	log.Fatal(server.ListenAndServe())
}
