# Secure Lia backend

A Node.js / TypeScript backend with persistent SQLite inventories, verified Lia sessions, signed raw-body webhooks, receipt-based purchase delivery, refunds, recovery of undelivered purchases and server-issued reward challenges.

```sh
npm install
cp .env.example .env
# Fill .env using your app's TEST server key and webhook secret.
npm test
npm run build
npm start
```

Use Node 22.13 or later. Keep this backend separate from your frontend. Store secrets in your hosting provider's environment configuration; never in browser code, public repositories or `VITE_*` variables. Configure your app's webhook URL as `https://YOUR_BACKEND/webhooks/lia` in Lia Developers.

Create the `coins-100` product in Lia Developers, then edit the server-only `PRODUCTS` mapping for your real entitlements. `GET /shop` reads the current Lia catalogue. Authenticate your frontend requests with `Authorization: Bearer <session from Lia.init() or Lia.session()>`. This is a short-lived player session, never your server API key.

- `GET /shop`: catalogue plus the signed-in player's inventory.
- `GET /inventory`: persistent inventory for that player and mode.
- `POST /purchases/settle { chargeId }`: checks the charge with Lia, verifies its player, mode, product and paid status, grants exactly once locally, then acknowledges delivery. Call after `Lia.pay()` and for charges returned by `Lia.charges()` after a reload.
- `POST /webhooks/lia`: validates timestamp and HMAC over the exact raw bytes before parsing. Test probes never grant anything. A duplicate paid event cannot grant twice. Verified refunds reverse the original entitlement once.
- `POST /rewards/challenge { kind }`: choose a server-defined reward (`production-boost` or `offline-bonus`), not a client-provided amount. Send the resulting ID as `Lia.showRewardedAd({rewardContextId: challengeId})`.
- `POST /rewards/claim { challengeId, adId }`: checks Lia's challenge claim, player and reward context, then grants once by ad ID. **Live grants require `providerVerified: true`.** Native completion alone is not provider-signed proof; this starter deliberately permits that evidence only in test mode.

The reconciliation job retries pending deliveries once a minute. Persist `data/` on a durable volume. Run one process per SQLite file; use a transactional shared database when scaling across instances. Refunds can create a negative inventory if items were already consumed; decide and document your product's debt/restriction policy. Competitive scores need your own authoritative gameplay validation before submission; a server endpoint alone is not an anti-cheat system.

The generated tests cover altered and expired webhook signatures, duplicate purchases/rewards, receipt conflicts, refunds and test/live isolation. Extend them with your game's rules before public release. No real LIA or advertising earnings are simulated by this backend.
