import { onDestroy } from 'svelte';
import { readable, type Readable as SvelteReadable } from 'svelte/store';
import {
  backButton,
  banner,
  holdBanner,
  nativeAd,
  type BannerPosition,
  colorScheme,
  contentSafeArea,
  controlBottomButton,
  controlHeaderButton,
  holdClosingConfirmation,
  holdVerticalSwipesOff,
  init,
  initialized,
  isFullscreen,
  language,
  mainButton,
  mode,
  notificationsAllowed,
  on,
  player,
  rtl,
  safeArea,
  secondaryButton,
  settingsButton,
  soundOn,
  startParam,
  themeParams,
  viewport,
  type BottomButton,
  type BottomButtonOptions,
  type EventName,
  type Events,
  type HeaderButton,
  type InitOptions,
  type InitResult,
  type Readable,
} from '@lia-labs/sdk';

// @lia-labs/sdk-svelte: Svelte stores over the Lia SDK (Svelte 4 and 5). Everything from
// @lia-labs/sdk is re-exported. The SDK's values become stores with toStore(), and the common ones
// are ready made in `stores`:
//
//   const { language, colorScheme } = stores;   then $language in your markup

export * from '@lia-labs/sdk';

/** Any SDK value as a Svelte store. */
export function toStore<T>(value: Readable<T>): SvelteReadable<T> {
  return readable(value.get(), (set) => {
    set(value.get());
    return value.subscribe(set);
  });
}

/** The SDK's state as Svelte stores. */
export const stores = {
  player: toStore(player),
  mode: toStore(mode),
  language: toStore(language),
  rtl: toStore(rtl),
  colorScheme: toStore(colorScheme),
  themeParams: toStore(themeParams),
  viewport: toStore(viewport),
  safeArea: toStore(safeArea),
  contentSafeArea: toStore(contentSafeArea),
  isFullscreen: toStore(isFullscreen),
  startParam: toStore(startParam),
  soundOn: toStore(soundOn),
  notificationsAllowed: toStore(notificationsAllowed),
  initialized: toStore(initialized),
  banner: toStore(banner),
  nativeAd: toStore(nativeAd),
};

export type InitState = { status: 'loading'; result: null; error: null } | { status: 'ready'; result: InitResult; error: null } | { status: 'error'; result: null; error: Error & { code?: string } };

/** A store that calls init() and tracks it: `$lia.status`, `$lia.result`. */
export function initStore(options?: InitOptions): SvelteReadable<InitState> {
  return readable<InitState>({ status: 'loading', result: null, error: null }, (set) => {
    let live = true;
    init(options).then(
      (result) => live && set({ status: 'ready', result, error: null }),
      (error) => live && set({ status: 'error', result: null, error }),
    );
    return () => {
      live = false;
    };
  });
}

/** Ties a cleanup to the component when called while one is being set up; returns it either way. */
function owned(dispose: () => void): () => void {
  try {
    onDestroy(dispose);
  } catch {
    // Outside a component: the caller calls dispose itself.
  }
  return dispose;
}

/** Listens to one of Lia's events for the component's life. Returns a function that stops. */
export function useLiaEvent<E extends EventName>(event: E, handler: (data: Events[E]) => void): () => void {
  return owned(on(event, handler));
}

function useBottom(button: BottomButton, options: BottomButtonOptions) {
  const control = controlBottomButton(button, options);
  return { update: control.update, dispose: owned(control.dispose) };
}

/** Shows Lia's main button for the component's life. `update(options)` changes it; `dispose()` hides it early. */
export const useMainButton = (options: BottomButtonOptions) => useBottom(mainButton, options);
export const useSecondaryButton = (options: BottomButtonOptions) => useBottom(secondaryButton, options);

function useHeader(button: HeaderButton, onClick: () => void) {
  const control = controlHeaderButton(button, onClick);
  return { update: control.update, dispose: owned(control.dispose) };
}

/** Shows the header's back button for the component's life. */
export const useBackButton = (onBack: () => void) => useHeader(backButton, onBack);
/** Adds Settings to the ⋯ menu for the component's life. */
export const useSettingsButton = (onOpen: () => void) => useHeader(settingsButton, onOpen);

/** Docks a banner for the component's life ("bottom" or "top"; Lia makes your page smaller to fit it). Returns a function that hides it early. */
export const useBannerAd = (position: BannerPosition = 'bottom') => owned(holdBanner(position));

/** Asks before closing for the component's life (or until the returned function is called). */
export const useClosingConfirmation = () => owned(holdClosingConfirmation());
/** Stops a swipe down from closing the sheet for the component's life. */
export const useVerticalSwipesDisabled = () => owned(holdVerticalSwipesOff());
