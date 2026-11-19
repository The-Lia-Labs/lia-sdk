import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameworks, SDK_VERSION, templates } from './frameworks.mjs';

const templateRoot = fileURLToPath(new URL('../templates/', import.meta.url));
const text = file => readFile(path.join(templateRoot, file), 'utf8');
const json = value => JSON.stringify(value, null, 2) + '\n';
export const validAppId = value => typeof value === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])$/.test(value);
export const validName = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(value) && value !== 'node_modules';

export async function projectFiles({ name, appId, framework, template = 'starter', mock = true }) {
  if (!validName(name)) throw Error('Use a lowercase project name with letters, numbers, dots, dashes or underscores.');
  if (!validAppId(appId)) throw Error('App ID must be 2–40 lowercase letters, numbers or dashes, starting and ending with a letter or number.');
  const spec = frameworks[framework];
  if (!spec || !templates.includes(template)) throw Error('Choose a supported framework and starter or demo template.');
  const angular = framework === 'angular', bridge = framework === 'bridge';
  const dependencies = { [spec.binding]: SDK_VERSION, ...(bridge ? {} : { '@lia-labs/sdk': SDK_VERSION }), ...spec.dependencies };
  const devDependencies = angular ? { '@angular/build': '~20.3.43', '@angular/cli': '~20.3.43', '@angular/compiler-cli': '20.3.35', typescript: '~5.9.3' } : { vite: '^8.3.8', typescript: '~5.9.3', ...spec.devDependencies };
  if (angular) Object.assign(dependencies, { '@angular/core': '20.3.35', '@angular/common': '20.3.35', '@angular/compiler': '20.3.35', '@angular/platform-browser': '20.3.35', rxjs: '^7.8.2', tslib: '^2.8.1', 'zone.js': '~0.15.0' });
  const scripts = angular ? { dev: 'ng serve --host 0.0.0.0', build: 'ng build', typecheck: 'ng build --configuration development' } : { dev: 'vite --host 0.0.0.0', build: `${spec.check || 'tsc --noEmit'} && vite build`, typecheck: spec.check || 'tsc --noEmit', preview: 'vite preview --host 0.0.0.0' };
  const files = {
    'package.json': json({ name, version: '0.0.0', private: true, type: 'module', scripts, dependencies, devDependencies, engines: { node: '^20.19.0 || >=22.12.0' } }),
    '.gitignore': 'node_modules\ndist\n.angular\n.env\n.env.*\n!.env.example\n*.local\n',
    '.env.example': '# Public configuration only. Never place server keys in VITE_* variables.\nVITE_LIA_MOCK=true\n',
    'lia.config.json': json({ appId, framework, template, sdkVersion: SDK_VERSION, mockDevelopment: mock }),
    'src/styles.css': await text('common/styles.css'),
    'src/config.ts': `export const APP_ID = ${JSON.stringify(appId)};\nexport const FRAMEWORK = ${JSON.stringify(spec.label)};\nexport const SDK_PACKAGE = ${JSON.stringify(spec.binding)};\nexport const PRODUCT_ID = 'demo-coins'; // Create this test product in the developer portal first.\n`,
    'src/format.ts': await text('common/format.ts'),
    'src/demo.ts': await text(bridge ? 'bridge/demo.ts' : template === 'demo' ? 'common/demo.ts' : 'common/minimal.ts'),
    'tsconfig.json': json({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ES2022','DOM','DOM.Iterable'], strict: true, skipLibCheck: true, ...(angular ? {} : { noEmit: true, allowImportingTsExtensions: true }), isolatedModules: true, ...(angular ? { experimentalDecorators: true, useDefineForClassFields: false } : { types: ['vite/client'] }), ...(spec.jsx ? { jsx: spec.jsx } : {}), ...(spec.jsxImportSource ? { jsxImportSource: spec.jsxImportSource } : {}) }, ...(angular ? { files: ['src/main.ts'], include: ['src/**/*.d.ts'], angularCompilerOptions: { strictTemplates: true } } : { include: ['src/**/*.ts','src/**/*.tsx','src/**/*.vue','src/**/*.svelte'] }) }),
  };
  const replacements = { '__APP_NAME__': name, '__FRAMEWORK__': spec.label, '__BINDING__': spec.binding, '__MOCK__': mock ? 'true' : 'false' };
  const render = source => Object.entries(replacements).reduce((result, [key, value]) => result.replaceAll(key, value), source);
  files['index.html'] = render(await text(angular ? 'angular/index.html' : 'common/index.html')).replace('__ENTRY__', spec.entry);
  files['README.md'] = render(await text('common/README.md')).replaceAll('__APP_ID__', appId).replaceAll('__TEMPLATE__', template);
  const folder = framework === 'vanilla' || framework === 'elements' ? 'vanilla' : framework;
  for (const file of await readdir(path.join(templateRoot, folder))) {
    if (['demo.ts','index.html'].includes(file)) continue;
    files['src/' + file] = render(await text(folder + '/' + file));
  }
  if (angular) {
    files['angular.json'] = json({ $schema: './node_modules/@angular/cli/lib/config/schema.json', version: 1, cli: { analytics: false }, projects: { app: { projectType: 'application', root: '', sourceRoot: 'src', architect: { build: { builder: '@angular/build:application', options: { browser: 'src/main.ts', index: 'index.html', outputPath: 'dist', tsConfig: 'tsconfig.json', styles: ['src/styles.css'], polyfills: ['zone.js'] }, configurations: { production: { fileReplacements: [{ replace: 'src/local-dev.ts', with: 'src/local-dev.production.ts' }] }, development: { optimization: false, sourceMap: true } }, defaultConfiguration: 'production' }, serve: { builder: '@angular/build:dev-server', configurations: { development: { buildTarget: 'app:build:development' } }, defaultConfiguration: 'development' } } } } });
  } else {
    files['vite.config.ts'] = `import { defineConfig } from 'vite';\n${spec.plugin || ''}\nexport default defineConfig({ plugins: [${spec.plugins || ''}] });\n`;
    files['src/lia.ts'] = bridge ? `export * from '@lia-labs/bridge';\n` : `export * from '${framework === 'elements' ? '@lia-labs/sdk' : spec.binding}';\n`;
    files['src/local-dev.ts'] = render(await text(bridge ? 'bridge/local-dev.ts' : 'common/local-dev.ts'));
  }
  if (framework === 'elements') {
    files['src/main.ts'] = `import './local-dev';\nimport { defineLiaElements } from '@lia-labs/elements';\nimport { mount } from './app';\nimport './styles.css';\ndefineLiaElements();\nconst host = document.createElement('lia-app');\nhost.setAttribute('auto-ready', '');\nconst button = document.createElement('lia-main-button');\nbutton.setAttribute('text', 'Try a toast');\nbutton.addEventListener('lia-click', () => import('./lia').then(sdk => sdk.toast('Hello from web components')).catch(console.error));\ndocument.body.append(host, button);\nconst dispose = mount({ nativeButton: false });\nimport.meta.hot?.dispose(() => { dispose(); host.remove(); button.remove(); });\n`;
  }
  if (framework === 'svelte') files['src/vite-env.d.ts'] = '/// <reference types="svelte" />\n/// <reference types="vite/client" />\n';
  return files;
}

export async function scaffold({ directory, ...options }) {
  // Validate and prepare every template before making any filesystem changes.
  const files = await projectFiles(options);
  const target = path.resolve(directory);
  let existing;
  try { existing = await lstat(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink() || (await readdir(target)).length)) throw Error('The destination must be a new or empty directory. Existing files are never overwritten.');
  await mkdir(target, { recursive: true });
  for (const [name, source] of Object.entries(files)) {
    const filename = path.resolve(target, name);
    if (!filename.startsWith(target + path.sep)) throw Error('Invalid template path.');
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, source, { flag: 'wx' });
  }
  return target;
}
