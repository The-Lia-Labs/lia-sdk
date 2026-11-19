import { disableClosingConfirmation, disableVerticalSwipes, enableClosingConfirmation, enableVerticalSwipes } from './app';
import type { BottomButton, BottomButtonParams, HeaderButton } from './components';

// Helpers the framework packages share: each ties a piece of Lia's UI to a component's life (shown
// while it's mounted, hidden after), so React, Vue, Svelte, Solid, Angular and the web components all
// behave the same way.

export interface BottomButtonOptions extends BottomButtonParams {
  onClick?: () => void;
}

export interface Control<P> {
  /** New params (the click handler is read fresh on every press). */
  update(params: P): void;
  /** Stops listening and hides it. */
  dispose(): void;
}

/** Shows a bottom button with these params while the control lives. */
export function controlBottomButton(button: BottomButton, options: BottomButtonOptions): Control<BottomButtonOptions> {
  let current = options;
  const stop = button.onClick(() => current.onClick?.());
  const apply = (o: BottomButtonOptions) => {
    const { onClick: _onClick, ...params } = o;
    button.setParams({ isVisible: true, isActive: true, isProgressVisible: false, ...params });
  };
  apply(options);
  return {
    update(next) {
      current = next;
      apply(next);
    },
    dispose() {
      stop();
      button.hide();
    },
  };
}

/** Shows a header button (back, settings) while the control lives. */
export function controlHeaderButton(button: HeaderButton, onClick: () => void): Control<() => void> {
  let current = onClick;
  const stop = button.onClick(() => current());
  button.show();
  return {
    update(next) {
      current = next;
    },
    dispose() {
      stop();
      button.hide();
    },
  };
}

/** Turns Lia's closing confirmation on until the returned function is called. */
export function holdClosingConfirmation(): () => void {
  enableClosingConfirmation().catch(() => {});
  return () => void disableClosingConfirmation().catch(() => {});
}

/** Stops a swipe down from closing the sheet until the returned function is called. */
export function holdVerticalSwipesOff(): () => void {
  disableVerticalSwipes().catch(() => {});
  return () => void enableVerticalSwipes().catch(() => {});
}
