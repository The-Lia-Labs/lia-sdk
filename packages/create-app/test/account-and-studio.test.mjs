import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, lstat, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import width from 'fast-string-width';
import { apiOrigin, savedAccount, clearAccount } from '../src/account.mjs';
import { createStudio, terminalStyle } from '../src/studio.mjs';

test('API destinations are origins, never credentials, redirects or arbitrary HTTP hosts', () => {
  assert.equal(apiOrigin(), 'https://api.lialabs.org');
  assert.equal(apiOrigin('http://localhost:8798'), 'http://localhost:8798');
  for (const origin of ['http://api.lialabs.org', 'https://user:secret@api.lialabs.org', 'https://api.lialabs.org/api', 'https://api.lialabs.org?token=x', 'https://api.lialabs.org#x', 'file:///tmp/server']) assert.throws(() => apiOrigin(origin));
});

test('credentials stay scoped to the API origin and revoked entries are removed privately', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'lia-account-test-'));
  const previous=process.env.LIA_CONFIG_DIR;process.env.LIA_CONFIG_DIR=root;
  const token='lia_cli_'+'a'.repeat(64);
  try {
    await writeFile(path.join(root,'credentials.json'),JSON.stringify({'https://api.lialabs.org':{token,expiresAt:Date.now()+60000},'http://localhost:8798':{token:'invalid',expiresAt:Date.now()+60000}}));
    assert.equal((await savedAccount()).token,token);
    assert.equal(await savedAccount('http://localhost:8798'),null);
    assert.equal(await savedAccount('https://other.example'),null);
    await clearAccount();assert.equal(await savedAccount(),null);
    assert.equal((await lstat(path.join(root,'credentials.json'))).mode & 0o777,0o600);
    assert(!JSON.parse(await readFile(path.join(root,'credentials.json'),'utf8'))['https://api.lialabs.org']);
  } finally {if(previous===undefined)delete process.env.LIA_CONFIG_DIR;else process.env.LIA_CONFIG_DIR=previous;await rm(root,{recursive:true,force:true});}
});

test('expired credentials and symlink files cannot authenticate a terminal', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'lia-account-test-'));
  const previous=process.env.LIA_CONFIG_DIR;process.env.LIA_CONFIG_DIR=root;
  try {
    const target=path.join(root,'expired.json'),file=path.join(root,'credentials.json');
    await writeFile(target,JSON.stringify({'https://api.lialabs.org':{token:'lia_cli_'+'b'.repeat(64),expiresAt:Date.now()-1}}));
    await symlink(target,file);await assert.rejects(savedAccount(),/regular private file/);
    await rm(file);await writeFile(file,await readFile(target));assert.equal(await savedAccount(),null);
    await rm(file);await mkdir(file);await assert.rejects(savedAccount(),/regular private file/);
  } finally {if(previous===undefined)delete process.env.LIA_CONFIG_DIR;else process.env.LIA_CONFIG_DIR=previous;await rm(root,{recursive:true,force:true});}
});

test('studio frames fit narrow and wide terminals with long content and unicode', () => {
  for(const columns of [32,54,80,100])for(const color of [true,false]) {
    const output={isTTY:true,columns,rows:40,write(){}};
    const studio=createStudio({output,env:color?{TERM:'xterm',COLORTERM:'truecolor'}:{NO_COLOR:'1'}});
    const frame=studio.frame(['A very long project name '.repeat(6),'文档 日本語 🚀',studio.t.rgb('blue','A colored line')],'A LONG TITLE '.repeat(8));
    for(const line of frame.split('\n'))assert(width(stripVTControlCharacters(line))<=columns,`Overflow at ${columns}: ${line}`);
    if(!color)assert.doesNotMatch(frame,/\x1b/);
  }
});

test('terminal color honors NO_COLOR, non-TTY and dumb terminals', () => {
  for(const [env,output] of [[{NO_COLOR:''},{isTTY:true}],[{TERM:'dumb'},{isTTY:true}],[{},{isTTY:false}]])assert.equal(terminalStyle(env,output).rgb('blue','hello'),'hello');
  assert.match(terminalStyle({COLORTERM:'truecolor'},{isTTY:true}).rgb('blue','hello'),/38;2;/);
});

test('accessible and compact headers omit the large wordmark', () => {
  for(const env of [{ACCESSIBLE:'1'}, {TERM:'dumb'}]) {
    let text='';createStudio({env,output:{isTTY:true,columns:80,rows:40,write(v){text+=v}}}).header('0.3.0');
    assert.match(text,/Lia Developer Studio/);assert.doesNotMatch(text,/██/);
  }
  let text='';createStudio({env:{NO_COLOR:'1'},output:{isTTY:true,columns:32,rows:20,write(v){text+=v}}}).header('0.3.0');
  assert.match(text,/DEVELOPER STUDIO/);assert.doesNotMatch(text,/██|\x1b/);
  for(const line of text.split('\n'))assert(width(line)<=32);
});
