# __APP_NAME__

A working **__FRAMEWORK__** Lia app, generated with the **__TEMPLATE__** template and `__BINDING__`.

## Run locally

```sh
npm install
npm run dev
```

Use the corresponding commands if you selected pnpm, Yarn or Bun. Node 22.12+ or 24+ is recommended. The local mock answers with a test player and simulated payments, ads and rewards; it cannot verify a real server session. Native permissions and hardware still need testing inside Lia. Development mocks are excluded from production builds and never replace an existing Lia host.

## Explore the code

- `src/App.*` / `src/app.component.ts` / `src/app.ts`: the UI and framework-specific state and lifecycle integration.
- `src/demo.ts`: typed feature examples, the source shown beside each action, and error handling.
- `src/local-dev.ts`: local mock setup, gated to development only.
- `src/config.ts`: public app ID (`__APP_ID__`) and the example product ID. App IDs do not authenticate requests.
- `src/styles.css`: Lia theme variables and safe-area spacing.

To explore all examples from the start, generate with `--template demo`. The bridge template demonstrates raw typed `request()` / `send()` messages; framework templates use their own hooks, composables, stores or signals. Web components demonstrate `<lia-app>` and `<lia-main-button>`.

## Test inside Lia

1. Run `npm run build` and host the output over HTTPS (`dist/`; Angular outputs `dist/browser/`). A development browser mock is not deployed.
2. Sign in to https://developers.lialabs.org, create an app and use your HTTPS page URL. Update `src/config.ts` if the registered app ID differs.
3. Add up to five additional testers using their Lia usernames. You and your testers find it in **Apps → Testing**; your publishing category applies after approval.
4. For the purchase example, create an active **demo-coins** test product in the portal. A product ID is not a price or proof of payment.
5. You can archive your test app in **Settings → Archive app** and restore it later. Archiving hides it from everyone testing it and withdraws pending review.

## Keep value on your server

Never place app server keys, admin keys or webhook secrets in browser code, `.env` files prefixed `VITE_`, browser storage or public Git repositories. Keep keys in a separate backend's secret configuration.

Never grant currency, items or rewards because a client says it paid, watched an ad or earned a score. On your backend, verify the Lia session, fetch and validate the charge (app, mode, player, product and status), fulfill once using durable idempotency, then acknowledge delivery. Keep test and live accounting separate. Validate valuable scores and referrals independently.

This client starter deliberately does not include an insecure `/api/deliver` stub or invent successful server verification. Demo purchases and scores are restricted to test mode. See https://docs.lialabs.org/guides/verify-on-your-server and https://docs.lialabs.org/guides/sell-an-item.

## Guides

- Getting started: https://docs.lialabs.org/quickstart
- Your package: https://docs.lialabs.org/packages
- Ads: https://docs.lialabs.org/concepts/ads
- Server API: https://docs.lialabs.org/reference/server-api
- SDK reference: https://docs.lialabs.org/reference/sdk

Lia SDK packages and this starter are MIT licensed. Open developer access is planned for Q1 2027; current developer and publication access follows the portal's approval process.

## Languages

The page follows the language selected in Lia. Browser previews detect the browser language; use `?lang=ar` (or another supported language code) to preview a translation. English is the fallback. Arabic uses right-to-left layout. All 13 Lia languages are included in `src/i18n.ts`. Extend its catalogue when you add your own UI. Code examples, app names and API response data are kept unchanged.
