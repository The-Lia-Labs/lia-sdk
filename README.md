# Lia SDK packages

The Lia SDK for web apps that run inside the Lia app, as npm packages. Modelled on how @tma.js splits Telegram's: a low level bridge, a typed core SDK, and thin bindings for each framework.

| Package | What it is |
| --- | --- |
| [`@lia-labs/bridge`](packages/bridge) | Typed calls and events over Lia's frame bridge, and `mockLia()` for local development |
| [`@lia-labs/sdk`](packages/sdk) | The SDK: every feature as typed, tree-shakeable exports, state as observable values |
| [`@lia-labs/sdk-react`](packages/react) | React hooks |
| [`@lia-labs/sdk-preact`](packages/preact) | Preact hooks |
| [`@lia-labs/sdk-vue`](packages/vue) | Vue composables |
| [`@lia-labs/sdk-svelte`](packages/svelte) | Svelte stores |
| [`@lia-labs/sdk-solid`](packages/solid) | Solid primitives |
| [`@lia-labs/sdk-angular`](packages/angular) | Angular signals |
| [`@lia-labs/elements`](packages/elements) | Custom elements for any page |

The script tag SDK (`https://api.lialabs.org/sdk/lia-apps-v1.js`, `window.Lia`) is served by lia-api and keeps working. A page uses the script tag or these packages, not both: both answer Lia through `window.__lia`.

Docs: https://docs.lialabs.org/packages

## Create an app

```sh
npm create @lia-labs/app@latest
```

Choose a framework, a small starter or interactive SDK demo, the public app ID, package manager and local simulation. For example:

```sh
npm create @lia-labs/app@latest my-game -- --framework react --template demo
```

See [the CLI](packages/create-app) and [starter documentation](https://docs.lialabs.org/packages/starters). `@lia-labs/create-app` has its own release version; the nine runtime packages continue to share their SDK version.

## Working on it

```sh
npm install
npm test          # every package's tests (vitest, jsdom), from source
npm run typecheck
npm run build     # ESM, CommonJS and types for each; script (IIFE) builds for bridge, sdk and elements
npm run check     # all three
```

The protocol types (`packages/bridge/src/types.ts`) follow the Lia app's host (lia-project `src/components/web-app.tsx`, its METHODS) and the script tag SDK (lia-api `src/sdk/script.ts`). Change them together.

## Publishing

The packages are published to npm under the `@lia-labs` organisation, MIT licensed. To release: bump the versions together, `npm run check`, then publish bridge and sdk before the rest:

```sh
npm publish -w @lia-labs/bridge -w @lia-labs/sdk
npm publish -w @lia-labs/sdk-react -w @lia-labs/sdk-preact -w @lia-labs/sdk-vue -w @lia-labs/sdk-svelte -w @lia-labs/sdk-solid -w @lia-labs/sdk-angular -w @lia-labs/elements
```

## Release 0.3.0

All nine packages are versioned together. Adds typed photo/video capture, app-scoped media reads and cleanup, native capability detection, and current branded invitation examples. Targets the SDK 1.9 protocol; npm package versions are separate from hosted SDK versions. Camera capture requires Lia iOS build 600 / Android versionCode 900549 or newer and explicit consent. See the core package README and https://docs.lialabs.org/reference/sdk-device.
