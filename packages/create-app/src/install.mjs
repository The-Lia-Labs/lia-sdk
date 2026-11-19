import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { packageManagers } from './frameworks.mjs';

export async function installDependencies(pm, { cwd, signal, env = process.env }) {
  if (!packageManagers.includes(pm)) throw Error('Unsupported package manager.');
  signal?.throwIfAborted();
  const win = process.platform === 'win32';
  const installArgs = pm === 'npm' ? ['install', '--no-audit', '--no-fund'] : ['install'];
  const command = win ? process.env.ComSpec || 'cmd.exe' : pm;
  const args = win ? ['/d', '/s', '/c', [pm, ...installArgs].join(' ')] : installArgs;
  let output = '';
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], shell: false, detached: !win });
    const collect = chunk => { output = (output + stripVTControlCharacters(chunk.toString())).slice(-64000); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    let abortTimer;
    const terminate = () => {
      if (!child.pid) return;
      if (win) child.kill('SIGTERM');
      else { try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') child.kill('SIGTERM'); } }
      abortTimer = setTimeout(() => { if (!win) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } else child.kill('SIGKILL'); }, 1500);
      abortTimer.unref();
    };
    const cleanup = () => { signal?.removeEventListener('abort', terminate); clearTimeout(abortTimer); };
    signal?.addEventListener('abort', terminate, { once: true });
    if (signal?.aborted) terminate();
    child.once('error', error => { cleanup(); reject(Error(error.code === 'ENOENT' ? `${pm} isn’t installed. Install it, then run ${pm} install in your project.` : error.message)); });
    child.once('close', code => {
      cleanup();
      if (signal?.aborted) { reject(signal.reason); return; }
      if (code === 0) { resolve(); return; }
      const detail = output.split(/\r?\n/).filter(Boolean).slice(-8).join('\n');
      reject(Error([`${pm} could not finish installing packages. Your project files are safe.`, detail, `Retry with: ${pm} install`].filter(Boolean).join('\n')));
    });
  });
}
