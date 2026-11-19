import { h, render as preactRender } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockLia, resetForTests, resetStateForTests, useBackButton, useInit, useLanguage, useMainButton, useSoundOn, type Mock } from '../src';

let mock: Mock | null = null;
afterEach(() => {
  mock?.restore();
  mock = null;
  resetForTests();
  resetStateForTests();
});

function render(component: () => unknown) {
  const host = document.createElement('div');
  act(() => preactRender(h(component as () => null, null), host));
  return { host, unmount: () => act(() => preactRender(null, host)) };
}

const flush = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe('@lia-labs/sdk-preact', () => {
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
});
