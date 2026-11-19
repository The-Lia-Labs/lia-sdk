import {type RequestListener,type IncomingMessage} from 'node:http';
import {mkdirSync} from 'node:fs';
import {LiaServer,verifyWebhook,type Mode} from './lia.js';
import {inventoryStore} from './store.js';
// Edit this SERVER-ONLY mapping to match product IDs created in Lia Developers.
const PRODUCTS:Record<string,number>={'coins-100':100};
const REWARDS:Record<string,number>={'production-boost':20,'offline-bonus':40};
const lia=new LiaServer(process.env.LIA_SERVER_KEY??'',{baseUrl:process.env.LIA_API_BASE_URL});
const secret=process.env.LIA_WEBHOOK_SECRET??'';if(!secret.startsWith('whsec_'))throw Error('Set LIA_WEBHOOK_SECRET on your server.');
const frontend=process.env.FRONTEND_ORIGIN??'http://localhost:5173';
if(lia.mode==='live'&&new URL(frontend).protocol!=='https:')throw Error('Use HTTPS for a live frontend.');
mkdirSync('data',{recursive:true});const store=inventoryStore(process.env.INVENTORY_DB??'data/inventory.sqlite');
async function body(req:IncomingMessage){const parts:Buffer[]=[];let length=0;for await(const part of req){length+=part.length;if(length>20000)throw Object.assign(Error('body_too_large'),{status:413});parts.push(part);}return Buffer.concat(parts);}
async function settle(chargeId:string,player?:string){
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(chargeId))throw Object.assign(Error('invalid_charge'),{status:400});
 const {charge}=await lia.getCharge({id:chargeId});
 if(charge.mode!==lia.mode||player&&charge.playerId!==player||!['paid','delivered'].includes(charge.status)||!PRODUCTS[charge.productId])throw Object.assign(Error('charge_not_deliverable'),{status:409});
 const result=store.grant(lia.mode,charge.playerId,'charge:'+charge.id,PRODUCTS[charge.productId],'purchase');
 // Always retry the acknowledgement, including after an inventory receipt already exists.
 await lia.deliverCharge({id:charge.id},{idempotencyKey:'deliver:'+charge.id});return result;
}
export const handler:RequestListener = async(req,res)=>{
 const url=new URL(req.url??'/','http://localhost');res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.headers.origin===frontend){res.setHeader('Access-Control-Allow-Origin',frontend);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');}
 const reply=(status:number,value:unknown)=>{res.statusCode=status;res.end(JSON.stringify(value));};
 try{
  if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}
  if(req.method==='GET'&&url.pathname==='/health'){reply(200,{ok:true,mode:lia.mode});return;}
  if(req.method==='POST'&&url.pathname==='/webhooks/lia'){
   const raw=await body(req);if(!await verifyWebhook(secret,raw,String(req.headers['lia-signature']??''))){reply(401,{error:'invalid_signature'});return;}
   const event=JSON.parse(raw.toString());if(event.test===true){reply(200,{received:true,probe:true});return;}
   if(event.type==='charge.paid'&&event.data?.mode===lia.mode)await settle(event.data.id);
   if(event.type==='charge.refunded'&&event.data?.mode===lia.mode){const {charge}=await lia.getCharge({id:event.data.id});if(charge.status==='refunded'&&charge.mode===lia.mode)store.revoke(lia.mode,charge.id);}
   reply(200,{received:true});return;
  }
  const token=/^Bearer (\S+)$/.exec(String(req.headers.authorization??''))?.[1];if(!token){reply(401,{error:'session_required'});return;}
  const player=await lia.requireSession(token),input=req.method==='POST'?JSON.parse((await body(req)).toString()||'{}'):{};
  if(req.method==='GET'&&url.pathname==='/shop'){const catalogue=await lia.listProducts();reply(200,{...catalogue,inventory:store.inventory(player.mode,player.playerId)});return;}
  if(req.method==='GET'&&url.pathname==='/inventory'){reply(200,store.inventory(player.mode,player.playerId));return;}
  if(req.method==='POST'&&url.pathname==='/purchases/settle'){reply(200,await settle(String(input.chargeId??''),player.playerId));return;}
  if(req.method==='POST'&&url.pathname==='/rewards/challenge'){
   const kind=String(input.kind??'');if(!REWARDS[kind]){reply(400,{error:'invalid_reward'});return;}
   const challenge=await lia.createAdChallenge({playerId:player.playerId,context:{kind},expiresIn:900});store.issueChallenge(player.mode,challenge.challengeId,player.playerId);reply(201,challenge);return;
  }
  if(req.method==='POST'&&url.pathname==='/rewards/claim'){
   if(!/^rc_[a-f0-9]{32}$/.test(String(input.challengeId??''))){reply(400,{error:'invalid_challenge'});return;}
   if(!store.ownsChallenge(player.mode,input.challengeId,player.playerId)){reply(403,{error:'wrong_player'});return;}
   const result=await lia.claimAdChallenge({id:input.challengeId,adId:input.adId},{idempotencyKey:'claim:'+input.challengeId});
   const context=result.context as {kind?:string};
   if(result.playerId!==player.playerId||!context.kind||!REWARDS[context.kind]){reply(403,{error:'wrong_player_or_reward'});return;}
   // Native completion is not provider SSV. Live valuable rewards are denied by default.
   if(lia.mode==='live'&&!result.providerVerified){reply(409,{error:'provider_verification_required'});return;}
   reply(200,store.grant(player.mode,player.playerId,'ad:'+result.adId,REWARDS[context.kind!],'ad'));return;
  }
  reply(404,{error:'not_found'});
 }catch(error){const e=error as {status?:number;code?:string};reply(e.status&&e.status>=400&&e.status<600?e.status:503,{error:e.code??'request_failed'});}
};
// Restart-safe recovery: the app can also call /purchases/settle after Lia.charges().
let reconciling=false;export const reconcile=async()=>{if(reconciling)return;reconciling=true;try{for(let page=0;page<5;page++){const result=await lia.listPendingCharges({limit:100,cursor:store.cursor()??undefined});for(const charge of result.charges){if(!PRODUCTS[charge.productId])continue;try{await settle(charge.id);}catch{/* Retry this charge next sweep without blocking other products. */}}store.setCursor(result.next);if(!result.next)break;}}finally{reconciling=false;}};
export function startRecovery(){const timer=setInterval(()=>void reconcile().catch(()=>{}),60_000);timer.unref();return timer;}
