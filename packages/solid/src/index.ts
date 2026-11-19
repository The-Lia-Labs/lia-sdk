import { createEffect, createSignal, getOwner, onCleanup, type Accessor } from 'solid-js';
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
  type EventName,
  type Events,
  type HeaderButton,
  type InitOptions,
  type InitResult,
  type Readable,
} from '@lia-labs/sdk';

// @lia-labs/sdk-solid: Solid primitives over the Lia SDK. Everything from @lia-labs/sdk is re-exported.
// Each primitive cleans up with its owner (a component or a root).

export * from '@lia-labs/sdk';

const cleanup = (fn: () => void) => {
  if (getOwner()) onCleanup(fn);
};

/** Any SDK value as a Solid accessor. */
export function useSignal<T>(value: Readable<T>): Accessor<T> {
  const [get, set] = createSignal<T>(value.get(), { equals: false });
  cleanup(value.subscribe((next) => set(() => next)));
  return get;
}

export type InitState = { status: 'loading'; result: null; error: null } | { status: 'ready'; result: InitResult; error: null } | { status: 'error'; result: null; error: Error & { code?: string } };

/** Calls init() once and tracks it. */
export function createInit(options?: InitOptions): Accessor<InitState> {
  const [state, setState] = createSignal<InitState>({ status: 'loading', result: null, error: null });
  init(options).then(
    (result) => setState({ status: 'ready', result, error: null }),
    (error) => setState({ status: 'error', result: null, error }),
  );
  return state;
}

export const usePlayer = () => useSignal(player);
export const useMode = () => useSignal(mode);
export const useLanguage = () => useSignal(language);
export const useRtl = () => useSignal(rtl);
export const useColorScheme = () => useSignal(colorScheme);
export const useThemeParams = () => useSignal(themeParams);
export const useViewport = () => useSignal(viewport);
export const useSafeArea = () => useSignal(safeArea);
export const useContentSafeArea = () => useSignal(contentSafeArea);
export const useIsFullscreen = () => useSignal(isFullscreen);
export const useStartParam = () => useSignal(startParam);
export const useSoundOn = () => useSignal(soundOn);
export const useNotificationsAllowed = () => useSignal(notificationsAllowed);
/** The banner Lia docks for you: `{ visible, position, height }`. */
export const useBanner = () => useSignal(banner);
/** The native ad Lia shows for you: `{ visible, placement, height }`. */
export const useNativeAd = () => useSignal(nativeAd);

type Position = BannerPosition | null | false | undefined;

/** Docks a banner for the owner's life ("bottom" or "top", or an accessor; null hides it). Lia makes your page smaller to fit it. */
export function createBannerAd(position: Position | Accessor<Position> = 'bottom'): void {
  let release: (() => void) | null = null;
  let at: Position = null;
  createEffect(() => {
    const next = (typeof position === 'function' ? position() : position) || null;
    if (next === at) return;
    at = next;
    release?.();
    release = next ? holdBanner(next) : null;
  });
  cleanup(() => release?.());
}

/** Listens to one of Lia's events for the owner's life. */
export function createLiaEvent<E extends EventName>(event: E, handler: (data: Events[E]) => void): void {
  cleanup(on(event, handler));
}

type Options = BottomButtonOptions | null | false | undefined;

function createBottom(button: BottomButton, options: Options | Accessor<Options>) {
  let control: ReturnType<typeof controlBottomButton> | null = null;
  const read = () => (typeof options === 'function' ? options() : options);
  createEffect(() => {
    const o = read();
    if (!o) {
      control?.dispose();
      control = null;
    } else if (control) control.update({ ...o });
    else control = controlBottomButton(button, { ...o });
  });
  cleanup(() => control?.dispose());
}

/** Shows Lia's main button with these options (an object or an accessor; null hides it). */
export const createMainButton = (options: Options | Accessor<Options>) => createBottom(mainButton, options);
export const createSecondaryButton = (options: Options | Accessor<Options>) => createBottom(secondaryButton, options);

function createHeader(button: HeaderButton, onClick: () => void) {
  cleanup(controlHeaderButton(button, onClick).dispose);
}

/** Shows the header's back button for the owner's life. */
export const createBackButton = (onBack: () => void) => createHeader(backButton, onBack);
/** Adds Settings to the ⋯ menu for the owner's life. */
export const createSettingsButton = (onOpen: () => void) => createHeader(settingsButton, onOpen);

/** Asks before closing for the owner's life. */
export const createClosingConfirmation = () => cleanup(holdClosingConfirmation());
/** Stops a swipe down from closing the sheet for the owner's life. */
export const createVerticalSwipesDisabled = () => cleanup(holdVerticalSwipesOff());
