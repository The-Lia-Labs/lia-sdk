import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {scaffoldBackend,backendLanguages} from '../src/backend.mjs';
test('every backend language generates its framework entry, private environment and package metadata',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lia-backends-'));try{
 for(const [language,config] of Object.entries(backendLanguages))for(const framework of config.frameworks){
  const target=path.join(root,language+'-'+framework);const result=await scaffoldBackend(target,{language,framework});
  assert.equal(result.target,target);assert(result.commands.length>0);const env=await readFile(path.join(target,'.env.example'),'utf8');assert.match(env,/LIA_SERVER_KEY=/);assert(!/VITE_LIA_SERVER_KEY|NEXT_PUBLIC_LIA_SERVER_KEY/.test(env));assert.match(await readFile(path.join(target,'.gitignore'),'utf8'),/\.env/);
  if(language==='typescript'){const pkg=JSON.parse(await readFile(path.join(target,'package.json')));assert.equal(pkg.dependencies['@lia-labs/server'],'^0.1.0');assert(pkg.private);assert.match(await readFile(path.join(target,'src/server.ts'),'utf8'),/ownsChallenge/);}
  if(language==='python'){assert.match(await readFile(path.join(target,'app.py'),'utf8'),new RegExp(framework));assert.match(await readFile(path.join(target,'service.py'),'utf8'),/BEGIN IMMEDIATE/);}
 }
 }finally{await rm(root,{recursive:true,force:true});}
});
test('backend scaffold refuses occupied directories, symlinks and unsupported combinations',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lia-backend-guard-'));try{
 await writeFile(path.join(root,'keep'),'original');await assert.rejects(()=>scaffoldBackend(root));assert.equal(await readFile(path.join(root,'keep'),'utf8'),'original');
 const link=root+'-link';await symlink(root,link);await assert.rejects(()=>scaffoldBackend(link));await rm(link);
 await assert.rejects(()=>scaffoldBackend(root+'-new',{language:'python',framework:'express'}));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('backend command handles language flags and prints deterministic CI instructions',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lia-backend-cli-'));try{
 const r=spawnSync(process.execPath,[new URL('../bin/create-app.mjs',import.meta.url).pathname,'backend',path.join(root,'api'),'--language','python','--framework','fastapi','--yes'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/uvicorn app:app/);assert(!r.stdout.includes('\x1b['));
 }finally{await rm(root,{recursive:true,force:true});}
});
