# @lia-labs/sdk

The Lia SDK, typed and tree-shakeable: players and sessions, payments on Lia's pay sheet, invites, notifications, ads, the bottom and header buttons, storage, the phone, and its state as observable values. Everything the script tag SDK does, as named exports.

```sh
npm install @lia-labs/sdk
```

```ts
import { init, isLia, mainButton, mockLia, pay, ready, themeParams } from '@lia-labs/sdk';

if (!isLia()) mockLia();

const me = await init(); // also keeps --lia-* CSS variables current
ready();

mainButton.setParams({ text: 'Buy for 5 LIA', isVisible: true });
mainButton.onClick(async () => {
  const { chargeId } = await pay('extra-lives');
  // send chargeId and a fresh session() to your server to deliver it
});

themeParams.subscribe((theme) => console.log(theme.bg_color));
```

Ads: full screen ones (`showRewardedAd`, `showInterstitialAd`), and since 0.2.0 banners and native ads. Lia draws those natively, outside your page, because AdMob can't draw inside a web view: `showBanner({ position: 'bottom' })` docks a banner and makes your page smaller to fit it, and `showNativeAd({ placement: 'card' | 'sheet' })` docks a card at the bottom edge or slides a sheet over your paused app. The framework packages add `useBannerAd('bottom')` (or `createBannerAd`, `injectBannerAd`, `<lia-banner>`), and `banner` and `nativeAd` follow what's up.


Without a bundler: `<script src="https://unpkg.com/@lia-labs/sdk/dist/index.global.js"></script>` gives you `window.liaSdk`. The original script tag (`window.Lia`) keeps working; use one or the other on a page, not both.

Full guide: https://docs.lialabs.org/packages/sdk

## Saving media (0.5.0)

Save a photo, video or any file to the person's phone, with no browser in between. Lia asks first (naming your app), then puts photos and videos in their Photos library (add-only access: your app never reads their library) and hands other files to the phone's save sheet ("Save to Files"). Needs a Lia build with `capabilities.saveMedia`; older builds answer `unknown_method`, so feature-detect and fall back.

```ts
import { init, saveMedia, openLink } from '@lia-labs/sdk';

const me = await init();
const picture = 'https://example.com/receipt.png';
if (me.capabilities?.saveMedia) {
  const saved = await saveMedia({ url: picture, filename: 'receipt.png' }); // or saveMedia(picture)
  if (!saved.cancelled) console.log(saved.to); // 'photos' or 'files'
} else {
  await openLink(picture, { external: true }); // older Lia: the browser, where it can be kept
}
// Bytes you made in the page (a canvas, say), up to about 6 MB:
await saveMedia({ data: base64, mimeType: 'image/png', filename: 'card.png' });
```

Links must be https (Lia downloads them itself; up to 50 MB for videos, 20 MB otherwise). File names are names, not paths.

## Camera media (0.3.0)

Targets the hosted SDK 1.9 protocol. Requires Lia iOS build 600 or Android versionCode 900549 or newer for native camera support. Older apps keep working; feature-detect capabilities rather than checking the JavaScript package version.

```ts
import { init, capturePhoto, captureVideo, readMedia, releaseMedia } from '@lia-labs/sdk';

const me = await init();
if (me.capabilities?.capturePhoto) {
  const photo = await capturePhoto(); // explicit app-named consent, then the system camera
  if (!photo.cancelled) {
    try {
      const parts: Uint8Array<ArrayBuffer>[] = [];
      let offset = 0;
      for (;;) {
        const chunk = await readMedia(photo.id, offset);
        parts.push(Uint8Array.from(atob(chunk.base64), c => c.charCodeAt(0)));
        offset = chunk.nextOffset;
        if (chunk.eof) break;
        await new Promise(resolve => setTimeout(resolve, 100)); // shared bridge rate limit
      }
      const blob = new Blob(parts, { type: photo.mimeType });
      // Preview or upload only when the person chooses. Capture never uploads automatically.
    } finally {
      await releaseMedia(photo.id);
    }
  }
}
```

`captureVideo()` uses the same result shape and also asks for microphone permission. Photos: up to 8 MiB. Videos: up to 30 seconds and 30 MiB. At most three captures per open app, with ten-minute handle expiry. Each `readMedia` call returns at most 48 KiB as base64, `nextOffset` and `eof`. Files belong to the creating app instance and are cleaned up on release or close. Device paths and EXIF fields are not returned. Handle permission denial, cancellation, `media_limit`, `media_too_large`, `media_expired`, `bad_offset` and `unknown_method` on older Lia builds. The mock cancels capture by default; use `onMethod` to simulate files.

Framework bindings re-export the same methods; inspect the `InitResult` returned by their initialization helpers for capabilities. Web components can use these methods through `@lia-labs/sdk` directly.

## Page interactions (0.4.0)

`init()` disables page zoom gestures, text selection, press-and-hold menus and native image/link dragging by default. Inputs, textareas and contenteditable fields retain normal editing. Scrolling, taps, keyboard focus and explicit `copyText()` calls keep working. These are browser controls and work with existing Lia builds.

```ts
import { init, setPageInteractions, getPageInteractions } from '@lia-labs/sdk';
setPageInteractions({ zoom: true, textSelection: true }); // before or after init()
await init();
console.log(getPageInteractions());
```

Each option (`zoom`, `textSelection`, `contextMenu`, `nativeDrag`) is a boolean and defaults to `false`. A partial update preserves other options. The script-tag equivalents are `Lia.setPageInteractions()` and `Lia.getPageInteractions()`. Enabling restores browser behavior; remove your own restrictive CSS/viewport directives too. Browser and OS accessibility settings remain in control of system magnification. Importing the module is safe during server rendering; call the setter in the browser.

## Server-backed games

`products()` reads the catalogue using the player session. `leaderboards.get(board, season)` reads server-managed rankings and `serverStorage.get(key)` reads server-controlled player data. Server writes require an official [backend package](https://docs.lialabs.org/packages/server); frontend code cannot write those values. `showRewardedAd({rewardContextId})` binds a server-issued challenge to the resulting ad. Your backend claims it and grants once. Live valuable rewards need provider SSV and an updated native host.

`enableDeveloperTools()` enables a local metadata-only inspector in test sessions. Call `dispose()` when finished. `createSandbox()` supplies local failed/interrupted purchase, expired session, unavailable ad and repeated-reward scenarios; it cannot verify real payments or ad rewards.
