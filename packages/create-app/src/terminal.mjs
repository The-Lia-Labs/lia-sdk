import path from 'node:path';
import { lstat, readdir } from 'node:fs/promises';
import { validName } from './scaffold.mjs';
import { packageManagers } from './frameworks.mjs';

export async function directoryError(directory) {
  if (!directory || /[\x00-\x1f\x7f]/.test(directory)) return 'Choose a directory without control characters.';
  if (!validName(path.basename(path.resolve(directory)).toLowerCase())) return 'Use letters, numbers, dots, dashes or underscores for the directory name.';
  try {
    const existing = await lstat(path.resolve(directory));
    if (!existing.isDirectory() || existing.isSymbolicLink() || (await readdir(directory)).length) return 'That directory is not empty. Pick a new or empty directory; existing files are never overwritten.';
  } catch (error) { if (error.code !== 'ENOENT') return 'That directory cannot be opened. Check its permissions or choose another path.'; }
}

export function detectPackageManager(userAgent = '') {
  const manager = userAgent.split('/')[0];
  return packageManagers.includes(manager) ? manager : 'npm';
}

export function nextCommands(directory, pm, installed) {
  // Keep ordinary paths easy to copy; quote every shell-sensitive character.
  const shown = /^[a-zA-Z0-9_./-]+$/.test(directory) ? directory : process.platform === 'win32'
    ? '"' + directory.replaceAll('"', '""') + '"'
    : "'" + directory.replaceAll("'", "'\"'\"'") + "'";
  return [...(path.resolve(directory) === process.cwd() ? [] : ['cd ' + shown]), ...(installed ? [] : [pm + ' install']), pm + ' run dev'];
}
