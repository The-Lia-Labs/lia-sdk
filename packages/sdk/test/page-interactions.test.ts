import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPageInteractions, init, mockLia, resetForTests, resetStateForTests, setPageInteractions } from '../src/index';

let frame: HTMLIFrameElement;
beforeEach(() => {
  frame = document.createElement('iframe'); document.body.append(frame);
  vi.stubGlobal('window', frame.contentWindow!); vi.stubGlobal('document', frame.contentDocument!);
  document.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
  document.body.innerHTML = '<p id="copy">A paragraph</p><input value="Editable"><div contenteditable="true"><b>Editor</b></div><img src="data:,">';
});
afterEach(() => { resetForTests(); resetStateForTests(); vi.unstubAllGlobals(); frame.remove(); });
function event(selector: string, name: string, extra: Record<string, unknown> = {}) {
  const e = document.createEvent('Event'); e.initEvent(name, true, true);
  Object.assign(e, extra); document.querySelector(selector)!.dispatchEvent(e); return e;
}
describe('browser interaction controls', () => {
  it('installs immediately during init without adding a native method', async () => {
    const mock = mockLia(); const started = init();
    expect(getPageInteractions()).toEqual({ zoom: false, textSelection: false, contextMenu: false, nativeDrag: false });
    expect(document.documentElement.dataset.liaZoom).toBe('off');
    await started; expect(mock.calls.map(c => c.method)).toEqual(['init']);
  });
  it('protects page content, while leaving field and rich-text editing usable', () => {
    getPageInteractions();
    for (const name of ['selectstart', 'contextmenu', 'dragstart']) {
      expect(event('#copy', name).defaultPrevented).toBe(true);
      expect(event('input', name).defaultPrevented).toBe(false);
      expect(event('b', name).defaultPrevented).toBe(false);
    }
    expect(event('#copy', 'keydown', { ctrlKey: true, key: 'a' }).defaultPrevented).toBe(true);
    expect(event('input', 'keydown', { ctrlKey: true, key: 'a' }).defaultPrevented).toBe(false);
    expect(event('#copy', 'click').defaultPrevented).toBe(false);
    expect(event('#copy', 'touchmove', { touches: [{}] }).defaultPrevented).toBe(false);
    // Scrolling never waits on the SDK: no touch listener cancels anything; pinch zoom is off through CSS.
    expect(event('#copy', 'touchmove', { touches: [{}, {}] }).defaultPrevented).toBe(false);
    expect(document.querySelector('style[data-lia-page-interactions]')!.textContent).toContain(':where(html[data-lia-zoom="off"]) :where(*){touch-action:pan-x pan-y}');
    expect(event('#copy', 'wheel', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(event('#copy', 'wheel').defaultPrevented).toBe(false);
  });
  it('toggles each control independently and restores the authored viewport', () => {
    const original = document.querySelector('meta')!.getAttribute('content');
    getPageInteractions(); expect(document.querySelector('meta')!.content).toContain('user-scalable=no');
    setPageInteractions({ zoom: true, textSelection: true });
    expect(document.querySelector('meta')!.getAttribute('content')).toBe(original);
    expect(event('#copy', 'gesturestart').defaultPrevented).toBe(false);
    expect(event('#copy', 'selectstart').defaultPrevented).toBe(false);
    expect(event('#copy', 'contextmenu').defaultPrevented).toBe(true);
    setPageInteractions({ contextMenu: true, nativeDrag: true });
    expect(event('#copy', 'contextmenu').defaultPrevented).toBe(false);
    expect(event('img', 'dragstart').defaultPrevented).toBe(false);
    setPageInteractions({ zoom: false }); setPageInteractions({ zoom: true });
    expect(document.querySelector('meta')!.getAttribute('content')).toBe(original);
  });
  it('validates atomically and shares one controller per document', () => {
    expect(() => setPageInteractions({ zoom: true, other: false } as never)).toThrow();
    expect(getPageInteractions().zoom).toBe(false);
    const snapshot = getPageInteractions(); snapshot.zoom = true;
    expect(getPageInteractions().zoom).toBe(false);
    setPageInteractions({ zoom: true }); getPageInteractions();
    expect(document.querySelectorAll('[data-lia-page-interactions]')).toHaveLength(1);
    expect(getPageInteractions().zoom).toBe(true);
    expect(() => setPageInteractions({ zoom: 'yes' } as never)).toThrow();
  });
});
