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

export function resolveGuitarPhysicalPitch(event, policy = GUITAR_PITCH_POLICY.SOURCE_SOUNDING) {
  const normalizedPolicy = normalizeGuitarPitchPolicy(policy);
  const writtenMidi = assertMidi(event?.pitch?.midi, 'Written pitch');

  if (normalizedPolicy === GUITAR_PITCH_POLICY.SOURCE_SOUNDING) {
    return assertMidi(event?.soundingPitchMidi, 'Source sounding pitch');
  }

  const physicalMidi = writtenMidi - 12;
  return assertMidi(physicalMidi, 'Standard guitar physical pitch');
}
