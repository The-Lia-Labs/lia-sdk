import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineLiaElements, mockLia, resetForTests, resetStateForTests, type Mock } from '../src';

let mock: Mock | null = null;
afterEach(() => {
  document.body.innerHTML = '';
  mock?.restore();
  mock = null;
  resetForTests();
  resetStateForTests();
});

defineLiaElements();
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('@lia-labs/elements', () => {
  it('<lia-app> runs init and says when it is ready', async () => {
    mock = mockLia({ init: { language: 'tr' } });
    const ready = vi.fn();
    document.body.addEventListener('lia-ready', (e) => ready((e as CustomEvent).detail.language));
    document.body.innerHTML = '<lia-app></lia-app>';
    await tick();
    expect(ready).toHaveBeenCalledWith('tr');
    expect(document.querySelector('lia-app')!.hasAttribute('ready')).toBe(true);
  });

  it('<lia-main-button> follows its attributes and fires lia-click', async () => {
    mock = mockLia();
    document.body.innerHTML = '<lia-main-button text="Buy"></lia-main-button>';
    const el = document.querySelector('lia-main-button')!;
    const clicked = vi.fn();
    el.addEventListener('lia-click', clicked);
    el.setAttribute('progress', '');
    mock.event('mainButtonClicked');
    el.remove();
    expect(clicked).toHaveBeenCalledOnce();
    const sent = mock.calls.filter((c) => c.method === 'bottomButton').map((c) => [c.params.text, c.params.visible, c.params.progress]);
    expect(sent).toEqual([
      ['Buy', true, false],
      ['Buy', true, true],
      ['Buy', false, true],
    ]);
  });

  it('header buttons and holds last as long as the element', () => {
    mock = mockLia();
    document.body.innerHTML = '<lia-back-button></lia-back-button><lia-closing-confirmation></lia-closing-confirmation>';
    document.body.innerHTML = '';
    expect(mock.calls.map((c) => [c.method, c.params])).toEqual([
      ['headerButton', { type: 'back', visible: true }],
      ['closingConfirmation', { enabled: true }],
      ['headerButton', { type: 'back', visible: false }],
      ['closingConfirmation', { enabled: false }],
    ]);
  });
});
