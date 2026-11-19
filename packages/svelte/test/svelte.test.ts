import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { init, initStore, mockLia, resetForTests, resetStateForTests, stores, toStore, signal, useBackButton, useMainButton, type Mock } from '../src';

let mock: Mock | null = null;
afterEach(() => {
  mock?.restore();
  mock = null;
  resetForTests();
  resetStateForTests();
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('@lia-labs/sdk-svelte', () => {
  it('turns SDK values into stores that start with the current value', () => {
    const count = signal(1);
    const store = toStore(count);
    const seen: number[] = [];
    const stop = store.subscribe((v) => seen.push(v));
    count.set(2);
    stop();
    count.set(3);
    expect(seen).toEqual([1, 2]);
  });

  it('follows Lia\'s state after init', async () => {
    mock = mockLia({ init: { language: 'sw' } });
    const lia = initStore();
    const status: string[] = [];
    const stop = lia.subscribe((s) => status.push(s.status));
    await tick();
    expect(status).toEqual(['loading', 'ready']);
    expect(get(stores.language)).toBe('sw');
    mock.event('soundChanged', { on: false });
    expect(get(stores.soundOn)).toBe(false);
    stop();
  });

  it('shows the main button until disposed, and back until disposed', async () => {
    mock = mockLia();
    await init();
    const clicked = vi.fn();
    const button = useMainButton({ text: 'Go', onClick: clicked });
    button.update({ text: 'Again', onClick: clicked });
    mock.event('mainButtonClicked');
    button.dispose();
    const back = useBackButton(() => {});
    back.dispose();
    expect(clicked).toHaveBeenCalledOnce();
    const sent = mock.calls.filter((c) => c.method === 'bottomButton').map((c) => [c.params.text, c.params.visible]);
    expect(sent).toEqual([
      ['Go', true],
      ['Again', true],
      ['Again', false],
    ]);
  });
});
