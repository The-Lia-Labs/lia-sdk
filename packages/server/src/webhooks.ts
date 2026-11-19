export class WebhookError extends Error { constructor() { super('invalid_webhook'); this.name = 'WebhookError'; } }
export interface WebhookEvent { id?: string; type: string; app: string; at: number; data?: unknown; test?: boolean }
/** Verify exact request bytes before JSON decoding; deduplicate event IDs durably in your database. */
export async function verifyWebhook(secret: string, raw: Uint8Array | string, signature: string, options: { now?: number; toleranceSeconds?: number } = {}): Promise<boolean> {
 const match = /^t=(\d{1,12}),v1=([a-f0-9]{64})$/.exec(signature);
 const tolerance = options.toleranceSeconds ?? 300;
 if (!secret || !Number.isFinite(tolerance) || tolerance < 1 || tolerance > 300 || !match || Math.abs((options.now ?? Date.now()) / 1000 - Number(match[1])) > tolerance) return false;
 const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw;
 if (bytes.byteLength > 1_048_576) return false;
 const prefix = new TextEncoder().encode(match[1] + '.');
 const message = new Uint8Array(prefix.length + bytes.length); message.set(prefix); message.set(bytes, prefix.length);
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
 const mac = Uint8Array.from(match[2].match(/../g)!, n => parseInt(n, 16));
 return crypto.subtle.verify('HMAC', key, mac, message);
}
export async function constructWebhookEvent(secret: string, raw: Uint8Array | string, signature: string, options?: { now?: number }): Promise<WebhookEvent> {
 if (!await verifyWebhook(secret, raw, signature, options)) throw new WebhookError();
 let event: unknown;
 try { event = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch { throw new WebhookError(); }
 if (!event || typeof event !== 'object') throw new WebhookError();
 const e = event as WebhookEvent;
 if (typeof e.type !== 'string' || typeof e.app !== 'string' || !Number.isFinite(e.at)) throw new WebhookError();
 return e;
}
