# Lia server packages

Official server clients for **TypeScript/JavaScript, Python, PHP and Go**. They call the same app-scoped Lia server API. A test key sees test records; a live key requires a live app and sees live records.

## Generate a backend

```sh
npx @lia-labs/create-app@latest backend
```

Choose Node.js HTTP or Express, FastAPI or Django, PHP HTTP, or Go HTTP. The generated backends verify short-lived player sessions and paid charges, keep SQLite inventories with unique receipts, acknowledge delivery after a successful grant, and reverse refunds once. The Node starter also includes server-issued reward challenges and a bounded, paginated recovery sweep.

The CLI never asks you to paste a secret into terminal arguments or writes one into the frontend. Set `LIA_SERVER_KEY` and `LIA_WEBHOOK_SECRET` on your server. Create the `coins-100` product in Lia Developers, then change the server-owned entitlement mapping for your real products. Persist `data/` on a durable volume. For multiple application instances, replace the sample SQLite store with a shared transactional database. Configure HTTPS and application-specific rate limits on production hosting.

Framework integration examples are included for **Express, Next.js App Router, Hono, FastAPI, Django and Laravel**. A framework adapter cannot determine your game's entitlement or anti-cheat rules; those remain server-owned application code.

## Install into an existing backend

| Language | Package / source | Install |
| --- | --- | --- |
| JavaScript / TypeScript | `@lia-labs/server` | `npm install @lia-labs/server` |
| Python | `lia-labs-server` | `pip install 'lia-labs-server @ git+https://github.com/The-Lia-Labs/lia-server-python.git@v0.1.0'` |
| PHP | `lia-labs/server` | Add the company GitHub VCS repository below, then `composer require lia-labs/server:^0.1.0` |
| Go | `github.com/The-Lia-Labs/lia-server-go` | `go get github.com/The-Lia-Labs/lia-server-go@v0.1.0` |

Python is installable from its tagged GitHub source; it is not yet listed on PyPI. PHP is installable through Composer VCS; it is not yet listed on Packagist.

```json
{"repositories":[{"type":"vcs","url":"https://github.com/The-Lia-Labs/lia-server-php"}]}
```

Node supports ESM and CommonJS and includes TypeScript types. Python supplies `LiaClient` and `AsyncLiaClient`. PHP requires 8.2+ and cURL; the generated inventory starter also requires PDO SQLite. Go's client uses the standard library; its generated inventory starter uses SQLite through CGO and needs a C compiler. Do not import these packages in a browser bundle.

## Authenticate the player

```ts
import {LiaClient} from '@lia-labs/server';
const lia = new LiaClient(process.env.LIA_SERVER_KEY!);
const player = await lia.requireSession(sessionFromLia);
const {products} = await lia.listProducts();
```

Python: `lia.require_session(session)`; PHP: `$lia->requireSession($session)`; Go: `client.RequireSession(ctx, session)`.

The frontend sends the session returned by `Lia.init()` or `Lia.session()`, not a player ID or your server key. The result's `exp` is Unix **milliseconds**. The clients verify the response's mode, player shape and expiry. Renew the frontend session when it expires. The API itself verifies signatures and app ownership.

## Operations

The shared machine-readable contract is [the shared contract](https://github.com/The-Lia-Labs/lia-sdk/blob/main/backends/contract.json). Names below are TypeScript/PHP names. Python uses snake_case and keyword parameters; Go uses PascalCase, `context.Context`, `lia.Params` and `lia.RequestOptions`.

| Area | Methods |
| --- | --- |
| Sessions | `verifySession`, `requireSession` |
| Catalogue | `listProducts` |
| Purchases | `getCharge`, `deliverCharge`, `refundCharge`, `listPendingCharges` |
| LIA rewards | `payReward`, `getPool` |
| Notifications | `sendNotification` |
| Rewarded ads | `verifyAd`, `createAdChallenge`, `claimAdChallenge` |
| Multiplayer lobby | `listTables`, `saveTable`, `sitAtTable`, `removeTable` |
| Authoritative scores | `listLeaderboards`, `saveLeaderboard`, `getLeaderboard`, `submitScore`, `moderateScore` |
| Server-only storage | `getPlayerStorage`, `setPlayerStorage` |
| Webhooks | `listWebhookEvents`, `replayWebhookEvent`, raw signature verification and event construction |
| Analytics | `getAnalytics`, `exportAnalytics` |

Storage writes require `expectedVersion`; a conflict is HTTP 409. JSON `null` is a valid stored value. Browser access to this storage is read-only and bound to the session's player. Scores must come from server-validated gameplay; moving an untrusted score to a server endpoint does not make it authoritative.

## Purchases and retries

1. Fetch the charge with the server key. Check `playerId`, `mode`, `productId` and a `paid`/`delivered` status.
2. In one database transaction, insert a unique receipt keyed by **mode + charge ID** and grant the mapped entitlement only if the receipt is new.
3. Commit inventory, then call `deliverCharge`. Retry that acknowledgement even if inventory was already granted.
4. Reconcile pending paid charges using every cursor page. Refunds must be rechecked against Lia and reversed once in your database.

All clients use a 15-second request budget and at most two retries by default. They retry transient HTTP/network failures, honor `Retry-After`, refuse authenticated redirects and omit raw error bodies from errors. Mutations keep the same generated Idempotency-Key and serialized body within a call. **Pass a stable business key when retrying across process restarts or separate calls.**

```ts
await lia.deliverCharge({id: charge.id}, {idempotencyKey: `deliver:${charge.id}`});
```

Python uses `idempotency_key=...`; PHP takes it as the second argument; Go uses `lia.RequestOptions{IdempotencyKey: ...}`. Session verification is a read-style POST and does not create an unnecessary idempotency record. `LiaError` includes a code, HTTP status, request ID and retry delay. Never treat a 503 as an invalid player or a completed purchase. Safe GETs and session verification have bounded retries; financial exactly-once behavior also relies on the API's and your database's unique business receipts.

## Signed webhooks

Verify **untouched raw bytes before parsing JSON** with `constructWebhookEvent` (Node), `construct_webhook_event` (Python), `Webhooks::constructEvent` (PHP), or `ConstructWebhookEvent` (Go). Use the `Lia-Signature` header and your app's webhook secret. Verification rejects altered payloads and timestamps more than five minutes in the past or future. Unknown signed event types can be acknowledged without granting anything; `test:true` probes never grant inventory.

Lia keeps a durable outbox with a stable event ID. It attempts delivery immediately, then after 1 minute, 5 minutes, 30 minutes, 2 hours, 8 hours, 24 hours and 48 hours. Each attempt gets a fresh signature timestamp. Inspect metadata using `listWebhookEvents`, and replay an event after fixing your handler. Deduplicate by stable business receipts even after a replay. Do not return 2xx before fulfillment commits.

## Reward challenges

Create a challenge on your server with a server-owned context and player ID. Return `challengeId` to the frontend and pass it as `rewardContextId` when requesting a rewarded ad. Bind/claim checks the player, app mode, ad format, age, completion and reuse. A claim **does not grant inventory by itself**; grant your game's entitlement once per ad in your own transaction.

**Live valuable rewards require `providerVerified:true`.** The new proof flow also needs an updated native Lia host to send the per-ad SSV nonce and the AdMob SSV callback configured. Backend support alone does not upgrade already-installed apps. Test-mode native completion is simulated evidence, never real provider-signed proof.

## Analytics

Reports include daily active players, purchases and payer conversion, per-format ad telemetry and D1/D7/D30 retention. CSV contains activity, ad and retention record types. Retention collection starts with this release; historical cohorts are not invented. Incomplete ad impression coverage returns null metrics. SDK-reported revenue is an estimate, not finalized AdMob earnings or a developer payout statement.

## Validation

From the company `lia-sdk` repository:

```sh
npm install
python3 -m venv .venv
.venv/bin/pip install -e backends/python
LIA_PYTHON=.venv/bin/python npm run test:backends
npm run test:create-app
```

Install Postman CLI, PHP with cURL and Go first. This runs all four real clients through the local first-party Postman HTTP simulation, including temporary failures, repeated mutations, session expiry, redirects, deadlines and webhook tampering. It does not touch production data. See `scripts/developer-server-features-local-test.mjs` in the API repository for the separate integration test against the real local Worker implementation.
