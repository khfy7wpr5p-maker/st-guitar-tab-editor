import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSourceSession } from '../src/model/sourceSession.js';
import { createTabAssignmentDocument } from '../src/model/tabAssignmentDocument.js';
import { serializeGuitarTabMusicXml } from '../src/musicxml/guitarTabMusicXmlWriter.js';

function score(noteBody) {
  return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>4</divisions></attributes>${noteBody}</measure></part></score-partwise>`;
}

function e4Note(notations = '') {
  return `<note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff><type>quarter</type>${notations}</note>`;
}

test('trusted source technical string/fret seeds the assignment document and survives export', () => {
  const source = score(e4Note('<notations><technical><string>1</string><fret>0</fret></technical></notations>'));
  const session = createSourceSession(source, { guitarPitchPolicy: 'source-sounding' });
  const event = session.events[0];

  assert.deepEqual(event.sourceTechnicalPosition, { string: 1, fret: 0 });
  const document = createTabAssignmentDocument(session);
  assert.deepEqual(document.getAssignment(event.sourceEventId), { string: 1, fret: 0 });
  assert.equal(document.canExport(), true);

  const output = serializeGuitarTabMusicXml({ sourceSession: session, document });
  assert.match(output, /<technical><string>1<\/string><fret>0<\/fret><\/technical>/);
  assert.equal(session.sourceXml, source);
});

test('notation-only source remains unassigned and is never auto-fingered', () => {
  const source = score(e4Note());
  const session = createSourceSession(source, { guitarPitchPolicy: 'source-sounding' });
  const document = createTabAssignmentDocument(session);

  assert.equal(session.events[0].sourceTechnicalPosition ?? null, null);
  assert.equal(document.getAssignment(session.events[0].sourceEventId), null);
  assert.equal(document.canExport(), false);
});

test('trusted technical position that contradicts the declared guitar target fails closed', () => {
  const source = score(e4Note('<notations><technical><string>1</string><fret>0</fret></technical></notations>'));
  const session = createSourceSession(source, { guitarPitchPolicy: 'standard-guitar-written' });

  assert.throws(
    () => createTabAssignmentDocument(session),
    /source.*technical|pitch mismatch|invalid guitar position/i,
  );
});
