import { t } from './i18n';
import { Component, effect, signal } from '@angular/core';
import { injectInit, injectLanguage, injectMode, injectPlayer, injectMainButton, ready, toast } from './lia';
import { mocked } from './local-dev';
import { FRAMEWORK, SDK_PACKAGE } from './config';
import { groups, executeAction, type DemoAction } from './demo';
import { errorMessage, exampleSource, formatResult } from './format';

@Component({selector:'app-root',standalone:true,template:`
@if(lia().status!=='ready'){
  <div class="loading"><div><h1>{{lia().status==='loading'?'Connecting to Lia…':'Open this app in Lia'}}</h1><p>{{lia().status==='error'?errorMessage(lia().error):'Loading your player, language and theme.'}}</p></div></div>
}@else{
  <main><header><div class="brand"><span class="mark" aria-hidden="true">&lt;/&gt;</span>Lia Developer Kit</div><span class="badge">{{mocked?'Local simulation':mode()==='test'?'Lia test mode':'Lia live mode'}}</span></header>
  <section class="hero"><span class="eyebrow">{{framework}} · {{binding}}</span><h1>Your ideas. Inside Lia.</h1><p>A working app with native features, framework state and examples you can make your own.</p><div class="meta"><span>Hello &#64;{{player()?.name}}</span><span>Language: {{language()}}</span><span>Theme and safe areas follow Lia</span></div></section>
  <p class="notice">{{mocked?'This browser simulates Lia. Payments, ads and rewards are pretend; camera, haptics and permissions still need testing in Lia.':'Explore one feature at a time. Native permissions require your approval. Demo purchases and scores run only in test mode.'}}</p>
  <nav class="tabs" role="tablist" aria-label="SDK features">@for(group of groups;track group.id){<button type="button" role="tab" [attr.aria-selected]="selected()===group.id" (click)="selected.set(group.id)">{{group.title}}</button>}</nav>
  <section [attr.aria-label]="section.title"><h2>{{section.title}}</h2><p class="intro">{{section.description}}</p><div class="grid">@for(action of section.actions;track action.id){<article class="feature"><h3>{{action.label}}</h3><p>{{action.description}}</p><button class="run" type="button" [disabled]="busy()!==null" [attr.aria-busy]="busy()===action.id" (click)="run(action)">{{busy()===action.id?'Running…':'Try it'}}</button><details><summary>View {{framework}} example</summary><pre><code>{{source(action.code,binding)}}</code></pre></details></article>}</div></section>
  <section class="result" aria-live="polite"><h2>Response</h2><pre [class.error]="failed()">{{result()}}</pre></section>
  <footer><a href="https://docs.lialabs.org/packages">SDK documentation</a><a href="https://developers.lialabs.org">Developer portal</a><a href="https://docs.lialabs.org/guides/verify-on-your-server">Verify on your server</a></footer></main>
}
`})
export class AppComponent{
  readonly lia=injectInit();readonly player=injectPlayer();readonly language=injectLanguage();readonly mode=injectMode();
  readonly framework=FRAMEWORK;readonly binding=SDK_PACKAGE;readonly mocked=mocked;readonly groups=groups;readonly source=exampleSource;readonly errorMessage=errorMessage;
  readonly selected=signal(groups[0].id);readonly busy=signal<string|null>(null);readonly result=signal('Choose a feature to see its response.');readonly failed=signal(false);
  readonly main=injectMainButton({text:t('Try a toast'),onClick:()=>{void toast(t('Hello from {framework}').replace('{framework}', FRAMEWORK)).catch(error=>{this.failed.set(true);this.result.set(errorMessage(error));});}});
  constructor(){effect(()=>{if(this.lia().status==='ready')requestAnimationFrame(()=>ready());});}
  get section(){return groups.find(group=>group.id===this.selected())!;}
  async run(action:DemoAction){if(this.busy())return;this.busy.set(action.id);this.failed.set(false);try{this.result.set(formatResult(await executeAction(action)));}catch(error){this.failed.set(true);this.result.set(errorMessage(error));}finally{this.busy.set(null);}}
}
