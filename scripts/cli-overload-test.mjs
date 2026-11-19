// Run against: postman simulation run postman/simulations/cli-overload.sim.yaml --port 4508 --no-history
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {cliRequest,whoami,savedAccount} from '../packages/create-app/src/account.mjs';
const origin=process.argv[2]||'http://localhost:4508';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local simulation only');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const retry=[];
eq((await cliRequest(origin,'/me?case=recover',{onRetry:e=>retry.push(e)})).username,'local-fixture');
eq(retry.length,1);eq(retry[0].delayMs,0);
await assert.rejects(cliRequest(origin,'/me?case=always'),e=>e.status===503&&/login and local files are safe/.test(e.message));checks++;
await assert.rejects(cliRequest(origin,'/me?case=unauthorized'),e=>e.status===401);checks++;
await assert.rejects(cliRequest(origin,'/me?case=invalid'),e=>e.status===400);checks++;
await assert.rejects(cliRequest(origin,'/me?case=long'),e=>e.status===429);checks++;
eq((await cliRequest(origin,'/me?case=date')).username,'local-fixture');
await assert.rejects(cliRequest(origin,'/apps',{method:'POST',body:{id:'fixture'}}),e=>e.status===503);checks++;
const leaseId='00000000-0000-4000-8000-000000000001';
eq((await cliRequest(origin,'/apps/retry-preview/preview',{method:'PUT',body:{leaseId,url:'https://fixture.trycloudflare.com'}})).connected,true);
const signal=new AbortController();
const cancel=setTimeout(()=>signal.abort(Error('User cancelled')),50);
try {await assert.rejects(cliRequest(origin,'/me?case=abort',{signal:signal.signal}));checks++;}finally{clearTimeout(cancel);}
const root=await mkdtemp(path.join(tmpdir(),'lia-overload-account-')),prior=process.env.LIA_CONFIG_DIR;
process.env.LIA_CONFIG_DIR=root;
try {
 const token='lia_cli_'+'a'.repeat(64);
 await writeFile(path.join(root,'credentials.json'),JSON.stringify({[origin]:{token,expiresAt:Date.now()+60000,account:{username:'local-fixture'}}}),{mode:0o600});
 eq((await whoami(origin)).username,'local-fixture');eq((await savedAccount(origin)).token,token);
 const result=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['packages/create-app/bin/create-app.mjs','whoami','--api',origin],{env:{...process.env,LIA_CONFIG_DIR:root},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.once('error',reject);child.once('close',code=>resolve({code,output}));
 });
 eq(result.code,0);assert.match(result.output,/@local-fixture/);checks++;
}finally{if(prior===undefined)delete process.env.LIA_CONFIG_DIR;else process.env.LIA_CONFIG_DIR=prior;await rm(root,{recursive:true,force:true});}
const counts=await cliRequest(origin,'/counts');
eq(counts['GET /cli/me?case=recover'],2);eq(counts['GET /cli/me?case=always'],3);
eq(counts['GET /cli/me?case=unauthorized'],1);eq(counts['GET /cli/me?case=invalid'],1);eq(counts['GET /cli/me?case=long'],1);
eq(counts['POST /cli/apps'],1);eq(counts['PUT /cli/apps/retry-preview/preview'],2);
eq(counts['GET /cli/me?case=abort'],1);
console.log(JSON.stringify({checks,result:'passed',target:'local Postman simulation'}));
