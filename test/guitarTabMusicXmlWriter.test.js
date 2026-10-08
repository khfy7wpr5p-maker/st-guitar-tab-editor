import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSourceSession } from '../src/model/sourceSession.js';
import { createTabAssignmentDocument } from '../src/model/tabAssignmentDocument.js';
import { inspectMusicXml } from '../src/musicxml/intake.js';

async function writerApi() {
  try { return await import('../src/musicxml/guitarTabMusicXmlWriter.js'); } catch { return {}; }
}

function score(body, attrs = '<divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time>') {
  return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes>${attrs}</attributes>${body}</measure></part></score-partwise>`;
}

function note(step, octave, duration, voice = 1, extra = '', alter = '') {
  return `<note>${extra}<pitch><step>${step}</step>${alter}<octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${voice}</voice><type>${duration === 2 ? 'eighth' : 'quarter'}</type></note>`;
}

function assignAll(session, positions) {
  const doc = createTabAssignmentDocument(session);
  session.events.forEach((event, index) => doc.assignPosition(event.sourceEventId, positions[index]));
  return doc;
}

test('writes two-staff six-line TAB with exact technical string/fret', async () => {
  const { serializeGuitarTabMusicXml } = await writerApi();
  assert.equal(typeof serializeGuitarTabMusicXml, 'function');
  const session = createSourceSession(score(note('E',4,4) + note('C',4,4,1,'<chord/>')));
  const doc = assignAll(session, [{ string:1, fret:0 }, { string:2, fret:1 }]);
  const xml = serializeGuitarTabMusicXml({ sourceSession: session, document: doc });
  assert.deepEqual(inspectMusicXml(xml), { ok:true, rootName:'score-partwise' });
  assert.match(xml, /<staves>2<\/staves>/);
  assert.match(xml, /<clef number="2"><sign>TAB<\/sign><line>5<\/line><\/clef>/);
  assert.match(xml, /<staff-lines>6<\/staff-lines>/);
  assert.match(xml, /<technical><string>1<\/string><fret>0<\/fret><\/technical>/);
  assert.match(xml, /<technical><string>2<\/string><fret>1<\/fret><\/technical>/);
  assert.equal((xml.match(/<staff>2<\/staff>/g) ?? []).length, 2);
});

test('preserves accidental spelling, duration, voice and tie flags', async () => {
  const { serializeGuitarTabMusicXml } = await writerApi();
  const source = score('<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>4</duration><voice>2</voice><type>quarter</type><tie type="start"/></note>');
  const session = createSourceSession(source);
  const doc = assignAll(session, [{ string:2, fret:7 }]);
  const xml = serializeGuitarTabMusicXml({ sourceSession: session, document: doc });
  assert.match(xml, /<step>F<\/step><alter>1<\/alter><octave>4<\/octave>/);
  assert.match(xml, /<duration>4<\/duration><tie type="start"\/><voice>2<\/voice>/);
  assert.match(xml, /<tied type="start"\/>/);
});

test('preserves multi-voice onset with backup/forward and reparses', async () => {
  const { serializeGuitarTabMusicXml } = await writerApi();
  const source = score(
    note('E',4,4,1) + '<backup><duration>4</duration></backup>' + note('C',4,2,2) + '<forward><duration>2</duration></forward>' + note('D',4,4,2)
  );
  const session = createSourceSession(source);
  const doc = assignAll(session, [{ string:1,fret:0 }, { string:2,fret:1 }, { string:2,fret:3 }]);
  const xml = serializeGuitarTabMusicXml({ sourceSession: session, document: doc });
  assert.deepEqual(inspectMusicXml(xml), { ok:true, rootName:'score-partwise' });
  assert.match(xml, /<backup><duration>8<\/duration><\/backup>/);
  assert.match(xml, /<forward><duration>4<\/duration><\/forward>/);
});

test('supports a complete six-note vertical group', async () => {
  const { serializeGuitarTabMusicXml } = await writerApi();
  const pitches = [
    ['E',4,{string:1,fret:0}], ['B',3,{string:2,fret:0}], ['G',3,{string:3,fret:0}],
    ['D',3,{string:4,fret:0}], ['A',2,{string:5,fret:0}], ['E',2,{string:6,fret:0}],
  ];
  const body = pitches.map(([s,o],i) => note(s,o,4,1,i ? '<chord/>' : '')).join('');
  const session = createSourceSession(score(body));
  const doc = assignAll(session, pitches.map((p) => p[2]));
  const xml = serializeGuitarTabMusicXml({ sourceSession: session, document: doc });
  assert.equal((xml.match(/<technical>/g) ?? []).length, 6);
});

test('rejects export when any source event lacks an assignment', async () => {
  const { serializeGuitarTabMusicXml } = await writerApi();
  const session = createSourceSession(score(note('E',4,4) + note('C',4,4,1,'<chord/>')));
  const doc = createTabAssignmentDocument(session);
  doc.assignPosition(session.events[0].sourceEventId, { string:1, fret:0 });
  assert.throws(() => serializeGuitarTabMusicXml({ sourceSession: session, document: doc }), /incomplete/i);
});

test('preserves explicit selected-staff key and measure key changes without changing other export bytes', async () => {
  const { serializeGuitarTabMusicXml } = await writerApi();
  const body = '<note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>2</staff></note>';
  const source = `<score-partwise><part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>4</divisions><key number="1"><fifths>3</fifths></key><key number="2"><fifths>0</fifths><mode>major</mode></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${body}</measure><measure number="2"><attributes><key number="2"><fifths>-1</fifths><mode>minor</mode></key></attributes>${body}</measure></part></score-partwise>`;
  const targetSelection = { partId: 'P1', partIndex: 0, staff: 2, voice: 1 };
  const session = createSourceSession(source, { targetSelection });
  const xml = serializeGuitarTabMusicXml({ sourceSession: session, document: assignAll(session, [{ string: 1, fret: 0 }, { string: 1, fret: 0 }]) });
  assert.match(xml, /<key number="1"><fifths>0<\/fifths><mode>major<\/mode><\/key>/);
  assert.match(xml, /<key number="1"><fifths>-1<\/fifths><mode>minor<\/mode><\/key>/);
  assert.doesNotMatch(xml, /<fifths>3<\/fifths>/);
  assert.equal(session.sourceXml, source);
  const withoutKeys = source.replace(/<key\b[^>]*>.*?<\/key>/g, '');
  const baseline = createSourceSession(withoutKeys, { targetSelection });
  const baselineXml = serializeGuitarTabMusicXml({ sourceSession: baseline, document: assignAll(baseline, [{ string: 1, fret: 0 }, { string: 1, fret: 0 }]) });
  assert.equal(xml.replace(/<key\b[^>]*>.*?<\/key>/g, ''), baselineXml);
});

test('unselected part key does not leak into selected part export', async () => {
  const { serializeGuitarTabMusicXml } = await writerApi();
  const body = '<note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>';
  const part = (id, fifths) => `<part id="${id}"><measure number="1"><attributes><divisions>4</divisions><key><fifths>${fifths}</fifths><mode>minor</mode></key></attributes>${body}</measure></part>`;
  const source = `<score-partwise><part-list><score-part id="P1"><part-name>Other</part-name></score-part><score-part id="P2"><part-name>Selected</part-name></score-part></part-list>${part('P1', 5)}${part('P2', -2)}</score-partwise>`;
  const session = createSourceSession(source, { targetSelection: { partId: 'P2', partIndex: 1, staff: 1, voice: 1 } });
  const xml = serializeGuitarTabMusicXml({ sourceSession: session, document: assignAll(session, [{ string: 1, fret: 0 }]) });
  assert.match(xml, /<key><fifths>-2<\/fifths><mode>minor<\/mode><\/key>/);
  assert.doesNotMatch(xml, /<fifths>5<\/fifths>/);
});

test('ambiguous or unsupported mid-measure key context cannot be silently dropped', () => {
  const body = note('E', 4, 4);
  assert.throws(() => createSourceSession(score(body, '<divisions>4</divisions><key><fifths>0</fifths></key><key><fifths>1</fifths></key>')), /Ambiguous/);
  assert.throws(() => createSourceSession(score(body + '<attributes><key><fifths>1</fifths></key></attributes>')), /Mid-measure/);
});

test('first key attributes after elapsed time cannot be moved to measure start', () => {
  for (const advance of [note('E', 4, 4), '<note><rest/><duration>4</duration></note>', '<forward><duration>4</duration></forward>']) {
    const first = score(note('E', 4, 4));
    const source = first.replace('</part>', `<measure number="2">${advance}<attributes><key><fifths>1</fifths></key></attributes></measure></part>`);
    assert.throws(() => createSourceSession(source), /Mid-measure/);
  }
});
