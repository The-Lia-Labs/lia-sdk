# Lia Server for Go

Official server-only package for Lia mini apps.

```go
client, err := lia.NewClient(os.Getenv("LIA_SERVER_KEY"), lia.Options{})
if err != nil { return err }
player, err := client.RequireSession(ctx, sessionFromLia)
if err != nil { return err }
products, err := client.ListProducts(ctx, lia.Params{}, lia.RequestOptions{})
```

Import `lia "github.com/The-Lia-Labs/lia-server-go"`. Go 1.22+, standard library only for the client. Every request accepts a context. `go test ./...` checks raw signature handling; set `LIA_CONFORMANCE_URL` to the local first-party simulation to enable the HTTP contract test.

For the complete installation guide, API methods, safe retries, payment delivery and framework starters, see [Lia backend packages](https://github.com/The-Lia-Labs/lia-sdk/blob/main/backends/README.md) and [developer documentation](https://docs.lialabs.org/packages/server).

The same client covers sessions, products, charges, reconciliation, rewards, notifications, ads, seasonal leaderboards, server-only storage, durable webhook history/replay and analytics. Never ship the server key to the browser. Verify charge owner, mode, status and product before granting inventory with a persistent unique receipt. A signed webhook or `watched` flag alone is not an inventory grant. Live valuable ad rewards require provider SSV and a compatible native Lia host.
