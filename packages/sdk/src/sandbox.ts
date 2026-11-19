import { LiaError, mockLia, type MockOptions, type MethodName } from '@lia-labs/bridge';
export type SandboxScenario='payment_failed'|'purchase_interrupted'|'session_expired'|'ad_unavailable'|'reward_repeated';
/** Explicit browser simulation only. Never turn these answers into real balances or payouts. */
export function createSandbox(options:Omit<MockOptions,'onMethod'>={}){
 const queues=new Map<string,SandboxScenario[]>(),pending:{chargeId:string;productId:string}[]=[];
 const methods:Record<SandboxScenario,MethodName>={payment_failed:'pay',purchase_interrupted:'pay',session_expired:'session',ad_unavailable:'showAd',reward_repeated:'showAd'};
 let repeatedAd:string|null=null;
 const mock=mockLia({...options,onMethod:async({method},next)=>{
   if(method==='charges')return [...pending];
   const queue=queues.get(method),scenario=queue?.shift();
   if(scenario==='payment_failed')throw new LiaError('payment_failed','Simulated payment failure: nothing was charged.');
   if(scenario==='session_expired')return {session:'lias_mock_expired',exp:Date.now()-60_000};
   if(scenario==='ad_unavailable')return {watched:false,shown:false,reason:'no_ad'};
   if(scenario==='purchase_interrupted'){const result=await next() as {chargeId:string;productId:string};pending.push(result);throw new LiaError('reloaded','Simulated reload after payment; recover with charges().');}
   if(scenario==='reward_repeated'){repeatedAd??='ad_mock_repeated';return {watched:true,shown:true,adId:repeatedAd};}
   return next();
 }});
 return {...mock,queue:(scenario:SandboxScenario)=>{const method=methods[scenario];if(!method)throw new LiaError('bad_scenario','Choose a documented sandbox scenario.');const queue=queues.get(method)??[];queue.push(scenario);queues.set(method,queue);},acknowledgeCharge:(id:string)=>{const at=pending.findIndex(c=>c.chargeId===id);if(at>=0)pending.splice(at,1);}};
}
