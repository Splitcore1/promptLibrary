import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
const folder = resolve(process.argv[2] || '.');
const node = process.platform === 'win32' && existsSync(join(folder, 'runtime/node.exe')) ? join(folder, 'runtime/node.exe') : process.execPath;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');
let child;
async function start() {
  child = spawn(node, ['scripts/launch-local.mjs'], { cwd: folder,
    env: { ...process.env, PROMPTFOLIO_NO_BROWSER: '1' }, stdio: 'inherit', detached: process.platform !== 'win32' });
  let exited = false; child.once('exit', () => { exited = true; });
  let marker;
  for (let i = 0; i < 240; i++) {
    assert(!exited, 'Launcher exited before readiness');
    try { marker = JSON.parse(readFileSync(join(folder, '.sites-runtime/launcher.json'), 'utf8')); if (marker.pid === child.pid) break; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  assert.equal(marker?.pid, child.pid, 'Launcher readiness marker missing');
  const base = 'http://127.0.0.1:' + marker.port;
  const signIn = await fetch(base + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
  assert.equal(signIn.status, 302);
  const cookie = signIn.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  async function api(path, method = 'GET', data) {
    const response = await fetch(base + path, { method,
      headers: { Cookie: cookie, Origin: base, ...(data && !(data instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined });
    assert(response.ok, await response.clone().text()); return response.json();
  }
  assert.equal((await fetch(base + '/api/library')).status, 401);
  return { api };
}
async function stop() {
  if (!child) return;
  const stopped = new Promise(r => child.once('exit', r));
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
  await Promise.race([stopped, new Promise(r => setTimeout(r, 5000))]); child = undefined;
  await new Promise(r => setTimeout(r, 1000));
}
try {
  let { api } = await start();
  const initial = await api('/api/library');
  assert.deepEqual(initial.prompts, [], 'Test requires an empty fixture; existing data is preserved.');
  assert.deepEqual(initial.collections, []);
  const collection = await api('/api/collections', 'POST', { name: 'Portable release smoke test', color: '#8871e5' });
  const form = new FormData(); form.append('file', new Blob([png], { type: 'image/png' }), 'fixture.png');
  const asset = await api('/api/assets', 'POST', form);
  let prompt = await api('/api/prompts', 'POST', {
    title: 'Portable release fixture', description: 'CI-created fixture only', model: 'Nano Banana',
    prompt: 'A studio product photograph.', coverId: asset.id, referenceIds: [], collectionIds: [collection.id],
    tags: [], parameters: '4:5', negative: '', favorite: false });
  prompt = await api('/api/prompts/' + prompt.id, 'PUT', { ...prompt, title: 'Portable release fixture updated' });
  assert.equal(prompt.version, 2);
  await stop(); ({ api } = await start());
  const restored = await api('/api/library');
  assert.equal(restored.prompts.length, 1);
  assert.equal(restored.prompts[0].id, prompt.id);
  assert.equal(restored.prompts[0].version, 2);
  assert.equal((await api('/api/prompts/' + prompt.id + '/history')).length, 2);
  await api('/api/prompts/' + prompt.id, 'DELETE');
  await api('/api/collections/' + collection.id, 'DELETE');
  console.log('PASS: portable launcher, sign-in, uploads, migrations, versions and persistence after restart.');
} finally { await stop(); }
