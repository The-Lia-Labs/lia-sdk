import { readFile, access } from 'node:fs/promises';
import { stripVTControlCharacters } from 'node:util';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { cloudflared, startTunnel } from './tunnel.mjs';
import { cliRequest, savedAccount } from './account.mjs';
import { detectPackageManager } from './terminal.mjs';
import { frameworks, packageManagers } from './frameworks.mjs';

export async function freePort(preferred, explicit=false) {
  for(let n=0;n<(explicit?1:20);n++){
    const port=preferred+n;
    const probe=host=>new Promise(resolve=>{const server=createServer();server.once('error',error=>resolve(error.code==='EAFNOSUPPORT'||error.code==='EADDRNOTAVAIL'));server.listen(port,host,()=>server.close(()=>resolve(true)));});
    const available=await probe('127.0.0.1')&&await probe('0.0.0.0')&&await probe('::1')&&await probe('::');
    if(available)return port;
  }
  throw Error('That development port is already in use. Choose another --port.');
}
export function serverCommand(pm,framework,port,hostname) {
  if(!packageManagers.includes(pm)||!Object.hasOwn(frameworks,framework))throw Error('Unsupported package manager or framework.');
  const flags=['--host','127.0.0.1','--port',String(port),...(framework==='angular'?[]:['--strictPort'])];
  return {command:pm,args:['run','dev',...(pm==='npm'?['--']:[]),...flags]};
}
async function projectManager(directory,preferred) {
  if(preferred){if(!packageManagers.includes(preferred))throw Error('Choose --pm npm, pnpm, yarn or bun.');return preferred;}
  for(const [file,pm] of [['pnpm-lock.yaml','pnpm'],['yarn.lock','yarn'],['bun.lock','bun'],['bun.lockb','bun'],['package-lock.json','npm']])try{await access(path.join(directory,file));return pm;}catch{}
  return detectPackageManager(process.env.npm_config_user_agent);
}
function serverProcess(directory,config,port,hostname,pm,onOutput) {
  const spec=serverCommand(pm,config.framework,port,hostname);
  const child=spawn(spec.command,spec.args,{cwd:directory,shell:false,windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe'],env:{...process.env,__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS:hostname,NG_CLI_ANALYTICS:'false'}});
  let logs='',streaming=false;
  const capture=buffer=>{logs=(logs+buffer.toString()).slice(-12000);if(streaming)onOutput?.(buffer.toString());};
  child.stdout.on('data',capture);child.stderr.on('data',capture);
  let failure;
  const done=new Promise(resolve=>{child.once('error',error=>{failure=error;resolve({error});});child.once('close',(code,signal)=>resolve({code,signal}));});
  const stop=async()=>{
    if(!child.pid)return;
    if(process.platform==='win32')spawn('taskkill',['/pid',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
    else try{process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}
    await Promise.race([done,delay(2000)]);
    if(process.platform!=='win32'){await delay(200);try{process.kill(-child.pid,'SIGKILL');}catch{}}
  };
  return {child,done,stop,logs:()=>logs,ready:()=>stripVTControlCharacters(logs).includes('http://127.0.0.1:'+port+'/'),failure:()=>failure,stream:()=>{streaming=true;}};
}
async function waitForPage(url,{signal,server,timeout=120_000}={}) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    signal?.throwIfAborted();
    if(server&&(server.child.exitCode!==null||server.failure()))throw Error('The local server stopped.\n'+server.logs().slice(-2500));
    if(server&&!server.ready()){await delay(250,undefined,{signal});continue;}
    try {const response=await fetch(url,{signal:AbortSignal.any([AbortSignal.timeout(2000),...(signal?[signal]:[])])});if(response.ok)return;}catch{}
    await delay(500,undefined,{signal});
  }
  throw Error('The preview did not become reachable: '+url+(server?'\n'+server.logs().slice(-1800):''));
}
export async function development({directory='.',origin,pm,port:requestedPort,signal,onStep=()=>{},onReady=()=>{},onOutput=()=>{}}) {
  directory=path.resolve(directory);
  const config=JSON.parse(await readFile(path.join(directory,'lia.config.json'),'utf8').catch(()=>{throw Error('Run dev inside a generated Lia project, or pass its directory.');}));
  if(!Object.hasOwn(frameworks,config.framework)||typeof config.appId!=='string'||!/^[a-z0-9][a-z0-9-]{1,39}$/.test(config.appId))throw Error('This project has an invalid Lia configuration.');
  const saved=await savedAccount(origin);if(!saved)throw Error('Sign in with npx @lia-labs/create-app@latest login first.');
  const account=await cliRequest(origin,'/me',{token:saved.token,signal});
  if(!account.scope?.split(' ').includes('apps:dev'))throw Error('Approve local preview access with the latest Lia CLI login.');
  const {apps}=await cliRequest(origin,'/apps',{token:saved.token,signal});
  const app=apps.find(app=>app.id===config.appId);
  if(!app)throw Error('Register this project before running dev: npx @lia-labs/create-app@latest register');
  if(app.status!=='test')throw Error('Local previews are only available for private test apps.');
  if(requestedPort!==undefined&&(!Number.isInteger(Number(requestedPort))||Number(requestedPort)<1024||Number(requestedPort)>65535))throw Error('Choose a --port between 1024 and 65535.');
  pm=await projectManager(directory,pm);
  const port=await freePort(requestedPort===undefined?(config.framework==='angular'?4200:5173):Number(requestedPort),requestedPort!==undefined);
  const localUrl='http://127.0.0.1:'+port,leaseId=randomUUID(),route='/apps/'+encodeURIComponent(config.appId)+'/preview';
  let tunnel,server,connected=false,heartbeat,stopping=false,heartbeating=false,cleanupFailed=false;
  const failed=new AbortController();
  const combined=AbortSignal.any([failed.signal,...(signal?[signal]:[])]);
  try {
    onStep('Preparing Cloudflare Tunnel');
    const helper=await cloudflared({signal:combined,onInstall:()=>onStep('Installing verified Cloudflare Tunnel helper')});
    onStep('Creating your HTTPS tunnel');tunnel=await startTunnel(helper,port,{signal:combined});
    onStep('Starting '+frameworks[config.framework].label+' on port '+port);
    server=serverProcess(directory,config,port,new URL(tunnel.url).hostname,pm,onOutput);
    await waitForPage(localUrl,{signal:combined,server});
    onStep('Cloudflare Tunnel connected');
    onStep('Connecting your private Lia listing');
    const preview=await cliRequest(origin,route,{method:'PUT',token:saved.token,body:{url:tunnel.url,leaseId},signal:combined});connected=true;
    const beat=async()=>{
      if(stopping||heartbeating)return;heartbeating=true;
      try{await cliRequest(origin,route,{method:'PATCH',token:saved.token,body:{leaseId},signal:combined});}
      catch(error){if(!stopping)failed.abort(Error('The preview disconnected: '+error.message));}
      finally{heartbeating=false;}
    };
    heartbeat=setInterval(()=>void beat(),30_000);
    const appUrl=app.public_host?'https://'+app.public_host:'https://developers.lialabs.org/apps/'+encodeURIComponent(app.id);
    await onReady({appId:app.id,name:app.name,framework:frameworks[config.framework].label,localUrl,publicUrl:tunnel.url,appUrl,dashboardUrl:preview.dashboardUrl,account,port});
    server.stream();
    await Promise.race([
      new Promise((resolve,reject)=>{if(combined.aborted){reject(combined.reason);return;}combined.addEventListener('abort',()=>reject(combined.reason),{once:true});}),
      server.done.then(result=>{throw Error('The local server stopped ('+(result.code??result.error?.message??result.signal)+').');}),
      tunnel.done.then(result=>{throw Error('Cloudflare Tunnel stopped ('+(result.code??result.signal)+').');}),
    ]);
  } finally {
    stopping=true;if(heartbeat)clearInterval(heartbeat);
    if(connected)try{await cliRequest(origin,route,{method:'DELETE',token:saved.token,body:{leaseId}});}catch{cleanupFailed=true;}
    await Promise.allSettled([server?.stop(),tunnel?.stop()]);
    if(connected)onStep(cleanupFailed?'Preview will expire within two minutes. Your hosting URL is unchanged.':'Preview disconnected. Your hosting URL is unchanged.');
  }
}
