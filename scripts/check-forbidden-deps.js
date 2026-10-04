import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const forbidden = /musicxml-to-guitar-tab-engine|alphatab/i;

async function filesUnder(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await filesUnder(path));
    else if (entry.name.endsWith('.js')) out.push(path);
  }
  return out;
}

const files = [join(root, 'package.json'), ...await filesUnder(join(root, 'src')), ...await filesUnder(join(root, 'web'))];
const violations = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  if (forbidden.test(text)) violations.push(file.slice(root.length + 1));
}
if (violations.length) {
  console.error(`Forbidden runtime dependency reference: ${violations.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Forbidden dependency scan: PASS');
}
