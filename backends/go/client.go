// Package lia is a server-only client for Lia. Never ship server keys to a mini app.
package lia

import (
	"bytes"
	"context"
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

//go:embed operations.json
var contract []byte

type operation struct {
	Method   string
	Path     string
	Body     []string
	Query    []string
	Required []string
	Text     bool
}
type Params map[string]any
type RequestOptions struct{ IdempotencyKey string }
type Options struct {
	BaseURL    string
	Timeout    time.Duration
	MaxRetries *int
	HTTPClient *http.Client
}
type Client struct {
	key, base  string
	mode       string
	timeout    time.Duration
	retries    int
	http       *http.Client
	operations map[string]operation
}
type Error struct {
	Code       string
	Status     int
	RequestID  string
	RetryAfter time.Duration
}

func (e *Error) Error() string { return e.Code }
func (e *Error) Retryable() bool {
	return e.Status == 0 || e.Status == 408 || e.Status == 425 || e.Status == 429 || e.Status == 500 || e.Status == 502 || e.Status == 503 || e.Status == 504 || e.Code == "idempotency_key_in_use"
}
func (c *Client) String() string   { return "lia.Client(mode=" + c.mode + ")" }
func (c *Client) GoString() string { return c.String() }
func (c *Client) Mode() string     { return c.mode }

var identifier = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,128}$`)
var keyPattern = regexp.MustCompile(`^lia_(test|live)_[A-Za-z0-9_-]+$`)
var playerPattern = regexp.MustCompile(`^p_\w{8,40}$`)
var placeholder = regexp.MustCompile(`\{(\w+)\}`)

func NewClient(key string, options Options) (*Client, error) {
	if !keyPattern.MatchString(key) {
		return nil, &Error{Code: "invalid_server_key"}
	}
	base := options.BaseURL
	if base == "" {
		base = "https://api.lialabs.org/api/apps/v1"
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.Hostname() == "" || !(parsed.Scheme == "https" || (parsed.Scheme == "http" && (parsed.Hostname() == "localhost" || parsed.Hostname() == "127.0.0.1" || parsed.Hostname() == "::1"))) {
		return nil, &Error{Code: "invalid_base_url"}
	}
	timeout := options.Timeout
	if timeout == 0 {
		timeout = 15 * time.Second
	}
	retries := 2
	if options.MaxRetries != nil {
		retries = *options.MaxRetries
	}
	if timeout < time.Millisecond || timeout > 120*time.Second || retries < 0 || retries > 3 {
		return nil, &Error{Code: "invalid_client_options"}
	}
	client := http.Client{}
	if options.HTTPClient != nil {
		client = *options.HTTPClient
	}
	client.CheckRedirect = func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }
	mode := "live"
	if strings.HasPrefix(key, "lia_test_") {
		mode = "test"
	}
	ops := map[string]operation{}
	if err := json.Unmarshal(contract, &ops); err != nil {
		return nil, err
	}
	return &Client{key: key, base: strings.TrimRight(base, "/"), mode: mode, timeout: timeout, retries: retries, http: &client, operations: ops}, nil
}
func safe(value string) string {
	if identifier.MatchString(value) {
		return value
	}
	return ""
}

// Call permits known operations only, preventing arbitrary paths from receiving your server key.
func (c *Client) Call(ctx context.Context, name string, params Params, options RequestOptions) (any, error) {
	spec, exists := c.operations[name]
	if !exists {
		return nil, &Error{Code: "unknown_operation"}
	}
	for _, field := range spec.Required {
		if _, exists := params[field]; !exists {
			return nil, &Error{Code: "missing_parameter"}
		}
	}
	bad := false
	path := placeholder.ReplaceAllStringFunc(spec.Path, func(match string) string {
		key := match[1 : len(match)-1]
		v, ok := params[key].(string)
		if !ok || safe(v) == "" || v == "." || v == ".." {
			bad = true
		}
		return url.PathEscape(v)
	})
	if bad {
		return nil, &Error{Code: "invalid_path_parameter"}
	}
	query := url.Values{}
	for _, key := range spec.Query {
		if v := params[key]; v != nil {
			query.Set(key, fmt.Sprint(v))
		}
	}
	target := c.base + path
	if q := query.Encode(); q != "" {
		target += "?" + q
	}
	idem := options.IdempotencyKey
	if idem != "" && safe(idem) == "" {
		return nil, &Error{Code: "invalid_idempotency_key"}
	}
	if spec.Method != "GET" && name != "verifySession" && idem == "" {
		buf := make([]byte, 16)
		if _, err := rand.Read(buf); err != nil {
			return nil, err
		}
		idem = hex.EncodeToString(buf)
	}
	var body []byte
	if spec.Method == "POST" {
		data := map[string]any{}
		for _, key := range spec.Body {
			if value, ok := params[key]; ok {
				data[key] = value
			}
		}
		var err error
		body, err = json.Marshal(data)
		if err != nil {
			return nil, err
		}
	}
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()
	for attempt := 0; ; attempt++ {
		req, err := http.NewRequestWithContext(ctx, spec.Method, target, bytes.NewReader(body))
		if err != nil {
			return nil, &Error{Code: "invalid_request"}
		}
		req.Header.Set("Authorization", "Bearer "+c.key)
		req.Header.Set("User-Agent", "lia-labs-server-go/0.1.0")
		req.Header.Set("Accept", "application/json")
		if spec.Text {
			req.Header.Set("Accept", "text/csv")
		}
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		if idem != "" {
			req.Header.Set("Idempotency-Key", idem)
		}
		response, err := c.http.Do(req)
		failure := &Error{Code: "network_error"}
		if err == nil {
			raw, readErr := io.ReadAll(io.LimitReader(response.Body, 1048577))
			response.Body.Close()
			failure = &Error{Code: "http_error", Status: response.StatusCode, RequestID: safe(response.Header.Get("X-Lia-Request-Id"))}
			if len(raw) > 1048576 {
				return nil, &Error{Code: "response_too_large", Status: response.StatusCode}
			}
			if readErr == nil {
				if response.StatusCode >= 200 && response.StatusCode < 300 {
					if spec.Text {
						return string(raw), nil
					}
					var result any
					if json.Unmarshal(raw, &result) != nil || result == nil {
						return nil, &Error{Code: "invalid_response", Status: response.StatusCode}
					}
					return result, nil
				}
				var result struct {
					Error string `json:"error"`
				}
				if json.Unmarshal(raw, &result) == nil && safe(result.Error) != "" {
					failure.Code = result.Error
				}
			} else {
				failure = &Error{Code: "network_error"}
			}
			retry := response.Header.Get("Retry-After")
			if seconds, e := strconv.ParseFloat(retry, 64); e == nil && !math.IsNaN(seconds) && !math.IsInf(seconds, 0) && seconds >= 0 {
				failure.RetryAfter = time.Duration(math.Min(seconds, 86400) * float64(time.Second))
			} else if at, e := http.ParseTime(retry); e == nil {
				failure.RetryAfter = time.Until(at)
				if failure.RetryAfter < 0 {
					failure.RetryAfter = 0
				}
			}
		}
		if ctx.Err() != nil {
			return nil, &Error{Code: "request_timeout"}
		}
		if !failure.Retryable() || attempt >= c.retries {
			return nil, failure
		}
		delay := time.Duration(100*(1<<attempt)) * time.Millisecond
		if failure.RetryAfter > 0 {
			delay = failure.RetryAfter
		}
		if deadline, ok := ctx.Deadline(); ok && time.Now().Add(delay).After(deadline) {
			return nil, failure
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, &Error{Code: "request_timeout"}
		case <-timer.C:
		}
	}
}

type Player struct {
	Valid    bool   `json:"valid"`
	PlayerID string `json:"playerId"`
	Mode     string `json:"mode"`
	Exp      int64  `json:"exp"`
}

func (c *Client) RequireSession(ctx context.Context, session string) (*Player, error) {
	value, err := c.VerifySession(ctx, Params{"session": session}, RequestOptions{})
	if err != nil {
		return nil, err
	}
	raw, _ := json.Marshal(value)
	var player Player
	err = json.Unmarshal(raw, &player)
	if err != nil || !player.Valid || !playerPattern.MatchString(player.PlayerID) || player.Mode != c.mode || player.Exp <= time.Now().UnixMilli() {
		return nil, &Error{Code: "invalid_session", Status: 401}
	}
	return &player, nil
}
func (c *Client) VerifySession(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "verifySession", params, options)
}
func (c *Client) ListProducts(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "listProducts", params, options)
}
func (c *Client) GetCharge(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "getCharge", params, options)
}
func (c *Client) DeliverCharge(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "deliverCharge", params, options)
}
func (c *Client) RefundCharge(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "refundCharge", params, options)
}
func (c *Client) PayReward(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "payReward", params, options)
}
func (c *Client) GetPool(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "getPool", params, options)
}
func (c *Client) SendNotification(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "sendNotification", params, options)
}
func (c *Client) VerifyAd(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "verifyAd", params, options)
}
func (c *Client) ListTables(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "listTables", params, options)
}
func (c *Client) SaveTable(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "saveTable", params, options)
}
func (c *Client) SitAtTable(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "sitAtTable", params, options)
}
func (c *Client) RemoveTable(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "removeTable", params, options)
}
func (c *Client) ListPendingCharges(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "listPendingCharges", params, options)
}
func (c *Client) ListLeaderboards(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "listLeaderboards", params, options)
}
func (c *Client) SaveLeaderboard(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "saveLeaderboard", params, options)
}
func (c *Client) GetLeaderboard(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "getLeaderboard", params, options)
}
func (c *Client) SubmitScore(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "submitScore", params, options)
}
func (c *Client) ModerateScore(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "moderateScore", params, options)
}
func (c *Client) GetPlayerStorage(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "getPlayerStorage", params, options)
}
func (c *Client) SetPlayerStorage(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "setPlayerStorage", params, options)
}
func (c *Client) ListWebhookEvents(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "listWebhookEvents", params, options)
}
func (c *Client) ReplayWebhookEvent(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "replayWebhookEvent", params, options)
}
func (c *Client) CreateAdChallenge(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "createAdChallenge", params, options)
}
func (c *Client) ClaimAdChallenge(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "claimAdChallenge", params, options)
}
func (c *Client) GetAnalytics(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "getAnalytics", params, options)
}
func (c *Client) ExportAnalytics(ctx context.Context, params Params, options RequestOptions) (any, error) {
	return c.Call(ctx, "exportAnalytics", params, options)
}
