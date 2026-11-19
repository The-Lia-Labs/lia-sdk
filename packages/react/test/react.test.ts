import { createElement, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockLia, resetForTests, resetStateForTests, useBackButton, useBanner, useBannerAd, useInit, useLanguage, useMainButton, useSoundOn, type Mock } from '../src';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mock: Mock | null = null;
afterEach(() => {
  mock?.restore();
  mock = null;
  resetForTests();
  resetStateForTests();
});

function render(component: () => unknown) {
  const host = document.createElement('div');
  const root = createRoot(host);
  act(() => root.render(createElement(component as () => null)));
  return { host, unmount: () => act(() => root.unmount()) };
}

const flush = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe('@lia-labs/sdk-react', () => {
  it('runs init and follows Lia\'s state', async () => {
    mock = mockLia({ init: { language: 'fr' } });
    const seen: string[] = [];
    const { unmount } = render(() => {
      const state = useInit();
      const language = useLanguage();
      const sound = useSoundOn();
      seen.push(`${state.status}:${language}:${sound}`);
      return null;
    });
    await flush();
    act(() => mock!.event('soundChanged', { on: false }));
    expect(seen).toContain('ready:fr:true');
    expect(seen.at(-1)).toBe('ready:fr:false');
    unmount();
  });

  it('shows the main button while mounted and calls the latest onClick', async () => {
    mock = mockLia();
    const first = vi.fn();
    const second = vi.fn();
    let handler = first;
    let rerender = () => {};
    const { unmount } = render(() => {
      const [, setTick] = useState(0);
      rerender = () => setTick((n) => n + 1);
      useMainButton({ text: 'Play', onClick: handler });
      return null;
    });
    await flush();
    handler = second;
    act(() => rerender());
    act(() => mock!.event('mainButtonClicked'));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    unmount();
    await flush();
    const last = mock.calls.filter((c) => c.method === 'bottomButton').pop();
    expect(last?.params).toMatchObject({ type: 'main', text: 'Play', visible: false });
  });

  it('shows the back button only while a handler is given', async () => {
    mock = mockLia();
    const back = vi.fn();
    const { unmount } = render(() => {
      useBackButton(back);
      return null;
    });
    act(() => mock!.event('backButtonClicked'));
    expect(back).toHaveBeenCalledOnce();
    unmount();
    expect(mock.calls.filter((c) => c.method === 'headerButton').map((c) => c.params)).toEqual([
      { type: 'back', visible: true },
      { type: 'back', visible: false },
    ]);
  });

  it('docks a banner while mounted and follows it', async () => {
    mock = mockLia();
    let seen: unknown = null;
    const { unmount } = render(() => {
      useInit();
      useBannerAd('top');
      seen = useBanner();
      return null;
    });
    await flush();
    act(() => mock!.event('banner', { state: 'shown', position: 'top', height: 50 }));
    expect(seen).toEqual({ visible: true, position: 'top', height: 50 });
    unmount();
    await flush();
    expect(mock.calls.filter((c) => c.method.endsWith('Banner')).map((c) => ({ method: c.method, params: c.params ?? {} }))).toEqual([
      { method: 'showBanner', params: { position: 'top' } },
      { method: 'hideBanner', params: {} },
    ]);
  });
});
