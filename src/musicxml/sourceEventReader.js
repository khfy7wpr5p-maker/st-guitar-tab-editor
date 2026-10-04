import { childText, children, firstChild, parseXml } from './xml.js';
import { inspectMusicXml } from './intake.js';

const STEP_TO_SEMITONE = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });

function intText(node, name, { required = true, fallback = null } = {}) {
  const raw = childText(node, name);
  if (raw === null) {
    if (!required) return fallback;
    throw new Error(`Missing <${name}>.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`Invalid integer <${name}>.`);
  return value;
}

function pitchFromNote(note) {
  const pitchNode = firstChild(note, 'pitch');
  if (!pitchNode) return null;
  const step = childText(pitchNode, 'step');
  const alter = intText(pitchNode, 'alter', { required: false, fallback: 0 });
  const octave = intText(pitchNode, 'octave');
  if (!Object.hasOwn(STEP_TO_SEMITONE, step)) throw new Error(`Unsupported pitch step: ${step}`);
  const midi = (octave + 1) * 12 + STEP_TO_SEMITONE[step] + alter;
  if (!Number.isSafeInteger(midi) || midi < 0 || midi > 127) throw new Error('Pitch is outside MIDI range.');
  return { step, alter, octave, midi };
}

function tieFlags(note) {
  let tieStart = false;
  let tieStop = false;
  for (const tie of children(note, 'tie')) {
    if (tie.attributes.type === 'start') tieStart = true;
    if (tie.attributes.type === 'stop') tieStop = true;
  }
  return { tieStart, tieStop };
}

export function readSourceEvents(xmlText) {
  const inspection = inspectMusicXml(xmlText);
  if (!inspection.ok) throw new Error(`${inspection.code}: ${inspection.message}`);
  const root = parseXml(xmlText);
  const part = children(root, 'part')[0];
  const partId = part.attributes.id || 'P1';
  const events = [];
  const measures = [];
  const divisionsByMeasure = [];
  let currentDivisions = null;

  const measureNodes = children(part, 'measure');
  for (let measureIndex = 0; measureIndex < measureNodes.length; measureIndex += 1) {
    const measure = measureNodes[measureIndex];
    const attributes = firstChild(measure, 'attributes');
    if (attributes && childText(attributes, 'divisions') !== null) {
      currentDivisions = intText(attributes, 'divisions');
      if (currentDivisions <= 0) throw new Error('divisions must be positive.');
    }
    if (!currentDivisions) throw new Error('Missing MusicXML divisions.');
    divisionsByMeasure.push(currentDivisions);

    let cursor = 0;
    let maxCursor = 0;
    let noteOrder = 0;
    const lastOnsetByVoice = new Map();
    const measureEventIds = [];

    for (const child of measure.children) {
      if (child.name === 'backup' || child.name === 'forward') {
        const amount = intText(child, 'duration');
        if (amount < 0) throw new Error(`${child.name} duration must be non-negative.`);
        cursor += child.name === 'backup' ? -amount : amount;
        maxCursor = Math.max(maxCursor, cursor);
        if (cursor < 0) throw new Error('MusicXML backup moves before measure start.');
        continue;
      }
      if (child.name !== 'note') continue;
      if (firstChild(child, 'time-modification')) throw new Error('time-modification is unsupported in MVP.');
      if (firstChild(child, 'grace')) throw new Error('grace notes are unsupported in MVP.');
      if (firstChild(child, 'unpitched')) throw new Error('unpitched/percussion notes are unsupported in MVP.');

      const voice = childText(child, 'voice') ?? '1';
      const staff = childText(child, 'staff') ?? '1';
      const duration = intText(child, 'duration');
      if (duration <= 0) throw new Error('Note duration must be positive.');
      const isChord = Boolean(firstChild(child, 'chord'));
      let onset;
      if (isChord) {
        if (!lastOnsetByVoice.has(voice)) throw new Error('Chord note has no preceding note in the same voice.');
        onset = lastOnsetByVoice.get(voice);
      } else {
        onset = cursor;
        lastOnsetByVoice.set(voice, onset);
      }

      const pitch = pitchFromNote(child);
      const isRest = Boolean(firstChild(child, 'rest'));
      if (!pitch && !isRest) throw new Error('Unsupported note without pitch/rest.');
      if (pitch) {
        const sourceEventId = `${partId}:m${measureIndex}:v${voice}:o${onset}:n${noteOrder}`;
        const dots = children(child, 'dot').length;
        const event = {
          sourceEventId,
          partId,
          measureIndex,
          measureNumber: measure.attributes.number ?? String(measureIndex + 1),
          voice,
          staff,
          onsetDivisions: onset,
          durationDivisions: duration,
          divisions: currentDivisions,
          pitch,
          type: childText(child, 'type'),
          dots,
          ...tieFlags(child),
          sourceOrder: noteOrder,
          groupId: null,
        };
        events.push(event);
        measureEventIds.push(sourceEventId);
      }
      if (!isChord) { cursor += duration; maxCursor = Math.max(maxCursor, cursor); }
      noteOrder += 1;
    }
    const timeNode = attributes ? firstChild(attributes, 'time') : null;
    measures.push({
      measureIndex,
      number: measure.attributes.number ?? String(measureIndex + 1),
      divisions: currentDivisions,
      durationDivisions: maxCursor,
      timeSignature: timeNode ? { beats: childText(timeNode, 'beats'), beatType: childText(timeNode, 'beat-type') } : null,
      sourceEventIds: measureEventIds,
    });
  }

  const grouped = new Map();
  for (const event of events) {
    const key = `${event.measureIndex}:${event.onsetDivisions}`;
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }
  const groups = [...grouped.entries()]
    .map(([key, list]) => {
      if (list.length > 6) throw new Error('Simultaneous group contains more than 6 pitched notes.');
      list.sort((a, b) => a.sourceOrder - b.sourceOrder);
      const groupId = `m${list[0].measureIndex}:o${list[0].onsetDivisions}`;
      for (const event of list) event.groupId = groupId;
      return {
        groupId,
        measureIndex: list[0].measureIndex,
        onsetDivisions: list[0].onsetDivisions,
        sourceEventIds: list.map((event) => event.sourceEventId),
      };
    })
    .sort((a, b) => a.measureIndex - b.measureIndex || a.onsetDivisions - b.onsetDivisions);

  return { partId, measures, events, groups, divisionsByMeasure };
}
