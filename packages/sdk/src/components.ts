import { LiaError, on, request, send, type ButtonPosition, type SensorName } from '@lia-labs/bridge';
import { readonly, shallowEqual, signal, type Readable } from './signals';
import { color, key, keys, once, text, value } from './validate';

// The parts of Lia with state of their own: the bottom and header buttons, storage, Face ID and the
// motion sensors. Each is a plain object; import only the ones you use.

// ---- Bottom buttons ----

export interface BottomButtonState {
  type: 'main' | 'secondary';
  text: string;
  color: string | null;
  textColor: string | null;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  hasShineEffect: boolean;
  position: ButtonPosition;
}

export interface BottomButtonParams {
  text?: string;
  color?: string | null;
  textColor?: string | null;
  isVisible?: boolean;
  isActive?: boolean;
  isProgressVisible?: boolean;
  hasShineEffect?: boolean;
  /** For the secondary button: where it sits next to the main one. */
  position?: ButtonPosition;
}

export interface BottomButton {
  /** Its whole state, to watch. */
  readonly state: Readable<BottomButtonState>;
  setText(value: string): BottomButton;
  setParams(params: BottomButtonParams): BottomButton;
  show(): BottomButton;
  hide(): BottomButton;
  enable(): BottomButton;
  disable(): BottomButton;
  /** A spinner instead of its label (disabled while it spins, unless leaveActive). */
  showProgress(leaveActive?: boolean): BottomButton;
  hideProgress(): BottomButton;
  /** Hears a press. Returns a function that stops listening. */
  onClick(listener: () => void): () => void;
}

function bottomButton(type: 'main' | 'secondary'): BottomButton {
  const $state = /* @__PURE__ */ signal<BottomButtonState>(
    { type, text: type === 'main' ? 'Continue' : 'Cancel', color: null, textColor: null, isVisible: false, isActive: true, isProgressVisible: false, hasShineEffect: false, position: 'left' },
    shallowEqual,
  );
  const update = (patch: Partial<BottomButtonState>) => {
    $state.set({ ...$state.get(), ...patch });
    const b = $state.get();
    send('bottomButton', { type, text: b.text, color: b.color, textColor: b.textColor, visible: b.isVisible, active: b.isActive, progress: b.isProgressVisible, shine: b.hasShineEffect, position: b.position });
    return api;
  };
  const api: BottomButton = {
    state: readonly($state),
    setText: (value) => update({ text: text(value, 'text', 64) }),
    setParams(p) {
      const patch: Partial<BottomButtonState> = {};
      if (p.text !== undefined) patch.text = text(p.text, 'text', 64);
      if (p.color !== undefined) patch.color = p.color === null ? null : color(p.color, 'color');
      if (p.textColor !== undefined) patch.textColor = p.textColor === null ? null : color(p.textColor, 'text_color');
      if (p.isVisible !== undefined) patch.isVisible = Boolean(p.isVisible);
      if (p.isActive !== undefined) patch.isActive = Boolean(p.isActive);
      if (p.isProgressVisible !== undefined) patch.isProgressVisible = Boolean(p.isProgressVisible);
      if (p.hasShineEffect !== undefined) patch.hasShineEffect = Boolean(p.hasShineEffect);
      if (p.position !== undefined) {
        if (!['left', 'right', 'top', 'bottom'].includes(p.position)) throw new LiaError('bad_position', 'left, right, top or bottom.');
        patch.position = p.position;
      }
      return update(patch);
    },
    show: () => update({ isVisible: true }),
    hide: () => update({ isVisible: false }),
    enable: () => update({ isActive: true }),
    disable: () => update({ isActive: false }),
    showProgress: (leaveActive) => update({ isProgressVisible: true, ...(leaveActive ? {} : { isActive: false }) }),
    hideProgress: () => update({ isProgressVisible: false, isActive: true }),
    onClick: (listener) => on(`${type}ButtonClicked` as 'mainButtonClicked', listener),
  };
  return api;
}

/** The wide button under your page, in Lia blue. */
export const mainButton: BottomButton = /* @__PURE__ */ bottomButton('main');
/** A second bottom button beside or above the main one. */
export const secondaryButton: BottomButton = /* @__PURE__ */ bottomButton('secondary');

// ---- Header buttons ----

export interface HeaderButton {
  readonly isVisible: Readable<boolean>;
  show(): HeaderButton;
  hide(): HeaderButton;
  onClick(listener: () => void): () => void;
}

function headerButton(type: 'back' | 'settings'): HeaderButton {
  const $visible = /* @__PURE__ */ signal(false);
  const set = (visible: boolean) => {
    $visible.set(visible);
    send('headerButton', { type, visible });
    return api;
  };
  const api: HeaderButton = {
    isVisible: readonly($visible),
    show: () => set(true),
    hide: () => set(false),
    onClick: (listener) => on(`${type}ButtonClicked` as 'backButtonClicked', listener),
  };
  return api;
}

/** A back button in Lia's header, for your own screens. */
export const backButton: HeaderButton = /* @__PURE__ */ headerButton('back');
/** Settings in your app's ⋯ menu. */
export const settingsButton: HeaderButton = /* @__PURE__ */ headerButton('settings');

// ---- Storage ----

type Once = { idempotencyKey?: string };

/** On Lia's server, for this player, on any phone: 1024 keys, values up to 4096 characters. */
export const cloudStorage = {
  async setItem(k: string, v: string, options?: Once): Promise<true> {
    await request('cloudStorage', once(options, { op: 'set' as const, key: key(k), value: value(v, 4096) }));
    return true;
  },
  async getItem(k: string): Promise<string | null> {
    const r = await request('cloudStorage', { op: 'get', keys: [key(k)] });
    return r.values?.[k] ?? null;
  },
  async getItems(ks: string[]): Promise<Record<string, string>> {
    return (await request('cloudStorage', { op: 'get', keys: keys(ks) })).values ?? {};
  },
  async removeItem(k: string, options?: Once): Promise<true> {
    await request('cloudStorage', once(options, { op: 'remove' as const, keys: [key(k)] }));
    return true;
  },
  async removeItems(ks: string[], options?: Once): Promise<true> {
    await request('cloudStorage', once(options, { op: 'remove' as const, keys: keys(ks) }));
    return true;
  },
  async getKeys(): Promise<string[]> {
    return (await request('cloudStorage', { op: 'keys' })).keys ?? [];
  },
};

function phoneStorage(method: 'deviceStorage' | 'secureStorage', max: number) {
  return {
    async setItem(k: string, v: string): Promise<true> {
      await request(method, { op: 'set', key: key(k), value: value(v, max) });
      return true;
    },
    async getItem(k: string): Promise<string | null> {
      return (await request(method, { op: 'get', key: key(k) })) as string | null;
    },
    async removeItem(k: string): Promise<true> {
      await request(method, { op: 'remove', key: key(k) });
      return true;
    },
    async clear(): Promise<true> {
      await request(method, { op: 'clear' });
      return true;
    },
  };
}

/** On this phone only, for your app: up to 5 MB. */
export const deviceStorage = /* @__PURE__ */ phoneStorage('deviceStorage', 1_048_576);
/** In the phone's secure store (the Keychain on iPhone): 10 items, values up to 2048 characters. */
export const secureStorage = /* @__PURE__ */ phoneStorage('secureStorage', 2048);

// ---- Face ID and Touch ID ----

export const biometric = {
  /** `{ available, type: "face" | "finger" | "unknown" }`. */
  init: () => request('biometricInit'),
  /** Asks the person to confirm it's them: `{ authenticated }`. */
  async authenticate(options: { reason?: string } = {}) {
    return request('biometricAuthenticate', { reason: text(options.reason, 'reason', 128, true) });
  },
};

// ---- Motion ----

export interface Sensor<R> {
  /** The latest reading (null before the first). */
  readonly reading: Readable<R | null>;
  readonly isStarted: Readable<boolean>;
  /** Starts readings, refreshRate 20 to 1000 ms (1000 by default). */
  start(options?: { refreshRate?: number }): Promise<true>;
  stop(): Promise<true>;
}

function sensor<R>(name: SensorName): Sensor<R> {
  const $reading = /* @__PURE__ */ signal<R | null>(null);
  const $started = /* @__PURE__ */ signal(false);
  let stopListening: (() => void) | null = null;
  return {
    reading: readonly($reading),
    isStarted: readonly($started),
    async start(options = {}) {
      const rate = options.refreshRate ?? 1000;
      if (typeof rate !== 'number' || rate < 20 || rate > 1000) throw new LiaError('bad_refresh_rate', '20 to 1000 ms.');
      stopListening ??= on('sensor', (d) => {
        if (d?.name === name) $reading.set({ ...(d.values as R) });
      });
      await request('sensor', { name, action: 'start', refreshRate: rate });
      $started.set(true);
      return true;
    },
    async stop() {
      await request('sensor', { name, action: 'stop' });
      stopListening?.();
      stopListening = null;
      $started.set(false);
      return true;
    },
  };
}

/** m/s², gravity included. */
export const accelerometer: Sensor<{ x: number; y: number; z: number }> = /* @__PURE__ */ sensor('accelerometer');
/** Rotation rate, radians a second. */
export const gyroscope: Sensor<{ x: number; y: number; z: number }> = /* @__PURE__ */ sensor('gyroscope');
/** Angles in radians. */
export const deviceOrientation: Sensor<{ alpha: number; beta: number; gamma: number }> = /* @__PURE__ */ sensor('deviceOrientation');
