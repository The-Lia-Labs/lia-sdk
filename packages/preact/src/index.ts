import { useEffect, useRef, useState } from 'preact/hooks';
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
  type InitOptions,
  type InitResult,
  type Readable,
} from '@lia-labs/sdk';

// @lia-labs/sdk-preact: Preact hooks over the Lia SDK (the same names as @lia-labs/sdk-react). Everything from @lia-labs/sdk is re-exported, so
// one import is enough.

export * from '@lia-labs/sdk';

/** Any SDK value as Preact state. */
export function useSignal<T>(value: Readable<T>): T {
  const [current, setCurrent] = useState(value.get);
  useEffect(() => {
    setCurrent(() => value.get());
    return value.subscribe((next) => setCurrent(() => next));
  }, [value]);
  return current;
}

export type InitState = { status: 'loading'; result: null; error: null } | { status: 'ready'; result: InitResult; error: null } | { status: 'error'; result: null; error: Error & { code?: string } };

/** Calls init() once and tracks it. Call `ready()` once your first screen is drawn. */
export function useInit(options?: InitOptions): InitState {
  const [state, setState] = useState<InitState>({ status: 'loading', result: null, error: null });
  useEffect(() => {
    let live = true;
    init(options).then(
      (result) => live && setState({ status: 'ready', result, error: null }),
      (error) => live && setState({ status: 'error', result: null, error }),
    );
    return () => {
      live = false;
    };
    // init() answers once per page; options only matter the first time.
  }, []);
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

/** Docks a banner while mounted ("bottom" or "top"; null or false: none). Lia makes your page smaller to fit it. */
export function useBannerAd(position: BannerPosition | null | false | undefined = 'bottom'): void {
  useEffect(() => (position ? holdBanner(position) : undefined), [position]);
}

/** Listens to one of Lia's events while the component is mounted (the latest handler is always used). */
export function useLiaEvent<E extends EventName>(event: E, handler: (data: Events[E]) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => on(event, (data: Events[E]) => ref.current(data)), [event]);
}

function useBottom(button: BottomButton, options: BottomButtonOptions | null | false | undefined) {
  const control = useRef<Control<BottomButtonOptions> | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const shown = Boolean(options);
  useEffect(() => {
    if (!shown) return;
    const c = controlBottomButton(button, { ...(latest.current as BottomButtonOptions), onClick: () => (latest.current || undefined)?.onClick?.() });
    control.current = c;
    return () => {
      control.current = null;
      c.dispose();
    };
  }, [button, shown]);
  const { onClick: _onClick, ...params } = options || ({} as BottomButtonOptions);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (control.current && latest.current) control.current.update({ ...latest.current, onClick: () => (latest.current || undefined)?.onClick?.() });
  }, [key]);
}

/** Shows Lia's main button while mounted (pass null or false to hide it): `{ text, onClick, isActive, isProgressVisible, color... }`. */
export const useMainButton = (options: BottomButtonOptions | null | false | undefined) => useBottom(mainButton, options);
/** The secondary bottom button, the same way. */
export const useSecondaryButton = (options: BottomButtonOptions | null | false | undefined) => useBottom(secondaryButton, options);

function useHeader(button: typeof backButton, onClick: (() => void) | null | false | undefined) {
  const latest = useRef(onClick);
  latest.current = onClick;
  const shown = Boolean(onClick);
  useEffect(() => {
    if (!shown) return;
    const c = controlHeaderButton(button, () => (latest.current || undefined)?.());
    return () => c.dispose();
  }, [button, shown]);
}

/** Shows the header's back button while mounted, calling onBack when pressed (null hides it). */
export const useBackButton = (onBack: (() => void) | null | false | undefined) => useHeader(backButton, onBack);
/** Adds Settings to the ⋯ menu while mounted. */
export const useSettingsButton = (onOpen: (() => void) | null | false | undefined) => useHeader(settingsButton, onOpen);

/** Asks before closing while `enabled` (a game under way, unsaved work). */
export function useClosingConfirmation(enabled = true): void {
  useEffect(() => (enabled ? holdClosingConfirmation() : undefined), [enabled]);
}

/** Stops a swipe down from closing the sheet while `disabled` (games that use swipes). */
export function useVerticalSwipesDisabled(disabled = true): void {
  useEffect(() => (disabled ? holdVerticalSwipesOff() : undefined), [disabled]);
}
