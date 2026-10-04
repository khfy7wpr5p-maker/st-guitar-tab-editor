import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('browser source graph contains no node built-in import', async () => {
  const sourceSession = await readFile(new URL('../src/model/sourceSession.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sourceSession, /from ['"]node:/);
});

test('web export button serializes Guitar TAB MusicXML and downloads .musicxml', async () => {
  const main = await readFile(new URL('../web/main.js', import.meta.url), 'utf8');
  assert.match(main, /serializeGuitarTabMusicXml/);
  assert.match(main, /exportButton\.addEventListener\(['"]click['"]/);
  assert.match(main, /\.musicxml/);
  assert.match(main, /URL\.createObjectURL/);
});
