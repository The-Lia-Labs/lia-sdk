import './local-dev';
import './styles.css';
import { request, send, on, type ThemeParams } from './lia';
import { groups, executeAction, type DemoAction } from './demo';
import { FRAMEWORK, SDK_PACKAGE } from './config';
import { mocked } from './local-dev';
import { errorMessage, formatResult, exampleSource } from './format';
const root=document.getElementById('app')!;
root.innerHTML='<div class="loading"><h1>Connecting to Lia…</h1></div>';
let selected=groups[0].id,busy=false;
const cleanups:(()=>void)[]=[];
function theme(values:ThemeParams){for(const[key,value]of Object.entries(values))if(typeof value==='string')document.documentElement.style.setProperty('--lia-'+key.replaceAll('_','-'),value);}
void request('init').then(me=>{
  theme(me.themeParams);document.documentElement.lang=me.language;document.documentElement.dir=me.rtl?'rtl':'ltr';
  cleanups.push(on('theme',data=>{if(data?.theme)theme(data.theme);}));
  root.innerHTML='<main><header><div class="brand"><span class="mark">&lt;/&gt;</span>Lia Developer Kit</div><span class="badge" id="mode"></span></header><section class="hero"><span class="eyebrow" id="framework"></span><h1>Build your own SDK layer.</h1><p>Typed raw requests and events. This advanced example shows what sits beneath the framework bindings.</p><div class="meta"><span id="player"></span></div></section><p class="notice">Local development uses simulated answers. Verify sessions, payments and rewards on your server. Permission prompts happen only after a click.</p><nav class="tabs" role="tablist" aria-label="Bridge features"></nav><h2 id="title"></h2><p class="intro" id="description"></p><div class="grid"></div><section class="result" aria-live="polite"><h2>Response</h2><pre id="result">Choose a feature to see its response.</pre></section><footer><a href="https://docs.lialabs.org/packages/bridge">Bridge documentation</a><a href="https://docs.lialabs.org/reference/sdk">SDK reference</a><a href="https://developers.lialabs.org">Developer portal</a></footer></main>';
  root.querySelector('#framework')!.textContent=FRAMEWORK+' · '+SDK_PACKAGE;root.querySelector('#mode')!.textContent=mocked?'Local simulation':me.mode==='test'?'Lia test mode':'Lia live mode';root.querySelector('#player')!.textContent='Hello @'+me.player.name+' · Language: '+me.language;
  function render(){const group=groups.find(group=>group.id===selected)!;root.querySelector('#title')!.textContent=group.title;root.querySelector('#description')!.textContent=group.description;root.querySelector('nav')!.replaceChildren(...groups.map(group=>{const button=document.createElement('button');button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(selected===group.id));button.textContent=group.title;button.onclick=()=>{selected=group.id;render();};return button;}));root.querySelector('.grid')!.replaceChildren(...group.actions.map(action=>{const card=document.createElement('article');card.className='feature';const h=document.createElement('h3'),p=document.createElement('p'),button=document.createElement('button'),details=document.createElement('details'),summary=document.createElement('summary'),code=document.createElement('pre');h.textContent=action.label;p.textContent=action.description;button.className='run';button.textContent='Try it';button.disabled=busy;button.onclick=()=>void run(action,button);summary.textContent='View bridge example';code.textContent=exampleSource(action.code,SDK_PACKAGE);details.append(summary,code);card.append(h,p,button,details);return card;}));}
  async function run(action:DemoAction,button:HTMLButtonElement){if(busy)return;busy=true;button.textContent='Running…';root.querySelectorAll<HTMLButtonElement>('.run').forEach(button=>button.disabled=true);const result=root.querySelector('#result')!;result.className='';try{result.textContent=formatResult(await executeAction(action));}catch(error){result.className='error';result.textContent=errorMessage(error);}finally{busy=false;button.textContent='Try it';root.querySelectorAll<HTMLButtonElement>('.run').forEach(button=>button.disabled=false);}}
  render();requestAnimationFrame(()=>send('ready'));
}).catch(error=>{root.replaceChildren();const p=document.createElement('p');p.textContent='Open in Lia: '+errorMessage(error);root.append(p);});
import.meta.hot?.dispose(()=>cleanups.forEach(stop=>stop()));
