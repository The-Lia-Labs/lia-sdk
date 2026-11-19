# @lia-labs/bridge

The lowest layer of the Lia SDK: typed calls and events between your web app and the Lia app, over the frame bridge Lia apps use (`{ lia: 1, id, method, params }`), plus `mockLia()` to run outside Lia. Most apps want [`@lia-labs/sdk`](https://www.npmjs.com/package/@lia-labs/sdk) instead.

```sh
npm install @lia-labs/bridge
```

```ts
import { isLia, mockLia, on, request } from '@lia-labs/bridge';

if (!isLia()) mockLia(); // a pretend Lia for local development

const me = await request('init');
await request('haptic', { kind: 'success' });
const stop = on('theme', ({ colorScheme }) => console.log(colorScheme));
```


Full guide: https://docs.lialabs.org/packages/bridge

Version 0.3.0 targets protocol 1.9.0, including optional `init().capabilities` and typed `capturePhoto`, `captureVideo`, `readMedia`, and `releaseMedia` requests. Camera support requires the new native Lia build; older hosts return `unknown_method`. The local mock cancels capture and rejects reads without simulated media. See the core SDK README for consent, limits and cleanup.
