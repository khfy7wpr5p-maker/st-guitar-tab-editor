import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSourceSession } from '../src/model/sourceSession.js';
import { createTabAssignmentDocument } from '../src/model/tabAssignmentDocument.js';
import { serializeGuitarTabMusicXml } from '../src/musicxml/guitarTabMusicXmlWriter.js';

function score(attributes = '<divisions>4</divisions>') {
  return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Source</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes>${attributes}</attributes><note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note></measure></part></score-partwise>`;
}

function guitarSession(xml) {
  return createSourceSession(xml, { guitarOctaveTransposition: true });
}

test('maps written notation one octave down for physical guitar string/fret validation', () => {
  const session = guitarSession(score());
  const event = session.events[0];

  assert.equal(event.pitch.midi, 69, 'source written pitch must stay A4');
  assert.equal(event.guitarSoundingMidi, 57, 'guitar target must sound A3');

  const document = createTabAssignmentDocument(session);
  assert.deepEqual(
    document.assignPosition(event.sourceEventId, { string: 3, fret: 2 }),
    { string: 3, fret: 2 },
  );
});

test('rejects concert-pitch A4 fingering for written A4 in guitar octave mode', () => {
  const session = guitarSession(score());
  const event = session.events[0];
  const document = createTabAssignmentDocument(session);

  assert.throws(
    () => document.assignPosition(event.sourceEventId, { string: 1, fret: 5 }),
    /pitch/i,
  );
});

test('does not double-apply an explicit MusicXML octave transpose', () => {
  const session = guitarSession(score('<divisions>4</divisions><transpose><chromatic>0</chromatic><octave-change>-1</octave-change></transpose>'));

  assert.equal(session.events[0].pitch.midi, 69);
  assert.equal(session.events[0].guitarSoundingMidi, 57);
});

test('serializes the guitar octave relationship without rewriting the written pitch', () => {
  const source = score();
  const session = guitarSession(source);
  const event = session.events[0];
  const document = createTabAssignmentDocument(session);
  document.assignPosition(event.sourceEventId, { string: 3, fret: 2 });

  const output = serializeGuitarTabMusicXml({ sourceSession: session, document });

  assert.match(output, /<transpose><diatonic>0<\/diatonic><chromatic>0<\/chromatic><octave-change>-1<\/octave-change><\/transpose>/);
  assert.match(output, /<pitch><step>A<\/step><octave>4<\/octave><\/pitch>/);
  assert.match(output, /<technical><string>3<\/string><fret>2<\/fret><\/technical>/);
  assert.equal(session.sourceXml, source);
});

test('keeps legacy source-session pitch validation unchanged unless guitar octave mode is requested', () => {
  const session = createSourceSession(score());
  const event = session.events[0];

  assert.equal(event.guitarSoundingMidi, undefined);
  assert.equal(session.guitarOctaveTransposition, false);
  const document = createTabAssignmentDocument(session);
  assert.doesNotThrow(() => document.assignPosition(event.sourceEventId, { string: 1, fret: 5 }));
  assert.doesNotMatch(serializeGuitarTabMusicXml({ sourceSession: session, document }), /<transpose>/);
});

test('guitar octave mode changes session identity to prevent stale assignment reuse', () => {
  const xml = score();
  const plain = createSourceSession(xml);
  const guitar = guitarSession(xml);

  assert.notEqual(guitar.sessionId, plain.sessionId);
  assert.equal(guitar.sourceFingerprint, plain.sourceFingerprint);
});
