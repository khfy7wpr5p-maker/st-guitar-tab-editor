import { STANDARD_TUNING } from './tuning.js';

export const GUITAR_PITCH_POLICY = Object.freeze({
  SOURCE_SOUNDING: 'source-sounding',
  STANDARD_GUITAR_WRITTEN: 'standard-guitar-written',
});

const VALID_POLICIES = new Set(Object.values(GUITAR_PITCH_POLICY));

export function normalizeGuitarPitchPolicy(value = GUITAR_PITCH_POLICY.SOURCE_SOUNDING) {
  if (typeof value !== 'string' || !VALID_POLICIES.has(value)) {
    throw new Error(`UNSUPPORTED_GUITAR_PITCH_POLICY: ${String(value)}`);
  }
  return value;
}

function assertMidi(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 127) {
    throw new Error(`${label} must be a MIDI integer from 0 to 127.`);
  }
  return value;
}

function sourceTechnicalMidi(event) {
  const position = event?.sourceTechnicalPosition;
  if (!position) return null;
  const openMidi = STANDARD_TUNING[position.string];
  if (!Number.isSafeInteger(openMidi) || !Number.isSafeInteger(position.fret)) {
    throw new Error('Invalid source guitar technical position.');
  }
  return assertMidi(openMidi + position.fret, 'Source guitar technical pitch');
}

export function resolveGuitarPhysicalPitch(event, policy = GUITAR_PITCH_POLICY.SOURCE_SOUNDING) {
  const normalizedPolicy = normalizeGuitarPitchPolicy(policy);
  const technicalMidi = sourceTechnicalMidi(event);
  if (technicalMidi !== null) return technicalMidi;

  const soundingMidi = assertMidi(event?.soundingPitchMidi, 'Source sounding pitch');
  if (normalizedPolicy === GUITAR_PITCH_POLICY.SOURCE_SOUNDING) return soundingMidi;

  const clefOctaveChange = event?.sourceClefOctaveChange ?? 0;
  if (!Number.isSafeInteger(clefOctaveChange)) {
    throw new Error('Invalid source clef octave context.');
  }
  if (clefOctaveChange === -1) return soundingMidi;
  if (clefOctaveChange !== 0) {
    throw new Error(`UNSUPPORTED_CLEF_OCTAVE_CONTEXT: ${clefOctaveChange}`);
  }

  return assertMidi(soundingMidi - 12, 'Standard guitar physical pitch');
}
