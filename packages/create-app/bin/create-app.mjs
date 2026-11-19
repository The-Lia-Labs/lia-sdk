#!/usr/bin/env node
import * as p from '@clack/prompts';
import { createStudio } from '../src/studio.mjs';
import { apiOrigin, login, logout, whoami, savedAccount, registerProject, cliRequest, openBrowser } from '../src/account.mjs';
import { development } from '../src/development.mjs';
import { emitKeypressEvents } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { frameworks, packageManagers, templates } from '../src/frameworks.mjs';
import { scaffold, validAppId } from '../src/scaffold.mjs';
import { directoryError, detectPackageManager, nextCommands } from '../src/terminal.mjs';
import { installDependencies } from '../src/install.mjs';

const studio = createStudio();
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url))).version;
const help = `
  Create a Lia app

  npm create @lia-labs/app@latest [directory] [options]

  Commands: login, logout, whoami, register [directory], apps, dev [directory]

  --port <port>          Local preview port (dev only)
  --local                Create locally without connecting an account
  --register             Register this project as a private test app
  --url <https-url>      Optional deployed app URL
  --name <name>          Listing name (defaults to the project name)
  --kind <type>          app, game or utility
  --no-browser           Print the sign-in URL without opening it
  --api <origin>         API origin (credentials are scoped to this origin)

  --framework, -f <name>   ${Object.keys(frameworks).join(', ')}
  --template, -t <name>    starter or demo
  --app-id <id>           Public app ID; editable later
  --pm <name>             npm, pnpm, yarn or bun (auto-detected)
  --no-mock               Open in Lia instead of simulating locally
  --install              Install dependencies
  --no-install           Skip dependency installation
  --yes, -y              Use defaults without prompts
  --help, -h              Show this help
  --version              Show version

  docs.lialabs.org/packages/starters
`;
const frameworkOptions = [
  ['react', 'React', 'Hooks and components'],
  ['vue', 'Vue', 'Composables and refs'],
  ['svelte', 'Svelte', 'Reactive stores'],
  ['preact', 'Preact', 'Lightweight React alternative'],
  ['solid', 'Solid', 'Fine-grained reactivity'],
  ['angular', 'Angular', 'Signals and standalone components'],
  ['vanilla', 'TypeScript', 'No framework needed'],
  ['elements', 'Web components', 'Custom HTML elements'],
  ['bridge', 'Low-level bridge', 'Build your own integration'],
].map(([value, label, hint]) => ({ value, label, hint, badge: {react:'RE',vue:'VU',svelte:'SV',preact:'PR',solid:'SO',angular:'NG',vanilla:'TS',elements:'WC',bridge:'BR'}[value], description: hint + ' · ' + frameworks[value].binding }));

let interactive = false, progress, target;
async function connect(origin, browser=true) {
  const controller=new AbortController();
  try {
    const account = await login({origin,browser,signal:controller.signal,onDevice:({url,code})=>{
      if(interactive) studio.note(['Confirm this code in your browser:', '', code, '', url], 'CONNECT YOUR ACCOUNT');
      else stdout.write('Open '+url+'\nConfirm code: '+code+'\n');
    },onWaiting:()=>{if(interactive){progress=studio.task(()=>controller.abort());progress.start('Waiting for browser approval');}else stdout.write('Waiting for browser approval…\n');}});
    if(interactive&&progress&&!progress.isCancelled)progress.stop('Connected as @'+account.username);
    return account;
  } catch(error) {if(controller.signal.aborted)throw new Cancelled();if(interactive)progress?.error('Sign-in did not finish');throw error;}
}
async function ensureAccount(origin,browser) {
  try{return await whoami(origin);}catch(error){if(error.status!==401)throw error;if(!interactive)throw error;return connect(origin,browser);}
}
async function runDevelopment({directory,origin,pm,port,browser}) {
  let account=await ensureAccount(origin,browser);
  if(!account.scope?.split(' ').includes('apps:dev')) {
    if(!interactive)throw Error('Run npx @lia-labs/create-app@latest login to approve local preview access.');
    studio.note(['Local previews need one additional permission.','Confirm the new code in your browser to connect your private test apps.'],'LOCAL PREVIEW ACCESS');
    await connect(origin,browser);
  }
  const controller=new AbortController();let ready=false,links;
  const stop=()=>controller.abort(Error('Preview stopped'));
  const key=(_text,pressed)=>{
    if(pressed?.name==='q'||(pressed?.ctrl&&pressed?.name==='c'))stop();
    else if(pressed?.name==='o'&&links)void openBrowser(links.appUrl);
    else if(pressed?.name==='d'&&links)void openBrowser(links.dashboardUrl);
  };
  const signals=['SIGINT','SIGTERM','SIGHUP'];for(const signal of signals)process.once(signal,stop);
  const previousRaw=stdin.isRaw;
  try {
    if(interactive){progress=studio.task(stop);progress.start('Preparing your live preview');}
    await development({directory,origin,pm,port,signal:controller.signal,onStep:message=>{
      if(interactive&&!ready)progress?.message(message);else stdout.write('  '+message+'\n');
    },onReady:info=>{
      ready=true;links=info;
      if(interactive){progress.stop('Your local app is connected to Lia');studio.livePreview(info);emitKeypressEvents(stdin);stdin.setRawMode(true);stdin.resume();stdin.on('keypress',key);}
      else stdout.write('Live preview: '+info.publicUrl+'\nLocal: '+info.localUrl+'\nOpen in Lia: '+info.appUrl+'\nPress Ctrl+C to stop.\n');
    },onOutput:text=>stdout.write(text)});
  } catch(error) {
    if(!controller.signal.aborted)throw error;
    if(interactive&&!ready)progress?.cancel('Preview stopped');
  } finally {
    for(const signal of signals)process.removeListener(signal,stop);
    if(interactive){stdin.removeListener('keypress',key);stdin.setRawMode(Boolean(previousRaw));stdin.pause();}
  }
}
class Cancelled extends Error {}
async function answer(prompt) {
  const value = await prompt;
  if (p.isCancel(value)) throw new Cancelled();
  return value;
}

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    framework: { type: 'string', short: 'f' }, template: { type: 'string', short: 't' },
    'app-id': { type: 'string' }, pm: { type: 'string' }, 'no-mock': { type: 'boolean' },
    install: { type: 'boolean' }, 'no-install': { type: 'boolean' }, yes: { type: 'boolean', short: 'y' },
    help: { type: 'boolean', short: 'h' }, version: { type: 'boolean' },
    local:{type:'boolean'},register:{type:'boolean'},url:{type:'string'},name:{type:'string'},kind:{type:'string'},api:{type:'string'},'no-browser':{type:'boolean'},port:{type:'string'},
  } });
  if (values.help) { stdout.write(help); process.exit(0); }
  if (values.version) { stdout.write(version + '\n'); process.exit(0); }
  const command=['login','logout','whoami','register','apps','dev'].includes(positionals[0])?positionals.shift():'create';
  const origin=apiOrigin(values.api);
  if(values.local&&values.register)throw Error('Choose --local or --register.');
  if(values.kind&&!['app','game','utility'].includes(values.kind))throw Error('Choose --kind app, game or utility.');
  if (positionals.length > 1) throw Error('Choose one project directory.');
  if (values.install && values['no-install']) throw Error('Use either --install or --no-install.');
  if (values.framework && !Object.hasOwn(frameworks, values.framework)) throw Error('Unknown framework. Use --help to see your options.');
  if (values.template && !templates.includes(values.template)) throw Error('Choose --template starter or --template demo.');
  if (values.pm && !packageManagers.includes(values.pm)) throw Error('Choose --pm npm, pnpm, yarn or bun.');
  if (values['app-id'] && !validAppId(values['app-id'])) throw Error('App ID needs 2–40 lowercase letters, numbers or dashes.');

  const ci = process.env.CI && !['false', '0'].includes(process.env.CI);
  interactive = Boolean(stdin.isTTY && stdout.isTTY && !values.yes && !ci);
  if(interactive)studio.header(version);
  if(command!=='create') {
    if(command==='login') {
      let account;
      try {account=await whoami(origin);if(!account.scope?.split(' ').includes('apps:dev'))account=await connect(origin,!values['no-browser']);}catch(error){if(error.status!==401)throw error;account=await connect(origin,!values['no-browser']);}
      if(interactive)studio.note(['Signed in as @'+account.username,'Your terminal can create and list your test apps.'],'CONNECTED');
      else stdout.write('Signed in as @'+account.username+'\n');
    } else if(command==='logout') {await logout(origin);stdout.write('Signed out of Lia.\n');}
    else if(command==='whoami') {const account=await whoami(origin);stdout.write('@'+account.username+'\n');}
    else if(command==='apps') {const saved=await savedAccount(origin);if(!saved)throw Error('Run login first.');const data=await cliRequest(origin,'/apps',{token:saved.token});const lines=data.apps.map(app=>app.id+'  ['+app.status+']  '+app.name);if(interactive)studio.note(lines.length?lines:['No apps yet. Run register from your project.'],'YOUR APPS');else stdout.write((lines.join('\n')||'No apps yet.')+'\n');}
    else if(command==='dev') {await runDevelopment({directory:positionals[0]||'.',origin,pm:values.pm,port:values.port,browser:!values['no-browser']});}
    else {const account=await ensureAccount(origin,!values['no-browser']);const result=await registerProject({directory:positionals[0]||'.',origin,id:values['app-id'],name:values.name,kind:values.kind,url:values.url});if(interactive)studio.launchpad({commands:[],registration:result,account,installed:true});else stdout.write('Registered '+result.appId+'\n'+result.dashboardUrl+'\n');}
  }
  if(command==='create') {
  const directory = (positionals[0] || (interactive ? await answer(studio.text({
    message: 'Where should we create your app?', placeholder: 'my-lia-app', defaultValue: 'my-lia-app',
    validate: value => directoryError(value?.trim() || 'my-lia-app'),
  })) : 'my-lia-app')).trim();
  const invalidDirectory = await directoryError(directory);
  if (invalidDirectory) throw Error(invalidDirectory);
  const name = path.basename(path.resolve(directory)).toLowerCase();
  const framework = values.framework || (interactive ? await answer(studio.select({
    message: 'Pick your framework', stage: 1, options: frameworkOptions, initialValue: 'react', maxItems: 9,
  })) : 'react');
  const template = values.template || (interactive ? await answer(studio.select({
    message: 'What would you like to build on?', stage: 2, cards: true, initialValue: 'starter', options: [
      { value: 'starter', label: 'A clean starter', hint: 'A small app to make your own', description: 'A focused starting point. Build your own experience.' },
      { value: 'demo', label: 'The SDK playground', hint: 'Working examples of Lia features', description: 'Explore native features with working, editable examples.' },
    ],
  })) : 'starter');
  const defaultId = name.replace(/[^a-z0-9-]/g, '-').slice(0, 40).replace(/-+$/, '').padEnd(2, 'a');
  let appId = values['app-id'] || defaultId;
  let pm = values.pm || detectPackageManager(process.env.npm_config_user_agent);
  let mock = !values['no-mock'];
  let install = Boolean(values.install || (interactive && !values['no-install']));
  if (interactive) {
    const settings = await answer(studio.select({
      message: 'How should we set it up?', initialValue: 'recommended', options: [
        { value: 'recommended', label: 'Recommended', hint: [pm, mock ? 'local preview' : 'open in Lia', install ? 'install' : 'install later'].join(' · ') },
        { value: 'custom', label: 'Customize', hint: 'Choose your own settings' },
      ],
    }));
    if (settings === 'custom') {
      if (!values['app-id']) appId = await answer(studio.text({ message: 'Your public Lia app ID', stage: 3, placeholder: defaultId, defaultValue: defaultId,
        validate: value => validAppId(value?.trim() || defaultId) ? undefined : 'Use 2–40 lowercase letters, numbers or dashes; start and end with a letter or number.',
      }));
      if (!values.pm) pm = await answer(studio.select({ message: 'Package manager', initialValue: pm,
        options: packageManagers.map(value => ({ value, label: value, ...(value === pm ? { hint: 'Detected' } : {}) })),
      }));
      if (!values['no-mock']) mock = await answer(studio.confirm({ message: 'Preview Lia features in your browser?', active: 'Yes, use simulated data', inactive: 'No, test inside Lia', initialValue: true }));
      if (!values.install && !values['no-install']) install = await answer(studio.confirm({ message: 'Install dependencies now?', active: 'Yes, get everything ready', inactive: 'I’ll install them later', initialValue: true }));
    }
    studio.blueprint({name,framework:frameworks[framework].label,template,pm,mock});
    progress = studio.task();
    progress.start('Creating your project');
  }
  target = await scaffold({ directory, name, framework, template, appId: appId.trim(), mock });
  if (interactive) progress.stop('Project files ready');
  else stdout.write(`\nCreated ${name} with ${frameworks[framework].label}.\n`);
  let installed = false;
  if (install) {
    const controller = new AbortController();
    if (interactive) { progress = studio.task(() => controller.abort()); progress.start(`Installing dependencies with ${pm}`); }
    else stdout.write(`Installing dependencies with ${pm}…\n`);
    const started = performance.now();
    try {
      await installDependencies(pm, { cwd: target, signal: controller.signal });
      installed = true;
      if (interactive) progress.stop(`Dependencies installed · ${((performance.now() - started) / 1000).toFixed(1)}s`);
      else stdout.write('Dependencies installed.\n');
    } catch (error) {
      if (controller.signal.aborted) throw new Cancelled();
      if (interactive) { progress.error('Dependencies need another try'); p.log.warn(error.message); }
      else process.stderr.write(`\n${error.message}\n`);
      process.exitCode = 1;
    }
  }
  let registration, account;
  let register=Boolean(values.register);
  if(interactive&&!values.local&&!register)register=await answer(studio.select({message:'Give this app a home in Lia?',stage:4,initialValue:'connect',options:[{value:'connect',label:'Connect & register',hint:'Create your private test listing',description:'Sign in with Lia. Your app is added to your developer dashboard.'},{value:'local',label:'Keep building locally',hint:'You can register later',description:'Try everything in your browser and connect when you’re ready.'}]}))==='connect';
  if(register) {
    try {
      account=await ensureAccount(origin,!values['no-browser']);
      if(interactive){progress=studio.task();progress.start('Registering your test app');}
      registration=await registerProject({directory:target,origin,id:appId.trim(),name:values.name,kind:values.kind,url:values.url});
      if(interactive)progress.stop(registration.alreadyRegistered?'Linked your existing app':'Your app is registered in Testing');
    } catch(error) {if(error instanceof Cancelled)throw error;if(interactive){progress?.error('Registration needs another try');p.log.warn(error.message+'\nYour local files are ready. Run npx @lia-labs/create-app register from your project.');}else process.stderr.write(error.message+'\n');process.exitCode=1;}
  }
  const commands = nextCommands(directory, pm, installed);
  if(registration)commands[commands.length-1]='npx @lia-labs/create-app@latest dev';
  if (interactive) studio.launchpad({commands,registration,account,installed,install});
  else stdout.write(`${registration?'\n'+(registration.alreadyRegistered?'Linked ':'Registered ')+registration.appId+'\n'+registration.dashboardUrl+'\n'+(registration.pendingHosting?'Add your deployed HTTPS URL in the dashboard before testing.\n':''):''}\nNext:\n${commands.map(command => '  ' + command).join('\n')}\n\nDocs: https://docs.lialabs.org/packages/starters\n`);

  }
} catch (error) {
  if (error instanceof Cancelled) {
    if (interactive) { if (progress && !progress.isCancelled) progress.cancel('Setup stopped'); p.cancel(target ? 'Setup stopped. Your project files are saved.' : 'Setup cancelled. No files changed.'); }
    else process.stderr.write('Setup cancelled.\n');
    process.exitCode = 130;
  } else {
    if (interactive) { progress?.error('Could not finish setup'); p.log.error(error.message || String(error)); p.outro('Run the command again when you’re ready.'); }
    else process.stderr.write(`\n${error.message || error}\n`);
    process.exitCode = 1;
  }
}
