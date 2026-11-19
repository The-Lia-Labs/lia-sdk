import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  capturePhoto,
  captureVideo,
  readMedia,
  saveMedia,
  location,
  screen,
  reminders,
  addToCalendar,
  releaseMedia,
  cloudStorage,
  colorScheme,
  computed,
  init,
  inviteLink,
  language,
  mainButton,
  backButton,
  mockLia,
  pay,
  player,
  resetForTests,
  resetStateForTests,
  showAd,
  signal,
  soundOn,
  submitScore,
  toast,
  viewport,
  accelerometer,
  banner,
  holdBanner,
  nativeAd,
  safeArea,
  showBanner,
  showNativeAd,
  type Mock,
} from '../src';

let mock: Mock | null = null;
afterEach(() => {
  mock?.restore();
  mock = null;
  resetForTests();
  resetStateForTests();
});

describe('signals', () => {
  it('only tells listeners about real changes, with the old value', () => {
    const count = signal(1);
    const heard: [number, number][] = [];
    const stop = count.subscribe((value, previous) => heard.push([value, previous]));
    count.set(1);
    count.set(2);
    stop();
    count.set(3);
    expect(heard).toEqual([[2, 1]]);
  });

  it('computes from others while anyone listens', () => {
    const a = signal(2);
    const doubled = computed([a], () => a.get() * 2);
    expect(doubled.get()).toBe(4);
    const heard = vi.fn();
    doubled.subscribe(heard);
    a.set(5);
    expect(heard).toHaveBeenCalledWith(10, 4);
  });
});

describe('init', () => {
  it('fills the state, sets lang and dir, and binds CSS variables', async () => {
    mock = mockLia({ init: { language: 'ar', rtl: true, theme: 'dark', themeParams: { bg_color: '#000000' } } });
    const me = await init();
    expect(player.get()).toEqual(me.player);
    expect(language.get()).toBe('ar');
    expect(colorScheme.get()).toBe('dark');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.style.getPropertyValue('--lia-bg-color')).toBe('#000000');
  });

  it('answers with the first result when called again', async () => {
    mock = mockLia();
    const first = init();
    expect(init()).toBe(first);
    await first;
    expect(mock.calls.filter((c) => c.method === 'init')).toHaveLength(1);
  });

  it('keeps state current from Lia\'s events', async () => {
    mock = mockLia();
    await init();
    const heard = vi.fn();
    soundOn.subscribe(heard);
    mock.event('soundChanged', { on: false });
    mock.event('viewport', { height: 700, expanded: true });
    expect(heard).toHaveBeenCalledWith(false, true);
    expect(viewport.get()).toEqual({ height: 700, expanded: true });
    expect(document.documentElement.style.getPropertyValue('--lia-viewport-height')).toBe('700px');
  });
});

describe('features', () => {
  it('checks arguments with the script tag SDK\'s codes, as rejections', async () => {
    mock = mockLia();
    await expect(pay('')).rejects.toMatchObject({ code: 'bad_productId' });
    await expect(pay('gems', { idempotencyKey: 'has space' })).rejects.toMatchObject({ code: 'bad_idempotency_key' });
    await expect(toast('hi', { position: 'middle' as 'top' })).rejects.toMatchObject({ code: 'bad_position' });
    await expect(submitScore(1.5)).rejects.toMatchObject({ code: 'bad_score' });
    await expect(showAd({ format: 'banner' as 'rewarded' })).rejects.toMatchObject({ code: 'bad_format' });
    await expect(cloudStorage.setItem('bad key', 'x')).rejects.toMatchObject({ code: 'bad_key' });
  });

  it('pays with the app\'s own idempotency key', async () => {
    mock = mockLia();
    await expect(pay('gems', { idempotencyKey: 'order-1' })).resolves.toMatchObject({ productId: 'gems' });
    expect(mock.calls[0]).toEqual({ method: 'pay', params: { productId: 'gems', idempotencyKey: 'order-1' } });
  });

  it('builds invite links after init', async () => {
    mock = mockLia();
    expect(() => inviteLink('room-1')).toThrow(expect.objectContaining({ code: 'not_ready' }));
    await init();
    expect(inviteLink('room-1')).toBe('https://lialabs.app/play/mock-app?start=room-1');
  });

  it('syncs the main button with Lia and hears its presses', async () => {
    mock = mockLia();
    const pressed = vi.fn();
    const stop = mainButton.onClick(pressed);
    mainButton.setParams({ text: 'Buy', isVisible: true }).showProgress();
    await Promise.resolve();
    const last = mock.calls.filter((c) => c.method === 'bottomButton').pop();
    expect(last?.params).toMatchObject({ type: 'main', text: 'Buy', visible: true, progress: true, active: false });
    expect(mainButton.state.get()).toMatchObject({ text: 'Buy', isVisible: true, isProgressVisible: true });
    mock.event('mainButtonClicked');
    stop();
    mock.event('mainButtonClicked');
    expect(pressed).toHaveBeenCalledOnce();
    expect(() => mainButton.setParams({ color: 'blue' })).toThrow(expect.objectContaining({ code: 'bad_color' }));
  });

  it('shows and hides header buttons', () => {
    mock = mockLia();
    backButton.show();
    expect(backButton.isVisible.get()).toBe(true);
    backButton.hide();
    expect(mock.calls.map((c) => c.params)).toEqual([
      { type: 'back', visible: true },
      { type: 'back', visible: false },
    ]);
  });

  it('keeps cloud storage per key', async () => {
    mock = mockLia();
    await cloudStorage.setItem('level', '7');
    expect(await cloudStorage.getItem('level')).toBe('7');
    expect(await cloudStorage.getItem('missing')).toBeNull();
    expect(await cloudStorage.getKeys()).toEqual(['level']);
  });

  it('turns sensor events into readings', async () => {
    mock = mockLia();
    await accelerometer.start({ refreshRate: 50 });
    mock.event('sensor', { name: 'accelerometer', values: { x: 1, y: 2, z: 9.8 } });
    mock.event('sensor', { name: 'gyroscope', values: { x: 5, y: 5, z: 5 } });
    expect(accelerometer.reading.get()).toEqual({ x: 1, y: 2, z: 9.8 });
    await accelerometer.stop();
    expect(accelerometer.isStarted.get()).toBe(false);
  });

  it('docks a banner and follows it from Lia\'s events, with --lia-banner-height', async () => {
    mock = mockLia();
    await init();
    await expect(showBanner({ position: 'middle' as 'top' })).rejects.toMatchObject({ code: 'bad_position' });
    await expect(showBanner()).resolves.toEqual({ shown: true, position: 'bottom', height: 50 });
    expect(mock.calls.at(-1)).toEqual({ method: 'showBanner', params: { position: 'bottom' } });
    mock.event('banner', { state: 'shown', position: 'bottom', height: 50 });
    mock.event('safeAreaChanged', { safeArea: { top: 47, bottom: 0, left: 0, right: 0 }, contentSafeArea: { top: 0, bottom: 0, left: 0, right: 0 } });
    expect(banner.get()).toEqual({ visible: true, position: 'bottom', height: 50 });
    expect(safeArea.get().bottom).toBe(0);
    expect(document.documentElement.style.getPropertyValue('--lia-banner-height')).toBe('50px');
    mock.event('banner', { state: 'hidden', position: 'bottom', height: 0 });
    expect(banner.get().visible).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--lia-banner-height')).toBe('0px');
  });

  it('holds a banner until released, and shows native ads', async () => {
    mock = mockLia();
    const release = holdBanner('top');
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    release();
    expect(mock.calls.map((c) => c.method)).toEqual(['showBanner', 'hideBanner']);
    await expect(showNativeAd({ placement: 'popup' as 'card' })).rejects.toMatchObject({ code: 'bad_placement' });
    await expect(showNativeAd()).resolves.toMatchObject({ shown: true, placement: 'card' });
    await expect(showNativeAd({ placement: 'sheet' })).resolves.toEqual({ shown: true, placement: 'sheet' });
    await init();
    mock.event('nativeAd', { state: 'showing', placement: 'card', height: 118 });
    expect(nativeAd.get()).toEqual({ visible: true, placement: 'card', height: 118 });
  });
});

describe('camera media', () => {
  it('preserves consent cancellation and sends bounded-handle read requests', async () => {
    mock = mockLia({ onMethod(call, next) {
      if (call.method === 'readMedia') return { base64: 'AQID', offset: 0, nextOffset: 3, eof: true, mimeType: 'image/jpeg' };
      return next();
    } });
    expect(await capturePhoto()).toEqual({ cancelled: true });
    expect(await captureVideo()).toEqual({ cancelled: true });
    expect((await readMedia('media-test', 0)).base64).toBe('AQID');
    expect(await releaseMedia('media-test')).toEqual({ released: true });
    expect(() => readMedia('media-test', -1)).toThrow('Invalid media offset');
    try { readMedia('media-test', -1); } catch (error) { expect((error as { code: string }).code).toBe('bad_offset'); }
    expect(mock.calls.map(c => c.method)).toEqual(['capturePhoto', 'captureVideo', 'readMedia', 'releaseMedia']);
  });
});

it('does not invent readable camera files in the local mock', async () => {
  mock = mockLia();
  await expect(readMedia('missing-media')).rejects.toMatchObject({ code: 'media_expired' });
});

describe('saving media', () => {
  it('saves a link or bytes, says where they went, and refuses what it must not send', async () => {
    mock = mockLia();
    expect(await saveMedia('https://example.com/receipt.png')).toEqual({ cancelled: false, to: 'photos' });
    expect(await saveMedia({ url: 'https://example.com/report', mimeType: 'application/pdf', filename: 'report.pdf' })).toEqual({ cancelled: false, to: 'files' });
    expect(await saveMedia({ data: 'AQID', mimeType: 'image/png', filename: 'dot.png' })).toEqual({ cancelled: false, to: 'photos' });
    expect(mock.calls.map((c) => c.method)).toEqual(['saveMedia', 'saveMedia', 'saveMedia']);
    expect(mock.calls[1].params).toEqual({ url: 'https://example.com/report', mimeType: 'application/pdf', filename: 'report.pdf' });
    const code = (fn: () => unknown) => { try { fn(); } catch (error) { return (error as { code: string }).code; } return null; };
    expect(code(() => saveMedia('http://example.com/a.png'))).toBe('bad_url');
    expect(code(() => saveMedia({ url: 'https://example.com/a', filename: '../a.png' }))).toBe('bad_filename');
    expect(code(() => saveMedia({ data: 'not base64!', mimeType: 'image/png' }))).toBe('bad_data');
    expect(code(() => saveMedia({ data: 'AQID', mimeType: 'png' }))).toBe('bad_mime_type');
  });

  it('is cancellable from Lia', async () => {
    mock = mockLia({ onMethod: (call, next) => (call.method === 'saveMedia' ? { cancelled: true } : next()) });
    expect(await saveMedia('https://example.com/a.mp4')).toEqual({ cancelled: true });
  });
});

describe('location, screen, reminders and calendar', () => {
  const code = (fn: () => unknown) => { try { fn(); } catch (error) { return (error as { code: string }).code; } return null; };

  it('gets and watches the location, low accuracy by default', async () => {
    mock = mockLia();
    expect((await location.get()).accuracy).toBe(1000);
    expect(mock.calls[0].params).toEqual({ action: 'get', accuracy: 'low' });
    const seen: number[] = [];
    const stop = await location.watch((p) => seen.push(p.latitude), { accuracy: 'high' });
    mock.event('locationChanged', { latitude: 1, longitude: 2, accuracy: 5, altitude: null, heading: null, speed: null, at: 1 });
    await stop();
    mock.event('locationChanged', { latitude: 3, longitude: 4, accuracy: 5, altitude: null, heading: null, speed: null, at: 2 });
    expect(seen).toEqual([1]);
    expect(mock.calls.map((c) => c.params)).toEqual([{ action: 'get', accuracy: 'low' }, { action: 'watch', accuracy: 'high' }, { action: 'stop' }]);
    expect(code(() => location.get({ accuracy: 'best' as never }))).toBe('bad_accuracy');
  });

  it('controls the screen and refuses bad values', async () => {
    mock = mockLia();
    await screen.lockOrientation('landscape');
    await screen.keepAwake();
    await screen.setBrightness(1);
    await screen.resetBrightness();
    await screen.protect(false);
    await screen.unlockOrientation();
    expect(mock.calls.map((c) => c.params)).toEqual([
      { action: 'orientation', value: 'landscape' },
      { action: 'keepAwake', value: true },
      { action: 'brightness', value: 1 },
      { action: 'brightness', value: null },
      { action: 'protect', value: false },
      { action: 'orientation', value: 'any' },
    ]);
    expect(code(() => screen.lockOrientation('sideways' as never))).toBe('bad_orientation');
    expect(code(() => screen.setBrightness(2))).toBe('bad_brightness');
  });

  it('schedules, lists and cancels reminders', async () => {
    mock = mockLia();
    const at = new Date(Date.now() + 3_600_000);
    expect(await reminders.schedule({ id: 'daily-1', title: 'Your chest is ready', at, startParam: 'chest' })).toEqual({ id: 'daily-1', at: at.getTime() });
    expect((await reminders.list()).map((r) => r.id)).toEqual(['daily-1']);
    await reminders.cancel('daily-1');
    expect(await reminders.list()).toEqual([]);
    expect(code(() => reminders.schedule({ id: 'a b', title: 'x', inSeconds: 60 }))).toBe('bad_id');
    expect(code(() => reminders.schedule({ id: 'a', title: 'x' }))).toBe('bad_at');
  });

  it('adds to the calendar, an hour long by default', async () => {
    mock = mockLia();
    expect(await addToCalendar({ title: 'Final', start: 1_800_000_000_000, location: 'Lagos' })).toEqual({ shared: true });
    expect(mock.calls[0].params).toMatchObject({ title: 'Final', start: 1_800_000_000_000, end: 1_800_003_600_000, allDay: false, location: 'Lagos' });
    expect(code(() => addToCalendar({ title: 'x', start: 2, end: 1 }))).toBe('bad_end');
    expect(code(() => addToCalendar({ title: 'x', start: 1, url: 'http://a.com' }))).toBe('bad_url');
  });
});
