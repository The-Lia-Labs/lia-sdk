import { emit, LiaError } from './bridge';
import type { EventName, Events, InitResult, MethodName, Outgoing, ResultOf } from './types';

// A pretend Lia for building outside the Lia app (a desktop browser, tests): it answers every call the
// way Lia would, with a test player in test mode, so your page runs end to end. Install it before your
// first call, only when you're not in Lia:
//
//   if (!isLia()) mockLia({ init: { language: 'es' } });

export interface MockCall {
  method: MethodName;
  /** The call's params, as sent (see Methods for each method's shape). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>;
}

export interface MockOptions {
  /** Changes to what `init` answers (a test player, English, light, a sheet). */
  init?: Partial<InitResult>;
  /** Decide an answer yourself: return a value, throw a LiaError (or `{ code }`) to fail, or call `next()` for the mock's own answer. */
  onMethod?: (call: MockCall, next: () => unknown) => unknown;
  /** ms before each answer (0 by default). */
  latency?: number;
}

export interface Mock {
  /** Sends an event to the page, as Lia would (`mock.event('theme', {...})`). */
  event<E extends EventName>(event: E, data?: Events[E]): void;
  /** Every call the page made, oldest first. */
  calls: MockCall[];
  /** Removes the mock. */
  restore(): void;
}

export const MOCK_INIT: InitResult = {
  player: { id: 'p_mock00000000000000000', name: 'tester' },
  session: 'lias_mock',
  exp: 0,
  mode: 'test',
  language: 'en',
  rtl: false,
  platform: 'ios',
  theme: 'light',
  themeParams: {
    bg_color: '#FFFFFF',
    text_color: '#0B0B0F',
    hint_color: '#6B6E7B',
    link_color: '#2F5BFF',
    button_color: '#2F5BFF',
    button_text_color: '#FFFFFF',
    secondary_bg_color: '#F5F5F7',
    header_bg_color: '#FFFFFF',
    bottom_bar_bg_color: '#FFFFFF',
    accent_text_color: '#2F5BFF',
    section_bg_color: '#F5F5F7',
    section_header_text_color: '#6B6E7B',
    subtitle_text_color: '#6B6E7B',
    destructive_text_color: '#EF4444',
    section_separator_color: '#E6E7EC',
  },
  display: 'sheet',
  isFullscreen: false,
  viewport: { height: 640, expanded: false },
  safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
  contentSafeArea: { top: 0, bottom: 0, left: 0, right: 0 },
  startParam: null,
  link: 'https://lialabs.app/play/mock-app',
  sound: true,
  notifications: { allowed: false, available: true },
  capabilities: { usageAnalytics: true, location: true, screen: true, reminders: true, calendar: true, mediaAccess: true },
};

/** Installs a pretend Lia. Returns controls, including `restore()`. */
export function mockLia(options: MockOptions = {}): Mock {
  if (typeof window === 'undefined') throw new LiaError('no_window', 'mockLia needs a page (window).');
  const w = window as unknown as { ReactNativeWebView?: { postMessage(message: string): void } };
  const before = w.ReactNativeWebView;
  const initResult: InitResult = { ...MOCK_INIT, exp: Date.now() + 15 * 60_000, ...options.init };
  const cloud = new Map<string, string>();
  const device = new Map<string, string>();
  const secure = new Map<string, string>();
  const reminders = new Map<string, { id: string; title: string; at: number }>();
  let best: number | null = null;
  let charge = 0;
  const calls: MockCall[] = [];

  const answer = (call: MockCall): unknown => {
    const p = call.params;
    switch (call.method) {
      case 'init':
        return initResult;
      case 'session':
        return { session: initResult.session, exp: Date.now() + 15 * 60_000 };
      case 'pay':
        return { chargeId: `ch_mock${String(++charge).padStart(4, '0')}`, productId: String(p.productId) } satisfies ResultOf<'pay'>;
      case 'charges':
        return [];
      case 'showRewardedAd':
      case 'showAd':
        return p.format === 'interstitial' ? { watched: false, shown: true, adId: 'ad_mock' } : { watched: true, shown: true, adId: 'ad_mock' };
      case 'showBanner':
        return { shown: true, position: p.position === 'top' ? 'top' : 'bottom', height: 50 };
      case 'hideBanner':
      case 'hideNativeAd':
        return { hidden: true };
      case 'showNativeAd':
        return p.placement === 'sheet' ? { shown: true, placement: 'sheet' } : { shown: true, placement: 'card', height: 118 };
      case 'confirm':
        return { confirmed: true };
      case 'showPopup':
        return (p.buttons as { id: string }[])[0]?.id ?? null;
      case 'requestNotifications':
        return { allowed: true };
      case 'inviteFriend':
        return { invited: true };
      case 'submitScore':
        best = Math.max(best ?? 0, Number(p.score));
        return { best };
      case 'leaderboard':
        return { top: best === null ? [] : [{ rank: 1, name: initResult.player.name, score: best, me: true }], me: best === null ? null : { rank: 1, score: best } };
      case 'expand':
        return { expanded: true };
      case 'requestFullscreen':
        return { isFullscreen: true };
      case 'exitFullscreen':
        return { isFullscreen: false };
      case 'capturePhoto':
      case 'captureVideo':
        return { cancelled: true };
      case 'analyticsStatus':
        return { allowed: true, available: true };
      case 'analyticsTrack':
        return { sent: true };
      case 'readMedia':
        throw new LiaError('media_expired', 'The mock does not create camera files. Override onMethod to simulate media.');
      case 'releaseMedia':
        return { released: true };
      case 'saveMedia':
        return { cancelled: false, to: /^(image|video)\//.test(String(p.mimeType ?? '')) || /\.(png|jpe?g|gif|webp|heic|mp4|mov)(\?|$)/i.test(String(p.url ?? p.filename ?? '')) ? 'photos' : 'files' };
      case 'scanQr':
        return 'mock-qr';
      case 'readClipboard':
        return null;
      case 'openLiaLink':
        return { closed: false };
      case 'cloudStorage': {
        if (p.op === 'set') return cloud.set(String(p.key), String(p.value)) && { ok: true };
        if (p.op === 'get') return { values: Object.fromEntries((p.keys as string[]).filter((k) => cloud.has(k)).map((k) => [k, cloud.get(k)!])) };
        if (p.op === 'remove') return (p.keys as string[]).forEach((k) => cloud.delete(k)), { ok: true };
        return { keys: [...cloud.keys()].sort() };
      }
      case 'deviceStorage':
      case 'secureStorage': {
        const store = call.method === 'deviceStorage' ? device : secure;
        if (p.op === 'set') return store.set(String(p.key), String(p.value)) && true;
        if (p.op === 'get') return store.get(String(p.key)) ?? null;
        if (p.op === 'remove') return store.delete(String(p.key)), true;
        return store.clear(), true;
      }
      case 'biometricInit':
        return { available: true, type: 'face' };
      case 'biometricAuthenticate':
        return { authenticated: true };
      case 'sensor':
      case 'screen':
      case 'mediaAccess':
        return true;
      case 'location':
        return p.action === 'get' ? { latitude: 6.45, longitude: 3.4, accuracy: p.accuracy === 'high' ? 10 : 1000, altitude: null, heading: null, speed: null, at: Date.now() } : true;
      case 'reminders': {
        if (p.action === 'schedule') return reminders.set(String(p.id), { id: String(p.id), title: String(p.title), at: Number(p.at) }), { id: p.id, at: p.at };
        if (p.action === 'cancel') return reminders.delete(String(p.id)), true;
        return [...reminders.values()];
      }
      case 'calendar':
        return { shared: true };
      default:
        return null;
    }
  };

  w.ReactNativeWebView = {
    postMessage(json: string) {
      const message = JSON.parse(json) as Outgoing;
      const call = { method: message.method, params: message.params } as MockCall;
      calls.push(call);
      const reply = () => {
        try {
          const result = options.onMethod ? options.onMethod(call, () => answer(call)) : answer(call);
          Promise.resolve(result).then(
            (value) => emit({ id: message.id, ok: true, result: value === undefined ? null : value }),
            (error) => emit({ id: message.id, ok: false, error: { code: (error && error.code) || 'failed', message: error?.message } }),
          );
        } catch (error) {
          const e = error as { code?: string; message?: string };
          emit({ id: message.id, ok: false, error: { code: e?.code || 'failed', message: e?.message } });
        }
      };
      if (options.latency) setTimeout(reply, options.latency);
      else queueMicrotask(reply);
    },
  };

  return {
    calls,
    event(event, data) {
      emit({ event, data });
    },
    restore() {
      if (before) w.ReactNativeWebView = before;
      else delete w.ReactNativeWebView;
    },
  };
}
