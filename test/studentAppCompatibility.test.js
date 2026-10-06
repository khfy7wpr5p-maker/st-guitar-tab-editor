import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { inspectMusicXml } from '../src/musicxml/intake.js';

async function collectJs(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes:true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await collectJs(path));
    else if (entry.name.endsWith('.js')) out.push(path);
  }
  return out;
}

test('pinned Student App compatibility MusicXML has two-staff six-line technical TAB shape', async () => {
  const xml = await readFile(new URL('./fixtures/student-app-compat.musicxml', import.meta.url), 'utf8');
  const inspection = inspectMusicXml(xml);
  assert.equal(inspection.ok, true);
  assert.equal(inspection.rootName, 'score-partwise');
  assert.equal(inspection.requiresPartSelection, false);
  assert.match(xml, /<staves>2<\/staves>/);
  assert.match(xml, /<sign>TAB<\/sign>/);
  assert.match(xml, /<staff-lines>6<\/staff-lines>/);
  assert.match(xml, /<technical><string>[1-6]<\/string><fret>\d+<\/fret><\/technical>/);
});

test('production source and package do not depend on Guitar TAB Engine or alphaTab', async () => {
  const packageJson = await readFile(new URL('../package.json', import.meta.url), 'utf8');
  assert.doesNotMatch(packageJson, /musicxml-to-guitar-tab-engine|alphatab/i);
  const root = new URL('..', import.meta.url).pathname;
  const files = [...await collectJs(join(root, 'src')), ...await collectJs(join(root, 'web'))];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /musicxml-to-guitar-tab-engine|alphatab/i, file);
  }
});

test('README documents separate guitarTabMusicXml handoff', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /guitarTabMusicXml/);
  assert.match(readme, /Student App/);
});
