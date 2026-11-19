import { createEnvironmentInjector, Injector, runInInjectionContext, type EnvironmentInjector } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { injectBackButton, injectInit, injectLanguage, injectMainButton, injectSoundOn, mockLia, resetForTests, resetStateForTests, type Mock } from '../src';

let mock: Mock | null = null;
afterEach(() => {
  mock?.restore();
  mock = null;
  resetForTests();
  resetStateForTests();
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const context = () => createEnvironmentInjector([], Injector.NULL as unknown as EnvironmentInjector);

describe('@lia-labs/sdk-angular', () => {
  it('runs init and follows Lia\'s state as signals', async () => {
    mock = mockLia({ init: { language: 'hi' } });
    const injector = context();
    const { state, language, sound } = runInInjectionContext(injector, () => ({ state: injectInit(), language: injectLanguage(), sound: injectSoundOn() }));
    await tick();
    expect(state().status).toBe('ready');
    expect(language()).toBe('hi');
    mock.event('soundChanged', { on: false });
    expect(sound()).toBe(false);
    injector.destroy();
    mock.event('soundChanged', { on: true });
    expect(sound()).toBe(false);
  });

  it('shows buttons until the injector is destroyed', () => {
    mock = mockLia();
    const clicked = vi.fn();
    const injector = context();
    runInInjectionContext(injector, () => {
      injectMainButton({ text: 'Play', onClick: clicked });
      injectBackButton(() => {});
    });
    mock.event('mainButtonClicked');
    injector.destroy();
    expect(clicked).toHaveBeenCalledOnce();
    expect(mock.calls.filter((c) => c.method === 'bottomButton').map((c) => c.params.visible)).toEqual([true, false]);
    expect(mock.calls.filter((c) => c.method === 'headerButton').map((c) => c.params.visible)).toEqual([true, false]);
  });
});
