import assert from 'node:assert/strict';
import { test } from 'node:test';

async function api() {
  try { return await import('../src/model/sourceSession.js'); } catch { return {}; }
}

function score(notes, attributes = '<divisions>4</divisions>') {
  return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes>${attributes}</attributes>${notes}</measure></part></score-partwise>`;
}

const note = (step, octave, duration = 4, extras = '') => `<note>${extras}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration><voice>1</voice><type>quarter</type></note>`;

test('creates deterministic source identities and source fingerprint', async () => {
  const { createSourceSession } = await api();
  assert.equal(typeof createSourceSession, 'function');
  const xml = score(note('E', 4));
  const a = createSourceSession(xml);
  const b = createSourceSession(xml);
  assert.equal(a.sourceFingerprint, b.sourceFingerprint);
  assert.equal(a.sessionId, b.sessionId);
  assert.deepEqual(a.events.map((e) => e.sourceEventId), b.events.map((e) => e.sourceEventId));
  assert.equal(a.events[0].sourceEventId, 'P1:m0:v1:o0:n0');
});

test('groups chord-marked notes at the same onset', async () => {
  const { createSourceSession } = await api();
  const xml = score(note('E', 4) + note('G', 4, 4, '<chord/>') + note('B', 4, 4, '<chord/>'));
  const session = createSourceSession(xml);
  assert.equal(session.groups.length, 1);
  assert.equal(session.groups[0].sourceEventIds.length, 3);
  assert.deepEqual(session.events.map((e) => e.onsetDivisions), [0, 0, 0]);
});

test('uses backup and forward for deterministic multi-voice timing', async () => {
  const { createSourceSession } = await api();
  const xml = score(
    '<note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>' +
    '<backup><duration>4</duration></backup>' +
    '<note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>2</voice><type>eighth</type></note>' +
    '<forward><duration>2</duration></forward>' +
    '<note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>2</voice><type>quarter</type></note>'
  );
  const session = createSourceSession(xml);
  assert.deepEqual(session.events.map((e) => [e.voice, e.onsetDivisions]), [['1', 0], ['2', 0], ['2', 4]]);
  assert.equal(session.groups[0].sourceEventIds.length, 2);
});

test('preserves accidental spelling and computes midi', async () => {
  const { createSourceSession } = await api();
  const xml = score('<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>');
  const event = createSourceSession(xml).events[0];
  assert.deepEqual(event.pitch, { step: 'F', alter: 1, octave: 4, midi: 66 });
});

test('supports 2 through 6 simultaneous notes and rejects more than 6', async () => {
  const { createSourceSession } = await api();
  const six = ['E','F','G','A','B','C'].map((s, i) => note(s, i === 5 ? 5 : 4, 4, i === 0 ? '' : '<chord/>')).join('');
  assert.equal(createSourceSession(score(six)).groups[0].sourceEventIds.length, 6);
  const seven = six + note('D', 5, 4, '<chord/>');
  assert.throws(() => createSourceSession(score(seven)), /more than 6/i);
});

test('rejects tuplets/time-modification', async () => {
  const { createSourceSession } = await api();
  const xml = score('<note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification></note>');
  assert.throws(() => createSourceSession(xml), /time-modification/i);
});

test('retains tie flags and ignores rests as editable events while moving time', async () => {
  const { createSourceSession } = await api();
  const xml = score('<note><rest/><duration>4</duration><voice>1</voice><type>quarter</type></note>' +
    '<note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type><tie type="start"/></note>');
  const session = createSourceSession(xml);
  assert.equal(session.events.length, 1);
  assert.equal(session.events[0].onsetDivisions, 4);
  assert.equal(session.events[0].tieStart, true);
});

test('measure extent includes the longest member of a same-onset chord', async () => {
  const { createSourceSession } = await api();
  const xml = score(note('E', 4, 4) + note('C', 4, 8, '<chord/>'));
  const session = createSourceSession(xml);
  assert.equal(session.measures[0].durationDivisions, 8);
});
