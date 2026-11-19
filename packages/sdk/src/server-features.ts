import { LiaError, request } from '@lia-labs/bridge';
import { init } from './state';
export interface Product { id:string;name:string;price:number;active:boolean }
export interface ServerBoard { board:string;season:string;source:'server';top:{playerId:string;name:string;score:number;rank:number}[];me:{playerId:string;name:string;score:number;rank:number}|null }
const key=(value:string)=>{if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(value))throw new LiaError('invalid_key','Use a valid board, season or storage key.');return encodeURIComponent(value);};
let fresh:{session:string;exp:number}|null=null;let initialSession:string|null=null;
/** Session-authenticated browser transport. Server API keys never belong in a web app. */
export async function clientRequest<T>(path:string,body?:unknown):Promise<T>{
  const me=await init();
  if(initialSession!==me.session){fresh=null;initialSession=me.session;}
  if(me.session==='lias_mock')throw new LiaError('mock_server_required','Run the secure backend starter or mock this request explicitly. Local simulations cannot verify a real reward.');
  const token=async(force=false)=>{if(force||(!fresh&&me.exp<Date.now()+10_000)||(fresh&&fresh.exp<Date.now()+10_000))fresh=await request('session');return (fresh??me).session;};
  for(let attempt=0;attempt<2;attempt++){
    const response=await fetch('https://api.lialabs.org/api/apps/client'+path,{method:body===undefined?'GET':'POST',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15_000),headers:{Authorization:'Bearer '+await token(attempt===1),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(response.status===401&&attempt===0)continue;
    const result=await response.json();if(!response.ok)throw new LiaError(result.error??'request_failed','Lia request failed ('+response.status+').');return result as T;
  }
  throw new LiaError('invalid_session','Refresh your Lia session and try again.');
}
/** Active catalogue from Lia’s records, without exposing a server key. Works on existing native builds. */
export const products=()=>clientRequest<{products:Product[];mode:'test'|'live'}>('/products');
/** These boards accept scores only from your authenticated game server. */
export const leaderboards={get:(board:string,season='all-time')=>clientRequest<ServerBoard>('/leaderboards/'+key(board)+'/seasons/'+key(season))};
/** Read your own inventory. Only your game server can write it, using optimistic version checks. */
export const serverStorage={get:<T=unknown>(name:string)=>clientRequest<{value:T|null;version:number;updatedAt:number|null}>('/storage/'+key(name))};
export async function bindRewardChallenge(challengeId:string,adId:string){return clientRequest<{bound:true;challengeId:string;adId:string}>('/ads/bind',{challengeId,adId});}
