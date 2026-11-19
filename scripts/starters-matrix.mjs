import {mkdtemp,writeFile,readFile,readdir} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {scaffold,projectFiles} from '../packages/create-app/src/scaffold.mjs';
import {frameworks} from '../packages/create-app/src/frameworks.mjs';
const root=await mkdtemp(path.join(tmpdir(),'lia-starters-matrix-'));
await writeFile(path.join(root,'matrix.json'),JSON.stringify({root,frameworks:Object.keys(frameworks)}));
console.log('Matrix root: '+root);
const queue=Object.keys(frameworks),results=[];
async function run(args,cwd,log){const output=createWriteStream(log);const status=await new Promise((resolve,reject)=>{const child=spawn('npm',args,{cwd,stdio:['ignore','pipe','pipe'],shell:false});child.stdout.pipe(output);child.stderr.pipe(output);child.once('error',reject);child.once('exit',resolve);});output.end();return status;}
async function hasMock(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){if(await hasMock(file))return true;}else if(entry.name.endsWith('.js')&&(await readFile(file,'utf8')).includes('lias_mock'))return true;}return false;}
async function worker(){while(queue.length){const framework=queue.shift(),cwd=path.join(root,framework);await scaffold({directory:cwd,name:'lia-'+framework,appId:'lia-'+framework,framework,template:'demo'});let stage='install',status=await run(['install','--no-audit','--no-fund'],cwd,path.join(root,framework+'-install.log'));if(status===0){for(const template of ['demo','starter']){stage=template+'-build';const files=await projectFiles({name:'lia-'+framework,appId:'lia-'+framework,framework,template});await writeFile(path.join(cwd,'src/demo.ts'),files['src/demo.ts']);status=await run(['run','build'],cwd,path.join(root,framework+'-'+stage+'.log'));if(status!==0)break;if(await hasMock(path.join(cwd,'dist'))){stage=template+'-production-mock-check';status=1;break;}}}const result={framework,stage,status,cwd};results.push(result);console.log(JSON.stringify(result));await writeFile(path.join(root,'results.json'),JSON.stringify(results,null,2));}}
await Promise.all([worker(),worker()]);process.exitCode=results.some(r=>r.status!==0)?1:0;
