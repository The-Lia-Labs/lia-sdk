import { operations } from './operations';
import type { ClientOptions, Mode, OperationParams, OperationResults, RequestOptions, VerifiedPlayer } from './types';
export type * from './types';
export { verifyWebhook, constructWebhookEvent, WebhookError } from './webhooks';

export class LiaError extends Error {
 constructor(readonly code: string, readonly status = 0, readonly requestId?: string, readonly retryAfterMs?: number) { super(code); this.name = 'LiaError'; }
 get retryable() { return this.status === 0 || [408, 425, 429, 500, 502, 503, 504].includes(this.status) || this.code === 'idempotency_key_in_use'; }
}
const identifier = /^[A-Za-z0-9_.:-]{1,128}$/;
function segment(value: unknown) {
 if (typeof value !== 'string' || !identifier.test(value) || value === '.' || value === '..') throw new LiaError('invalid_path_parameter');
 return encodeURIComponent(value);
}
function retryAfter(value: string | null) {
 if (!value) return undefined;
 const ms = /^\d+(\.\d+)?$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
 return Number.isFinite(ms) ? Math.max(0, ms) : undefined;
}
const safe = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value) ? value : undefined;
export class LiaClient {
 #key: string; #base: string; #fetch: typeof fetch; #timeout: number; #retries: number;
 readonly mode: Mode;
 constructor(key: string, options: ClientOptions = {}) {
  if (!/^lia_(test|live)_[A-Za-z0-9_-]+$/.test(key)) throw new LiaError('invalid_server_key');
  this.#key = key; this.mode = key.startsWith('lia_test_') ? 'test' : 'live';
  const url = new URL(options.baseUrl ?? 'https://api.lialabs.org/api/apps/v1');
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new LiaError('invalid_base_url');
  this.#base = url.href.replace(/\/$/, ''); this.#fetch = options.fetch ?? fetch;
  this.#timeout = options.timeoutMs ?? 15_000; this.#retries = options.maxRetries ?? 2;
  if (!Number.isInteger(this.#timeout) || this.#timeout < 1 || this.#timeout > 120_000 || !Number.isInteger(this.#retries) || this.#retries < 0 || this.#retries > 3) throw new LiaError('invalid_client_options');
 }
 toJSON() { return { mode: this.mode }; }
 /** Only known operations are callable; a path cannot redirect the server key elsewhere. */
 async call<K extends keyof OperationParams>(operation: K, params: OperationParams[K], options: RequestOptions = {}): Promise<OperationResults[K]> {
  const spec = operations[operation]; if (!spec) throw new LiaError('unknown_operation');
  const input = params as Record<string, unknown>;
  for (const key of spec.required as readonly string[]) if (input[key] === undefined) throw new LiaError('missing_parameter');
  const path = spec.path.replace(/\{(\w+)\}/g, (_, key) => segment(input[key]));
  const url = new URL(this.#base + path);
  for (const key of spec.query as readonly string[]) if (input[key] !== undefined && input[key] !== null) url.searchParams.set(key, String(input[key]));
  const mutation = spec.method !== 'GET' && operation !== 'verifySession';
  if (options.idempotencyKey !== undefined && !identifier.test(options.idempotencyKey)) throw new LiaError('invalid_idempotency_key');
  const idempotencyKey = mutation ? options.idempotencyKey ?? crypto.randomUUID() : undefined;
  const body = spec.method === 'POST' ? JSON.stringify(Object.fromEntries((spec.body as readonly string[]).filter(key => input[key] !== undefined).map(key => [key, input[key]]))) : undefined;
  const headers: Record<string, string> = { Authorization: 'Bearer ' + this.#key, Accept: spec.text ? 'text/csv' : 'application/json', 'User-Agent': '@lia-labs/server/0.1.0' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const controller = new AbortController(), deadline = Date.now() + this.#timeout;
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(cancel, this.#timeout);
  try {
   for (let attempt = 0; ; attempt++) {
    let error: LiaError;
    try {
     const response = await this.#fetch(url.href, { method: spec.method, headers, body, redirect: 'manual', signal: controller.signal });
     const text = await response.text();
     let result: any; try { result = JSON.parse(text); } catch { /* Never include HTML error bodies in errors. */ }
     if (response.ok) {
      if (spec.text) return text as OperationResults[K];
      if (!result || typeof result !== 'object') throw new LiaError('invalid_response', response.status);
      return result as OperationResults[K];
     }
     error = new LiaError(safe(result?.error) ?? 'http_error', response.status, safe(response.headers.get('X-Lia-Request-Id')), retryAfter(response.headers.get('Retry-After')));
    } catch (e) {
     if (controller.signal.aborted) throw new LiaError(options.signal?.aborted ? 'request_aborted' : 'request_timeout');
     error = e instanceof LiaError ? e : new LiaError('network_error');
    }
    const delay = error.retryAfterMs ?? (100 * 2 ** attempt + Math.floor(Math.random() * 100));
    if (!error.retryable || attempt >= this.#retries || Date.now() + delay >= deadline) throw error;
    await new Promise<void>((resolve, reject) => {
     const abort = () => { clearTimeout(wait); reject(new LiaError(options.signal?.aborted ? 'request_aborted' : 'request_timeout')); };
     const wait = setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve(); }, delay);
     controller.signal.addEventListener('abort', abort, { once: true });
     if (controller.signal.aborted) abort();
    });
   }
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', cancel); }
 }
 async requireSession(session: string): Promise<VerifiedPlayer> {
  const result = await this.verifySession({ session });
  if (!result.valid || !/^p_\w{8,40}$/.test(result.playerId) || result.mode !== this.mode || !Number.isSafeInteger(result.exp) || result.exp <= Date.now()) throw new LiaError('invalid_session', 401);
  return result;
 }
 verifySession(params: OperationParams['verifySession'], options?: RequestOptions) { return this.call('verifySession', params, options); }
 listProducts(params: OperationParams['listProducts'] = {}, options?: RequestOptions) { return this.call('listProducts', params, options); }
 getCharge(params: OperationParams['getCharge'], options?: RequestOptions) { return this.call('getCharge', params, options); }
 deliverCharge(params: OperationParams['deliverCharge'], options?: RequestOptions) { return this.call('deliverCharge', params, options); }
 refundCharge(params: OperationParams['refundCharge'], options?: RequestOptions) { return this.call('refundCharge', params, options); }
 payReward(params: OperationParams['payReward'], options?: RequestOptions) { return this.call('payReward', params, options); }
 getPool(params: OperationParams['getPool'] = {}, options?: RequestOptions) { return this.call('getPool', params, options); }
 sendNotification(params: OperationParams['sendNotification'], options?: RequestOptions) { return this.call('sendNotification', params, options); }
 verifyAd(params: OperationParams['verifyAd'], options?: RequestOptions) { return this.call('verifyAd', params, options); }
 listTables(params: OperationParams['listTables'] = {}, options?: RequestOptions) { return this.call('listTables', params, options); }
 saveTable(params: OperationParams['saveTable'], options?: RequestOptions) { return this.call('saveTable', params, options); }
 sitAtTable(params: OperationParams['sitAtTable'], options?: RequestOptions) { return this.call('sitAtTable', params, options); }
 removeTable(params: OperationParams['removeTable'], options?: RequestOptions) { return this.call('removeTable', params, options); }
 listPendingCharges(params: OperationParams['listPendingCharges'] = {}, options?: RequestOptions) { return this.call('listPendingCharges', params, options); }
 listLeaderboards(params: OperationParams['listLeaderboards'] = {}, options?: RequestOptions) { return this.call('listLeaderboards', params, options); }
 saveLeaderboard(params: OperationParams['saveLeaderboard'], options?: RequestOptions) { return this.call('saveLeaderboard', params, options); }
 getLeaderboard(params: OperationParams['getLeaderboard'], options?: RequestOptions) { return this.call('getLeaderboard', params, options); }
 submitScore(params: OperationParams['submitScore'], options?: RequestOptions) { return this.call('submitScore', params, options); }
 moderateScore(params: OperationParams['moderateScore'], options?: RequestOptions) { return this.call('moderateScore', params, options); }
 getPlayerStorage(params: OperationParams['getPlayerStorage'], options?: RequestOptions) { return this.call('getPlayerStorage', params, options); }
 setPlayerStorage(params: OperationParams['setPlayerStorage'], options?: RequestOptions) { return this.call('setPlayerStorage', params, options); }
 listWebhookEvents(params: OperationParams['listWebhookEvents'] = {}, options?: RequestOptions) { return this.call('listWebhookEvents', params, options); }
 replayWebhookEvent(params: OperationParams['replayWebhookEvent'], options?: RequestOptions) { return this.call('replayWebhookEvent', params, options); }
 createAdChallenge(params: OperationParams['createAdChallenge'], options?: RequestOptions) { return this.call('createAdChallenge', params, options); }
 claimAdChallenge(params: OperationParams['claimAdChallenge'], options?: RequestOptions) { return this.call('claimAdChallenge', params, options); }
 getAnalytics(params: OperationParams['getAnalytics'] = {}, options?: RequestOptions) { return this.call('getAnalytics', params, options); }
 exportAnalytics(params: OperationParams['exportAnalytics'] = {}, options?: RequestOptions) { return this.call('exportAnalytics', params, options); }
}
