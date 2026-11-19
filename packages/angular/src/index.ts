import { DestroyRef, inject, signal, type Signal } from '@angular/core';
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
  type Control,
  type EventName,
  type Events,
  type HeaderButton,
  type InitOptions,
  type InitResult,
  type Readable,
} from '@lia-labs/sdk';

// @lia-labs/sdk-angular: Angular signals over the Lia SDK (Angular 17 and later). Everything from
// @lia-labs/sdk is re-exported. The inject* functions run in an injection context (a component's
// constructor or field initializer, or runInInjectionContext) and clean up with it.

export * from '@lia-labs/sdk';

const onDestroy = (fn: () => void) => inject(DestroyRef).onDestroy(fn);

/** Any SDK value as a read-only Angular signal, for the injection context's life. */
export function toLiaSignal<T>(value: Readable<T>): Signal<T> {
  const s = signal(value.get());
  onDestroy(value.subscribe((next) => s.set(next)));
  return s.asReadonly();
}

export type InitState = { status: 'loading'; result: null; error: null } | { status: 'ready'; result: InitResult; error: null } | { status: 'error'; result: null; error: Error & { code?: string } };

/** Calls init() once and tracks it as a signal. */
export function injectInit(options?: InitOptions): Signal<InitState> {
  const state = signal<InitState>({ status: 'loading', result: null, error: null });
  let live = true;
  onDestroy(() => (live = false));
  init(options).then(
    (result) => live && state.set({ status: 'ready', result, error: null }),
    (error) => live && state.set({ status: 'error', result: null, error }),
  );
  return state.asReadonly();
}

export const injectPlayer = () => toLiaSignal(player);
export const injectMode = () => toLiaSignal(mode);
export const injectLanguage = () => toLiaSignal(language);
export const injectRtl = () => toLiaSignal(rtl);
export const injectColorScheme = () => toLiaSignal(colorScheme);
export const injectThemeParams = () => toLiaSignal(themeParams);
export const injectViewport = () => toLiaSignal(viewport);
export const injectSafeArea = () => toLiaSignal(safeArea);
export const injectContentSafeArea = () => toLiaSignal(contentSafeArea);
export const injectIsFullscreen = () => toLiaSignal(isFullscreen);
export const injectStartParam = () => toLiaSignal(startParam);
export const injectSoundOn = () => toLiaSignal(soundOn);
export const injectNotificationsAllowed = () => toLiaSignal(notificationsAllowed);
/** The banner Lia docks for you: `{ visible, position, height }`. */
export const injectBanner = () => toLiaSignal(banner);
/** The native ad Lia shows for you: `{ visible, placement, height }`. */
export const injectNativeAd = () => toLiaSignal(nativeAd);
/** Docks a banner for the component's life ("bottom" or "top"; Lia makes your page smaller to fit it). */
export const injectBannerAd = (position: BannerPosition = 'bottom') => onDestroy(holdBanner(position));

/** Listens to one of Lia's events for the injection context's life. */
export function injectLiaEvent<E extends EventName>(event: E, handler: (data: Events[E]) => void): void {
  onDestroy(on(event, handler));
}

function injectBottom(button: BottomButton, options: BottomButtonOptions): Control<BottomButtonOptions> {
  const control = controlBottomButton(button, options);
  onDestroy(control.dispose);
  return control;
}

/** Shows Lia's main button for the component's life; `update(options)` changes it. */
export const injectMainButton = (options: BottomButtonOptions) => injectBottom(mainButton, options);
export const injectSecondaryButton = (options: BottomButtonOptions) => injectBottom(secondaryButton, options);

function injectHeader(button: HeaderButton, onClick: () => void): Control<() => void> {
  const control = controlHeaderButton(button, onClick);
  onDestroy(control.dispose);
  return control;
}

/** Shows the header's back button for the component's life. */
export const injectBackButton = (onBack: () => void) => injectHeader(backButton, onBack);
/** Adds Settings to the ⋯ menu for the component's life. */
export const injectSettingsButton = (onOpen: () => void) => injectHeader(settingsButton, onOpen);

/** Asks before closing for the component's life. */
export const injectClosingConfirmation = () => onDestroy(holdClosingConfirmation());
/** Stops a swipe down from closing the sheet for the component's life. */
export const injectVerticalSwipesDisabled = () => onDestroy(holdVerticalSwipesOff());
