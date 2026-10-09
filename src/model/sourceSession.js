import { guitarSoundingMidiForWrittenMidi } from '../guitar/tuning.js';
import { readSourceEvents } from '../musicxml/sourceEventReader.js';

function deterministicFingerprint(text) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < text.length; index += 1) {
    const unit = BigInt(text.charCodeAt(index));
    hash ^= unit & 0xffn;
    hash = BigInt.asUintN(64, hash * prime);
    hash ^= (unit >> 8n) & 0xffn;
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

function targetFingerprint(targetSelection) {
  if (targetSelection === null) return null;
  return deterministicFingerprint([
    targetSelection.partId,
    targetSelection.partIndex,
    targetSelection.staff,
    targetSelection.voice,
  ].join('\u0000'));
}

function withGuitarOctaveTransposition(events, enabled) {
  if (!enabled) return events;
  return events.map((event) => ({
    ...event,
    guitarSoundingMidi: guitarSoundingMidiForWrittenMidi(event.pitch.midi),
  }));
}

export function createSourceSession(xmlText, { targetSelection = null, guitarOctaveTransposition = false } = {}) {
  if (typeof guitarOctaveTransposition !== 'boolean') {
    throw new TypeError('guitarOctaveTransposition must be a boolean.');
  }
  const parsed = readSourceEvents(xmlText, { targetSelection });
  const sourceFingerprint = deterministicFingerprint(xmlText);
  const target = parsed.targetSelection;
  const selectionFingerprint = targetFingerprint(target);
  const transpositionSuffix = guitarOctaveTransposition ? ':guitar-octave-down' : '';
  const events = withGuitarOctaveTransposition(parsed.events, guitarOctaveTransposition);
  return {
    sessionId: selectionFingerprint === null
      ? `source:${sourceFingerprint}${transpositionSuffix}`
      : `source:${sourceFingerprint}:target:${selectionFingerprint}${transpositionSuffix}`,
    sourceFingerprint,
    sourceXml: xmlText,
    guitarOctaveTransposition,
    ...parsed,
    events,
  };
}
