import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function loadApi() {
  try { return await import('../src/musicxml/intake.js'); } catch { return {}; }
}

const validXml = await readFile(new URL('./fixtures/minimal-valid.musicxml', import.meta.url), 'utf8');

test('accepts one-part score-partwise MusicXML', async () => {
  const { inspectMusicXml } = await loadApi();
  assert.equal(typeof inspectMusicXml, 'function');
  assert.deepEqual(inspectMusicXml(validXml), {
    ok: true,
    rootName: 'score-partwise',
    parts: [{ partId: 'P1', partName: 'Guitar', pitchedCount: 1, unpitchedCount: 0 }],
    requiresPartSelection: false,
  });
});

test('rejects malformed XML', async () => {
  const { inspectMusicXml } = await loadApi();
  assert.equal(typeof inspectMusicXml, 'function');
  const result = inspectMusicXml('<score-partwise><part></score-partwise>');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_XML');
});

test('rejects score-timewise', async () => {
  const { inspectMusicXml } = await loadApi();
  assert.equal(typeof inspectMusicXml, 'function');
  const result = inspectMusicXml('<score-timewise version="4.0"><part-list/></score-timewise>');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNSUPPORTED_ROOT');
});

test('accepts multiple pitched parts as inventory requiring explicit selection', async () => {
  const { inspectMusicXml } = await loadApi();
  assert.equal(typeof inspectMusicXml, 'function');
  const xml = '<score-partwise><part-list><score-part id="P1"><part-name>One</part-name></score-part><score-part id="P2"><part-name>Two</part-name></score-part></part-list><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part><part id="P2"><measure number="1"><note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>';
  const result = inspectMusicXml(xml);
  assert.equal(result.ok, true);
  assert.equal(result.requiresPartSelection, true);
  assert.deepEqual(result.parts.map(({ partId, partName }) => ({ partId, partName })), [
    { partId: 'P1', partName: 'One' },
    { partId: 'P2', partName: 'Two' },
  ]);
});

test('rejects unpitched-only content', async () => {
  const { inspectMusicXml } = await loadApi();
  assert.equal(typeof inspectMusicXml, 'function');
  const xml = '<score-partwise><part-list/><part id="P1"><measure number="1"><note><unpitched/><duration>1</duration></note></measure></part></score-partwise>';
  const result = inspectMusicXml(xml);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNSUPPORTED_UNPITCHED');
});

test('rejects undefined XML entities instead of accepting partial text', async () => {
  const { inspectMusicXml } = await loadApi();
  const xml = '<score-partwise><part-list/><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><note><pitch><step>&bogus;</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note></measure></part></score-partwise>';
  const result = inspectMusicXml(xml);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_XML');
});

test('accepts a standard external MusicXML DOCTYPE without resolving it', async () => {
  const { inspectMusicXml } = await loadApi();
  const xml = '<?xml version="1.0"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="4.0"><part-list/><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note></measure></part></score-partwise>';
  assert.deepEqual(inspectMusicXml(xml), {
    ok: true,
    rootName: 'score-partwise',
    parts: [{ partId: 'P1', partName: 'P1', pitchedCount: 1, unpitchedCount: 0 }],
    requiresPartSelection: false,
  });
});

test('rejects DOCTYPE internal subsets/entities', async () => {
  const { inspectMusicXml } = await loadApi();
  const xml = '<!DOCTYPE score-partwise [<!ENTITY x "E">]><score-partwise><part-list/><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><note><pitch><step>&x;</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note></measure></part></score-partwise>';
  const result = inspectMusicXml(xml);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_XML');
});
