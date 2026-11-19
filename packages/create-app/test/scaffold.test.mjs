import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { frameworks } from '../src/frameworks.mjs';
import { projectFiles, scaffold } from '../src/scaffold.mjs';

for(const framework of Object.keys(frameworks))for(const template of ['starter','demo'])test(`${framework}: complete ${template} project`,async()=>{
 const files=await projectFiles({name:'my-app',appId:'my-app',framework,template});
 const pkg=JSON.parse(files['package.json']);
 assert.equal(pkg.dependencies[frameworks[framework].binding],'0.7.0');
 assert(files['src/'+frameworks[framework].entry]);assert(files['src/styles.css']);
 if(template==='demo') assert(files['src/demo.ts']);
 else {
  assert(files['src/starter.ts']);assert(!files['src/demo.ts']);assert(!files['src/format.ts']);
  assert.match(Object.entries(files).filter(([name])=>name.startsWith('src/')).map(([,source])=>source).join('\n'),/has a home in Lia/);
  assert(!Object.values(files).some(source=>/Your ideas\. Inside Lia\.|Your first features|Try a toast|demo-coins|role="tablist"/.test(source)));
 }
 assert.match(files['README.md'],/Apps → Testing/);assert.match(files['README.md'],/Never place app server keys/);
 assert(!Object.values(files).some(text=>/__APP_NAME__|__FRAMEWORK__|__BINDING__|__MOCK__|__ENTRY__/.test(text)));
 assert.match(files['src/local-dev.ts'],framework==='angular'?/mockLia/:/import\.meta\.env\.DEV/);
 if(framework==='angular'){assert.equal(JSON.parse(files['angular.json']).projects.app.architect.build.configurations.production.fileReplacements[0].with,'src/local-dev.production.ts');assert(!files['src/local-dev.production.ts'].includes('mockLia'));}
 else assert.match(files['src/local-dev.ts'],/!isLia\(\)/);
});
test('the clean starter uses the app name safely in its title, config and framework view',async()=>{
 const files=await projectFiles({name:'my-folder',appId:'orbit-app',displayName:'Orbit & Friends <3',framework:'react'});
 assert.equal(JSON.parse(files['lia.config.json']).name,'Orbit & Friends <3');
 assert.match(files['src/config.ts'],/APP_NAME = "Orbit & Friends <3"/);
 assert.match(files['index.html'],/Orbit &amp; Friends &lt;3 · Lia/);
 assert(!files['src/config.ts'].includes('PRODUCT_ID'));
 assert.match(files['src/App.tsx'],/appTitle\(APP_NAME\)/);
 assert.match(files['src/App.tsx'],/useInit/);assert.match(files['src/App.tsx'],/ready\(\)/);
});
test('all feature IDs are unique and all demos remain client-only',async()=>{
 const files=await projectFiles({name:'demo-app',appId:'demo-app',framework:'react',template:'demo'});
 const ids=[...files['src/demo.ts'].matchAll(/action\('([^']+)'/g)].map(match=>match[1]);
 assert(ids.length>=50);assert.equal(new Set(ids).size,ids.length);
 assert.match(files['src/demo.ts'],/restricted to test mode/);
 assert(!Object.values(files).some(source=>/lia_live_[A-Za-z0-9]{12}|ADMIN_KEY\s*=/.test(source)));
});
test('invalid input causes no filesystem changes',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lia-create-test-'));
 try{for(const args of [{name:'bad name'},{appId:'../bad'},{framework:'unknown'},{template:'unknown'},{displayName:''},{displayName:'x'.repeat(41)},{displayName:'new\nline'}]){
  await assert.rejects(scaffold({directory:path.join(root,'app'),name:'valid',appId:'valid',framework:'react',...args}));
  assert.deepEqual(await readdir(root),[]);
 }}finally{await rm(root,{recursive:true,force:true});}
});
test('existing files and symlink destinations are never overwritten',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lia-create-test-'));
 try{await writeFile(path.join(root,'important.txt'),'keep me');
  await assert.rejects(scaffold({directory:root,name:'valid',appId:'valid',framework:'react'}),/never overwritten/);
  assert.equal(await readFile(path.join(root,'important.txt'),'utf8'),'keep me');
  const link=root+'-link';await symlink(root,link,'dir');
  try{await assert.rejects(scaffold({directory:link,name:'valid',appId:'valid',framework:'react'}),/never overwritten/);}finally{await rm(link);}
 }finally{await rm(root,{recursive:true,force:true});}
});
test('CLI non-interactive flags create a usable project without installing',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lia-create-test-'));
 try{const dir=path.join(root,'example');const output=execFileSync(process.execPath,[new URL('../bin/create-app.mjs',import.meta.url).pathname,dir,'--framework','vue','--template','demo','--app-id','example','--yes','--no-install'],{encoding:'utf8'});
  assert.match(output,/Created example with Vue/);assert.equal(JSON.parse(await readFile(path.join(dir,'lia.config.json'),'utf8')).framework,'vue');
  assert(!(await readdir(dir)).includes('node_modules'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('no-mock configuration is explicit',async()=>{
 const files=await projectFiles({name:'my-app',appId:'my-app',framework:'react',mock:false});
 assert.match(files['src/local-dev.ts'],/DEV && false/);assert.equal(JSON.parse(files['lia.config.json']).mockDevelopment,false);
});
test('CLI clean starters use the requested display name without including a demo',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lia-create-name-test-'));
 try {
  const dir=path.join(root,'orbit');
  execFileSync(process.execPath,[new URL('../bin/create-app.mjs',import.meta.url).pathname,dir,'--framework','preact','--name','Orbit Data','--yes','--no-install','--local']);
  assert.equal(JSON.parse(await readFile(path.join(dir,'lia.config.json'),'utf8')).name,'Orbit Data');
  assert.match(await readFile(path.join(dir,'src/config.ts'),'utf8'),/APP_NAME = "Orbit Data"/);
  assert(!(await readdir(path.join(dir,'src'))).includes('demo.ts'));
 } finally {await rm(root,{recursive:true,force:true});}
});
