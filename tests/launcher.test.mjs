import test from 'node:test';
import assert from 'node:assert/strict';
import { supportsNode, migrationConfig } from '../scripts/launch-local.mjs';
test('Launcher accepts supported Node versions only', () => {
  for (const version of ['22.13.0', '22.19.0', '24.0.0']) assert(supportsNode(version));
  for (const version of ['20.19.0', '22.12.0', 'v18.0.0']) assert(!supportsNode(version));
});
test('Local migration uses the same database identity and a directory-relative schema', () => {
  const c = migrationConfig('/tmp/fixture-app');
  assert.equal(c.d1_databases[0].binding, 'DB');
  assert.equal(c.d1_databases[0].database_id, '00000000-0000-4000-8000-000000000000');
  assert(c.d1_databases[0].migrations_dir.endsWith('drizzle'));
});
