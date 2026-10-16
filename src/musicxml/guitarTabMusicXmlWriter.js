import { childText, children, firstChild, parseXml } from './xml.js';

const TUNING_LINES = Object.freeze([
  ['E', 2], ['A', 2], ['D', 3], ['G', 3], ['B', 3], ['E', 4],
]);
const OSMD_SECOND_STAFF_VOICE_START = 5;

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

function beamXml(event) {
  return (event.beams ?? [])
    .map((beam) => tag('beam', escapeXml(beam.value), ` number="${beam.number}"`))
    .join('');
}

function notationsXml(event, assignment, withTechnical) {
  let body = '';
  if (event.tieStop) body += empty('tied', ' type="stop"');
  if (event.tieStart) body += empty('tied', ' type="start"');
  body += (event.tuplets ?? []).map((tuplet) => contextXml(tuplet)).join('');
  if (withTechnical) body += tag('technical', tag('string', assignment.string) + tag('fret', assignment.fret));
  return body ? tag('notations', body) : '';
}

function noteXml(event, assignment, staff, chord, voice = event.voice, withTechnical = false) {
  let body = chord ? empty('chord') : '';
  body += pitchXml(event.pitch);
  body += tag('duration', event.durationDivisions);
  body += tieXml(event);
  body += tag('voice', escapeXml(voice));
  if (event.type) body += tag('type', escapeXml(event.type));
  for (let i = 0; i < (event.dots ?? 0); i += 1) body += empty('dot');
  if (event.timeModification) body += contextXml(event.timeModification);
  body += tag('staff', staff);
  if (staff === 1) body += beamXml(event);
  body += notationsXml(event, assignment, withTechnical);
  return tag('note', body);
}

function voiceSort(a, b) {
  const an = Number(a), bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return String(a).localeCompare(String(b));
}

function createTabVoiceMap(events) {
  const sourceVoices = [...new Set(events.map((event) => event.voice))].sort(voiceSort);
  const occupiedVoiceNumbers = new Set(sourceVoices
    .map((voice) => Number.parseInt(String(voice), 10))
    .filter((voice) => Number.isSafeInteger(voice) && voice >= 0));
  const tabVoices = new Map();
  let nextVoice = OSMD_SECOND_STAFF_VOICE_START;
  for (const sourceVoice of sourceVoices) {
    while (occupiedVoiceNumbers.has(nextVoice)) nextVoice += 1;
    if (!Number.isSafeInteger(nextVoice)) throw new Error('Unable to allocate a distinct TAB voice.');
    tabVoices.set(sourceVoice, String(nextVoice));
    occupiedVoiceNumbers.add(nextVoice);
    nextVoice += 1;
  }
  return tabVoices;
}

function writeStaff(events, assignments, staff, extent, voiceMap = null) {
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
      xml += noteXml(event, assignment, staff, isChord, voiceMap?.get(voice) ?? voice, voiceMap !== null);
      if (!isChord) cursor = event.onsetDivisions + event.durationDivisions;
      previousOnset = event.onsetDivisions;
    }
    if (cursor < extent) xml += tag('forward', tag('duration', extent - cursor));
    if (voiceIndex < voices.length - 1 && extent > 0) xml += tag('backup', tag('duration', extent));
  });
  return xml;
}

function contextXml(node, notationStaff = false, requireStaffNumber = false) {
  const attrs = { ...node.attributes };
  if (notationStaff && (requireStaffNumber || attrs.number !== undefined)) attrs.number = '1';
  const encodedAttrs = Object.entries(attrs).map(([name, value]) => ` ${name}="${escapeXml(value)}"`).join('');
  return tag(node.name, escapeXml(node.text) + node.children.map((child) => contextXml(child)).join(''), encodedAttrs);
}

function textNode(name, text, attributes = {}) {
  return { name, attributes: { ...attributes }, children: [], text: String(text) };
}

function containerNode(name, childrenValue, attributes = {}) {
  return { name, attributes: { ...attributes }, children: childrenValue, text: '' };
}

function insertAttributeChild(attributes, node) {
  const order = ['divisions', 'key', 'time', 'staves', 'part-symbol', 'instruments', 'clef', 'staff-details', 'transpose'];
  const targetOrder = order.indexOf(node.name);
  let index = attributes.children.length;
  for (let current = 0; current < attributes.children.length; current += 1) {
    const currentOrder = order.indexOf(attributes.children[current].name);
    if (currentOrder > targetOrder) {
      index = current;
      break;
    }
  }
  attributes.children.splice(index, 0, node);
}

function tabClefNode(tabStaff) {
  return containerNode('clef', [textNode('sign', 'TAB'), textNode('line', 5)], { number: String(tabStaff) });
}

function tabStaffDetailsNode(tabStaff) {
  const body = [textNode('staff-type', 'alternate'), textNode('staff-lines', 6)];
  TUNING_LINES.forEach(([step, octave], index) => {
    body.push(containerNode('staff-tuning', [
      textNode('tuning-step', step),
      textNode('tuning-octave', octave),
    ], { line: String(index + 1) }));
  });
  return containerNode('staff-details', body, { number: String(tabStaff), 'show-frets': 'numbers' });
}

function resolveTargetPart(root, sourceSession) {
  const parts = children(root, 'part');
  const part = parts[sourceSession.partIndex];
  if (!part || part.attributes.id !== sourceSession.partId) {
    throw new Error('Source session target part no longer matches source MusicXML.');
  }
  return part;
}

function maxSourceStaff(part) {
  let maximum = 1;
  for (const measure of children(part, 'measure')) {
    for (const attributes of children(measure, 'attributes')) {
      const staves = Number(childText(attributes, 'staves'));
      if (Number.isSafeInteger(staves) && staves > maximum) maximum = staves;
    }
    for (const note of children(measure, 'note')) {
      const staff = Number(childText(note, 'staff'));
      if (Number.isSafeInteger(staff) && staff > maximum) maximum = staff;
    }
  }
  return maximum;
}

function prepareSourceNotation(part, targetStaff, tabStaff) {
  const measures = children(part, 'measure');
  if (measures.length === 0) throw new Error('Target part contains no measures.');
  let firstAttributes = firstChild(measures[0], 'attributes');
  if (!firstAttributes) {
    firstAttributes = containerNode('attributes', []);
    measures[0].children.unshift(firstAttributes);
  }
  const staves = firstChild(firstAttributes, 'staves');
  if (staves) staves.text = String(tabStaff);
  else insertAttributeChild(firstAttributes, textNode('staves', tabStaff));

  for (const measure of measures) {
    for (const attributes of children(measure, 'attributes')) {
      for (const declaredStaves of children(attributes, 'staves')) {
        declaredStaves.text = String(tabStaff);
      }
    }
  }

  for (const clef of children(firstAttributes, 'clef')) {
    if (clef.attributes.number === undefined) clef.attributes.number = '1';
  }
  for (const details of children(firstAttributes, 'staff-details')) {
    if (details.attributes.number === undefined) details.attributes.number = '1';
  }
  insertAttributeChild(firstAttributes, tabClefNode(tabStaff));
  insertAttributeChild(firstAttributes, tabStaffDetailsNode(tabStaff));

  for (const measure of measures) {
    for (const note of children(measure, 'note')) {
      if (!firstChild(note, 'staff')) {
        const voiceIndex = note.children.findIndex((child) => child.name === 'voice');
        note.children.splice(voiceIndex >= 0 ? voiceIndex + 1 : note.children.length, 0, textNode('staff', 1));
      }
    }
  }
}

export function serializeGuitarTabMusicXml({ sourceSession, document }) {
  if (!sourceSession?.events || !sourceSession?.measures || !document) throw new TypeError('sourceSession and document are required.');
  if (document.sessionId !== sourceSession.sessionId) throw new Error('Stale assignment document does not match source session.');
  if (!document.canExport()) throw new Error('TAB assignment document is incomplete.');
  const assignments = new Map(document.listAssignments().map(({ sourceEventId, string, fret }) => [sourceEventId, { string, fret }]));
  const tabVoiceMap = createTabVoiceMap(sourceSession.events);
  const root = parseXml(sourceSession.sourceXml);
  const part = resolveTargetPart(root, sourceSession);
  const targetStaff = sourceSession.targetSelection?.staff ?? 1;
  const tabStaff = maxSourceStaff(part) + 1;
  prepareSourceNotation(part, targetStaff, tabStaff);
  const measureNodes = children(part, 'measure');

  for (const measure of sourceSession.measures) {
    const events = sourceSession.events.filter((event) => event.measureIndex === measure.measureIndex);
    const extent = measure.durationDivisions || Math.max(0, ...events.map((event) => event.onsetDivisions + event.durationDivisions));
    const measureNode = measureNodes[measure.measureIndex];
    if (!measureNode) throw new Error('Source session measure no longer matches source MusicXML.');
    const finalCursor = measure.finalCursorDivisions ?? extent;
    if (events.length > 0 && finalCursor > 0) {
      measureNode.children.push(containerNode('backup', [textNode('duration', finalCursor)]));
    }
    if (events.length > 0) {
      const tabXml = writeStaff(events, assignments, tabStaff, extent, tabVoiceMap);
      const fragment = parseXml(`<fragment>${tabXml}</fragment>`);
      measureNode.children.push(...fragment.children);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>${contextXml(root)}`;
}
