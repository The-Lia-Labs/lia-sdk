import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {serverCommand,freePort,development} from '../src/development.mjs';
import {startTunnel} from '../src/tunnel.mjs';

test('dev commands keep server hosts local and permit only the assigned tunnel hostname',()=>{
 for(const pm of ['npm','pnpm','yarn','bun'])for(const framework of ['react','vue','svelte','preact','solid','angular','vanilla','elements','bridge']){
  const spec=serverCommand(pm,framework,4250,'assigned.trycloudflare.com');
  assert.equal(spec.command,pm);assert.deepEqual(spec.args.slice(0,2),['run','dev']);
  assert(spec.args.includes('127.0.0.1'));assert(spec.args.includes('4250'));assert(!spec.args.includes('0.0.0.0'));
  if(framework==='angular')assert(!spec.args.includes('--allowed-hosts'),'Angular 20 CLI exposes that flag as a boolean; use the exact Vite host environment instead');
  else assert(spec.args.includes('--strictPort'));
 }
 assert.throws(()=>serverCommand('npm;echo','react',4250,'host'));
 assert.throws(()=>serverCommand('npm','unknown',4250,'host'));
});

test('an occupied port is preserved, with an explicit-port error or an alternate port',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
 try{await assert.rejects(freePort(port,true),/already in use/);assert.notEqual(await freePort(port),port);}finally{await new Promise(resolve=>server.close(resolve));}
});

test('invalid projects fail before opening a tunnel or making a network request',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lia-invalid-preview-'));
 try{
  await assert.rejects(development({directory:root}),/generated Lia project/);
  await writeFile(path.join(root,'lia.config.json'),JSON.stringify({appId:'../../secret',framework:'react'}));
  await assert.rejects(development({directory:root}),/invalid Lia configuration/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('tunnel child startup, URL parsing and cleanup are bounded', {skip:process.platform==='win32'},async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lia-tunnel-process-'));const helper=path.join(root,'helper');
 try{
  await writeFile(helper,'#!'+process.execPath+'\nconsole.error("https://fixture-tunnel.trycloudflare.com");console.error("Registered tunnel connection");setInterval(()=>{},1000);',{mode:0o700});
  const tunnel=await startTunnel(helper,4200,{timeoutMs:5000});assert.equal(tunnel.url,'https://fixture-tunnel.trycloudflare.com');const pid=tunnel.child.pid;
  await tunnel.stop();assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
  await writeFile(helper,'#!'+process.execPath+'\nsetInterval(()=>{},1000);',{mode:0o700});
  await assert.rejects(startTunnel(helper,4200,{timeoutMs:100}),/did not provide/);
 }finally{await rm(root,{recursive:true,force:true});}
});
