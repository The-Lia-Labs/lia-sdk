import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {scaffoldBackend} from '../packages/create-app/src/backend.mjs';
const base=process.env.LIA_CONFORMANCE_URL;
assert(base?.startsWith('http://127.0.0.1:'));
const root=await mkdtemp(path.join(tmpdir(),'lia-starter-integration-')),repo=process.cwd(),python=process.env.LIA_PYTHON??'python3';
function command(cmd,args,cwd,env={}){return new Promise((resolve,reject)=>{const child=spawn(cmd,args,{cwd,stdio:['ignore','pipe','pipe'],env:{...process.env,...env}});let log='';child.stdout.on('data',s=>log+=s);child.stderr.on('data',s=>log+=s);child.on('error',reject);child.on('exit',code=>code===0?resolve(log):reject(Error(cmd+' failed: '+log.slice(-3000))));});}
async function exercise(label,cmd,args,cwd,port){
 const env={...process.env,LIA_SERVER_KEY:'lia_test_fixture',LIA_WEBHOOK_SECRET:'whsec_fixture',LIA_API_BASE_URL:base,LIA_INVENTORY_DB:path.join(cwd,'data/inventory.sqlite'),INVENTORY_DB:path.join(cwd,'data/inventory.sqlite'),DJANGO_SECRET_KEY:'local-only-regression-secret',PORT:String(port),LISTEN_ADDR:'127.0.0.1:'+port};
 const child=spawn(cmd,args,{cwd,env,stdio:['ignore','pipe','pipe']});let log='',exited=false;child.stdout.on('data',s=>log+=s);child.stderr.on('data',s=>log+=s);child.on('exit',()=>exited=true);
 const url='http://127.0.0.1:'+port;
 const req=async(route,body,token='valid',headers={})=>{const r=await fetch(url+route,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json',...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)}),signal:AbortSignal.timeout(5000)});return {status:r.status,body:await r.json()};};
 try{
  let ready=false;for(let i=0;i<100;i++){if(exited)throw Error(label+' exited: '+log.slice(-2000));try{ready=(await req('/health')).status===200;}catch{}if(ready)break;await sleep(100);}assert(ready,label+' readiness '+log);
  assert.equal((await req('/shop')).body.inventory.coins,0,label+' initial inventory');
  assert.equal((await req('/shop',undefined,'expired')).status,401,label+' expired session');
  const results=await Promise.all(Array.from({length:5},()=>req('/purchases/settle',{chargeId:'one'})));for(const r of results){assert.equal(r.status,200,label+' '+JSON.stringify(r.body));assert.equal(r.body.coins,100,label+' duplicate grant');}
  assert.equal((await req('/purchases/settle',{chargeId:'one'},'other')).status,409,label+' wrong player');
  assert.equal((await req('/shop',undefined,'other')).body.inventory.coins,0,label+' separate player');
  const signed=async(type,id)=>{const at=Math.floor(Date.now()/1000),raw=JSON.stringify({id:'event-'+id,type,app:'fixture',at:at*1000,data:{id,mode:'test'}}),signature='t='+at+',v1='+createHmac('sha256','whsec_fixture').update(at+'.'+raw).digest('hex');return req('/webhooks/lia',raw,'valid',{'Lia-Signature':signature});};
  assert.equal((await signed('charge.paid','one')).status,200,label+' paid webhook');assert.equal((await signed('charge.paid','one')).status,200);
  assert.equal((await req('/shop')).body.inventory.coins,100,label+' signed duplicate');
  assert.equal((await req('/webhooks/lia','{}','valid',{'Lia-Signature':'t=1,v1='+'a'.repeat(64)})).status,401,label+' invalid signature');
  assert.equal((await signed('charge.refunded','refunded')).status,200,label+' refund');assert.equal((await signed('charge.refunded','refunded')).status,200);
  assert.equal((await req('/shop')).body.inventory.coins,0,label+' duplicate refund');
  console.log('PASS '+label+': generated HTTP server, verified sessions/catalogue, concurrent duplicate settlement, ownership isolation, signed duplicate webhook and one-time refund');
 }finally{child.kill('SIGTERM');await new Promise(resolve=>exited?resolve():child.once('exit',resolve));}
}
try{
 for(const framework of ['node','express']){
  const cwd=path.join(root,framework);await scaffoldBackend(cwd,{framework});const pkg=JSON.parse(await readFile(path.join(cwd,'package.json')));pkg.dependencies['@lia-labs/server']='file:'+path.join(repo,'packages/server');await writeFile(path.join(cwd,'package.json'),JSON.stringify(pkg));
  await command('npm',['install','--ignore-scripts','--no-audit','--no-fund'],cwd);await command('npm',['test'],cwd);await exercise(framework,process.execPath,['dist/entry.js'],cwd,framework==='node'?4601:4602);
 }
 for(const framework of ['fastapi','django']){
  const cwd=path.join(root,framework);await scaffoldBackend(cwd,{language:'python',framework});
  await exercise(framework,python,framework==='fastapi'?['-m','uvicorn','app:app','--port','4603']:['app.py','runserver','127.0.0.1:4604','--noreload'],cwd,framework==='fastapi'?4603:4604);
 }
 {
  const cwd=path.join(root,'php');await scaffoldBackend(cwd,{language:'php'});const pkg=JSON.parse(await readFile(path.join(cwd,'composer.json')));pkg.repositories=[{type:'path',url:path.join(repo,'backends/php')}];await writeFile(path.join(cwd,'composer.json'),JSON.stringify(pkg));await command('composer',['install','--no-interaction','--quiet'],cwd);await exercise('php','php',['-S','127.0.0.1:4605','server.php'],cwd,4605);
 }
 {
  const cwd=path.join(root,'go');await scaffoldBackend(cwd,{language:'go'});await writeFile(path.join(cwd,'go.mod'),(await readFile(path.join(cwd,'go.mod'),'utf8'))+'\nreplace github.com/The-Lia-Labs/lia-server-go => '+path.join(repo,'backends/go')+'\n');await command('go',['mod','tidy'],cwd);await command('go',['build','-o','server','.'],cwd);await exercise('go',path.join(cwd,'server'),[],cwd,4606);
 }
}finally{await rm(root,{recursive:true,force:true});}
