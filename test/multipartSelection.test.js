import test from 'node:test';
import assert from 'node:assert/strict';

import { inspectMusicXml } from '../src/musicxml/intake.js';
import { createSourceSession } from '../src/model/sourceSession.js';
import { serializeGuitarTabMusicXml } from '../src/musicxml/guitarTabMusicXmlWriter.js';

const MULTIPART_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Voice</part-name></score-part>
    <score-part id="P2"><part-name>Guitar</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

test('GTAB-10B inventories pitched parts instead of rejecting the whole multipart score', () => {
  const result = inspectMusicXml(MULTIPART_XML);
  assert.equal(result.ok, true);
  assert.equal(result.requiresPartSelection, true);
  assert.deepEqual(result.parts, [
    { partId: 'P1', partName: 'Voice', pitchedCount: 1, unpitchedCount: 0 },
    { partId: 'P2', partName: 'Guitar', pitchedCount: 2, unpitchedCount: 0 },
  ]);
});

test('GTAB-10B never guesses a target part for multipart TAB authoring', () => {
  assert.throws(
    () => createSourceSession(MULTIPART_XML),
    (error) => error?.code === 'PART_SELECTION_REQUIRED',
  );
});

test('GTAB-10B creates a source session only from the explicitly selected pitched part', () => {
  const session = createSourceSession(MULTIPART_XML, { partId: 'P2' });
  assert.equal(session.partId, 'P2');
  assert.equal(session.partCount, 2);
  assert.equal(session.selectedPartId, 'P2');
  assert.equal(session.events.length, 2);
  assert.deepEqual(session.events.map((event) => event.pitch.step), ['E', 'F']);
  assert.match(session.sessionId, /:part:P2$/);
});

test('GTAB-10B rejects an unknown selected part deterministically', () => {
  assert.throws(
    () => createSourceSession(MULTIPART_XML, { partId: 'P9' }),
    (error) => error?.code === 'UNKNOWN_PART',
  );
});

test('GTAB-10B blocks multipart export until non-target parts can be preserved safely', () => {
  const session = createSourceSession(MULTIPART_XML, { partId: 'P2' });
  const document = {
    sessionId: session.sessionId,
    canExport: () => true,
    listAssignments: () => session.events.map((event, index) => ({
      sourceEventId: event.sourceEventId,
      string: 1 + index,
      fret: index,
    })),
  };

  assert.throws(
    () => serializeGuitarTabMusicXml({ sourceSession: session, document }),
    (error) => error?.code === 'UNSUPPORTED_MULTIPART_EXPORT',
  );
});
