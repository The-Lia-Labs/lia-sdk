import { t } from './i18n';
import { createEffect, createSignal, For, Show } from 'solid-js';
import { createInit, createMainButton, ready, toast, useLanguage, useMode, usePlayer } from './lia';
import { mocked } from './local-dev';
import { FRAMEWORK, SDK_PACKAGE } from './config';
import { groups, executeAction, type DemoAction } from './demo';
import { errorMessage, exampleSource, formatResult } from './format';
export function App(){
  const lia=createInit(), player=usePlayer(),language=useLanguage(),mode=useMode();
  const [selected,setSelected]=createSignal(groups[0].id),[busy,setBusy]=createSignal<string|null>(null),[result,setResult]=createSignal('Choose a feature to see its response.'),[failed,setFailed]=createSignal(false);
  const section=()=>groups.find(group=>group.id===selected())!;
  createEffect(()=>{if(lia().status==='ready')ready();});
  createMainButton(()=>lia().status==='ready'&&{text:t('Try a toast'),onClick:()=>{void toast('Hello from Solid').catch(error=>{setFailed(true);setResult(errorMessage(error));});}});
  async function run(action:DemoAction){if(busy())return;setBusy(action.id);setFailed(false);try{setResult(formatResult(await executeAction(action)));}catch(error){setFailed(true);setResult(errorMessage(error));}finally{setBusy(null);}}
  return <Show when={lia().status==='ready'} fallback={<div class="loading"><div><h1>{lia().status==='loading'?'Connecting to Lia…':'Open this app in Lia'}</h1><p>{lia().status==='error'?errorMessage(lia().error):'Loading your player, language and theme.'}</p></div></div>}>
    <main><header><div class="brand"><span class="mark" aria-hidden="true">{'</>'}</span>Lia Developer Kit</div><span class="badge">{mocked?'Local simulation':mode()==='test'?'Lia test mode':'Lia live mode'}</span></header>
    <section class="hero"><span class="eyebrow">{FRAMEWORK} · {SDK_PACKAGE}</span><h1>Your ideas. Inside Lia.</h1><p>A working app with native features, framework state and examples you can make your own.</p><div class="meta"><span>Hello @{player()?.name}</span><span>Language: {language()}</span><span>Theme and safe areas follow Lia</span></div></section>
    <p class="notice">{mocked?'This browser simulates Lia. Payments, ads and rewards are pretend; camera, haptics and permissions still need testing in Lia.':'Explore one feature at a time. Native permissions require your approval. Demo purchases and scores run only in test mode.'}</p>
    <nav class="tabs" role="tablist" aria-label="SDK features"><For each={groups}>{group=><button type="button" role="tab" aria-selected={selected()===group.id} onClick={()=>setSelected(group.id)}>{group.title}</button>}</For></nav>
    <section aria-label={section().title}><h2>{section().title}</h2><p class="intro">{section().description}</p><div class="grid"><For each={section().actions}>{action=><article class="feature"><h3>{action.label}</h3><p>{action.description}</p><button class="run" type="button" disabled={busy()!==null} aria-busy={busy()===action.id} onClick={()=>void run(action)}>{busy()===action.id?'Running…':'Try it'}</button><details><summary>View {FRAMEWORK} example</summary><pre><code>{exampleSource(action.code,SDK_PACKAGE)}</code></pre></details></article>}</For></div></section>
    <section class="result" aria-live="polite"><h2>Response</h2><pre classList={{error:failed()}}>{result()}</pre></section>
    <footer><a href="https://docs.lialabs.org/packages">SDK documentation</a><a href="https://developers.lialabs.org">Developer portal</a><a href="https://docs.lialabs.org/guides/verify-on-your-server">Verify on your server</a></footer></main>
  </Show>;
}
