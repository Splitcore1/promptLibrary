import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function supportsNode(version) {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  return major > 22 || major === 22 && minor >= 13;
}
export function migrationConfig(directory) {
  return {
    name: 'promptfolio-local', compatibility_date: '2026-05-15',
    compatibility_flags: ['nodejs_compat'],
    d1_databases: [{ binding: 'DB', database_name: 'promptfolio',
      database_id: '00000000-0000-4000-8000-000000000000',
      migrations_dir: join(directory, 'drizzle') }],
  };
}
function openBrowser(url) {
  if (process.env.PROMPTFOLIO_NO_BROWSER === '1') return;
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/c', 'start', url], { windowsHide: true, stdio: 'ignore' })
    : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
  child.on('error', () => console.log('Откройте ссылку выше в браузере.'));
  child.unref();
}
async function freePort() {
  for (let port = 5173; port < 5193; port++) {
    const free = await new Promise(resolvePort => {
      const probe = createServer();
      probe.once('error', () => resolvePort(false));
      probe.listen(port, '127.0.0.1', () => probe.close(() => resolvePort(true)));
    });
    if (free) return port;
  }
  throw new Error('Порты 5173–5192 заняты. Закройте другой экземпляр приложения и попробуйте снова.');
}
async function isOurServer(port) {
  try {
    if (!Number.isInteger(port) || port < 5173 || port > 5192) return false;
    const response = await fetch('http://127.0.0.1:' + port, { signal: AbortSignal.timeout(2000) });
    return response.ok && (await response.text()).includes('Promptfolio — библиотека промптов');
  } catch { return false; }
}
export async function launch() {
  if (!supportsNode(process.versions.node)) throw new Error('Нужен Node.js 22.13 или новее. Скачайте готовый Windows-архив из Releases.');
  process.chdir(root);
  const state = join(root, '.sites-runtime'), marker = join(state, 'launcher.json');
  if (existsSync(marker)) {
    try {
      const old = JSON.parse(readFileSync(marker, 'utf8'));
      process.kill(old.pid, 0);
      if (await isOurServer(old.port)) {
        const url = 'http://127.0.0.1:' + old.port + '/signin-with-chatgpt?return_to=/';
        console.log('Promptfolio уже работает: ' + url); openBrowser(url); return;
      }
    } catch { /* Ignore stale launch markers; preserve library data. */ }
  }
  if (!existsSync(join(root, 'node_modules/vinext/dist/cli.js'))) throw new Error('Зависимости отсутствуют. Скачайте Promptfolio-*-windows-x64.zip из Releases. Для исходников сначала выполните npm ci.');
  mkdirSync(state, { recursive: true });
  const config = join(state, 'local-db.json');
  writeFileSync(config, JSON.stringify(migrationConfig(root), null, 2) + '\n');
  const environment = { ...process.env,
    PATH: dirname(process.execPath) + delimiter + (process.env.PATH || ''),
    CLOUDFLARE_CF_FETCH_ENABLED: 'false', WRANGLER_SEND_METRICS: 'false' };
  console.log('\nPromptfolio · локальная библиотека\n');
  console.log('Подготавливаем библиотеку. Ваши сохранённые данные сохранятся.');
  const migrations = spawnSync(process.execPath, [
    '--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js',
    'd1', 'migrations', 'apply', 'DB', '--local', '--config', config,
    '--persist-to', join(root, '.wrangler/state'),
  ], { cwd: root, env: { ...environment, CI: 'true' }, stdio: ['ignore', 'inherit', 'inherit'] });
  if (migrations.status !== 0) throw new Error('Не удалось подготовить локальную базу. Подробности приведены выше.');
  const port = await freePort(), origin = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, [
    '--import', './scripts/sites-env.mjs', './node_modules/vinext/dist/cli.js',
    'dev', '--hostname', '127.0.0.1', '--port', String(port),
  ], { cwd: root, env: environment, stdio: 'inherit' });
  let exited = false;
  const completion = new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('exit', code => {
      exited = true;
      try { if (JSON.parse(readFileSync(marker, 'utf8')).pid === process.pid) unlinkSync(marker); } catch {}
      resolveExit(code || 0);
    });
  });
  const terminate = () => { if (!exited) child.kill('SIGTERM'); };
  process.once('SIGINT', terminate); process.once('SIGTERM', terminate);
  let ready = false;
  for (let attempt = 0; attempt < 180 && !exited; attempt++) {
    if (await isOurServer(port)) { ready = true; break; }
    await new Promise(resolveWait => setTimeout(resolveWait, 500));
  }
  if (!ready) { terminate(); throw new Error('Приложение не запустилось. Подробности приведены выше.'); }
  writeFileSync(marker, JSON.stringify({ pid: process.pid, port }));
  const url = origin + '/signin-with-chatgpt?return_to=/';
  console.log('\nГотово! Откройте: ' + url);
  console.log('Оставляйте это окно открытым. Для остановки нажмите Ctrl+C.\n');
  openBrowser(url);
  const code = await completion;
  process.removeListener('SIGINT', terminate); process.removeListener('SIGTERM', terminate);
  if (code) throw new Error('Сервер завершился с ошибкой: ' + code);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  launch().catch(error => { console.error('\n' + error.message); process.exitCode = 1; });
}
