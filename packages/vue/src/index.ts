import { getCurrentScope, isRef, onScopeDispose, readonly, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
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

// @lia-labs/sdk-vue: Vue composables over the Lia SDK. Everything from @lia-labs/sdk is re-exported.
// Each composable stops listening when its component (or effect scope) goes away.

export * from '@lia-labs/sdk';

const cleanup = (fn: () => void) => {
  if (getCurrentScope()) onScopeDispose(fn);
};

/** Any SDK value as a read-only ref. */
export function useSignal<T>(value: Readable<T>): Readonly<Ref<T>> {
  const ref = shallowRef(value.get());
  cleanup(value.subscribe((next) => (ref.value = next)));
  return readonly(ref) as Readonly<Ref<T>>;
}

export interface InitState {
  status: Ref<'loading' | 'ready' | 'error'>;
  result: Ref<InitResult | null>;
  error: Ref<(Error & { code?: string }) | null>;
}

/** Calls init() once and tracks it. */
export function useInit(options?: InitOptions): InitState {
  const status = shallowRef<'loading' | 'ready' | 'error'>('loading');
  const result = shallowRef<InitResult | null>(null);
  const error = shallowRef<(Error & { code?: string }) | null>(null);
  init(options).then(
    (r) => {
      result.value = r;
      status.value = 'ready';
    },
    (e) => {
      error.value = e;
      status.value = 'error';
    },
  );
  return { status, result, error };
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

/** Docks a banner for the component's life ("bottom" or "top"; a ref or getter, null hides it). Lia makes your page smaller to fit it. */
export function useBannerAd(position: MaybeRefOrGetter<BannerPosition | null | false | undefined> = 'bottom'): void {
  let release: (() => void) | null = null;
  const stop = watch(
    () => toValue(position) || null,
    (at) => {
      release?.();
      release = at ? holdBanner(at) : null;
    },
    { immediate: true },
  );
  cleanup(() => {
    stop();
    release?.();
  });
}

/** Listens to one of Lia's events for the component's life. */
export function useLiaEvent<E extends EventName>(event: E, handler: (data: Events[E]) => void): void {
  cleanup(on(event, handler));
}

function useBottom(button: BottomButton, options: MaybeRefOrGetter<BottomButtonOptions | null | false | undefined>) {
  let control: ReturnType<typeof controlBottomButton> | null = null;
  const stop = watch(
    () => {
      const o = toValue(options);
      return o ? { ...o } : null;
    },
    (o) => {
      if (!o) {
        control?.dispose();
        control = null;
      } else if (control) control.update(o);
      else control = controlBottomButton(button, o);
    },
    { immediate: true, deep: true },
  );
  cleanup(() => {
    stop();
    control?.dispose();
  });
}

/** Shows Lia's main button with these options (a ref, getter or object; null hides it). */
export const useMainButton = (options: MaybeRefOrGetter<BottomButtonOptions | null | false | undefined>) => useBottom(mainButton, options);
export const useSecondaryButton = (options: MaybeRefOrGetter<BottomButtonOptions | null | false | undefined>) => useBottom(secondaryButton, options);

type Handler = (() => void) | null | false | undefined;

// A handler is a function itself, so it comes as a function or a ref to one (never a getter).
function useHeader(button: HeaderButton, onClick: Handler | Ref<Handler>) {
  let control: ReturnType<typeof controlHeaderButton> | null = null;
  const stop = watch(
    () => (isRef(onClick) ? onClick.value : onClick),
    (fn) => {
      if (!fn) {
        control?.dispose();
        control = null;
      } else if (control) control.update(fn);
      else control = controlHeaderButton(button, fn);
    },
    { immediate: true },
  );
  cleanup(() => {
    stop();
    control?.dispose();
  });
}

/** Shows the header's back button, calling onBack when pressed (a function or a ref to one; null hides it). */
export const useBackButton = (onBack: Handler | Ref<Handler>) => useHeader(backButton, onBack);
/** Adds Settings to the ⋯ menu. */
export const useSettingsButton = (onOpen: Handler | Ref<Handler>) => useHeader(settingsButton, onOpen);

function useHold(enabled: MaybeRefOrGetter<boolean>, hold: () => () => void) {
  let release: (() => void) | null = null;
  const stop = watch(
    () => Boolean(toValue(enabled)),
    (on) => {
      if (on && !release) release = hold();
      if (!on && release) {
        release();
        release = null;
      }
    },
    { immediate: true },
  );
  cleanup(() => {
    stop();
    release?.();
  });
}

/** Asks before closing while `enabled`. */
export const useClosingConfirmation = (enabled: MaybeRefOrGetter<boolean> = true) => useHold(enabled, holdClosingConfirmation);
/** Stops a swipe down from closing the sheet while `disabled`. */
export const useVerticalSwipesDisabled = (disabled: MaybeRefOrGetter<boolean> = true) => useHold(disabled, holdVerticalSwipesOff);
