import { init, ready } from './lia';
import { APP_NAME } from './config';
import { appTitle, connectionMessage, GUIDE_URL, openGuide } from './starter';

export function mount() {
  const root = document.getElementById('app')!;
  root.innerHTML = '<main><span class="mark" aria-hidden="true">✦</span><h1></h1><p role="status"></p><a target="_blank" rel="noreferrer">Start building →</a></main>';
  root.querySelector('h1')!.textContent = appTitle(APP_NAME);
  const status = root.querySelector('[role="status"]')!;
  status.textContent = connectionMessage({ status: 'loading' });
  const link = root.querySelector('a')!;
  link.href = GUIDE_URL;
  link.addEventListener('click', openGuide);
  let disposed = false;
  void init().then(() => {
    if (disposed) return;
    status.textContent = connectionMessage({ status: 'ready' });
    requestAnimationFrame(() => { if (!disposed) ready(); });
  }).catch(() => { if (!disposed) status.textContent = connectionMessage({ status: 'error' }); });
  return () => { disposed = true; link.removeEventListener('click', openGuide); };
}
