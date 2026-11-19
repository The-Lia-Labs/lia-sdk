import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
const port=Number(process.env.LIA_CONFORMANCE_PORT??4590);
const base=`http://127.0.0.1:${port}/lia/api/apps/v1`;
const log=createWriteStream('/tmp/lia-server-conformance.ndjson');
const simulation=spawn('postman',['simulation','run','postman/simulations/server-packages.sim.yaml','--port',String(port),'--no-history','--output','ndjson'],{stdio:['ignore','pipe','inherit']});simulation.stdout.pipe(log);
let exited=false;simulation.once('exit',()=>{exited=true;});
const run=(cmd,args,cwd)=>new Promise((resolve,reject)=>{const child=spawn(cmd,args,{cwd,stdio:'inherit',env:{...process.env,LIA_CONFORMANCE_URL:base}});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(cmd+' exited '+code)));});
try{
 let ready=false;for(let i=0;i<100;i++){if(exited)throw Error('Postman simulation failed to start');try{ready=(await fetch(base.replace('/api/apps/v1','/health'))).ok;}catch{}if(ready)break;await sleep(100);}if(!ready)throw Error('Simulation did not become ready');
 await run(process.execPath,['scripts/server-conformance.mjs']);
 await run(process.env.LIA_PYTHON??'python3',['backends/python/tests/conformance.py']);
 await run('php',['backends/php/tests/conformance.php']);
 await run('go',['test','-race','./...'],'backends/go');
 if(process.argv.includes('--starters'))await run(process.execPath,['scripts/test-backend-starters.mjs']);
 const counts=await fetch(base.replace('/api/apps/v1','/counts')).then(r=>r.json());
 for(const lang of ['node','python','php','go']){
  if(counts[`GET /api/apps/v1/charges/retry-${lang}`]!==2||counts[`POST /api/apps/v1/charges/replay-${lang}/deliver`]!==2||counts[`GET /api/apps/v1/charges/rate-${lang}`]!==1)throw Error(lang+' retry counts differ');
 }
 if(counts['GET /leak'])throw Error('An authenticated redirect was followed');
 console.log('PASS: all four real language clients over HTTP; stable mutation keys, bounded retries and no redirected credentials.');
}finally{simulation.kill('SIGINT');await new Promise(resolve=>{if(exited)resolve();else simulation.once('exit',resolve);});log.end();}
