import { installPageInteractions } from './page-interactions';
import { on, request, type BannerInfo, type NativeAdInfo, type ColorScheme, type Display, type InitResult, type Insets, type Language, type Mode, type Platform, type Player, type ThemeParams, type Viewport } from '@lia-labs/bridge';
import { readonly, shallowEqual, signal, type Readable } from './signals';

// Who the player is and how the app is shown, kept current from Lia's events after init().

const ZERO: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

export const $player = /* @__PURE__ */ signal<Player | null>(null, shallowEqual);
export const $mode = /* @__PURE__ */ signal<Mode | null>(null);
export const $language = /* @__PURE__ */ signal<Language>('en');
export const $rtl = /* @__PURE__ */ signal(false);
export const $platform = /* @__PURE__ */ signal<Platform>('unknown');
export const $colorScheme = /* @__PURE__ */ signal<ColorScheme>('light');
export const $themeParams = /* @__PURE__ */ signal<ThemeParams>({}, shallowEqual);
export const $viewport = /* @__PURE__ */ signal<Viewport>({ height: typeof window === 'undefined' ? 0 : window.innerHeight, expanded: false }, shallowEqual);
export const $safeArea = /* @__PURE__ */ signal<Insets>(ZERO, shallowEqual);
export const $contentSafeArea = /* @__PURE__ */ signal<Insets>(ZERO, shallowEqual);
export const $display = /* @__PURE__ */ signal<Display>('sheet');
export const $isFullscreen = /* @__PURE__ */ signal(false);
export const $startParam = /* @__PURE__ */ signal<string | null>(null);
export const $soundOn = /* @__PURE__ */ signal(true);
export const $notificationsAllowed = /* @__PURE__ */ signal(false);
export const $notificationsAvailable = /* @__PURE__ */ signal(false);
export const $link = /* @__PURE__ */ signal<string | null>(null);
export const $initialized = /* @__PURE__ */ signal(false);
export const $banner = /* @__PURE__ */ signal<BannerInfo>({ visible: false, position: null, height: 0 }, shallowEqual);
export const $nativeAd = /* @__PURE__ */ signal<NativeAdInfo>({ visible: false, placement: null, height: 0 }, shallowEqual);

/** The player: `{ id, name }` (null before init). */
export const player: Readable<Player | null> = /* @__PURE__ */ readonly($player);
/** "test" or "live" (null before init). */
export const mode: Readable<Mode | null> = /* @__PURE__ */ readonly($mode);
/** The person's language in Lia. */
export const language: Readable<Language> = /* @__PURE__ */ readonly($language);
/** Whether that language reads right to left. */
export const rtl: Readable<boolean> = /* @__PURE__ */ readonly($rtl);
export const platform: Readable<Platform> = /* @__PURE__ */ readonly($platform);
/** "light" or "dark". */
export const colorScheme: Readable<ColorScheme> = /* @__PURE__ */ readonly($colorScheme);
/** Lia's colours (bg_color, text_color...). */
export const themeParams: Readable<ThemeParams> = /* @__PURE__ */ readonly($themeParams);
/** `{ height, expanded }`: the page's height in px, and whether a sheet is at full height. */
export const viewport: Readable<Viewport> = /* @__PURE__ */ readonly($viewport);
/** The phone's safe area, in px. */
export const safeArea: Readable<Insets> = /* @__PURE__ */ readonly($safeArea);
/** Also clear of Lia's floating controls in fullscreen, in px. */
export const contentSafeArea: Readable<Insets> = /* @__PURE__ */ readonly($contentSafeArea);
/** How the app opened: "sheet", "full" or "fullscreen". */
export const display: Readable<Display> = /* @__PURE__ */ readonly($display);
export const isFullscreen: Readable<boolean> = /* @__PURE__ */ readonly($isFullscreen);
/** What the app was opened with (an invite, a link, a notification), kept current while it's open. */
export const startParam: Readable<string | null> = /* @__PURE__ */ readonly($startParam);
/** Whether the person wants your app's sounds. */
export const soundOn: Readable<boolean> = /* @__PURE__ */ readonly($soundOn);
/** Whether this person lets your app send notifications. */
export const notificationsAllowed: Readable<boolean> = /* @__PURE__ */ readonly($notificationsAllowed);
/** Whether your app may ask for notifications at all. */
export const notificationsAvailable: Readable<boolean> = /* @__PURE__ */ readonly($notificationsAvailable);
/** The banner Lia docks for you: `{ visible, position, height }` (showBanner). */
export const banner: Readable<BannerInfo> = /* @__PURE__ */ readonly($banner);
/** The native ad Lia shows for you: `{ visible, placement, height }` (showNativeAd). */
export const nativeAd: Readable<NativeAdInfo> = /* @__PURE__ */ readonly($nativeAd);
/** Whether init() has answered. */
export const initialized: Readable<boolean> = /* @__PURE__ */ readonly($initialized);

export interface InitOptions {
  /** Keep --lia-* CSS variables on the page's root current (true by default). */
  cssVars?: boolean;
  /** Set the page's lang and dir from the person's language (true by default). */
  documentLanguage?: boolean;
}

let started: Promise<InitResult> | null = null;
let wired = false;

function wire(documentLanguage: boolean) {
  if (wired) return;
  wired = true;
  on('theme', (d) => {
    if (d?.theme) $themeParams.set(d.theme);
    if (d?.colorScheme) $colorScheme.set(d.colorScheme);
  });
  on('viewport', (d) => d && $viewport.set({ height: d.height, expanded: Boolean(d.expanded) }));
  on('languageChanged', (d) => {
    if (!d) return;
    $language.set(d.language);
    $rtl.set(Boolean(d.rtl));
    if (documentLanguage) applyDocumentLanguage();
  });
  on('notificationsChanged', (d) => d && $notificationsAllowed.set(Boolean(d.allowed)));
  on('startParam', (d) => d && $startParam.set(d.startParam || null));
  on('soundChanged', (d) => d && $soundOn.set(d.on !== false));
  on('banner', (d) => {
    if (!d) return;
    const shown = d.state === 'shown';
    $banner.set({ visible: shown, position: shown ? d.position : null, height: shown ? d.height || 0 : 0 });
  });
  on('nativeAd', (d) => {
    if (!d) return;
    const showing = d.state === 'showing';
    $nativeAd.set({ visible: showing, placement: showing ? d.placement : null, height: showing ? d.height || 0 : 0 });
  });
  // A docked ad takes an edge: Lia pads around it, so the page's safe area there changes.
  on('safeAreaChanged', (d) => {
    if (!d) return;
    if (d.safeArea) $safeArea.set(d.safeArea);
    if (d.contentSafeArea) $contentSafeArea.set(d.contentSafeArea);
  });
  on('fullscreenChanged', (d) => {
    if (!d) return;
    $isFullscreen.set(Boolean(d.isFullscreen));
    if (d.contentSafeArea) $contentSafeArea.set(d.contentSafeArea);
  });
}

function applyDocumentLanguage() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = $language.get();
  document.documentElement.dir = $rtl.get() ? 'rtl' : 'ltr';
}

/**
 * Call first: who the player is, a session for your server, their language and theme. Safe to call
 * again (it answers with the first result). Rejects with "not_in_lia" outside Lia (see mockLia).
 */
export function init(options: InitOptions = {}): Promise<InitResult> {
  installPageInteractions();
  if (started) return started;
  const documentLanguage = options.documentLanguage !== false;
  started = request('init').then(
    (me) => {
      wire(documentLanguage);
      $player.set(me.player);
      $mode.set(me.mode);
      $language.set(me.language || 'en');
      $rtl.set(Boolean(me.rtl));
      $platform.set(me.platform || 'unknown');
      $colorScheme.set(me.theme === 'dark' ? 'dark' : 'light');
      $themeParams.set(me.themeParams || {});
      if (me.viewport) $viewport.set(me.viewport);
      $safeArea.set(me.safeArea || ZERO);
      $contentSafeArea.set(me.contentSafeArea || ZERO);
      $display.set(me.display || 'sheet');
      $isFullscreen.set(Boolean(me.isFullscreen));
      $startParam.set(me.startParam || null);
      $link.set(me.link || null);
      $soundOn.set(me.sound !== false);
      $notificationsAllowed.set(Boolean(me.notifications?.allowed));
      $notificationsAvailable.set(Boolean(me.notifications?.available));
      if (documentLanguage) applyDocumentLanguage();
      if (options.cssVars !== false) bindCssVars();
      $initialized.set(true);
      return me;
    },
    (error) => {
      started = null;
      throw error;
    },
  );
  return started;
}

let unbindCss: (() => void) | null = null;

/**
 * Keeps Lia's theme, the viewport and the safe areas on the page's root as CSS variables, the same
 * names as the script tag SDK: --lia-bg-color..., --lia-color-scheme, --lia-viewport-height,
 * --lia-safe-area-inset-*, --lia-content-safe-area-inset-*, --lia-banner-height. init() does this for you. Returns a
 * function that stops keeping them current.
 */
export function bindCssVars(): () => void {
  if (unbindCss || typeof document === 'undefined') return unbindCss ?? (() => {});
  const root = document.documentElement;
  const apply = () => {
    const theme = $themeParams.get() as Record<string, string | undefined>;
    Object.keys(theme).forEach((k) => theme[k] && root.style.setProperty(`--lia-${k.replace(/_/g, '-')}`, theme[k]!));
    root.style.setProperty('--lia-color-scheme', $colorScheme.get());
    root.style.setProperty('--lia-viewport-height', `${$viewport.get().height}px`);
    root.style.setProperty('--lia-banner-height', `${$banner.get().visible ? $banner.get().height : 0}px`);
    (['top', 'bottom', 'left', 'right'] as const).forEach((side) => {
      root.style.setProperty(`--lia-safe-area-inset-${side}`, `${$safeArea.get()[side] || 0}px`);
      root.style.setProperty(`--lia-content-safe-area-inset-${side}`, `${$contentSafeArea.get()[side] || 0}px`);
    });
  };
  apply();
  const stops = [$themeParams, $colorScheme, $viewport, $safeArea, $contentSafeArea, $banner].map((s) => (s as Readable<unknown>).subscribe(apply));
  unbindCss = () => {
    stops.forEach((stop) => stop());
    unbindCss = null;
  };
  return unbindCss;
}

/** For tests: back to before init(). */
export function resetStateForTests() {
  started = null;
  wired = false;
  unbindCss?.();
  $initialized.set(false);
  $player.set(null);
  $mode.set(null);
  $link.set(null);
  $startParam.set(null);
}
