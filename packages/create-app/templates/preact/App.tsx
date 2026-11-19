import { t } from './i18n';
import { useEffect, useState } from 'preact/hooks';
import { ready, toast, useInit, useLanguage, useMode, usePlayer, useMainButton } from './lia';
import { mocked } from './local-dev';
import { FRAMEWORK, SDK_PACKAGE } from './config';
import { groups, executeAction, type DemoAction } from './demo';
import { errorMessage, exampleSource, formatResult } from './format';

export function App() {
  const lia = useInit();
  const player = usePlayer(), language = useLanguage(), mode = useMode();
  const [selected, setSelected] = useState(groups[0].id);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState('Choose a feature to see its response.');
  const [failed, setFailed] = useState(false);
  const section = groups.find(group => group.id === selected)!;
  useEffect(() => { if (lia.status === 'ready') ready(); }, [lia.status]);
  useMainButton(lia.status === 'ready' && { text: t('Try a toast'), onClick: () => { void toast(t('Hello from {framework}').replace('{framework}', FRAMEWORK)).catch(error => { setFailed(true); setResult(errorMessage(error)); }); } });
  async function run(action: DemoAction) {
    if (busy) return;
    setBusy(action.id); setFailed(false);
    try { setResult(formatResult(await executeAction(action))); }
    catch (error) { setFailed(true); setResult(errorMessage(error)); }
    finally { setBusy(null); }
  }
  if (lia.status !== 'ready') return <div className="loading"><div><h1>{lia.status === 'loading' ? 'Connecting to Lia…' : 'Open this app in Lia'}</h1><p>{lia.status === 'error' ? errorMessage(lia.error) : 'Loading your player, language and theme.'}</p></div></div>;
  return <main>
    <header><div className="brand"><span className="mark" aria-hidden>{'</>'}</span>Lia Developer Kit</div><span className="badge">{mocked ? 'Local simulation' : mode === 'test' ? 'Lia test mode' : 'Lia live mode'}</span></header>
    <section className="hero"><span className="eyebrow">{FRAMEWORK} · {SDK_PACKAGE}</span><h1>Your ideas. Inside Lia.</h1><p>A working app with native features, framework state and examples you can make your own.</p><div className="meta"><span>Hello @{player?.name}</span><span>Language: {language}</span><span>Theme and safe areas follow Lia</span></div></section>
    <p className="notice">{mocked ? 'This browser simulates Lia. Payments, ads and rewards are pretend; camera, haptics and permissions still need testing in Lia.' : 'Explore one feature at a time. Native permissions require your approval. Demo purchases and scores run only in test mode.'}</p>
    <nav className="tabs" role="tablist" aria-label="SDK features">{groups.map(group=><button type="button" role="tab" key={group.id} aria-selected={selected===group.id} onClick={()=>setSelected(group.id)}>{group.title}</button>)}</nav>
    <section aria-label={section.title}><h2>{section.title}</h2><p className="intro">{section.description}</p><div className="grid">{section.actions.map(action=><article className="feature" key={action.id}><h3>{action.label}</h3><p>{action.description}</p><button type="button" className="run" disabled={busy!==null} aria-busy={busy===action.id} onClick={()=>void run(action)}>{busy===action.id ? 'Running…' : 'Try it'}</button><details><summary>View {FRAMEWORK} example</summary><pre><code>{exampleSource(action.code,SDK_PACKAGE)}</code></pre></details></article>)}</div></section>
    <section className="result" aria-live="polite"><h2>Response</h2><pre className={failed?'error':''}>{result}</pre></section>
    <footer><a href="https://docs.lialabs.org/packages">SDK documentation</a><a href="https://developers.lialabs.org">Developer portal</a><a href="https://docs.lialabs.org/guides/verify-on-your-server">Verify on your server</a></footer>
  </main>;
}
