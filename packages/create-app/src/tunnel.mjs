import { access, chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir, platform, arch, tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

export const CLOUDFLARED_VERSION = '2026.11.1';
const run = promisify(execFile);
const suffix = platform() === 'win32' ? '.exe' : '';
const assetNames = {
  'darwin-arm64': 'cloudflared-darwin-arm64.tgz', 'darwin-x64': 'cloudflared-darwin-amd64.tgz',
  'linux-arm64': 'cloudflared-linux-arm64', 'linux-x64': 'cloudflared-linux-amd64',
  'win32-x64': 'cloudflared-windows-amd64.exe',
};
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
async function executable(file) {
  try { const result=await run(file,['--version'],{timeout:5000,windowsHide:true});return /cloudflared version/.test(result.stdout+result.stderr); } catch { return false; }
}
export async function cloudflared({signal,onInstall=()=>{}}={}) {
  if(process.env.LIA_CLOUDFLARED_PATH){if(await executable(process.env.LIA_CLOUDFLARED_PATH))return process.env.LIA_CLOUDFLARED_PATH;throw Error('LIA_CLOUDFLARED_PATH is not a working cloudflared executable.');}
  if(await executable('cloudflared'))return 'cloudflared';
  const assetName=assetNames[platform()+'-'+arch()];
  if(!assetName)throw Error('Install cloudflared for this platform, then run dev again.');
  const root=path.join(process.env.LIA_CACHE_DIR||process.env.XDG_CACHE_HOME||path.join(homedir(),'.cache'),'lia','cloudflared',CLOUDFLARED_VERSION,platform()+'-'+arch());
  const file=path.join(root,'cloudflared'+suffix);
  try {const record=JSON.parse(await readFile(file+'.json','utf8'));if(record.sha256===sha(await readFile(file))&&await executable(file))return file;}catch{}
  onInstall();await mkdir(root,{recursive:true,mode:0o700});
  const metadata=await fetch('https://api.github.com/repos/cloudflare/cloudflared/releases/tags/'+CLOUDFLARED_VERSION,{signal:AbortSignal.any([AbortSignal.timeout(30_000),...(signal?[signal]:[])]),headers:{accept:'application/vnd.github+json','user-agent':'Lia-Developer-Studio'}});
  if(!metadata.ok)throw Error('Could not download Cloudflare Tunnel metadata. Install cloudflared manually and retry.');
  const release=await metadata.json(),asset=release.assets?.find(value=>value.name===assetName);
  if(!asset||!/^sha256:[a-f0-9]{64}$/.test(asset.digest)||!asset.browser_download_url.startsWith('https://github.com/cloudflare/cloudflared/releases/download/'+CLOUDFLARED_VERSION+'/')||asset.size>80_000_000)throw Error('Cloudflare Tunnel release verification failed.');
  const response=await fetch(asset.browser_download_url,{signal:AbortSignal.any([AbortSignal.timeout(120_000),...(signal?[signal]:[])])});
  if(!response.ok)throw Error('Cloudflare Tunnel download failed. Retry dev or install cloudflared manually.');
  const download=Buffer.from(await response.arrayBuffer());
  if(download.length!==asset.size||sha(download)!==asset.digest.slice(7))throw Error('Cloudflare Tunnel checksum did not match. The download was not installed.');
  const temporary=await mkdtemp(path.join(root,'install-'));
  try {
    let binary=download;
    if(assetName.endsWith('.tgz')){
      const archive=path.join(temporary,'cloudflared.tgz');await writeFile(archive,download);
      binary=(await run('tar',['-xOzf',archive,'cloudflared'],{encoding:'buffer',maxBuffer:100_000_000,timeout:30_000,signal})).stdout;
    }
    const staged=path.join(temporary,'cloudflared'+suffix);await writeFile(staged,binary,{mode:0o700});await chmod(staged,0o700);
    if(!await executable(staged))throw Error('The downloaded Cloudflare Tunnel helper could not start.');
    await rename(staged,file);await writeFile(file+'.json',JSON.stringify({sha256:sha(binary)}),{mode:0o600});return file;
  } finally {await rm(temporary,{recursive:true,force:true});}
}

export async function startTunnel(file,port,{signal,timeoutMs=60_000}={}) {
  const temporary=await mkdtemp(path.join(tmpdir(),'lia-tunnel-'));
  const config=path.join(temporary,'config.yml');await writeFile(config,'{}\n',{mode:0o600});
  const child=spawn(file,['tunnel','--config',config,'--no-autoupdate','--url','http://127.0.0.1:'+port,'--http-host-header','localhost:'+port,'--protocol','http2','--metrics','127.0.0.1:0'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  let logs='',settled=false,previewUrl,registered=false;
  const done=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
  const stop=async()=>{if(child.exitCode===null&&!child.killed)child.kill('SIGTERM');await Promise.race([done,new Promise(resolve=>setTimeout(resolve,2000))]);if(child.exitCode===null)child.kill('SIGKILL');await rm(temporary,{recursive:true,force:true});};
  let abort;
  try {
    const url=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>finish(Error('Cloudflare Tunnel did not provide a preview URL.\n'+logs.slice(-1500))),timeoutMs);
      const finish=(error,url)=>{if(settled)return;settled=true;clearTimeout(timeout);if(error)reject(error);else resolve(url);};
      const capture=buffer=>{logs=(logs+buffer.toString()).slice(-8000);const match=logs.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\b/);if(match)previewUrl=match[0];if(logs.includes('Registered tunnel connection'))registered=true;if(previewUrl&&registered)finish(null,previewUrl);};
      child.stdout.on('data',capture);child.stderr.on('data',capture);child.once('error',error=>finish(error));child.once('close',code=>finish(Error('Cloudflare Tunnel stopped ('+code+').\n'+logs.slice(-1500))));
      abort=()=>finish(signal.reason||Error('Cancelled'));if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    });
    if(abort)signal?.removeEventListener('abort',abort);
    return {url,child,done,stop};
  } catch(error){await stop();throw error;}
}
