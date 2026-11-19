// What the Lia app and a web app say to each other: every method the Lia app answers, with its params
// and result, and every event it sends. Kept in step with the Lia app's host (its METHODS list) and the
// script tag SDK (lia-api/src/sdk/script.ts).

export type Mode = 'test' | 'live';
export type ColorScheme = 'light' | 'dark';
export type Display = 'sheet' | 'full' | 'fullscreen';
export type Platform = 'ios' | 'android' | 'unknown';
/** The languages Lia speaks. */
export type Language = 'en' | 'es' | 'pt' | 'fr' | 'tr' | 'ru' | 'vi' | 'id' | 'fil' | 'sw' | 'hi' | 'ar' | 'zh';

/** Lia's colours, with Telegram's theme parameter names. */
export interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
  section_separator_color?: string;
}

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Viewport {
  height: number;
  expanded: boolean;
}

export interface Player {
  /** This person's id in your app (pseudonymous, only for your app). */
  id: string;
  /** Their Lia username, without the @. */
  name: string;
}

/** What `init` answers. */
export interface InitResult {
  capabilities?: { capturePhoto?: boolean; captureVideo?: boolean; readMedia?: boolean; usageAnalytics?: boolean; saveMedia?: boolean; location?: boolean; screen?: boolean; reminders?: boolean; calendar?: boolean; mediaAccess?: boolean };
  player: Player;
  session: string;
  exp: number;
  mode: Mode;
  language: Language;
  rtl: boolean;
  platform: Platform;
  theme: ColorScheme;
  themeParams: ThemeParams;
  display: Display;
  isFullscreen: boolean;
  viewport: Viewport;
  safeArea: Insets;
  contentSafeArea: Insets;
  startParam: string | null;
  link: string | null;
  sound: boolean;
  notifications: { allowed: boolean; available: boolean };
}

export type CapturedMedia = { cancelled: true } | { cancelled: false; id: string; kind: 'photo' | 'video'; mimeType: string; size: number; width: number; height: number; duration: number | null };
/** Where a saved file went: the Photos library (photos, videos), or the phone's save sheet (other files). */
export type SavedMedia = { cancelled: true } | { cancelled: false; to: 'photos' | 'files' };
export type MediaChunk = { base64: string; offset: number; nextOffset: number; eof: boolean; mimeType: string };
export type AdFormat = 'rewarded' | 'rewardedInterstitial' | 'interstitial';
export type AdState = 'loading' | 'showing' | 'closed';
export interface AdResult {
  watched: boolean;
  shown: boolean;
  adId?: string;
  reason?: string;
}
/** Where a banner docks: Lia draws it outside your page, which is made smaller to fit. */
export type BannerPosition = 'top' | 'bottom';
export type BannerState = 'loading' | 'shown' | 'failed' | 'hidden';
/** "card": docked at the bottom edge until closed; "sheet": over your paused app until closed. */
export type NativeAdPlacement = 'card' | 'sheet';
/** Not shown: "no_ad" (none loaded), "too_soon" (native ads are paced), "off" (turned off for your app). */
export type BannerResult = { shown: true; position: BannerPosition; height: number } | { shown: false; reason: string };
export type NativeAdResult = { shown: true; placement: NativeAdPlacement; height?: number } | { shown: false; reason: string };
/** The banner now (Lia.banner). */
export interface BannerInfo {
  visible: boolean;
  position: BannerPosition | null;
  height: number;
}
/** The native ad now (Lia.nativeAd). */
export interface NativeAdInfo {
  visible: boolean;
  placement: NativeAdPlacement | null;
  height: number;
}
export interface Charge {
  chargeId: string;
  productId: string;
}
export type PopupButtonType = 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
export interface PopupButton {
  id: string;
  type: PopupButtonType;
  text: string;
}
export type HapticKind = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'success' | 'warning' | 'error' | 'selection';
export type LiaScreen = 'invite' | 'strides' | 'activity' | 'send' | 'apps' | 'streak' | 'mine' | 'receive';
export type SensorName = 'accelerometer' | 'gyroscope' | 'deviceOrientation';
/** "low": about a kilometre (city, area), the default; "high": GPS. */
export type LocationAccuracy = 'low' | 'high';
/** Where the phone is. With "low", altitude, heading and speed are null. `at` is when it was measured (ms). */
export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  at: number;
}
export interface Reminder {
  id: string;
  title: string;
  at: number;
}
export type ButtonPosition = 'left' | 'right' | 'top' | 'bottom';
export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  me: boolean;
}
export interface Leaderboard {
  top: LeaderboardRow[];
  me: { rank: number; score: number } | null;
}
type Once = { idempotencyKey?: string };

/** Every method: its params and what it answers. */
export interface Methods {
  init: { params: void; result: InitResult };
  ready: { params: void; result: null };
  session: { params: void; result: { session: string; exp: number } };
  analyticsStatus: { params: void; result: { allowed: boolean; available: boolean } };
  analyticsTrack: { params: { name: string; properties?: Record<string, number | boolean> }; result: { sent: boolean } };
  pay: { params: { productId: string } & Once; result: Charge | null };
  charges: { params: void; result: Charge[] };
  showRewardedAd: { params: void; result: AdResult };
  showAd: { params: { format: AdFormat }; result: AdResult };
  showBanner: { params: { position: BannerPosition }; result: BannerResult };
  hideBanner: { params: void; result: { hidden: true } };
  showNativeAd: { params: { placement: NativeAdPlacement }; result: NativeAdResult };
  hideNativeAd: { params: void; result: { hidden: true } };
  confirm: { params: { title: string; body: string; confirm: string; danger: boolean }; result: { confirmed: boolean } };
  showPopup: { params: { title: string; message: string; buttons: PopupButton[] }; result: string | null };
  requestNotifications: { params: void; result: { allowed: boolean } };
  inviteFriend: { params: { startParam: string | null } & Once; result: { invited: boolean } };
  expandable: { params: { enabled: boolean }; result: null };
  submitScore: { params: { score: number } & Once; result: { best: number } };
  leaderboard: { params: void; result: Leaderboard };
  share: { params: { text: string }; result: null };
  haptic: { params: { kind: HapticKind }; result: null };
  toast: { params: { text: string; position: 'top' | 'bottom'; tone: 'info' | 'error' }; result: null };
  expand: { params: void; result: { expanded: true } };
  requestFullscreen: { params: void; result: { isFullscreen: true } };
  exitFullscreen: { params: void; result: { isFullscreen: false } };
  close: { params: void; result: null };
  setColors: { params: { background?: string; header?: string }; result: null };
  closingConfirmation: { params: { enabled: boolean }; result: null };
  verticalSwipes: { params: { enabled: boolean }; result: null };
  bottomButton: {
    params: { type: 'main' | 'secondary'; text: string; color: string | null; textColor: string | null; visible: boolean; active: boolean; progress: boolean; shine: boolean; position: ButtonPosition };
    result: null;
  };
  headerButton: { params: { type: 'back' | 'settings'; visible: boolean }; result: null };
  capturePhoto: { params: Record<string, never>; result: CapturedMedia };
  captureVideo: { params: Record<string, never>; result: CapturedMedia };
  readMedia: { params: { id: string; offset: number }; result: MediaChunk };
  releaseMedia: { params: { id: string }; result: { released: true } };
  saveMedia: { params: { url?: string; data?: string; mimeType?: string; filename?: string }; result: SavedMedia };
  scanQr: { params: { text: string }; result: string | null };
  copyText: { params: { text: string }; result: null };
  readClipboard: { params: void; result: string | null };
  openLink: { params: { url: string; external: boolean }; result: null };
  openLiaLink: { params: { screen: string }; result: { closed: boolean } };
  cloudStorage: {
    params: ({ op: 'set'; key: string; value: string } | { op: 'get' | 'remove'; keys: string[] } | { op: 'keys' }) & Once;
    result: { ok?: true; values?: Record<string, string>; keys?: string[] };
  };
  deviceStorage: { params: { op: 'set'; key: string; value: string } | { op: 'get' | 'remove'; key: string } | { op: 'clear' }; result: string | null | true };
  secureStorage: { params: { op: 'set'; key: string; value: string } | { op: 'get' | 'remove'; key: string } | { op: 'clear' }; result: string | null | true };
  biometricInit: { params: void; result: { available: boolean; type: 'face' | 'finger' | 'unknown' } };
  biometricAuthenticate: { params: { reason: string }; result: { authenticated: boolean } };
  sensor: { params: { name: SensorName; action: 'start'; refreshRate: number } | { name: SensorName; action: 'stop' }; result: true };
  location: { params: { action: 'get' | 'watch'; accuracy: LocationAccuracy } | { action: 'stop' }; result: Position | true };
  screen: {
    params:
      | { action: 'orientation'; value: 'portrait' | 'landscape' | 'any' }
      | { action: 'keepAwake' | 'protect'; value: boolean }
      | { action: 'brightness'; value: number | null };
    result: true;
  };
  mediaAccess: { params: { audio: boolean; video: boolean }; result: true };
  reminders: {
    params: { action: 'schedule'; id: string; title: string; body?: string; at: number; startParam?: string } | { action: 'cancel'; id: string } | { action: 'list' };
    result: { id: string; at: number } | true | Reminder[];
  };
  calendar: { params: { title: string; start: number; end: number; allDay: boolean; location?: string; description?: string; url?: string }; result: { shared: true } };
}
export type MethodName = keyof Methods;
export type ParamsOf<M extends MethodName> = Methods[M]['params'];
export type ResultOf<M extends MethodName> = Methods[M]['result'];

/** Every event the Lia app sends, and its data. */
export interface Events {
  pause: undefined;
  resume: undefined;
  theme: { theme: ThemeParams; colorScheme: ColorScheme };
  viewport: { height: number; expanded: boolean; isStateStable?: boolean };
  fullscreenChanged: { isFullscreen: boolean; contentSafeArea?: Insets };
  languageChanged: { language: Language; rtl: boolean };
  startParam: { startParam: string | null };
  notificationsChanged: { allowed: boolean };
  soundChanged: { on: boolean };
  analyticsChanged: { allowed: boolean; available: boolean };
  charge: Charge;
  ad: { state: AdState; format: AdFormat };
  banner: { state: BannerState; position: BannerPosition; height: number; reason?: string };
  nativeAd: { state: AdState; placement: NativeAdPlacement; height?: number };
  /** A docked ad took or gave back an edge: the safe areas there changed. */
  safeAreaChanged: { safeArea: Insets; contentSafeArea: Insets };
  mainButtonClicked: undefined;
  secondaryButtonClicked: undefined;
  backButtonClicked: undefined;
  settingsButtonClicked: undefined;
  sensor: { name: SensorName; values: Record<string, number> };
  locationChanged: Position;
}
export type EventName = keyof Events;

/** A message from the page to Lia. */
export interface Outgoing {
  lia: 1;
  id: number;
  method: string;
  params: Record<string, unknown>;
}
/** A message from Lia to the page: an answer to a call, or an event. */
export type Incoming = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: { code: string; message?: string } } | { event: string; data?: unknown };
