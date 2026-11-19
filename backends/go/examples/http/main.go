// Verified sessions and raw signed webhooks. Supply a transactional fulfillment handler before launch.
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
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"ok":true}`)
	})
	mux.HandleFunc("GET /shop", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token == "" || token == r.Header.Get("Authorization") {
			http.Error(w, `{"error":"session_required"}`, 401)
			return
		}
		if _, err := client.RequireSession(r.Context(), token); err != nil {
			status := 503
			if failure, ok := err.(*lia.Error); ok && failure.Status == 401 {
				status = 401
			}
			http.Error(w, `{"error":"session_unavailable"}`, status)
			return
		}
		products, err := client.ListProducts(r.Context(), lia.Params{}, lia.RequestOptions{})
		if err != nil {
			http.Error(w, `{"error":"unavailable"}`, 503)
			return
		}
		json.NewEncoder(w).Encode(products)
	})
	mux.HandleFunc("POST /webhooks/lia", func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 20000))
		if err != nil {
			http.Error(w, `{"error":"body_too_large"}`, 413)
			return
		}
		event, err := lia.ConstructWebhookEvent(os.Getenv("LIA_WEBHOOK_SECRET"), raw, r.Header.Get("Lia-Signature"), time.Now())
		if err != nil {
			http.Error(w, `{"error":"invalid_webhook"}`, 401)
			return
		}
		if event.Test {
			w.Header().Set("Content-Type", "application/json")
			io.WriteString(w, `{"received":true,"probe":true}`)
			return
		}
		// Fetch the authoritative charge, validate player/mode/product/status, then grant atomically once.
		// Return 2xx only after your database commit and Lia delivery acknowledgement.
		http.Error(w, `{"error":"configure_transactional_fulfillment"}`, 503)
	})
	address := os.Getenv("LISTEN_ADDR")
	if address == "" {
		address = "127.0.0.1:3001"
	}
	server := &http.Server{Addr: address, Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 25 * time.Second, IdleTimeout: 60 * time.Second}
	log.Fatal(server.ListenAndServe())
}
