package lia

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"regexp"
	"strconv"
	"time"
)

var signaturePattern = regexp.MustCompile(`^t=(\d{1,12}),v1=([a-f0-9]{64})$`)

// VerifyWebhook verifies untouched request bytes. Store stable event IDs durably to deduplicate retries.
func VerifyWebhook(secret string, raw []byte, signature string, now time.Time) bool {
	m := signaturePattern.FindStringSubmatch(signature)
	if secret == "" || m == nil || len(raw) > 1048576 {
		return false
	}
	at, err := strconv.ParseInt(m[1], 10, 64)
	if err != nil || now.Sub(time.Unix(at, 0)) > 5*time.Minute || time.Unix(at, 0).Sub(now) > 5*time.Minute {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(m[1] + "."))
	mac.Write(raw)
	actual, err := hex.DecodeString(m[2])
	return err == nil && hmac.Equal(mac.Sum(nil), actual)
}

type WebhookEvent struct {
	ID   string          `json:"id"`
	Type string          `json:"type"`
	App  string          `json:"app"`
	At   int64           `json:"at"`
	Data json.RawMessage `json:"data"`
	Test bool            `json:"test"`
}

func ConstructWebhookEvent(secret string, raw []byte, signature string, now time.Time) (*WebhookEvent, error) {
	if !VerifyWebhook(secret, raw, signature, now) {
		return nil, &Error{Code: "invalid_webhook", Status: 401}
	}
	var event WebhookEvent
	if json.Unmarshal(raw, &event) != nil || event.Type == "" || event.App == "" || event.At == 0 {
		return nil, &Error{Code: "invalid_webhook", Status: 401}
	}
	return &event, nil
}
