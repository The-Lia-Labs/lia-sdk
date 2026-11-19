import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installDependencies } from '../src/install.mjs';

const cli = new URL('../bin/create-app.mjs', import.meta.url).pathname;
const shellTests = { skip: process.platform === 'win32' };
async function fixture(source) {
  const root = await mkdtemp(path.join(tmpdir(), 'lia-cli-install-'));
  await writeFile(path.join(root, 'npm'), `#!${process.execPath}\n${source}`, { mode: 0o755 });
  return { root, env: { ...process.env, PATH: root + path.delimiter + process.env.PATH } };
}

test('CI output stays static and honors the invoking package manager', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'lia-cli-ci-'));
  try {
    const run = spawnSync(process.execPath, [cli, 'hello', '--framework', 'vue', '--no-install'], { cwd: root,
      env: { ...process.env, CI: 'true', NO_COLOR: '1', npm_config_user_agent: 'pnpm/10.0.0 npm/? node/v22' }, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stdout, /\x1b|Pick your framework|How should we/);
    assert.match(run.stdout, /pnpm install\n\s+pnpm run dev/);
    assert.equal(JSON.parse(await readFile(path.join(root, 'hello/lia.config.json'))).framework, 'vue');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('invalid CLI options fail before creating a project', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'lia-cli-invalid-'));
  try {
    for (const flags of [['--framework', 'wrong'], ['--pm', 'npm;echo'], ['--install', '--no-install'], ['--app-id', 'x']]) {
      const run = spawnSync(process.execPath, [cli, 'hello', '--yes', ...flags], { cwd: root, encoding: 'utf8' });
      assert.equal(run.status, 1); assert.deepEqual(await readdir(root), []);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('successful installs hide package-manager noise and receive fixed arguments', shellTests, async () => {
  const { root, env } = await fixture(`console.log('NOISY_INSTALL_OUTPUT'); console.log('funding and audit chatter'); require('node:fs').writeFileSync('install-args.json', JSON.stringify(process.argv.slice(2)));`);
  try {
    const run = spawnSync(process.execPath, [cli, 'hello', '--yes', '--install'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr); assert.doesNotMatch(run.stdout, /NOISY_INSTALL_OUTPUT|funding/);
    assert.match(run.stdout, /Dependencies installed/); assert.doesNotMatch(run.stdout, /\n  npm install/);
    assert.deepEqual(JSON.parse(await readFile(path.join(root, 'hello/install-args.json'))), ['install', '--no-audit', '--no-fund']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failed installs retain the project, show the cause and print retry commands', shellTests, async () => {
  const { root, env } = await fixture(`console.error('\u001b[31mREGISTRY_UNAVAILABLE\u001b[0m'); process.exit(17);`);
  try {
    const run = spawnSync(process.execPath, [cli, 'hello', '--yes', '--install'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(run.status, 1); assert.match(run.stderr, /REGISTRY_UNAVAILABLE/); assert.doesNotMatch(run.stderr, /\x1b/);
    assert.match(run.stdout, /npm install\n\s+npm run dev/);
    assert.doesNotMatch(run.stdout, /Dependencies installed/);
    assert.equal(JSON.parse(await readFile(path.join(root, 'hello/lia.config.json'))).appId, 'hello');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('missing package managers produce a recovery command', shellTests, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'lia-cli-missing-'));
  try { await assert.rejects(installDependencies('pnpm', { cwd: root, env: { ...process.env, PATH: root } }), /pnpm isn’t installed.*pnpm install/); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('aborting an installation terminates its process', shellTests, async () => {
  const { root, env } = await fixture(`require('node:fs').writeFileSync('installer.pid', String(process.pid)); setInterval(() => {}, 100);`);
  try {
    const controller = new AbortController();
    const install = installDependencies('npm', { cwd: root, env, signal: controller.signal });
    const rejected = assert.rejects(install, /abort/i);
    let pid;
    for (let attempts = 0; attempts < 100 && !pid; attempts++) {
      try { pid = Number(await readFile(path.join(root, 'installer.pid'), 'utf8')); } catch { await new Promise(resolve => setTimeout(resolve, 10)); }
    }
    assert(pid, 'installer started'); controller.abort(); await rejected;
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an already-cancelled install never starts a process', shellTests, async () => {
  const { root, env } = await fixture(`require('node:fs').writeFileSync('unexpected', 'started');`);
  try {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(installDependencies('npm', { cwd: root, env, signal: controller.signal }), /abort/i);
    assert.deepEqual(await readdir(root), ['npm']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
