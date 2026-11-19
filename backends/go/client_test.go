package lia

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"
)

func TestConformance(t *testing.T) {
	base := os.Getenv("LIA_CONFORMANCE_URL")
	if base == "" {
		t.Skip("Set LIA_CONFORMANCE_URL to the local Postman simulation")
	}
	if !strings.HasPrefix(base, "http://127.0.0.1:") {
		t.Fatal("local simulation required")
	}
	client, err := NewClient("lia_test_fixture", Options{BaseURL: base, Timeout: 2 * time.Second})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile("testdata/conformance.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Operation string
		Params    Params
		Method    string
		Path      string
		Body      map[string]any
		Query     map[string]string
		Text      bool
	}
	if err = json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	for _, c := range cases {
		result, err := client.Call(ctx, c.Operation, c.Params, RequestOptions{})
		if err != nil {
			t.Fatalf("%s: %v", c.Operation, err)
		}
		if c.Operation == "verifySession" {
			continue
		}
		if c.Text {
			if !strings.Contains(result.(string), "active_players") {
				t.Fatal("CSV")
			}
			continue
		}
		echo := result.(map[string]any)["echo"].(map[string]any)
		if echo["method"] != c.Method || echo["path"] != c.Path {
			t.Fatal(c.Operation)
		}
		actual, _ := json.Marshal(echo["body"])
		expected, _ := json.Marshal(c.Body)
		if string(actual) != string(expected) {
			t.Fatalf("%s body: %s != %s", c.Operation, actual, expected)
		}
	}
	player, err := client.RequireSession(ctx, "valid")
	if err != nil || player.PlayerID != "p_12345678" {
		t.Fatal("session", err)
	}
	for _, session := range []string{"invalid", "expired", "wrong-mode"} {
		if _, err = client.RequireSession(ctx, session); err == nil {
			t.Fatal("session accepted")
		}
	}
	if _, err = client.GetCharge(ctx, Params{"id": "retry-go"}, RequestOptions{}); err != nil {
		t.Fatal(err)
	}
	for id, code := range map[string]string{"rate-go": "slow_down", "redirect-go": "http_error", "invalid-go": "invalid_response", "conflict-go": "idempotency_key_reused"} {
		_, err = client.GetCharge(ctx, Params{"id": id}, RequestOptions{})
		failure, ok := err.(*Error)
		if !ok || failure.Code != code {
			t.Fatalf("%s: %v", id, err)
		}
	}
	if _, err = client.DeliverCharge(ctx, Params{"id": "replay-go"}, RequestOptions{IdempotencyKey: "go:one"}); err != nil {
		t.Fatal(err)
	}
	if _, err = client.GetCharge(ctx, Params{"id": "../pool"}, RequestOptions{}); err == nil {
		t.Fatal("path accepted")
	}
	if strings.Contains(fmt.Sprintf("%#v", client), "fixture") {
		t.Fatal("key logged")
	}
	slow, _ := NewClient("lia_test_fixture", Options{BaseURL: base, Timeout: 40 * time.Millisecond})
	if _, err = slow.GetCharge(ctx, Params{"id": "slow-go"}, RequestOptions{}); err == nil {
		t.Fatal("timeout accepted")
	}
}
func TestWebhook(t *testing.T) {
	at := time.Now().Unix()
	raw := []byte(fmt.Sprintf(`{"id":"evt_1","type":"charge.paid","app":"example","at":%d}`, at*1000))
	mac := hmac.New(sha256.New, []byte("whsec_fixture"))
	mac.Write([]byte(fmt.Sprint(at) + "."))
	mac.Write(raw)
	sig := fmt.Sprintf("t=%d,v1=%s", at, hex.EncodeToString(mac.Sum(nil)))
	if !VerifyWebhook("whsec_fixture", raw, sig, time.Now()) || VerifyWebhook("wrong", raw, sig, time.Now()) || VerifyWebhook("whsec_fixture", append(raw, ' '), sig, time.Now()) || VerifyWebhook("whsec_fixture", raw, sig, time.Now().Add(301*time.Second)) {
		t.Fatal("signature handling")
	}
	if _, err := ConstructWebhookEvent("whsec_fixture", raw, sig, time.Now()); err != nil {
		t.Fatal(err)
	}
}
