import { LiaError } from '@lia-labs/bridge';

// The same checks as the script tag SDK, with the same error codes, before anything reaches Lia.

export function text(value: unknown, name: string, max: number, optional = false): string {
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new LiaError(`bad_${name}`, `${name} must be text up to ${max} characters.`);
  return value;
}

export function color(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new LiaError(`bad_${name}`, `${name} must be a colour like #2F5BFF.`);
  return value;
}

const KEY = /^[A-Za-z0-9_-]{1,128}$/;
export function key(value: unknown): string {
  if (typeof value !== 'string' || !KEY.test(value)) throw new LiaError('bad_key', 'Keys are 1 to 128 of A-Z, a-z, 0-9, _ and -.');
  return value;
}

export function keys(list: unknown): string[] {
  if (!Array.isArray(list) || !list.length || list.length > 100) throw new LiaError('bad_keys', 'A list of 1 to 100 keys.');
  return list.map(key);
}

export function value(v: unknown, max: number): string {
  if (typeof v !== 'string' || v.length > max) throw new LiaError('bad_value', `Values are text up to ${max} characters.`);
  return v;
}

export function startParam(v: unknown): string {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(v)) throw new LiaError('bad_start_param', '1 to 64 of A-Z, a-z, 0-9, _ and -.');
  return v;
}

const IDEM = /^[A-Za-z0-9_.:-]{1,64}$/;
/** Adds the app's own idempotency key to a call's params, when it gave one. */
export function once<P extends object>(options: { idempotencyKey?: string } | undefined, params: P): P & { idempotencyKey?: string } {
  const k = options?.idempotencyKey;
  if (k === undefined || k === null) return params;
  if (typeof k !== 'string' || !IDEM.test(k)) throw new LiaError('bad_idempotency_key', '1 to 64 of A-Z, a-z, 0-9, _, -, . and :.');
  return { ...params, idempotencyKey: k };
}
