import { createRoot, createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackButton, createInit, createMainButton, mockLia, resetForTests, resetStateForTests, useLanguage, useSoundOn, type Mock } from '../src';

let mock: Mock | null = null;
afterEach(() => {
  mock?.restore();
  mock = null;
  resetForTests();
  resetStateForTests();
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('@lia-labs/sdk-solid', () => {
  it('runs init and follows Lia\'s state as accessors', async () => {
    mock = mockLia({ init: { language: 'zh' } });
    await createRoot(async (dispose) => {
      const state = createInit();
      const language = useLanguage();
      const sound = useSoundOn();
      await tick();
      expect(state().status).toBe('ready');
      expect(language()).toBe('zh');
      mock!.event('soundChanged', { on: false });
      expect(sound()).toBe(false);
      dispose();
    });
  });

  it('drives the main button from an accessor and hides it with the root', async () => {
    mock = mockLia();
    const clicked = vi.fn();
    let setText!: (v: string) => void;
    let dispose!: () => void;
    createRoot((d) => {
      dispose = d;
      const [text, set] = createSignal('Start');
      setText = set;
      createMainButton(() => ({ text: text(), onClick: clicked }));
      createBackButton(() => {});
    });
    await tick();
    setText('Next');
    await tick();
    mock.event('mainButtonClicked');
    dispose();
    expect(clicked).toHaveBeenCalledOnce();
    const sent = mock.calls.filter((c) => c.method === 'bottomButton').map((c) => [c.params.text, c.params.visible]);
    expect(sent).toContainEqual(['Next', true]);
    expect(sent.at(-1)).toEqual(['Next', false]);
    expect(mock.calls.filter((c) => c.method === 'headerButton').map((c) => c.params.visible)).toEqual([true, false]);
  });
});
