import { LiaError, setDebug } from '@lia-labs/bridge';
import { init } from './state';
import { products } from './server-features';
export interface DeveloperTools { dispose():void; clear():void }
/** Local, opt-in test-session inspector. Never uploads payloads, tokens, responses or player data. */
export async function enableDeveloperTools():Promise<DeveloperTools>{
  const me=await init();if(me.mode!=='test')throw new LiaError('test_only','Developer tools are available only in test sessions.');
  const host=document.createElement('div');host.setAttribute('data-lia-developer-tools','');
  const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<style>:host{position:fixed;z-index:2147483647;bottom:calc(12px + env(safe-area-inset-bottom));inset-inline-end:12px;color-scheme:light dark;font:13px/1.5 system-ui}button{font:inherit;border:0;border-radius:12px;padding:10px 14px;background:#2f5bff;color:white;cursor:pointer}section{width:min(340px,calc(100vw - 24px));max-height:60vh;overflow:auto;border:1px solid #8491b5;border-radius:16px;padding:16px;background:light-dark(#fff,#151821);color:light-dark(#172035,#f3f5fb);box-shadow:0 8px 36px #0003;margin-bottom:8px}h2{font-size:16px;margin:0 0 8px}p{margin:4px 0}ol{padding:0;list-style:none;font:12px/1.5 ui-monospace;overflow-wrap:anywhere}li{padding:6px 0;border-top:1px solid #8491b533}section[hidden]{display:none}</style><section hidden role="region" aria-label="Lia developer diagnostics"><h2>Lia developer tools</h2><p data-session></p><p data-products>Checking products…</p><p>Local diagnostics · test mode · no payloads recorded</p><button data-clear>Clear</button><ol aria-live="polite"></ol></section><button data-toggle aria-expanded="false">SDK tools</button>';
  document.body.append(host);const panel=shadow.querySelector('section')!,list=shadow.querySelector('ol')!,toggle=shadow.querySelector<HTMLButtonElement>('[data-toggle]')!;
  const records:string[]=[];let disposed=false;
  const safe=(value:string)=>value.replace(/(?:lia[s]?_|whsec_)[A-Za-z0-9_.-]+/g,'[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,180);
  const record=(text:string)=>{if(disposed)return;records.push(new Date().toLocaleTimeString()+' '+safe(text));if(records.length>100)records.shift();list.replaceChildren(...records.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));};
  const session=()=>{shadow.querySelector('[data-session]')!.textContent=me.exp>Date.now()?'Session active · expires in '+Math.max(0,Math.ceil((me.exp-Date.now())/60000))+' min':'Session expired · request a fresh session';};session();const timer=setInterval(session,30_000);
  toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));};shadow.querySelector<HTMLButtonElement>('[data-clear]')!.onclick=()=>{records.length=0;list.replaceChildren();};
  setDebug(true,{log:(...args:unknown[])=>{record('SDK '+String(args[0])+' '+(typeof args[1]==='string'?args[1]:''));},warn:()=>record('SDK warning'),error:()=>record('SDK listener error')});
  const error=(event:ErrorEvent)=>record('JavaScript '+(event.error?.name??'Error')+' at line '+event.lineno);
  const rejection=()=>record('Unhandled promise rejection · check the associated SDK or network call');
  window.addEventListener('error',error);window.addEventListener('unhandledrejection',rejection);
  const original=window.fetch;
  const wrapped:typeof fetch=async(input,options)=>{let path='request';try{path=new URL(input instanceof Request?input.url:String(input),location.href).pathname;}catch{}
    const start=performance.now();try{const response=await original.call(window,input,options);record('HTTP '+response.status+' '+path+' '+Math.round(performance.now()-start)+'ms');return response;}catch(e){record('Network failure '+path);throw e;}};
  window.fetch=wrapped;
  void products().then(r=>{if(!disposed)shadow.querySelector('[data-products]')!.textContent=r.products.length+' active products: '+r.products.map(p=>p.id).join(', ');}).catch(e=>{if(!disposed)shadow.querySelector('[data-products]')!.textContent='Catalogue unavailable · '+safe(String(e?.code??'network'));});
  return {clear:()=>{records.length=0;list.replaceChildren();},dispose:()=>{disposed=true;clearInterval(timer);setDebug(false);if(window.fetch===wrapped)window.fetch=original;window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection);host.remove();}};
}
