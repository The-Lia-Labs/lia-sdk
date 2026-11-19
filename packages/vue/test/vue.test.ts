import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockLia, resetForTests, resetStateForTests, useBackButton, useInit, useLanguage, useMainButton, useSoundOn, type Mock } from '../src';

let mock: Mock | null = null;
afterEach(() => {
  mock?.restore();
  mock = null;
  resetForTests();
  resetStateForTests();
});

function mount(setup: () => () => unknown) {
  const app = createApp(defineComponent({ setup: () => setup() as () => null }));
  app.mount(document.createElement('div'));
  return app;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('@lia-labs/sdk-vue', () => {
  it('runs init and follows Lia\'s state as refs', async () => {
    mock = mockLia({ init: { language: 'pt' } });
    let state!: ReturnType<typeof useInit>;
    let language!: ReturnType<typeof useLanguage>;
    let sound!: ReturnType<typeof useSoundOn>;
    const app = mount(() => {
      state = useInit();
      language = useLanguage();
      sound = useSoundOn();
      return () => h('div');
    });
    await tick();
    expect(state.status.value).toBe('ready');
    expect(language.value).toBe('pt');
    mock.event('soundChanged', { on: false });
    expect(sound.value).toBe(false);
    app.unmount();
  });

  it('drives the main button from a ref, and hides it when unmounted', async () => {
    mock = mockLia();
    const clicked = vi.fn();
    const text = ref('Start');
    const app = mount(() => {
      useMainButton(() => ({ text: text.value, onClick: clicked }));
      return () => h('div');
    });
    text.value = 'Next';
    await nextTick();
    mock.event('mainButtonClicked');
    expect(clicked).toHaveBeenCalledOnce();
    app.unmount();
    await tick();
    const sent = mock.calls.filter((c) => c.method === 'bottomButton').map((c) => [c.params.text, c.params.visible]);
    expect(sent.at(-1)).toEqual(['Next', false]);
    expect(sent).toContainEqual(['Next', true]);
  });

  it('shows the back button while given a handler', () => {
    mock = mockLia();
    const back = vi.fn();
    const app = mount(() => {
      useBackButton(back);
      return () => h('div');
    });
    mock.event('backButtonClicked');
    app.unmount();
    expect(back).toHaveBeenCalledOnce();
    expect(mock.calls.map((c) => c.params)).toEqual([
      { type: 'back', visible: true },
      { type: 'back', visible: false },
    ]);
  });
});
