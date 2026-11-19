<script setup lang="ts">
import { t } from './i18n';
import { computed, ref, watch } from 'vue';
import { ready, toast, useInit, useLanguage, useMode, usePlayer, useMainButton } from './lia';
import { mocked } from './local-dev';
import { FRAMEWORK, SDK_PACKAGE } from './config';
import { groups, executeAction, type DemoAction } from './demo';
import { errorMessage, exampleSource, formatResult } from './format';
const lia=useInit(), player=usePlayer(), language=useLanguage(), mode=useMode();
const status=lia.status, initError=lia.error;
const selected=ref(groups[0].id), busy=ref<string|null>(null), result=ref('Choose a feature to see its response.'), failed=ref(false);
const section=computed(()=>groups.find(group=>group.id===selected.value)!);
watch(status,value=>{if(value==='ready')ready();},{immediate:true});
useMainButton(()=>status.value==='ready'&&{text:t('Try a toast'),onClick:()=>{void toast('Hello from Vue').catch(error=>{failed.value=true;result.value=errorMessage(error);});}});
async function run(action:DemoAction){if(busy.value)return;busy.value=action.id;failed.value=false;try{result.value=formatResult(await executeAction(action));}catch(error){failed.value=true;result.value=errorMessage(error);}finally{busy.value=null;}}
</script>
<template>
  <div v-if="status!=='ready'" class="loading"><div><h1>{{status==='loading'?'Connecting to Lia…':'Open this app in Lia'}}</h1><p>{{status==='error'?errorMessage(initError):'Loading your player, language and theme.'}}</p></div></div>
  <main v-else>
    <header><div class="brand"><span class="mark" aria-hidden="true">&lt;/&gt;</span>Lia Developer Kit</div><span class="badge">{{mocked?'Local simulation':mode==='test'?'Lia test mode':'Lia live mode'}}</span></header>
    <section class="hero"><span class="eyebrow">{{FRAMEWORK}} · {{SDK_PACKAGE}}</span><h1>Your ideas. Inside Lia.</h1><p>A working app with native features, framework state and examples you can make your own.</p><div class="meta"><span>Hello @{{player?.name}}</span><span>Language: {{language}}</span><span>Theme and safe areas follow Lia</span></div></section>
    <p class="notice">{{mocked?'This browser simulates Lia. Payments, ads and rewards are pretend; camera, haptics and permissions still need testing in Lia.':'Explore one feature at a time. Native permissions require your approval. Demo purchases and scores run only in test mode.'}}</p>
    <nav class="tabs" role="tablist" aria-label="SDK features"><button v-for="group in groups" :key="group.id" type="button" role="tab" :aria-selected="selected===group.id" @click="selected=group.id">{{group.title}}</button></nav>
    <section :aria-label="section.title"><h2>{{section.title}}</h2><p class="intro">{{section.description}}</p><div class="grid"><article v-for="action in section.actions" :key="action.id" class="feature"><h3>{{action.label}}</h3><p>{{action.description}}</p><button class="run" type="button" :disabled="busy!==null" :aria-busy="busy===action.id" @click="run(action)">{{busy===action.id?'Running…':'Try it'}}</button><details><summary>View {{FRAMEWORK}} example</summary><pre><code>{{exampleSource(action.code,SDK_PACKAGE)}}</code></pre></details></article></div></section>
    <section class="result" aria-live="polite"><h2>Response</h2><pre :class="{error:failed}">{{result}}</pre></section>
    <footer><a href="https://docs.lialabs.org/packages">SDK documentation</a><a href="https://developers.lialabs.org">Developer portal</a><a href="https://docs.lialabs.org/guides/verify-on-your-server">Verify on your server</a></footer>
  </main>
</template>
