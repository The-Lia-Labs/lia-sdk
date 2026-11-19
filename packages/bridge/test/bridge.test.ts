import { afterEach, describe, expect, it, vi } from 'vitest';
import { emit, isLia, isLiaError, mockLia, on, onAny, once, request, resetForTests, send } from '../src';

type Posted = { lia: number; id: number; method: string; params: Record<string, unknown> };

/** A fake Lia app frame that records what the page posts. */
function fakeLia() {
  const posted: Posted[] = [];
  (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView = { postMessage: (json: string) => posted.push(JSON.parse(json)) };
  return posted;
}

afterEach(() => {
  delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  resetForTests();
  vi.useRealTimers();
});

describe('bridge', () => {
  it('knows when it is outside Lia', async () => {
    expect(isLia()).toBe(false);
    await expect(request('init')).rejects.toMatchObject({ code: 'not_in_lia' });
  });

  it('posts {lia: 1, id, method, params} and resolves with Lia\'s answer', async () => {
    const posted = fakeLia();
    const answer = request('haptic', { kind: 'success' });
    expect(posted[0]).toMatchObject({ lia: 1, method: 'haptic', params: { kind: 'success' } });
    (window as unknown as { __lia: { receive(m: unknown): void } }).__lia.receive({ id: posted[0].id, ok: true, result: null });
    await expect(answer).resolves.toBeNull();
  });

  it('defines window.__lia once, frozen', () => {
    fakeLia();
    request('ready').catch(() => {});
    const descriptor = Object.getOwnPropertyDescriptor(window, '__lia')!;
    expect(descriptor.writable).toBe(false);
    expect(descriptor.configurable).toBe(false);
  });

  it('turns an error answer into a LiaError with its code and method', async () => {
    const posted = fakeLia();
    const answer = request('pay', { productId: 'gems' });
    emit({ id: posted[0].id, ok: false, error: { code: 'cancelled' } });
    const error = await answer.catch((e) => e);
    expect(isLiaError(error, 'cancelled')).toBe(true);
    expect(error.method).toBe('pay');
  });

  it('times out ordinary calls after 20 s, never calls that wait on the person', async () => {
    vi.useFakeTimers();
    fakeLia();
    const quick = request('session').catch((e) => e.code);
    const patient = vi.fn();
    request('pay', { productId: 'gems' }).then(patient, patient);
    vi.advanceTimersByTime(20_001);
    expect(await quick).toBe('timeout');
    await Promise.resolve();
    expect(patient).not.toHaveBeenCalled();
  });

  it('refuses messages Lia would ignore', async () => {
    fakeLia();
    await expect(request('copyText', { text: 'x'.repeat(20_000) })).rejects.toMatchObject({ code: 'too_large' });
  });

  it('stops waiting when aborted', async () => {
    fakeLia();
    const controller = new AbortController();
    const answer = request('scanQr', { text: '' }, { signal: controller.signal });
    controller.abort();
    await expect(answer).rejects.toMatchObject({ code: 'aborted' });
  });

  it('delivers events to on, once and onAny listeners', () => {
    const seen: unknown[] = [];
    const stop = on('soundChanged', (d) => seen.push(d.on));
    once('soundChanged', (d) => seen.push(`once:${d.on}`));
    const all = vi.fn();
    onAny(all);
    emit({ event: 'soundChanged', data: { on: false } });
    emit({ event: 'soundChanged', data: { on: true } });
    stop();
    emit({ event: 'soundChanged', data: { on: false } });
    expect(seen).toEqual([false, 'once:false', true]);
    expect(all).toHaveBeenCalledTimes(3);
  });

  it('send() never throws, even outside Lia', () => {
    expect(() => send('ready')).not.toThrow();
  });
});

describe('mockLia', () => {
  it('answers every call like Lia, with a test player', async () => {
    const mock = mockLia({ init: { language: 'es' } });
    const me = await request('init');
    expect(me).toMatchObject({ mode: 'test', language: 'es', player: { name: 'tester' } });
    await request('cloudStorage', { op: 'set', key: 'level', value: '7' });
    expect(await request('cloudStorage', { op: 'get', keys: ['level', 'none'] })).toEqual({ values: { level: '7' } });
    expect(await request('submitScore', { score: 40 })).toEqual({ best: 40 });
    expect(mock.calls.map((c) => c.method)).toEqual(['init', 'cloudStorage', 'cloudStorage', 'submitScore']);
    mock.restore();
    expect(isLia()).toBe(false);
  });

  it('lets onMethod answer, fail, or pass to the mock', async () => {
    mockLia({
      onMethod: (call, next) => {
        if (call.method === 'pay') throw { code: 'cancelled' };
        if (call.method === 'confirm') return { confirmed: false };
        return next();
      },
    });
    await expect(request('pay', { productId: 'gems' })).rejects.toMatchObject({ code: 'cancelled' });
    await expect(request('confirm', { title: 'Sure?', body: '', confirm: '', danger: false })).resolves.toEqual({ confirmed: false });
    await expect(request('expand')).resolves.toEqual({ expanded: true });
  });

  it('sends events', () => {
    const mock = mockLia();
    const heard = vi.fn();
    on('resume', heard);
    mock.event('resume');
    expect(heard).toHaveBeenCalledOnce();
  });
});
