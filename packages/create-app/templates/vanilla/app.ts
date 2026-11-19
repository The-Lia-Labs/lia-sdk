import * as Lia from './lia';
import { mocked } from './local-dev';
import { FRAMEWORK, SDK_PACKAGE } from './config';
import { groups, executeAction, type DemoAction } from './demo';
import { errorMessage, exampleSource, formatResult } from './format';

export function mount(options: { nativeButton?: boolean } = {}) {
  const root=document.getElementById('app')!;
  root.innerHTML='<div class="loading"><div><h1>Connecting to Lia…</h1><p>Loading your player, language and theme.</p></div></div>';
  let disposed=false, busy=false, selected=groups[0].id;
  const cleanups:(()=>void)[]=[];
  void Lia.init().then(()=>{
    if(disposed)return;
    root.innerHTML='<main><header><div class="brand"><span class="mark" aria-hidden="true">&lt;/&gt;</span>Lia Developer Kit</div><span class="badge" id="mode"></span></header><section class="hero"><span class="eyebrow" id="framework"></span><h1>Your ideas. Inside Lia.</h1><p>A working app with native features, framework state and examples you can make your own.</p><div class="meta"><span id="player"></span><span id="language"></span><span>Theme and safe areas follow Lia</span></div></section><p class="notice" id="notice"></p><nav class="tabs" role="tablist" aria-label="SDK features"></nav><section><h2 id="section-title"></h2><p class="intro" id="section-description"></p><div class="grid"></div></section><section class="result" aria-live="polite"><h2>Response</h2><pre id="result">Choose a feature to see its response.</pre></section><footer><a href="https://docs.lialabs.org/packages">SDK documentation</a><a href="https://developers.lialabs.org">Developer portal</a><a href="https://docs.lialabs.org/guides/verify-on-your-server">Verify on your server</a></footer></main>';
    root.querySelector('#framework')!.textContent=FRAMEWORK+' · '+SDK_PACKAGE;
    root.querySelector('#notice')!.textContent=mocked?'This browser simulates Lia. Payments, ads and rewards are pretend; camera, haptics and permissions still need testing in Lia.':'Explore one feature at a time. Native permissions require your approval. Demo purchases and scores run only in test mode.';
    const identity=()=>{
      root.querySelector('#player')!.textContent='Hello @'+(Lia.player.get()?.name??'');
      root.querySelector('#language')!.textContent='Language: '+Lia.language.get();
      root.querySelector('#mode')!.textContent=mocked?'Local simulation':Lia.mode.get()==='test'?'Lia test mode':'Lia live mode';
    };
    identity();cleanups.push(Lia.player.subscribe(identity),Lia.language.subscribe(identity),Lia.mode.subscribe(identity));
    function render(){
      const group=groups.find(group=>group.id===selected)!;
      root.querySelector('#section-title')!.textContent=group.title;
      root.querySelector('#section-description')!.textContent=group.description;
      root.querySelector('nav')!.replaceChildren(...groups.map(group=>{const button=document.createElement('button');button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(selected===group.id));button.textContent=group.title;button.onclick=()=>{selected=group.id;render();};return button;}));
      root.querySelector('.grid')!.replaceChildren(...group.actions.map(action=>{
        const card=document.createElement('article');card.className='feature';
        const title=document.createElement('h3');title.textContent=action.label;
        const description=document.createElement('p');description.textContent=action.description;
        const button=document.createElement('button');button.type='button';button.className='run';button.textContent='Try it';button.disabled=busy;button.onclick=()=>void run(action,button);
        const details=document.createElement('details'),summary=document.createElement('summary'),code=document.createElement('pre');summary.textContent='View '+FRAMEWORK+' example';code.textContent=exampleSource(action.code,SDK_PACKAGE);details.append(summary,code);
        card.append(title,description,button,details);return card;
      }));
    }
    async function run(action:DemoAction,button:HTMLButtonElement){
      if(busy)return;busy=true;button.textContent='Running…';button.setAttribute('aria-busy','true');root.querySelectorAll<HTMLButtonElement>('.run').forEach(button=>button.disabled=true);
      const result=root.querySelector('#result')!;result.className='';
      try{result.textContent=formatResult(await executeAction(action));}catch(error){result.className='error';result.textContent=errorMessage(error);}finally{busy=false;button.textContent='Try it';button.removeAttribute('aria-busy');root.querySelectorAll<HTMLButtonElement>('.run').forEach(button=>button.disabled=false);}
    }
    render();
    if(options.nativeButton!==false){const control=Lia.controlBottomButton(Lia.mainButton,{text:'Try a toast',onClick:()=>{void Lia.toast('Hello from '+FRAMEWORK).catch(error=>{root.querySelector('#result')!.textContent=errorMessage(error);});}});cleanups.push(()=>control.dispose());}
    requestAnimationFrame(()=>{if(!disposed)Lia.ready();});
  }).catch(error=>{if(!disposed){root.replaceChildren();const main=document.createElement('main'),title=document.createElement('h1'),message=document.createElement('p');title.textContent='Open this app in Lia';message.textContent=errorMessage(error);main.append(title,message);root.append(main);}});
  return ()=>{disposed=true;cleanups.forEach(dispose=>dispose());};
}
