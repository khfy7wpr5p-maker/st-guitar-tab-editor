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

function normalizeTargetSelection(value) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('targetSelection must be an object.');
  }
  const partId = typeof value.partId === 'string' ? value.partId : '';
  if (!partId || partId !== partId.trim()) throw new Error('targetSelection partId must be non-empty trimmed text.');
  if (!Number.isSafeInteger(value.partIndex) || value.partIndex < 0) {
    throw new Error('targetSelection partIndex must be a safe integer >= 0.');
  }
  if (!Number.isSafeInteger(value.staff) || value.staff < 1) {
    throw new Error('targetSelection staff must be a safe integer >= 1.');
  }
  if (!Number.isSafeInteger(value.voice) || value.voice < 0) {
    throw new Error('targetSelection voice must be a safe integer >= 0.');
  }
  return Object.freeze({
    partId,
    partIndex: value.partIndex,
    staff: value.staff,
    voice: value.voice,
  });
}

function resolveSourcePart(root, targetSelection) {
  const parts = children(root, 'part');
  const seen = new Set();
  for (let index = 0; index < parts.length; index += 1) {
    const partId = parts[index]?.attributes?.id;
    if (typeof partId !== 'string' || !partId || partId !== partId.trim()) {
      throw new Error(`Invalid MusicXML part id at partIndex ${index}.`);
    }
    if (seen.has(partId)) throw new Error(`Duplicate MusicXML part id ${partId}.`);
    seen.add(partId);
  }

  if (targetSelection === null) {
    return { part: parts[0], partIndex: 0, partId: parts[0].attributes.id || 'P1' };
  }

  const part = parts[targetSelection.partIndex];
  if (!part || part.attributes.id !== targetSelection.partId) {
    throw new Error('targetSelection partId/partIndex mismatch.');
  }
  return {
    part,
    partIndex: targetSelection.partIndex,
    partId: targetSelection.partId,
  };
}

function explicitTargetIdentity(note) {
  const rawVoice = childText(note, 'voice');
  const rawStaff = childText(note, 'staff');
  if (rawVoice === null || rawStaff === null) return null;
  const voice = Number(rawVoice);
  const staff = Number(rawStaff);
  if (!Number.isSafeInteger(voice) || voice < 0) return null;
  if (!Number.isSafeInteger(staff) || staff < 1) return null;
  return { voice, staff };
}

export function readSourceEvents(xmlText, { targetSelection = null } = {}) {
  const normalizedTarget = normalizeTargetSelection(targetSelection);
  const inspection = inspectMusicXml(xmlText, { allowMultipart: normalizedTarget !== null });
  if (!inspection.ok) throw new Error(`${inspection.code}: ${inspection.message}`);
  const root = parseXml(xmlText);
  const resolved = resolveSourcePart(root, normalizedTarget);
  const { part, partIndex, partId } = resolved;
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

      const rawVoice = childText(child, 'voice');
      const rawStaff = childText(child, 'staff');
      const voice = rawVoice ?? '1';
      const staff = rawStaff ?? '1';
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
      maxCursor = Math.max(maxCursor, onset + duration);

      const pitch = pitchFromNote(child);
      const isRest = Boolean(firstChild(child, 'rest'));
      if (!pitch && !isRest) throw new Error('Unsupported note without pitch/rest.');
      if (pitch) {
        const identity = explicitTargetIdentity(child);
        const selected = normalizedTarget === null || (
          identity !== null &&
          identity.staff === normalizedTarget.staff &&
          identity.voice === normalizedTarget.voice
        );
        if (selected) {
          const sourceEventId = `${partId}:m${measureIndex}:v${voice}:o${onset}:n${noteOrder}`;
          const dots = children(child, 'dot').length;
          const event = {
            sourceEventId,
            partId,
            partIndex,
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
      }
      if (!isChord) { cursor += duration; maxCursor = Math.max(maxCursor, cursor); }
      noteOrder += 1;
    }
    const timeNode = attributes ? firstChild(attributes, 'time') : null;
    const selectedStaff = normalizedTarget?.staff ?? 1;
    const keyNodes = attributes ? children(attributes, 'key').filter((key) =>
      key.attributes.number === undefined || Number(key.attributes.number) === selectedStaff) : [];
    const staffKeys = keyNodes.filter((key) => key.attributes.number !== undefined);
    const selectedKeys = staffKeys.length ? staffKeys : keyNodes;
    if (selectedKeys.length > 1) throw new Error('Ambiguous selected-staff key context.');
    const keyAfterElapsedTime = attributes && children(attributes, 'key').length > 0
      && measure.children.slice(0, measure.children.indexOf(attributes)).some((node) => ['note', 'backup', 'forward'].includes(node.name));
    if (keyAfterElapsedTime || children(measure, 'attributes').slice(1).some((node) => children(node, 'key').length)) {
      throw new Error('Mid-measure key changes are unsupported; refusing context loss.');
    }
    measures.push({
      measureIndex,
      number: measure.attributes.number ?? String(measureIndex + 1),
      divisions: currentDivisions,
      durationDivisions: maxCursor,
      timeSignature: timeNode ? { beats: childText(timeNode, 'beats'), beatType: childText(timeNode, 'beat-type') } : null,
      keySignature: selectedKeys[0] ?? null,
      sourceEventIds: measureEventIds,
    });
  }

  if (normalizedTarget !== null && events.length === 0) {
    throw new Error('targetSelection contains no pitched notes.');
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

  return {
    partId,
    partIndex,
    targetSelection: normalizedTarget,
    measures,
    events,
    groups,
    divisionsByMeasure,
  };
}
