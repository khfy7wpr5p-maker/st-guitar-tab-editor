import { STANDARD_TUNING } from './tuning.js';

export function positionToMidi({ string, fret, tuning = STANDARD_TUNING, capo = 0 }) {
  if (!Number.isInteger(string) || string < 1 || string > 6 || !Object.hasOwn(tuning, string)) {
    throw new RangeError('Invalid guitar string.');
  }
  if (!Number.isInteger(fret) || fret < 0 || fret > 20) throw new RangeError('Invalid fret.');
  if (!Number.isInteger(capo) || capo < 0 || capo > 20) throw new RangeError('Invalid capo.');
  return tuning[string] + capo + fret;
}

export function validatePositionForEvent(event, position, tuning = STANDARD_TUNING, capo = 0) {
  const { string, fret } = position ?? {};
  if (!Number.isInteger(string) || string < 1 || string > 6 || !Object.hasOwn(tuning, string)) {
    return { ok: false, code: 'INVALID_STRING' };
  }
  if (!Number.isInteger(fret) || fret < 0 || fret > 20) return { ok: false, code: 'INVALID_FRET' };
  let midi;
  try { midi = positionToMidi({ string, fret, tuning, capo }); }
  catch { return { ok: false, code: 'INVALID_POSITION' }; }
  if (!event?.pitch || event.pitch.midi !== midi) {
    return { ok: false, code: 'PITCH_MISMATCH', expectedMidi: event?.pitch?.midi ?? null, actualMidi: midi };
  }
  return { ok: true, midi };
}
