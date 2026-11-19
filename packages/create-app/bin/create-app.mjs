#!/usr/bin/env node
import * as p from '@clack/prompts';
import color from 'picocolors';
import { stdin, stdout } from 'node:process';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { frameworks, packageManagers, templates } from '../src/frameworks.mjs';
import { scaffold, validAppId } from '../src/scaffold.mjs';
import { directoryError, detectPackageManager, nextCommands } from '../src/terminal.mjs';
import { installDependencies } from '../src/install.mjs';

const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url))).version;
const help = `
  Create a Lia app

  npm create @lia-labs/app@latest [directory] [options]

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
].map(([value, label, hint]) => ({ value, label, hint }));

let interactive = false, progress, target;
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
  } });
  if (values.help) { stdout.write(help); process.exit(0); }
  if (values.version) { stdout.write(version + '\n'); process.exit(0); }
  if (positionals.length > 1) throw Error('Choose one project directory.');
  if (values.install && values['no-install']) throw Error('Use either --install or --no-install.');
  if (values.framework && !Object.hasOwn(frameworks, values.framework)) throw Error('Unknown framework. Use --help to see your options.');
  if (values.template && !templates.includes(values.template)) throw Error('Choose --template starter or --template demo.');
  if (values.pm && !packageManagers.includes(values.pm)) throw Error('Choose --pm npm, pnpm, yarn or bun.');
  if (values['app-id'] && !validAppId(values['app-id'])) throw Error('App ID needs 2–40 lowercase letters, numbers or dashes.');

  const ci = process.env.CI && !['false', '0'].includes(process.env.CI);
  interactive = Boolean(stdin.isTTY && stdout.isTTY && !values.yes && !ci);
  if (interactive) {
    stdout.write('\n');
    p.intro(`${color.bgBlue(color.white(color.bold(' LIA ')))}  ${color.bold('Create an app')} ${color.dim('v' + version)}`);
    p.log.message(color.dim('From an idea to an app inside Lia.'));
  }
  const directory = (positionals[0] || (interactive ? await answer(p.text({
    message: 'Where should we create your app?', placeholder: 'my-lia-app', defaultValue: 'my-lia-app',
    validate: value => directoryError(value?.trim() || 'my-lia-app'),
  })) : 'my-lia-app')).trim();
  const invalidDirectory = await directoryError(directory);
  if (invalidDirectory) throw Error(invalidDirectory);
  const name = path.basename(path.resolve(directory)).toLowerCase();
  const framework = values.framework || (interactive ? await answer(p.select({
    message: 'Pick your framework', options: frameworkOptions, initialValue: 'react', maxItems: 9,
  })) : 'react');
  const template = values.template || (interactive ? await answer(p.select({
    message: 'What would you like to build on?', initialValue: 'starter', options: [
      { value: 'starter', label: 'A clean starter', hint: 'A small app to make your own' },
      { value: 'demo', label: 'The SDK playground', hint: 'Working examples of Lia features' },
    ],
  })) : 'starter');
  const defaultId = name.replace(/[^a-z0-9-]/g, '-').slice(0, 40).replace(/-+$/, '').padEnd(2, 'a');
  let appId = values['app-id'] || defaultId;
  let pm = values.pm || detectPackageManager(process.env.npm_config_user_agent);
  let mock = !values['no-mock'];
  let install = Boolean(values.install || (interactive && !values['no-install']));
  if (interactive) {
    const settings = await answer(p.select({
      message: 'How should we set it up?', initialValue: 'recommended', options: [
        { value: 'recommended', label: 'Recommended', hint: [pm, mock ? 'local preview' : 'open in Lia', install ? 'install' : 'install later'].join(' · ') },
        { value: 'custom', label: 'Customize', hint: 'Choose your own settings' },
      ],
    }));
    if (settings === 'custom') {
      if (!values['app-id']) appId = await answer(p.text({ message: 'Your public Lia app ID', placeholder: defaultId, defaultValue: defaultId,
        validate: value => validAppId(value?.trim() || defaultId) ? undefined : 'Use 2–40 lowercase letters, numbers or dashes; start and end with a letter or number.',
      }));
      if (!values.pm) pm = await answer(p.select({ message: 'Package manager', initialValue: pm,
        options: packageManagers.map(value => ({ value, label: value, ...(value === pm ? { hint: 'Detected' } : {}) })),
      }));
      if (!values['no-mock']) mock = await answer(p.confirm({ message: 'Preview Lia features in your browser?', active: 'Yes, use simulated data', inactive: 'No, test inside Lia', initialValue: true }));
      if (!values.install && !values['no-install']) install = await answer(p.confirm({ message: 'Install dependencies now?', active: 'Yes, get everything ready', inactive: 'I’ll install them later', initialValue: true }));
    }
    p.log.step(`${color.bold(name)} ${color.dim('· ' + frameworks[framework].label + ' · ' + (template === 'demo' ? 'SDK playground' : 'Starter'))}`);
    progress = p.spinner({ styleFrame: color.blue });
    progress.start('Creating your project');
  }
  target = await scaffold({ directory, name, framework, template, appId: appId.trim(), mock });
  if (interactive) progress.stop('Project files ready');
  else stdout.write(`\nCreated ${name} with ${frameworks[framework].label}.\n`);
  let installed = false;
  if (install) {
    const controller = new AbortController();
    if (interactive) { progress = p.spinner({ styleFrame: color.blue, onCancel: () => controller.abort(), cancelMessage: 'Installation stopped' }); progress.start(`Installing dependencies with ${pm}`); }
    else stdout.write(`Installing dependencies with ${pm}…\n`);
    const started = performance.now();
    try {
      await installDependencies(pm, { cwd: target, signal: controller.signal });
      installed = true;
      if (interactive) progress.stop(`Dependencies installed ${color.dim('· ' + ((performance.now() - started) / 1000).toFixed(1) + 's')}`);
      else stdout.write('Dependencies installed.\n');
    } catch (error) {
      if (controller.signal.aborted) throw new Cancelled();
      if (interactive) { progress.error('Dependencies need another try'); p.log.warn(error.message); }
      else process.stderr.write(`\n${error.message}\n`);
      process.exitCode = 1;
    }
  }
  const commands = nextCommands(directory, pm, installed);
  if (interactive) {
    p.note(commands.map(command => color.cyan(command)).join('\n'), 'Start building');
    p.log.info(`${mock ? 'Your browser preview uses simulated Lia data.' : 'Open your HTTPS app inside Lia to test.'}\n${color.dim('When you’re ready, add it at developers.lialabs.org.')}`);
    p.outro(`${color.bold(installed || !install ? 'Make it yours.' : 'Your app is created. Install packages to continue.')} ${color.dim('docs.lialabs.org/packages/starters')}`);
  } else stdout.write(`\nNext:\n${commands.map(command => '  ' + command).join('\n')}\n\nDocs: https://docs.lialabs.org/packages/starters\n`);
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
