import {mkdir,readdir,readFile,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const backendLanguages={typescript:{label:'TypeScript / JavaScript',frameworks:['node','express']},python:{label:'Python',frameworks:['fastapi','django']},php:{label:'PHP',frameworks:['php']},go:{label:'Go',frameworks:['http']}};
const templateRoot=fileURLToPath(new URL('../templates/',import.meta.url));
async function copyTree(root,prefix='',files={}){for(const entry of await readdir(root,{withFileTypes:true})){const file=path.join(root,entry.name),name=prefix+entry.name;if(entry.isDirectory())await copyTree(file,name+'/',files);else files[name]=await readFile(file,'utf8');}return files;}
/** Backend directories stay separate: no server credentials in a frontend bundle. */
export async function scaffoldBackend(directory,{language='typescript',framework}={}){
 const config=backendLanguages[language];if(!config)throw Error('Choose typescript, python, php or go.');framework??=config.frameworks[0];if(!config.frameworks.includes(framework))throw Error('Unsupported backend framework for '+language+'.');
 const target=path.resolve(directory);let existing;try{existing=await lstat(target);}catch(e){if(e.code!=='ENOENT')throw e;}
 if(existing&&(!existing.isDirectory()||existing.isSymbolicLink()||(await readdir(target)).length))throw Error('Choose a new or empty directory. Existing files are never overwritten.');
 const name=path.basename(target);if(!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(name))throw Error('Use a lowercase project directory.');
 let files={};let commands=[];
 if(language==='typescript'){
  for(const[file,source]of Object.entries(await copyTree(path.join(templateRoot,'backend'))))files[file==='README.md'?file:'src/'+file]=source;
  const dependencies={'@lia-labs/server':'^0.1.0'},devDependencies={typescript:'~5.9.3','@types/node':'^24.0.0'};
  if(framework==='express'){dependencies.express='^5.1.0';devDependencies['@types/express']='^5.0.0';files['src/entry.ts']="import express from 'express';\nimport {handler,startRecovery} from './server.js';\nconst app=express();app.disable('x-powered-by');\n// Raw IncomingMessage: do not install express.json() before signed webhooks.\napp.use(handler);startRecovery();app.listen(Number(process.env.PORT??3001),process.env.HOST??'127.0.0.1');\n";}
  files['package.json']=JSON.stringify({name,version:'0.0.0',private:true,type:'module',engines:{node:'>=22.13.0'},scripts:{build:'tsc',start:'node --env-file=.env dist/entry.js',test:'npm run build && node --test dist/backend.test.js'},dependencies,devDependencies},null,2)+'\n';
  files['tsconfig.json']=JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',outDir:'dist',rootDir:'src',strict:true,skipLibCheck:true},include:['src/**/*.ts']},null,2)+'\n';
  commands=['npm install','cp .env.example .env','npm test','npm start'];
 }else{
  files=await copyTree(path.join(templateRoot,'backend-'+language));
  if(language==='python'){
   files['app.py']=files[framework+'/app.py'];delete files['fastapi/app.py'];delete files['django/app.py'];
   files['requirements.txt']='lia-labs-server @ git+https://github.com/The-Lia-Labs/lia-server-python.git@v0.1.0\n'+(framework==='fastapi'?'fastapi>=0.115,<1\nuvicorn>=0.34,<1':'Django>=5.2,<6.1')+'\npython-dotenv>=1,<2\n';
   files['app.py']="from dotenv import load_dotenv\nload_dotenv()\n"+files['app.py'];
   commands=['python3 -m venv .venv','. .venv/bin/activate','pip install -r requirements.txt','cp .env.example .env',framework==='fastapi'?'uvicorn app:app --host 127.0.0.1 --port 3001':'python app.py runserver 127.0.0.1:3001'];
  }else if(language==='php'){
   files['composer.json']=JSON.stringify({name:'app/'+name,type:'project',repositories:[{type:'vcs',url:'https://github.com/The-Lia-Labs/lia-server-php'}],require:{php:'>=8.2','ext-pdo':'*','ext-pdo_sqlite':'*','lia-labs/server':'^0.1.0'}},null,2)+'\n';
   commands=['composer install','# Export LIA_SERVER_KEY and LIA_WEBHOOK_SECRET in your server environment','php -S 127.0.0.1:3001 server.php'];
  }else{
   files['go.mod']='module example.com/'+name+'\n\ngo 1.22\n\nrequire (\n github.com/The-Lia-Labs/lia-server-go v0.1.0\n github.com/mattn/go-sqlite3 v1.14.32\n)\n';
   commands=['go mod tidy','# Export LIA_SERVER_KEY and LIA_WEBHOOK_SECRET in your server environment','go run .'];
  }
  files['README.md']='# '+name+'\n\nLia '+config.label+' backend using '+framework+'.\n\n```sh\n'+commands.join('\n')+'\n```\n\nUse server credentials from your app in Lia Developers. Send the short-lived player session in Authorization: Bearer.\n\n'+'Create the coins-100 product in Lia Developers and edit the server-owned entitlement mapping. Purchases verify player, mode, status and product, then grant once per charge using SQLite transactions. Refunds reverse once and can create a negative balance after items have been spent. Persist data/ on a durable volume; use a shared transactional database for multiple servers. Set DJANGO_SECRET_KEY for Django. Go uses SQLite through CGO and needs a C compiler.'+'\n\nNever trust a frontend score, player ID, price or watched flag. Verify charges with Lia and grant inventory atomically in your database. Test/live keys access separate records. Use production hosting, HTTPS, a secret manager and per-player limits before launch.\n\nFull guide: https://docs.lialabs.org/packages/server\n';
 }
 files['.gitignore']='node_modules\ndist\ndata\n.env\n*.sqlite*\n.venv\n__pycache__\nvendor\n';
 files['.env.example']='# SERVER ONLY. Never expose these through VITE_* or NEXT_PUBLIC_* variables.\nLIA_SERVER_KEY=lia_test_REPLACE_ME\nLIA_WEBHOOK_SECRET=whsec_REPLACE_ME\nFRONTEND_ORIGIN=http://localhost:5173\nPORT=3001\n# DJANGO_SECRET_KEY=SET_A_UNIQUE_RANDOM_SERVER_SECRET\n# LIA_API_BASE_URL=https://api.lialabs.org/api/apps/v1\n';
 for(const[file,source]of Object.entries(files)){await mkdir(path.dirname(path.join(target,file)),{recursive:true});await writeFile(path.join(target,file),source,{flag:'wx'});}
 return {target,language,framework,commands};
}
export async function backendSetup({values,directory,studio,interactive,answer}){
 const language=values.language??(interactive?await answer(studio.select({message:'Choose your backend language',stage:1,initialValue:'typescript',options:Object.entries(backendLanguages).map(([value,c])=>({value,label:c.label,hint:'Official Lia server client'}))})):'typescript');
 const config=backendLanguages[language];if(!config)throw Error('Choose --language typescript, python, php or go.');
 const framework=values.framework??(interactive&&config.frameworks.length>1?await answer(studio.select({message:'Pick your backend framework',stage:2,initialValue:config.frameworks[0],options:config.frameworks.map(value=>({value,label:({node:'Node.js HTTP',express:'Express',fastapi:'FastAPI',django:'Django'})[value]??value}))})):config.frameworks[0]);
 directory??=interactive?await answer(studio.text({message:'Where should we create your backend?',defaultValue:'my-lia-server',placeholder:'my-lia-server'})):'my-lia-server';
 if(interactive)studio.note([config.label+' · '+framework,'Verified sessions · signed webhooks · server-only credentials'],'YOUR BACKEND');
 const task=interactive?studio.task():null;task?.start('Preparing your backend');
 let result;try{result=await scaffoldBackend(directory,{language,framework});task?.stop('Backend files ready');}catch(e){task?.error('Backend setup did not finish');throw e;}
 const commands=['cd '+JSON.stringify(directory),...result.commands];
 if(interactive)studio.launchpad({commands,installed:false});else process.stdout.write('\nCreated '+directory+' · '+config.label+' / '+framework+'\n\n'+commands.map(s=>'  '+s).join('\n')+'\n\nConfigure server credentials before starting. https://docs.lialabs.org/packages/server\n');
}
