#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { frameworks, packageManagers } from '../src/frameworks.mjs';
import { scaffold, validAppId, validName } from '../src/scaffold.mjs';

const help = `Create a Lia app\n\n  npm create @lia-labs/app@latest [directory]\n\nOptions:\n  --framework <name>   ${Object.keys(frameworks).join(', ')}\n  --template <name>    starter or demo\n  --app-id <id>        Public ID from the developer portal\n  --pm <name>          npm, pnpm, yarn or bun\n  --no-mock           Disable the local browser mock\n  --install           Install dependencies after creation\n  --no-install        Leave dependency installation to you\n  --yes, -y           Accept defaults without prompts\n  --help, -h          Show this help\n  --version           Show version\n`;

let rl;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { framework: {type:'string',short:'f'}, template:{type:'string',short:'t'}, 'app-id':{type:'string'}, pm:{type:'string'}, 'no-mock':{type:'boolean'}, install:{type:'boolean'}, 'no-install':{type:'boolean'}, yes:{type:'boolean',short:'y'}, help:{type:'boolean',short:'h'}, version:{type:'boolean'} } });
  if (values.help) { stdout.write(help); process.exit(0); }
  if (values.version) { stdout.write(JSON.parse(await readFile(new URL('../package.json',import.meta.url))).version+'\n'); process.exit(0); }
  if (positionals.length > 1 || (values.install && values['no-install'])) throw Error('Use one directory and either --install or --no-install.');
  const interactive = !values.yes && stdin.isTTY;
  if (interactive) rl = createInterface({input:stdin,output:stdout});
  async function ask(question, fallback, validate = () => true) {
    if (!rl) return fallback;
    for (;;) {
      const answer = (await rl.question(`${question} (${fallback}): `)).trim() || fallback;
      if (validate(answer)) return answer;
      stdout.write('Please enter a valid answer.\n');
    }
  }
  async function choose(question, options, fallback) {
    if (!rl) return fallback;
    stdout.write('\n'+question+'\n'+options.map((item,i)=>`  ${i+1}. ${item.label}\n`).join(''));
    const answer = await ask('Choose',fallback,value=>options.some((item,i)=>item.value===value||String(i+1)===value));
    return options.find((item,i)=>item.value===answer||String(i+1)===answer).value;
  }
  const directory = positionals[0] || await ask('Project directory','my-lia-app');
  const name = path.basename(path.resolve(directory)).toLowerCase();
  if (!validName(name)) throw Error('Choose a project directory with a valid lowercase npm name.');
  const framework = values.framework || await choose('Which framework?',Object.entries(frameworks).map(([value,spec])=>({value,label:spec.label})),'react');
  const template = values.template || await choose('What would you like to start with?',[{value:'starter',label:'Starter — a small working app'},{value:'demo',label:'SDK demo — explore the feature catalogue'}],'starter');
  const defaultId = name.replace(/[^a-z0-9-]/g,'-').slice(0,40).replace(/-+$/,'').padEnd(2,'a');
  const appId = values['app-id'] || await ask('Lia app ID (you can edit it later)',defaultId,validAppId);
  const pm = values.pm || await choose('Package manager',packageManagers.map(value=>({value,label:value})),'npm');
  if (!packageManagers.includes(pm)) throw Error('Choose npm, pnpm, yarn or bun.');
  const mock = values['no-mock'] ? false : (await ask('Enable simulated Lia in local development?','yes',value=>['yes','no','y','n'].includes(value.toLowerCase()))).toLowerCase().startsWith('y');
  const install = values.install || (!values['no-install'] && interactive && (await ask('Install dependencies now?','yes',value=>['yes','no','y','n'].includes(value.toLowerCase()))).toLowerCase().startsWith('y'));
  rl?.close();
  const target = await scaffold({directory,name,framework,template,appId,mock});
  stdout.write(`\nCreated ${name} with ${frameworks[framework].label}.\n`);
  stdout.write('Mock payments and rewards run only during local development; production builds use the real Lia host.\n');
  let installed = false;
  if (install) {
    stdout.write(`\nInstalling with ${pm}…\n`);
    const command = process.platform==='win32' ? process.env.ComSpec||'cmd.exe' : pm;
    const args = process.platform==='win32' ? ['/d','/s','/c',`${pm} install`] : ['install'];
    const code = await new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:target,stdio:'inherit',shell:false});child.once('error',reject);child.once('exit',resolve);});
    if (code!==0) throw Error(`Installation did not finish. Your files are safe; run ${pm} install in the project to retry.`);
    installed = true;
  }
  const shownDirectory = process.platform === 'win32' ? '"' + directory.replaceAll('"', '""') + '"' : "'" + directory.replaceAll("'", "'\"'\"'") + "'";
  stdout.write(`\nNext:\n  cd ${shownDirectory}\n${installed?'':`  ${pm} install\n`}  ${pm} run dev\n\nRegister your HTTPS app in https://developers.lialabs.org.\nYou and your testers will find it in Lia under Apps → Testing.\nNever put server keys in browser code or trust the client to grant purchases or rewards.\n`);
} catch (error) {
  rl?.close();
  process.stderr.write(`\n${error.message || error}\n`);
  process.exitCode = error.code==='ABORT_ERR' ? 0 : 1;
}
