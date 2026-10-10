import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSourceSession } from '../src/model/sourceSession.js';
import { createTabAssignmentDocument } from '../src/model/tabAssignmentDocument.js';
import { serializeGuitarTabMusicXml } from '../src/musicxml/guitarTabMusicXmlWriter.js';

function score({
  attributes = '<divisions>4</divisions>',
  step = 'C',
  alter = 1,
  octave = 4,
} = {}) {
  const alterXml = alter === 0 ? '' : `<alter>${alter}</alter>`;
  return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Source</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes>${attributes}</attributes><note><pitch><step>${step}</step>${alterXml}<octave>${octave}</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff><type>quarter</type></note></measure></part></score-partwise>`;
}

function documentFor(session) {
  return createTabAssignmentDocument(session);
}

test('clef octave context does not transpose canonical physical pitch', () => {
  const source = score({
    attributes: '<divisions>4</divisions><clef number="1"><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>',
  });
  const session = createSourceSession(source);
  const event = session.events[0];

  assert.equal(event.pitch.midi, 61);
  assert.equal(event.soundingPitchMidi, 61);
  assert.equal(session.sourceXml, source);

  const accepted = documentFor(session);
  assert.deepEqual(
    accepted.assignPosition(event.sourceEventId, { string: 2, fret: 2 }),
    { string: 2, fret: 2 },
  );

  const rejected = documentFor(session);
  assert.throws(
    () => rejected.assignPosition(event.sourceEventId, { string: 5, fret: 4 }),
    /pitch/i,
  );

  const output = serializeGuitarTabMusicXml({ sourceSession: session, document: accepted });
  assert.match(output, /<clef number="1"><sign>G<\/sign><line>2<\/line><clef-octave-change>-1<\/clef-octave-change><\/clef>/);
  assert.doesNotMatch(output, /<transpose>/);
  assert.match(output, /<pitch><step>C<\/step><alter>1<\/alter><octave>4<\/octave><\/pitch>/);
  assert.match(output, /<technical><string>2<\/string><fret>2<\/fret><\/technical>/);
});

test('explicit MusicXML octave transpose is applied exactly once and preserved once', () => {
  const source = score({
    attributes: '<divisions>4</divisions><transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>-1</octave-change></transpose>',
  });
  const session = createSourceSession(source);
  const event = session.events[0];

  assert.equal(event.pitch.midi, 61);
  assert.equal(event.soundingPitchMidi, 49);

  const accepted = documentFor(session);
  assert.deepEqual(
    accepted.assignPosition(event.sourceEventId, { string: 5, fret: 4 }),
    { string: 5, fret: 4 },
  );

  const rejected = documentFor(session);
  assert.throws(
    () => rejected.assignPosition(event.sourceEventId, { string: 2, fret: 2 }),
    /pitch/i,
  );

  const output = serializeGuitarTabMusicXml({ sourceSession: session, document: accepted });
  assert.equal((output.match(/<transpose>/g) ?? []).length, 1);
  assert.match(output, /<transpose><diatonic>0<\/diatonic><chromatic>0<\/chromatic><octave-change>-1<\/octave-change><\/transpose>/);
  assert.match(output, /<pitch><step>C<\/step><alter>1<\/alter><octave>4<\/octave><\/pitch>/);
  assert.equal(session.sourceXml, source);
});

test('plain non-transposing source keeps pitch and source bytes unchanged', () => {
  const source = score();
  const session = createSourceSession(source);
  const event = session.events[0];

  assert.equal(event.pitch.midi, 61);
  assert.equal(event.soundingPitchMidi, 61);
  assert.equal(session.sourceXml, source);

  const document = documentFor(session);
  document.assignPosition(event.sourceEventId, { string: 2, fret: 2 });
  assert.doesNotMatch(
    serializeGuitarTabMusicXml({ sourceSession: session, document }),
    /<transpose>/,
  );
});

test('deprecated boolean octave policy cannot override source semantics', () => {
  assert.throws(
    () => createSourceSession(score(), { guitarOctaveTransposition: true }),
    /guitarOctaveTransposition|source.*transpose|unsupported/i,
  );
});

test('mid-measure clef context fails closed instead of moving to measure start', () => {
  const firstNote = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>';
  const secondNote = '<note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>';
  const source = score().replace(
    /<note>.*<\/note>/,
    `${firstNote}<attributes><clef number="1"><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef></attributes>${secondNote}`,
  );

  assert.throws(() => createSourceSession(source), /mid-measure clef/i);
});
