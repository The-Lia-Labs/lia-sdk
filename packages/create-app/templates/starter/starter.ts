import { isLia, openLink } from './lia';
import { mocked } from './local-dev';

export const GUIDE_URL = 'https://docs.lialabs.org/quickstart';

export function connectionMessage(state: { status: string; error?: unknown }): string {
  if (state.status === 'loading') return 'Connecting to the Lia SDK…';
  if (state.status === 'error') return 'Open this app inside Lia, or enable the local preview to keep building in your browser.';
  return 'The Lia SDK is connected. Start with this page and make it your own.';
}

/** Regular links in your browser; the native link handler when running inside Lia. */
export function openGuide(event: { preventDefault(): void }) {
  if (mocked || !isLia()) return;
  event.preventDefault();
  void openLink(GUIDE_URL, { external: true }).catch(() => {
    const status = document.querySelector<HTMLElement>('[role="status"]');
    if (status) status.textContent = 'Open ' + GUIDE_URL + ' in your browser to start building.';
  });
}

export const appTitle = (name: string) => name + ' has a home in Lia.';
