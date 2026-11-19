import { readFile, writeFile, mkdir, rename, chmod, lstat, unlink } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export const TERMINAL_SCOPE = 'apps:read apps:create apps:dev';
export const DEFAULT_API = 'https://api.lialabs.org';
const configDir = () => process.env.LIA_CONFIG_DIR || path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'lia');
const tokenFile = () => path.join(configDir(), 'credentials.json');
export function apiOrigin(value = DEFAULT_API) {
  const url = new URL(value);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Use an HTTPS API origin, or localhost for local development.');
  return url.origin;
}
async function credentials() {
  try {
    const stat=await lstat(tokenFile());
    if(stat.isSymbolicLink()||!stat.isFile()||stat.size>65536)throw Error('The Lia credentials file is not a regular private file.');
    const data=JSON.parse(await readFile(tokenFile(),'utf8'));
    return data && typeof data==='object' && !Array.isArray(data) ? data : {};
  } catch(error) { if(error.code==='ENOENT')return {}; throw error; }
}
async function save(data) {
  await mkdir(configDir(),{recursive:true,mode:0o700});
  if((await lstat(configDir())).isSymbolicLink())throw Error('The Lia credentials directory cannot be a symlink.');
  const tmp=path.join(configDir(),'.credentials-'+randomUUID());
  try { await writeFile(tmp,JSON.stringify(data),{mode:0o600,flag:'wx'});await rename(tmp,tokenFile());await chmod(tokenFile(),0o600); }
  finally { await unlink(tmp).catch(()=>{}); }
}
export async function savedAccount(origin=DEFAULT_API) {
  const value=(await credentials())[apiOrigin(origin)];
  return value && typeof value.token==='string' && /^lia_cli_[a-f0-9]{64}$/.test(value.token) && value.expiresAt>Date.now() ? value : null;
}
export async function clearAccount(origin=DEFAULT_API) {const data=await credentials();delete data[apiOrigin(origin)];await save(data);}

export class LiaAPIError extends Error { constructor(status,code){super(({unauthorized:'Sign in first with: npx @lia-labs/create-app login',developer_required:'Join Lia Developers in your browser first.',exists:'That app ID belongs to another developer. Choose another --app-id.',hosting_required:'Add your deployed HTTPS URL before submitting this app.',access_denied:'Terminal access was declined or could not be granted.',expired_token:'That sign-in expired. Run login again.'})[code]||`Lia could not complete the request (${code||status}).`);this.status=status;this.code=code;} }
export async function cliRequest(origin,route,{method='GET',body,token,signal}={}) {
  const res=await fetch(apiOrigin(origin)+'/api/cli'+route,{method,redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(20_000),...(signal?[signal]:[])]),headers:{accept:'application/json',...(body!==undefined?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new LiaAPIError(res.status,typeof data.error==='string'?data.error:'request_failed');
  return data;
}
export async function whoami(origin=DEFAULT_API,signal) {
  const saved=await savedAccount(origin);
  if(!saved)throw new LiaAPIError(401,'unauthorized');
  try { return await cliRequest(origin,'/me',{token:saved.token,signal}); }
  catch(error){if(error.status===401)await clearAccount(origin);throw error;}
}
export async function logout(origin=DEFAULT_API) {
  const saved=await savedAccount(origin);
  let remoteError;
  if(saved)try{await cliRequest(origin,'/logout',{method:'POST',body:{},token:saved.token});}catch(error){if(error.status!==401)remoteError=error;}
  await clearAccount(origin);
  if(remoteError)throw Error('Signed out locally. The server could not be reached; revoke this terminal in Lia Developers → Connected terminals.');
}
export async function openBrowser(url) {
  const link=new URL(url);
  if(!['https:','http:'].includes(link.protocol)||link.username||link.password)throw Error('Invalid sign-in URL.');
  const command=platform()==='darwin'?'open':platform()==='win32'?'rundll32':'xdg-open';
  const args=platform()==='win32'?['url.dll,FileProtocolHandler',url]:[url];
  return new Promise(resolve=>{const child=spawn(command,args,{stdio:'ignore',shell:false});const timer=setTimeout(()=>{child.unref();resolve(false);},5000);timer.unref();const done=value=>{clearTimeout(timer);resolve(value);};child.once('error',()=>done(false));child.once('close',code=>done(code===0));});
}
export async function login({origin=DEFAULT_API,signal,onDevice=()=>{},onWaiting=()=>{},browser=true}={}) {
  const device=await cliRequest(origin,'/device',{method:'POST',body:{client_id:'lia-cli',scope:TERMINAL_SCOPE,client_name:'Lia CLI on '+({darwin:'macOS',win32:'Windows',linux:'Linux'}[platform()]||platform())},signal});
  if(!/^lia_device_[a-f0-9]{64}$/.test(device.device_code)||!/^\w{4}-\w{4}$/.test(device.user_code)||!Number.isFinite(device.expires_in)||device.expires_in<=0||device.expires_in>600)throw Error('The API returned an invalid sign-in request.');
  const verification=new URL(device.verification_uri_complete);
  const local=['localhost','127.0.0.1'].includes(new URL(origin).hostname);
  if((!local&&verification.origin!=='https://developers.lialabs.org')||verification.pathname!=='/cli/authorize'||!['https:','http:'].includes(verification.protocol))throw Error('The sign-in page is not a trusted Lia Developers page.');
  onDevice({url:verification.toString(),code:device.user_code,expiresIn:device.expires_in});
  if(browser)await openBrowser(verification.toString());
  onWaiting();
  const deadline=Date.now()+device.expires_in*1000;let interval=Math.max(5,Number(device.interval)||5)*1000;
  while(Date.now()<deadline){
    await delay(interval,undefined,{signal});
    let result;
    try {result=await cliRequest(origin,'/token',{method:'POST',body:{client_id:'lia-cli',grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:device.device_code},signal});}
    catch(error){if(error.code==='authorization_pending')continue;if(error.code==='slow_down'){interval+=5000;continue;}throw error;}
    if(!/^lia_cli_[a-f0-9]{64}$/.test(result.access_token)||!result.account?.username||!Number.isFinite(result.expires_in)||result.expires_in<=0||result.expires_in>30*86400)throw Error('The API returned invalid terminal credentials.');
    const data=await credentials();
    data[apiOrigin(origin)]={token:result.access_token,expiresAt:Date.now()+result.expires_in*1000,account:result.account};
    await save(data);
    return {...result.account,scope:result.scope};
  }
  throw new LiaAPIError(400,'expired_token');
}
export async function registerProject({directory='.',origin=DEFAULT_API,id,name,kind='app',url,signal}={}) {
  const filename=path.resolve(directory,'lia.config.json');
  const config=JSON.parse(await readFile(filename,'utf8').catch(()=>{throw Error('Run register inside a generated Lia project, or pass its directory.');}));
  const account=await savedAccount(origin);
  if(!account)throw new LiaAPIError(401,'unauthorized');
  const appId=id||config.appId;
  if(typeof appId!=='string'||!/^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/.test(appId))throw Error('Choose a valid --app-id (2–40 lowercase letters, numbers or dashes).');
  const result=await cliRequest(origin,'/apps',{method:'POST',token:account.token,signal,body:{id:appId,name:name||appId.replaceAll('-',' '),kind,...(url?{url}:{})}});
  const dashboard=result.dashboardUrl||new URL('/apps/'+encodeURIComponent(appId),new URL(origin).hostname==='api.lialabs.org'?'https://developers.lialabs.org':origin).toString();
  const next={...config,appId,registration:{id:appId,apiOrigin:apiOrigin(origin),dashboardUrl:dashboard,publicHost:result.app?.publicHost||result.app?.public_host||null}};
  await writeFile(filename,JSON.stringify(next,null,2)+'\n');
  if(config.appId!==appId){const file=path.resolve(directory,'src/config.ts');const prior=await readFile(file,'utf8').catch(()=>null);if(prior)await writeFile(file,prior.replace('export const APP_ID = '+JSON.stringify(config.appId)+';','export const APP_ID = '+JSON.stringify(appId)+';'));}
  return {...result,dashboardUrl:dashboard,appId,pendingHosting:result.app?.url==='/sdk/cli-setup'};
}
