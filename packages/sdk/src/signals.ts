// The SDK's state as small observable values: read with get(), hear changes with subscribe(). Every
// framework package turns these into its own kind of state (a hook, a ref, a store, a signal), so the
// shape is kept to what they all need: get is stable, subscribe returns its own unsubscribe, and
// listeners only hear real changes (never on subscribe).

export interface Readable<T> {
  /** The value now. */
  get(): T;
  /** Hears each change, with the new and the old value. Returns a function that stops listening. */
  subscribe(listener: (value: T, previous: T) => void): () => void;
}

export interface Writable<T> extends Readable<T> {
  set(value: T): void;
}

/** A value you can read, set and watch. */
export function signal<T>(initial: T, equals: (a: T, b: T) => boolean = Object.is): Writable<T> {
  let value = initial;
  const listeners = new Set<(value: T, previous: T) => void>();
  const get = () => value;
  const subscribe = (listener: (value: T, previous: T) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const set = (next: T) => {
    if (equals(value, next)) return;
    const previous = value;
    value = next;
    [...listeners].forEach((listener) => listener(next, previous));
  };
  return { get, subscribe, set };
}

/** A value worked out from others, kept current while anyone listens. */
export function computed<T>(sources: Readable<unknown>[], fn: () => T, equals: (a: T, b: T) => boolean = Object.is): Readable<T> {
  const inner = signal(fn(), equals);
  let stops: (() => void)[] = [];
  let count = 0;
  const get = () => (count ? inner.get() : fn());
  const subscribe = (listener: (value: T, previous: T) => void) => {
    if (count++ === 0) {
      inner.set(fn());
      stops = sources.map((source) => source.subscribe(() => inner.set(fn())));
    }
    const stop = inner.subscribe(listener);
    return () => {
      stop();
      if (--count === 0) {
        stops.forEach((s) => s());
        stops = [];
      }
    };
  };
  return { get, subscribe };
}

/** Shallow equality for small objects (insets, the viewport). */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return ka.length === kb.length && ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Read-only view of a writable, for exporting. */
export const readonly = <T>(s: Readable<T>): Readable<T> => ({ get: s.get, subscribe: s.subscribe });
