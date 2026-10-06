const TUNING_LINES = Object.freeze([
  ['E', 2], ['A', 2], ['D', 3], ['G', 3], ['B', 3], ['E', 4],
]);

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function tag(name, content, attrs = '') {
  return `<${name}${attrs}>${content}</${name}>`;
}

function empty(name, attrs = '') { return `<${name}${attrs}/>`; }

function pitchXml(pitch) {
  let body = tag('step', escapeXml(pitch.step));
  if (pitch.alter) body += tag('alter', pitch.alter);
  body += tag('octave', pitch.octave);
  return tag('pitch', body);
}

function tieXml(event) {
  return `${event.tieStop ? empty('tie', ' type="stop"') : ''}${event.tieStart ? empty('tie', ' type="start"') : ''}`;
}

function notationsXml(event, assignment, withTechnical) {
  let body = '';
  if (event.tieStop) body += empty('tied', ' type="stop"');
  if (event.tieStart) body += empty('tied', ' type="start"');
  if (withTechnical) body += tag('technical', tag('string', assignment.string) + tag('fret', assignment.fret));
  return body ? tag('notations', body) : '';
}

function noteXml(event, assignment, staff, chord) {
  let body = chord ? empty('chord') : '';
  body += pitchXml(event.pitch);
  body += tag('duration', event.durationDivisions);
  body += tieXml(event);
  body += tag('voice', escapeXml(event.voice));
  if (event.type) body += tag('type', escapeXml(event.type));
  for (let i = 0; i < (event.dots ?? 0); i += 1) body += empty('dot');
  body += tag('staff', staff);
  body += notationsXml(event, assignment, staff === 2);
  return tag('note', body);
}

function voiceSort(a, b) {
  const an = Number(a), bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return String(a).localeCompare(String(b));
}

function writeStaff(events, assignments, staff, extent) {
  const byVoice = new Map();
  for (const event of events) {
    const list = byVoice.get(event.voice) ?? [];
    list.push(event);
    byVoice.set(event.voice, list);
  }
  const voices = [...byVoice.keys()].sort(voiceSort);
  let xml = '';
  voices.forEach((voice, voiceIndex) => {
    const list = byVoice.get(voice).slice().sort((a, b) => a.onsetDivisions - b.onsetDivisions || a.sourceOrder - b.sourceOrder);
    let cursor = 0;
    let previousOnset = null;
    for (const event of list) {
      const isChord = previousOnset !== null && event.onsetDivisions === previousOnset;
      if (!isChord) {
        if (event.onsetDivisions < cursor) throw new Error('Unsupported overlapping notes inside one voice.');
        if (event.onsetDivisions > cursor) xml += tag('forward', tag('duration', event.onsetDivisions - cursor));
      }
      const assignment = assignments.get(event.sourceEventId);
      xml += noteXml(event, assignment, staff, isChord);
      if (!isChord) cursor = event.onsetDivisions + event.durationDivisions;
      previousOnset = event.onsetDivisions;
    }
    if (cursor < extent) xml += tag('forward', tag('duration', extent - cursor));
    if (voiceIndex < voices.length - 1 && extent > 0) xml += tag('backup', tag('duration', extent));
  });
  return xml;
}

function attributesXml(measure, firstMeasure) {
  let body = tag('divisions', measure.divisions);
  if (measure.timeSignature?.beats && measure.timeSignature?.beatType) {
    body += tag('time', tag('beats', escapeXml(measure.timeSignature.beats)) + tag('beat-type', escapeXml(measure.timeSignature.beatType)));
  }
  if (firstMeasure) {
    body += tag('staves', 2);
    body += tag('clef', tag('sign', 'G') + tag('line', 2), ' number="1"');
    body += tag('clef', tag('sign', 'TAB') + tag('line', 5), ' number="2"');
    let tuning = tag('staff-type', 'alternate') + tag('staff-lines', 6);
    TUNING_LINES.forEach(([step, octave], index) => {
      tuning += tag('staff-tuning', tag('tuning-step', step) + tag('tuning-octave', octave), ` line="${index + 1}"`);
    });
    body += tag('staff-details', tuning, ' number="2" show-frets="numbers"');
  }
  return tag('attributes', body);
}

export function serializeGuitarTabMusicXml({ sourceSession, document }) {
  if (!sourceSession?.events || !sourceSession?.measures || !document) throw new TypeError('sourceSession and document are required.');
  if (sourceSession.partCount > 1) {
    const error = new Error('Multipart MusicXML export is blocked until non-target parts can be preserved safely.');
    error.code = 'UNSUPPORTED_MULTIPART_EXPORT';
    throw error;
  }
  if (document.sessionId !== sourceSession.sessionId) throw new Error('Stale assignment document does not match source session.');
  if (!document.canExport()) throw new Error('TAB assignment document is incomplete.');
  const assignments = new Map(document.listAssignments().map(({ sourceEventId, string, fret }) => [sourceEventId, { string, fret }]));

  let measuresXml = '';
  for (const measure of sourceSession.measures) {
    const events = sourceSession.events.filter((event) => event.measureIndex === measure.measureIndex);
    const extent = measure.durationDivisions || Math.max(0, ...events.map((event) => event.onsetDivisions + event.durationDivisions));
    let body = attributesXml(measure, measure.measureIndex === 0);
    body += writeStaff(events, assignments, 1, extent);
    if (extent > 0) body += tag('backup', tag('duration', extent));
    body += writeStaff(events, assignments, 2, extent);
    measuresXml += tag('measure', body, ` number="${escapeXml(measure.number)}"`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<score-partwise version="4.0">` +
    `<part-list><score-part id="P1"><part-name>Guitar TAB</part-name></score-part></part-list>` +
    `<part id="P1">${measuresXml}</part>` +
    `</score-partwise>`;
}
