import assert from 'node:assert/strict';
import { test } from 'node:test';

async function api() {
  try { return await import('../src/guitar/positionValidator.js'); } catch { return {}; }
}

const event = (midi) => ({ pitch: { midi } });

test('maps standard open strings and fret 20 exactly', async () => {
  const { positionToMidi, validatePositionForEvent } = await api();
  assert.equal(typeof positionToMidi, 'function');
  assert.equal(positionToMidi({ string: 1, fret: 0 }), 64);
  assert.equal(positionToMidi({ string: 6, fret: 0 }), 40);
  assert.equal(positionToMidi({ string: 1, fret: 20 }), 84);
  assert.deepEqual(validatePositionForEvent(event(67), { string: 1, fret: 3 }), { ok: true, midi: 67 });
});

test('rejects invalid string/fret and wrong pitch', async () => {
  const { validatePositionForEvent } = await api();
  assert.equal(validatePositionForEvent(event(64), { string: 0, fret: 0 }).code, 'INVALID_STRING');
  assert.equal(validatePositionForEvent(event(64), { string: 1, fret: 21 }).code, 'INVALID_FRET');
  assert.equal(validatePositionForEvent(event(64), { string: 2, fret: 0 }).code, 'PITCH_MISMATCH');
});
