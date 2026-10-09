export const STANDARD_TUNING = Object.freeze({
  1: 64,
  2: 59,
  3: 55,
  4: 50,
  5: 45,
  6: 40,
});

export const GUITAR_WRITTEN_TO_SOUNDING_SEMITONES = -12;

export function guitarSoundingMidiForWrittenMidi(writtenMidi) {
  if (!Number.isSafeInteger(writtenMidi) || writtenMidi < 0 || writtenMidi > 127) {
    throw new RangeError('Invalid written MIDI pitch.');
  }
  return writtenMidi + GUITAR_WRITTEN_TO_SOUNDING_SEMITONES;
}
