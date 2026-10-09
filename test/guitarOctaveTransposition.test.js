import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSourceSession } from '../src/model/sourceSession.js';
import { createTabAssignmentDocument } from '../src/model/tabAssignmentDocument.js';

function score(attributes = '<divisions>4</divisions>') {
  return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Source</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes>${attributes}</attributes><note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note></measure></part></score-partwise>`;
}

test('maps written guitar notation one octave down for physical string/fret validation', () => {
  const session = createSourceSession(score());
  const event = session.events[0];

  assert.equal(event.pitch.midi, 69, 'source written pitch must stay A4');
  assert.equal(event.guitarSoundingMidi, 57, 'guitar target must sound A3');

  const document = createTabAssignmentDocument(session);
  assert.deepEqual(
    document.assignPosition(event.sourceEventId, { string: 3, fret: 2 }),
    { string: 3, fret: 2 },
  );
});

test('rejects concert-pitch A4 fingering for written A4 guitar notation', () => {
  const session = createSourceSession(score());
  const event = session.events[0];
  const document = createTabAssignmentDocument(session);

  assert.throws(
    () => document.assignPosition(event.sourceEventId, { string: 1, fret: 5 }),
    /pitch/i,
  );
});

test('does not double-apply an explicit MusicXML octave transpose', () => {
  const session = createSourceSession(score('<divisions>4</divisions><transpose><chromatic>0</chromatic><octave-change>-1</octave-change></transpose>'));

  assert.equal(session.events[0].pitch.midi, 69);
  assert.equal(session.events[0].guitarSoundingMidi, 57);
});
