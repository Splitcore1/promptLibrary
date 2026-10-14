import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid package version');
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Build the Windows release on Windows x64.');
if (process.env.RELEASE_TAG && process.env.RELEASE_TAG !== 'v' + version) throw new Error('Tag does not match package version');
const folder = resolve('artifacts', 'Promptfolio-v' + version + '-windows-x64'), zip = folder + '.zip';
const phase = process.argv[2] || 'prepare';
if (phase === 'prepare') {
  if (existsSync(folder)) throw new Error('Package directory exists; use a clean CI checkout.');
  mkdirSync(folder, { recursive: true });
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(p => p && !p.startsWith('.github/'));
  for (const file of files) cpSync(file, join(folder, file), { recursive: true });
  cpSync('dist', join(folder, 'dist'), { recursive: true });
  cpSync('node_modules', join(folder, 'node_modules'), { recursive: true, dereference: true });
  mkdirSync(join(folder, 'runtime'));
  cpSync(process.execPath, join(folder, 'runtime/node.exe'));
  const license = join(dirname(process.execPath), 'LICENSE');
  if (!existsSync(license)) throw new Error('Node.js redistribution license is missing');
  cpSync(license, join(folder, 'runtime/LICENSE'));
  writeFileSync(join(folder, 'runtime/version.txt'), process.version + '\n');
  console.log(folder);
} else if (phase === 'archive') {
  rmSync(join(folder, 'node_modules/.vite'), { recursive: true, force: true });
  const sevenZip = 'C:\\Program Files\\7-Zip\\7z.exe';
  const result = spawnSync(existsSync(sevenZip) ? sevenZip : '7z', [
    'a', '-tzip', '-mx=5', zip, folder,
    '-xr!.wrangler', '-xr!.sites-runtime', '-xr!.vinext', '-xr!*.tsbuildinfo',
  ], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Archive creation failed');
  const hash = createHash('sha256').update(readFileSync(zip)).digest('hex');
  writeFileSync(resolve('artifacts/SHA256SUMS.txt'), hash + '  ' + zip.split(/[\\/]/).at(-1) + '\n');
  console.log('Windows release ready: ' + zip);
} else throw new Error('Unknown packaging phase');
