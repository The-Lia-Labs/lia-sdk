import { LiaError, on, request, send, type AdFormat, type AdResult, type AdState, type BannerPosition, type BannerResult, type NativeAdPlacement, type NativeAdResult, type Charge, type Events, type HapticKind, type Leaderboard, type PopupButton, type PopupButtonType, type LocationAccuracy, type Position, type Reminder } from '@lia-labs/bridge';
import { $isFullscreen, $link, $notificationsAllowed, $viewport } from './state';
import { color, once, startParam as checkStartParam, text } from './validate';

type Once = { idempotencyKey?: string };

// ---- Lifecycle ----

/** Your page is drawn: Lia takes its loader away. */
export function ready(): void {
  send('ready');
}

/** A fresh session token for your server (15 minutes): `{ session, exp }`. */
export function session(): Promise<{ session: string; exp: number }> {
  return request('session');
}

/** Closes the app. */
export function close(): Promise<null> {
  return request('close');
}

/** Hears Lia pausing your app (the background, or one of its screens over it). */
export function onPause(listener: () => void): () => void {
  return on('pause', listener);
}

/** Hears your app coming back. */
export function onResume(listener: () => void): () => void {
  return on('resume', listener);
}

// ---- Payments ----

/** Lia's pay sheet for one of your products: `{ chargeId, productId }` once paid; rejects with "cancelled" if not. */
export async function pay(productId: string, options?: Once): Promise<Charge> {
  const result = await request('pay', once(options, { productId: text(productId, 'productId', 64) }));
  // A reload while paying sends the charge as an event instead (onCharge).
  if (!result) throw new LiaError('reloaded', 'The page reloaded while paying: the charge comes through onCharge.', 'pay');
  return result;
}

/** Paid charges your server hasn't delivered yet, oldest first (up to 50). */
export function charges(): Promise<Charge[]> {
  return request('charges');
}

/** Hears a charge confirmed while no pay() was waiting (after a reload). */
export function onCharge(listener: (charge: Charge) => void): () => void {
  return on('charge', listener);
}

// ---- Ads ----

export interface AdOptions {
  format?: AdFormat;
  /** Hears each stage: "loading", "showing", "closed". */
  onState?: (state: AdState) => void;
}

/** A full screen ad, played by Lia. Resolves once it's closed: `{ watched, shown, adId?, reason? }`. */
export async function showAd(options: AdOptions = {}): Promise<AdResult> {
  const format = options.format ?? 'rewarded';
  if (!['rewarded', 'rewardedInterstitial', 'interstitial'].includes(format)) throw new LiaError('bad_format', 'rewarded, rewardedInterstitial or interstitial.');
  const stop = options.onState ? on('ad', (d: Events['ad']) => options.onState!(d?.state)) : null;
  try {
    return await request('showAd', { format });
  } finally {
    stop?.();
  }
}

export const showRewardedAd = (options: Omit<AdOptions, 'format'> = {}) => showAd({ ...options, format: 'rewarded' });
export const showRewardedInterstitialAd = (options: Omit<AdOptions, 'format'> = {}) => showAd({ ...options, format: 'rewardedInterstitial' });
export const showInterstitialAd = (options: Omit<AdOptions, 'format'> = {}) => showAd({ ...options, format: 'interstitial' });

/** Hears every ad's stages. */
export function onAd(listener: (data: Events['ad']) => void): () => void {
  return on('ad', listener);
}

// Banner and native ads. AdMob can't draw inside a web page, so Lia draws them natively, outside your
// page: a docked ad makes the page smaller instead of covering it, and the native sheet comes up over
// your paused app. None of them can sit inside your scrolling content.

/**
 * A banner docked at the screen's edge ("bottom" by default, or "top"), drawn by Lia: your page gets
 * smaller to fit it. Resolves once it's shown `{ shown: true, position, height }`, or
 * `{ shown: false, reason: "no_ad" | "off" }`. AdMob refreshes it while it's up.
 */
export async function showBanner(options: { position?: BannerPosition } = {}): Promise<BannerResult> {
  const position = options.position ?? 'bottom';
  if (position !== 'top' && position !== 'bottom') throw new LiaError('bad_position', 'top or bottom.');
  return request('showBanner', { position });
}

/** Takes the banner away (your page gets its room back). */
export function hideBanner(): Promise<{ hidden: true }> {
  return request('hideBanner');
}

/** Hears the banner load, show, fail or hide. */
export function onBanner(listener: (data: Events['banner']) => void): () => void {
  return on('banner', listener);
}

/** Shows a banner until the returned function is called (the framework packages build on this). */
export function holdBanner(position: BannerPosition = 'bottom'): () => void {
  let released = false;
  showBanner({ position })
    .then(() => {
      if (released) hideBanner().catch(() => {});
    })
    .catch(() => {});
  return () => {
    if (released) return;
    released = true;
    hideBanner().catch(() => {});
  };
}

/**
 * A native ad in Lia's own look, for a pause in your app (a round's end, a results screen). "card" (the
 * default) docks a compact card at the bottom edge, your page smaller to fit, until the person closes
 * it or you call hideNativeAd(); resolves once it's up. "sheet" slides a larger one over your paused
 * app; resolves once it's closed. Paced by Lia: `{ shown: false, reason: "too_soon" }` when it isn't
 * its turn ("no_ad" and "off" as for banners).
 */
export async function showNativeAd(options: { placement?: NativeAdPlacement } = {}): Promise<NativeAdResult> {
  const placement = options.placement ?? 'card';
  if (placement !== 'card' && placement !== 'sheet') throw new LiaError('bad_placement', 'card or sheet.');
  return request('showNativeAd', { placement });
}

/** Takes the native card away. */
export function hideNativeAd(): Promise<{ hidden: true }> {
  return request('hideNativeAd');
}

/** Hears a native ad load, show and close. */
export function onNativeAd(listener: (data: Events['nativeAd']) => void): () => void {
  return on('nativeAd', listener);
}

// ---- Notifications and invites ----

/** Asks the person, in Lia's own sheet, to allow your app's notifications: `{ allowed }`. */
export async function requestNotifications(): Promise<{ allowed: boolean }> {
  const result = await request('requestNotifications');
  $notificationsAllowed.set(Boolean(result?.allowed));
  return result;
}

/** Lia's friend picker: friends get a card that opens your app with startParam. `{ invited }`. */
export async function inviteFriend(options: { startParam?: string | null } & Once = {}): Promise<{ invited: boolean }> {
  const start = options.startParam === undefined || options.startParam === null ? null : checkStartParam(options.startParam);
  return request('inviteFriend', once(options, { startParam: start }));
}

/** The branded launch link supplied by Lia, with optional startParam. Call after init(); do not hardcode a hostname. */
export function inviteLink(param?: string | null): string {
  const link = $link.get();
  if (!link) throw new LiaError('not_ready', 'Call init() first.');
  return param === undefined || param === null ? link : `${link}?start=${checkStartParam(param)}`;
}

/** The phone's share sheet with your text (up to 500 characters). */
export async function share(message: string): Promise<null> {
  return request('share', { text: text(message, 'text', 500) });
}

// ---- Dialogs ----

/** A yes or no question in Lia's own sheet: `{ confirmed }`. */
export async function confirm(options: { title: string; body?: string; confirm?: string; danger?: boolean }): Promise<{ confirmed: boolean }> {
  const o = options || ({} as typeof options);
  return request('confirm', { title: text(o.title, 'title', 60), body: text(o.body, 'body', 300, true), confirm: text(o.confirm, 'confirm', 24, true), danger: o.danger === true });
}

export interface PopupOptions {
  title?: string;
  message: string;
  buttons?: { id?: string; type?: PopupButtonType; text?: string }[];
}

/** Up to three buttons: the pressed button's id, or null. */
export async function showPopup(options: PopupOptions): Promise<string | null> {
  const p = options || ({} as PopupOptions);
  const list = p.buttons === undefined ? [{ id: '', type: 'close' as const }] : p.buttons;
  if (!Array.isArray(list) || list.length < 1 || list.length > 3) throw new LiaError('bad_buttons', '1 to 3 buttons.');
  const buttons: PopupButton[] = list.map((b) => {
    const type = b.type || 'default';
    if (!['default', 'ok', 'close', 'cancel', 'destructive'].includes(type)) throw new LiaError('bad_button_type', type);
    return { id: text(b.id === undefined ? '' : String(b.id), 'id', 64, true), type, text: type === 'default' || type === 'destructive' ? text(b.text, 'text', 64) : text(b.text, 'text', 64, true) };
  });
  return request('showPopup', { title: text(p.title, 'title', 64, true), message: text(p.message, 'message', 256), buttons });
}

/** A message with one Close button; settles when it's closed. */
export async function showAlert(message: string): Promise<void> {
  await showPopup({ message });
}

/** OK and Cancel: true when OK. */
export async function showConfirm(message: string): Promise<boolean> {
  return (await showPopup({ message, buttons: [{ id: 'ok', type: 'ok' }, { id: 'cancel', type: 'cancel' }] })) === 'ok';
}

/** A short message in Lia's own style. */
export async function toast(message: string, options: { position?: 'top' | 'bottom'; tone?: 'info' | 'error' } = {}): Promise<null> {
  if (options.position !== undefined && options.position !== 'top' && options.position !== 'bottom') throw new LiaError('bad_position', 'position is top or bottom.');
  return request('toast', { text: text(message, 'text', 140), position: options.position || 'bottom', tone: options.tone === 'error' ? 'error' : 'info' });
}

// ---- Layout and colours ----

/** As a sheet: take the full height. */
export async function expand(): Promise<{ expanded: true }> {
  const result = await request('expand');
  $viewport.set({ ...$viewport.get(), expanded: true });
  return result;
}

/** Edge to edge, with only Lia's floating Close and ⋯ over your page. */
export async function requestFullscreen(): Promise<{ isFullscreen: true }> {
  const result = await request('requestFullscreen');
  $isFullscreen.set(true);
  return result;
}

export async function exitFullscreen(): Promise<{ isFullscreen: false }> {
  const result = await request('exitFullscreen');
  $isFullscreen.set(false);
  return result;
}

/** As a sheet: whether pulling it up takes the whole screen. */
export const enableExpand = () => request('expandable', { enabled: true });
export const disableExpand = () => request('expandable', { enabled: false });
/** As a sheet: whether a swipe down closes it. */
export const enableVerticalSwipes = () => request('verticalSwipes', { enabled: true });
export const disableVerticalSwipes = () => request('verticalSwipes', { enabled: false });
/** Ask before closing (unsaved work, a game under way). */
export const enableClosingConfirmation = () => request('closingConfirmation', { enabled: true });
export const disableClosingConfirmation = () => request('closingConfirmation', { enabled: false });

/** The colour behind your page (#RRGGBB). */
export async function setBackgroundColor(value: string): Promise<null> {
  return request('setColors', { background: color(value, 'color') });
}

/** Lia's header colour (#RRGGBB); its text turns light or dark to suit. */
export async function setHeaderColor(value: string): Promise<null> {
  return request('setColors', { header: color(value, 'color') });
}

// ---- Device ----

/** A tap the person feels. */
export function haptic(kind: HapticKind = 'light'): Promise<null> {
  return request('haptic', { kind });
}

/** The native camera asks for consent first; older Lia builds return unknown_method. */
export function capturePhoto() { return request('capturePhoto', {}); }
export function captureVideo() { return request('captureVideo', {}); }
/** Read at most 48 KiB per call. Local file paths are never exposed. */
export function readMedia(id: string, offset = 0) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new LiaError('bad_offset', 'Invalid media offset');
  return request('readMedia', { id: text(id, 'id', 80), offset });
}
export function releaseMedia(id: string) { return request('releaseMedia', { id: text(id, 'id', 80) }); }

/** What `saveMedia` saves: a public https link Lia downloads, or the bytes themselves (base64, up to 6 MB). */
export type SaveSource = { url: string; mimeType?: string; filename?: string } | { data: string; mimeType: string; filename?: string };
const SAVE_DATA_MAX = 8_000_000; // base64 characters: about 6 MB of file
/**
 * Saves a photo, video or any file to the person's phone. Lia asks first (naming your app), then puts
 * photos and videos in their Photos library (add-only access) and hands other files to the phone's save
 * sheet ("Save to Files"). `{ cancelled: true }` if they say no. Older Lia builds: unknown_method, so
 * check `capabilities.saveMedia` from init() and fall back (openLink, say) when it's missing.
 */
export function saveMedia(source: string | SaveSource) {
  const s: SaveSource = typeof source === 'string' ? { url: source } : source;
  const filename = 'filename' in s && s.filename !== undefined ? text(s.filename, 'filename', 120) : undefined;
  if (filename !== undefined && /[\\/\u0000-\u001f]/.test(filename)) throw new LiaError('bad_filename', 'A file name, not a path');
  const mimeType = s.mimeType !== undefined ? text(s.mimeType, 'mimeType', 100) : undefined;
  if (mimeType !== undefined && !/^[a-z]+\/[a-z0-9.+-]+$/i.test(mimeType)) throw new LiaError('bad_mime_type', 'Invalid mimeType');
  if ('url' in s) {
    const url = text(s.url, 'url', 2048);
    if (!/^https:\/\//i.test(url)) throw new LiaError('bad_url', 'saveMedia takes an https link');
    return request('saveMedia', { url, mimeType, filename });
  }
  const data = text(s.data, 'data', SAVE_DATA_MAX);
  if (!/^[A-Za-z0-9+/]+=*$/.test(data)) throw new LiaError('bad_data', 'data must be base64');
  if (!mimeType) throw new LiaError('bad_mime_type', 'mimeType is required with data');
  return request('saveMedia', { data, mimeType, filename });
}

// ---- Location, screen, reminders, calendar (Lia 1.13: check capabilities from init(); older builds: unknown_method) ----

function accuracyOf(options?: { accuracy?: LocationAccuracy }): LocationAccuracy {
  const a = options?.accuracy;
  if (a === undefined) return 'low';
  if (a !== 'low' && a !== 'high') throw new LiaError('bad_accuracy', "accuracy is 'low' (about a kilometre) or 'high' (GPS).");
  return a;
}
function timeOf(value: unknown, name: string): number {
  const ms = value instanceof Date ? value.getTime() : value;
  if (typeof ms !== 'number' || !Number.isFinite(ms)) throw new LiaError(`bad_${name}`, `${name} must be a Date or a time in milliseconds.`);
  return Math.round(ms);
}
function idOf(value: unknown): string {
  const id = text(value, 'id', 64);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new LiaError('bad_id', 'id uses letters, digits, - and _.');
  return id;
}

/**
 * Where the person is. Lia asks them first (naming your app), then the phone does; "denied" or
 * "permission_denied" if not. `accuracy: 'low'` (the default) is about a kilometre; ask for 'high' only
 * when you need GPS. `navigator.geolocation` in your page goes through the same consent.
 */
export const location = {
  get(options?: { accuracy?: LocationAccuracy }): Promise<Position> {
    return request('location', { action: 'get', accuracy: accuracyOf(options) }) as Promise<Position>;
  },
  /** Follows the person while your app is open: resolves to `stop()`. */
  async watch(listener: (position: Position) => void, options?: { accuracy?: LocationAccuracy }): Promise<() => Promise<unknown>> {
    if (typeof listener !== 'function') throw new LiaError('bad_listener', 'Pass a function.');
    const accuracy = accuracyOf(options);
    const stopListening = on('locationChanged', listener);
    try {
      await request('location', { action: 'watch', accuracy });
    } catch (error) {
      stopListening();
      throw error;
    }
    return () => {
      stopListening();
      return request('location', { action: 'stop' });
    };
  },
};

/** The screen while your app is open. Everything here is undone when it closes or goes to the background. */
export const screen = {
  /** "portrait" or "landscape" (either way up). */
  lockOrientation(orientation: 'portrait' | 'landscape'): Promise<true> {
    if (orientation !== 'portrait' && orientation !== 'landscape') throw new LiaError('bad_orientation', 'portrait or landscape.');
    return request('screen', { action: 'orientation', value: orientation });
  },
  /** Follows the phone again. */
  unlockOrientation: (): Promise<true> => request('screen', { action: 'orientation', value: 'any' }),
  /** Keeps the screen on (games, videos, timers). */
  keepAwake: (on = true): Promise<true> => request('screen', { action: 'keepAwake', value: on !== false }),
  /** 0 to 1 (1 for showing a ticket or a QR code). */
  setBrightness(level: number): Promise<true> {
    if (typeof level !== 'number' || !(level >= 0 && level <= 1)) throw new LiaError('bad_brightness', '0 to 1.');
    return request('screen', { action: 'brightness', value: level });
  },
  /** Back to the person's own brightness. */
  resetBrightness: (): Promise<true> => request('screen', { action: 'brightness', value: null }),
  /** Blocks screenshots and screen recording (balances, codes, receipts). */
  protect: (on = true): Promise<true> => request('screen', { action: 'protect', value: on !== false }),
};

export interface ReminderInput {
  /** Yours to cancel or replace it by: letters, digits, - and _. */
  id: string;
  /** Up to 60 characters; Lia shows it as "{your app} · {title}". */
  title: string;
  body?: string;
  /** When (a Date or ms), or inSeconds from now. */
  at?: Date | number;
  inSeconds?: number;
  /** What your app opens with when the reminder is tapped. */
  startParam?: string;
}

/**
 * Reminders on the phone that open your app when tapped. Needs your app's notification consent (Lia asks if
 * it hasn't). Up to 10 at a time, up to 30 days ahead; the same id replaces one.
 */
export const reminders = {
  schedule(r: ReminderInput): Promise<{ id: string; at: number }> {
    const at = r?.at !== undefined ? timeOf(r.at, 'at') : r?.inSeconds !== undefined ? Date.now() + timeOf(r.inSeconds, 'inSeconds') * 1000 : null;
    if (at === null) throw new LiaError('bad_at', 'Pass at (a Date) or inSeconds.');
    const startParam = r.startParam === undefined ? undefined : text(r.startParam, 'startParam', 64);
    return request('reminders', { action: 'schedule', id: idOf(r.id), title: text(r.title, 'title', 60), body: text(r.body, 'body', 160, true) || undefined, at, startParam }) as Promise<{ id: string; at: number }>;
  },
  cancel: (id: string): Promise<true> => request('reminders', { action: 'cancel', id: idOf(id) }) as Promise<true>,
  list: (): Promise<Reminder[]> => request('reminders', { action: 'list' }) as Promise<Reminder[]>,
};

export interface CalendarEvent {
  title: string;
  start: Date | number;
  /** An hour after start when left out. */
  end?: Date | number;
  allDay?: boolean;
  location?: string;
  description?: string;
  /** An https link. */
  url?: string;
}

/** An event for the person's calendar: Lia makes a calendar file and opens the share sheet (any calendar app). */
export function addToCalendar(e: CalendarEvent): Promise<{ shared: true }> {
  const start = timeOf(e?.start, 'start');
  const end = e.end === undefined ? start + 3_600_000 : timeOf(e.end, 'end');
  if (end < start) throw new LiaError('bad_end', 'end is after start.');
  const url = e.url === undefined ? undefined : text(e.url, 'url', 2048);
  if (url !== undefined && !url.startsWith('https://')) throw new LiaError('bad_url', 'url is an https link.');
  return request('calendar', {
    title: text(e.title, 'title', 120),
    start,
    end,
    allDay: e.allDay === true,
    location: text(e.location, 'location', 200, true) || undefined,
    description: text(e.description, 'description', 2000, true) || undefined,
    url,
  });
}

/** Lia's QR scanner: the code's text, or null if closed. */
export async function scanQr(options: { text?: string } = {}): Promise<string | null> {
  return request('scanQr', { text: text(options.text, 'text', 64, true) });
}

/** Copies text (Lia says it's copied). */
export async function copyText(value: string): Promise<null> {
  return request('copyText', { text: text(value, 'text', 4096) });
}

/** The clipboard's text (iOS asks first), or null. */
export function readClipboard(): Promise<string | null> {
  return request('readClipboard');
}

/** Opens an https page: in Lia's in-app browser, or outside Lia with `{ external: true }`. */
export async function openLink(url: string, options: { external?: boolean } = {}): Promise<null> {
  if (typeof url !== 'string' || !/^https:\/\/\S+$/.test(url) || url.length > 2048) throw new LiaError('bad_url', 'An https address.');
  return request('openLink', { url, external: Boolean(options.external) });
}

/** Opens one of Lia's own screens: `{ closed }` says whether your app closed for it. */
export async function openLiaLink(screen: 'invite' | 'strides' | 'activity' | 'send' | 'apps' | 'streak' | 'mine' | 'receive'): Promise<{ closed: boolean }> {
  return request('openLiaLink', { screen: text(screen, 'screen', 40) });
}

// ---- Scores ----

/** Records a score (only the best counts): `{ best }`. */
export async function submitScore(score: number, options?: Once): Promise<{ best: number }> {
  if (typeof score !== 'number' || score < 0 || Math.floor(score) !== score) throw new LiaError('bad_score', 'A whole number, 0 or more.');
  return request('submitScore', once(options, { score }));
}

/** The top 50 and your place. */
export function leaderboard(): Promise<Leaderboard> {
  return request('leaderboard');
}
