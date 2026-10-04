import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('package exposes forbidden-dependency and browser verification scripts', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['check:forbidden'], 'node scripts/check-forbidden-deps.js');
  assert.equal(pkg.scripts['test:browser'], 'playwright test');
});

test('CI runs Node 18/20/22 unit tests and Chromium browser acceptance', async () => {
  const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(ci, /node-version:\s*\[18, 20, 22\]/);
  assert.match(ci, /npm test/);
  assert.match(ci, /npm run check:forbidden/);
  assert.match(ci, /playwright install --with-deps chromium/);
  assert.match(ci, /npm run test:browser/);
});
