import './local-dev';
import './styles.css';
import { request, send, on, type ThemeParams, type Insets } from './lia';
import { APP_NAME } from './config';
import { appTitle, connectionMessage, GUIDE_URL, openGuide } from './starter';

const root = document.getElementById('app')!;
root.innerHTML = '<main><span class="mark" aria-hidden="true">✦</span><h1></h1><p role="status"></p><a target="_blank" rel="noreferrer">Start building →</a></main>';
root.querySelector('h1')!.textContent = appTitle(APP_NAME);
const status = root.querySelector('[role="status"]')!;
status.textContent = connectionMessage({ status: 'loading' });
const link = root.querySelector('a')!;
link.href = GUIDE_URL;
link.addEventListener('click', openGuide);
const cleanups: (() => void)[] = [];
cleanups.push(on('languageChanged', data => { document.documentElement.lang = data.language; document.documentElement.dir = data.rtl ? 'rtl' : 'ltr'; }));
let disposed = false;
function theme(values: ThemeParams) { for (const [key,value] of Object.entries(values)) if (typeof value === 'string') document.documentElement.style.setProperty('--lia-' + key.replaceAll('_','-'), value); }
function insets(values: Insets) { for (const [side,value] of Object.entries(values)) document.documentElement.style.setProperty('--lia-content-safe-area-inset-' + side, value + 'px'); }
void request('init').then(me => {
  if (disposed) return;
  theme(me.themeParams); insets(me.contentSafeArea);
  document.documentElement.lang = me.language; document.documentElement.dir = me.rtl ? 'rtl' : 'ltr';
  cleanups.push(on('theme', data => { if (data?.theme) theme(data.theme); }), on('safeAreaChanged', data => insets(data.contentSafeArea)));
  status.textContent = connectionMessage({ status: 'ready' });
  requestAnimationFrame(() => { if (!disposed) send('ready'); });
}).catch(() => { if (!disposed) status.textContent = connectionMessage({ status: 'error' }); });
import.meta.hot?.dispose(() => { disposed = true; link.removeEventListener('click', openGuide); cleanups.forEach(stop => stop()); });
