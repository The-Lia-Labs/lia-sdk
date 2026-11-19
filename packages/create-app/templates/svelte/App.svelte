<script lang="ts">
import { t } from './i18n';
  import { initStore, ready, toast, stores, useMainButton } from './lia';
  import { mocked } from './local-dev';
  import { FRAMEWORK, SDK_PACKAGE } from './config';
  import { groups, executeAction, type DemoAction } from './demo';
  import { errorMessage, exampleSource, formatResult } from './format';
  const lia=initStore(), {player,language,mode}=stores;
  let selected=groups[0].id, busy:string|null=null, result='Choose a feature to see its response.', failed=false, announced=false;
  $: section=groups.find(group=>group.id===selected)!;
  $: if($lia.status==='ready'&&!announced){announced=true;ready();}
  useMainButton({text:t('Try a toast'),onClick:()=>{void toast('Hello from Svelte').catch(error=>{failed=true;result=errorMessage(error);});}});
  async function run(action:DemoAction){if(busy)return;busy=action.id;failed=false;try{result=formatResult(await executeAction(action));}catch(error){failed=true;result=errorMessage(error);}finally{busy=null;}}
</script>
{#if $lia.status!=='ready'}
  <div class="loading"><div><h1>{$lia.status==='loading'?'Connecting to Lia…':'Open this app in Lia'}</h1><p>{$lia.status==='error'?errorMessage($lia.error):'Loading your player, language and theme.'}</p></div></div>
{:else}
  <main>
    <header><div class="brand"><span class="mark" aria-hidden="true">&lt;/&gt;</span>Lia Developer Kit</div><span class="badge">{mocked?'Local simulation':$mode==='test'?'Lia test mode':'Lia live mode'}</span></header>
    <section class="hero"><span class="eyebrow">{FRAMEWORK} · {SDK_PACKAGE}</span><h1>Your ideas. Inside Lia.</h1><p>A working app with native features, framework state and examples you can make your own.</p><div class="meta"><span>Hello @{$player?.name}</span><span>Language: {$language}</span><span>Theme and safe areas follow Lia</span></div></section>
    <p class="notice">{mocked?'This browser simulates Lia. Payments, ads and rewards are pretend; camera, haptics and permissions still need testing in Lia.':'Explore one feature at a time. Native permissions require your approval. Demo purchases and scores run only in test mode.'}</p>
    <nav class="tabs" role="tablist" aria-label="SDK features">{#each groups as group(group.id)}<button type="button" role="tab" aria-selected={selected===group.id} onclick={()=>selected=group.id}>{group.title}</button>{/each}</nav>
    <section aria-label={section.title}><h2>{section.title}</h2><p class="intro">{section.description}</p><div class="grid">{#each section.actions as action(action.id)}<article class="feature"><h3>{action.label}</h3><p>{action.description}</p><button class="run" type="button" disabled={busy!==null} aria-busy={busy===action.id} onclick={()=>run(action)}>{busy===action.id?'Running…':'Try it'}</button><details><summary>View {FRAMEWORK} example</summary><pre><code>{exampleSource(action.code,SDK_PACKAGE)}</code></pre></details></article>{/each}</div></section>
    <section class="result" aria-live="polite"><h2>Response</h2><pre class:error={failed}>{result}</pre></section>
    <footer><a href="https://docs.lialabs.org/packages">SDK documentation</a><a href="https://developers.lialabs.org">Developer portal</a><a href="https://docs.lialabs.org/guides/verify-on-your-server">Verify on your server</a></footer>
  </main>
{/if}
