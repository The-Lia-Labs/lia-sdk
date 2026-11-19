import type { EventName, Events, Incoming, MethodName, Outgoing, ParamsOf, ResultOf } from './types';

// The lowest layer: the Lia app's frame bridge. A call is a message the page posts with
// window.ReactNativeWebView.postMessage, {lia: 1, id, method, params}; the Lia app answers it once through
// window.__lia.receive({id, ok, result | error}), and sends events the same way ({event, data}).
//
// One hub per page, kept on a global symbol, so two copies of this package in one bundle share the
// same ids, answers and listeners instead of fighting over window.__lia.

/** The protocol version these packages speak (the Lia SDK's). */
export const PROTOCOL = '1.13.1';
/** How long a call that doesn't wait on the person may take, in ms. */
export const DEFAULT_TIMEOUT = 20_000;
/** The largest message the Lia app hears (it ignores bigger ones). */
export const MAX_MESSAGE = 16_000;
/** Calls that wait on the person (a sheet, a video, the scanner, Face ID) have no time limit. */
export const PATIENT: ReadonlySet<string> = new Set([
  'pay',
  'showRewardedAd',
  'showNativeAd',
  'showAd',
  'share',
  'confirm',
  'showPopup',
  'requestNotifications',
  'inviteFriend',
  'scanQr',
  'capturePhoto',
  'captureVideo',
  'saveMedia',
  'biometricAuthenticate',
  'readClipboard',
  'location',
  'mediaAccess',
  'reminders',
  'calendar',
]);

/** An error from Lia or from this package: `code` says why (see the docs' error codes). */
export class LiaError extends Error {
  readonly code: string;
  readonly method?: string;
  constructor(code: string, message?: string, method?: string) {
    super(message || code);
    this.name = 'LiaError';
    this.code = code;
    this.method = method;
  }
}

/** Whether `error` is a LiaError (with this code, when given). */
export function isLiaError(error: unknown, code?: string): error is LiaError {
  return error instanceof Error && typeof (error as LiaError).code === 'string' && (code === undefined || (error as LiaError).code === code);
}

type Waiting = { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> | null; method: string };
type Listener = (data: never) => void;
type AnyListener = (event: string, data: unknown) => void;
type Hub = {
  next: number;
  waiting: Map<number, Waiting>;
  listeners: Map<string, Set<Listener>>;
  any: Set<AnyListener>;
  debug: boolean;
  logger: Pick<Console, 'log' | 'warn' | 'error'>;
  /** Whether window.__lia is ours (false: something else, such as the script tag SDK, defined it first). */
  receiving: boolean;
};

const KEY = Symbol.for('@lia-labs/bridge');

function hub(): Hub {
  const g = globalThis as unknown as Record<symbol, Hub | undefined>;
  let h = g[KEY];
  if (h) return h;
  h = { next: 1, waiting: new Map(), listeners: new Map(), any: new Set(), debug: false, logger: console, receiving: false };
  g[KEY] = h;
  const hubRef = h;
  if (typeof window !== 'undefined') {
    if (Object.getOwnPropertyDescriptor(window, '__lia')) {
      hubRef.logger.warn('[lia] window.__lia is already defined (the script tag SDK?). Use the Lia packages or the script tag, not both.');
    } else {
      Object.defineProperty(window, '__lia', {
        configurable: false,
        writable: false,
        value: Object.freeze({ receive: (message: unknown) => receive(hubRef, message) }),
      });
      hubRef.receiving = true;
    }
  }
  return h;
}

function receive(h: Hub, message: unknown) {
  if (!message || typeof message !== 'object') return;
  const m = message as Incoming;
  if ('event' in m) {
    if (h.debug) h.logger.log('[lia] event', m.event, m.data);
    h.any.forEach((fn) => safely(h, () => fn(m.event, m.data)));
    (h.listeners.get(m.event) ?? new Set()).forEach((fn) => safely(h, () => (fn as (data: unknown) => void)(m.data)));
    return;
  }
  const entry = h.waiting.get(m.id);
  if (!entry) return;
  h.waiting.delete(m.id);
  if (entry.timer) clearTimeout(entry.timer);
  if (h.debug) h.logger.log('[lia] answer', entry.method, m);
  if (m.ok) entry.resolve(m.result);
  else entry.reject(new LiaError(m.error?.code || 'failed', m.error?.message, entry.method));
}

function safely(h: Hub, fn: () => void) {
  try {
    fn();
  } catch (error) {
    h.logger.error('[lia] a listener threw', error);
  }
}

type Transport = { postMessage(message: string): void };
const transport = (): Transport | null => (typeof window === 'undefined' ? null : ((window as unknown as { ReactNativeWebView?: Transport }).ReactNativeWebView ?? null));

/** Whether this page is open inside the Lia app (or a mock from `mockLia`). */
export function isLia(): boolean {
  return transport() !== null;
}

export interface RequestOptions {
  /** ms before giving up with "timeout" (20 s by default; calls that wait on the person never time out unless you set one). */
  timeout?: number;
  /** Stop waiting (rejects with "aborted"; Lia may still act on the call). */
  signal?: AbortSignal;
}

type ArgsOf<M extends MethodName> = ParamsOf<M> extends void ? [params?: Record<string, never>, options?: RequestOptions] : [params: ParamsOf<M>, options?: RequestOptions];

/** Calls one of Lia's methods and resolves with its answer (or rejects with a LiaError). */
export function request<M extends MethodName>(method: M, ...[params, options]: ArgsOf<M>): Promise<ResultOf<M>> {
  const h = hub();
  return new Promise<ResultOf<M>>((resolve, reject) => {
    const bridge = transport();
    if (!bridge) return reject(new LiaError('not_in_lia', 'Open this app inside Lia.', method));
    if (options?.signal?.aborted) return reject(new LiaError('aborted', 'The call was aborted.', method));
    const id = h.next++;
    const message: Outgoing = { lia: 1, id, method, params: (params ?? {}) as Record<string, unknown> };
    const json = JSON.stringify(message);
    if (json.length > MAX_MESSAGE) return reject(new LiaError('too_large', `Messages to Lia are at most ${MAX_MESSAGE} characters.`, method));
    const ms = options?.timeout ?? (PATIENT.has(method) ? null : DEFAULT_TIMEOUT);
    const timer = ms === null ? null : setTimeout(() => {
      h.waiting.delete(id);
      reject(new LiaError('timeout', "Lia didn't answer.", method));
    }, ms);
    h.waiting.set(id, { resolve: resolve as (value: unknown) => void, reject, timer, method });
    options?.signal?.addEventListener('abort', () => {
      if (!h.waiting.delete(id)) return;
      if (timer) clearTimeout(timer);
      reject(new LiaError('aborted', 'The call was aborted.', method));
    });
    if (h.debug) h.logger.log('[lia] call', method, message.params);
    bridge.postMessage(json);
  });
}

/** Calls a method without waiting for its answer (a button's text, the header): failures are dropped. */
export function send<M extends MethodName>(method: M, ...args: ArgsOf<M>): void {
  request(method, ...args).catch((error) => {
    if (hub().debug) hub().logger.warn('[lia] send failed', method, error);
  });
}

/** Listens for one of Lia's events. Returns a function that stops listening. */
export function on<E extends EventName>(event: E, listener: (data: Events[E]) => void): () => void;
export function on(event: string, listener: (data: unknown) => void): () => void;
export function on(event: string, listener: (data: never) => void): () => void {
  if (typeof listener !== 'function') throw new LiaError('bad_listener', 'Pass a function.');
  const h = hub();
  let set = h.listeners.get(event);
  if (!set) h.listeners.set(event, (set = new Set()));
  set.add(listener as Listener);
  return () => off(event, listener as (data: unknown) => void);
}

/** Stops a listener added with `on`. */
export function off<E extends EventName>(event: E, listener: (data: Events[E]) => void): void;
export function off(event: string, listener: (data: unknown) => void): void;
export function off(event: string, listener: (data: never) => void): void {
  hub().listeners.get(event)?.delete(listener as Listener);
}

/** Listens for the next time an event happens only. */
export function once<E extends EventName>(event: E, listener: (data: Events[E]) => void): () => void {
  const stop = on(event, (data: Events[E]) => {
    stop();
    listener(data);
  });
  return stop;
}

/** Hears every event, with its name. Returns a function that stops listening. */
export function onAny(listener: (event: string, data: unknown) => void): () => void {
  const h = hub();
  h.any.add(listener);
  return () => h.any.delete(listener);
}

/** Logs every call, answer and event to the console (or your logger). */
export function setDebug(on: boolean, logger?: Pick<Console, 'log' | 'warn' | 'error'>): void {
  const h = hub();
  h.debug = on;
  if (logger) h.logger = logger;
}

/** Hands a message to this page's listeners as if it came from Lia (for mocks and tests). */
export function emit(message: Incoming): void {
  receive(hub(), message);
}

/** Starts the bridge now (it also starts on first use): defines window.__lia so Lia's answers arrive. */
export function install(): { receiving: boolean } {
  return { receiving: hub().receiving };
}

/** For tests: forgets every call and listener. */
export function resetForTests(): void {
  const h = hub();
  h.waiting.forEach((entry) => entry.timer && clearTimeout(entry.timer));
  h.waiting.clear();
  h.listeners.clear();
  h.any.clear();
  h.debug = false;
}
