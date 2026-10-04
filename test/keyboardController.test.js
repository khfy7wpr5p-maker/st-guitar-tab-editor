import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTabAssignmentDocument } from '../src/model/tabAssignmentDocument.js';

async function loadController() {
  try { return await import('../src/editor/keyboardController.js'); } catch { return {}; }
}

function makeSession() {
  const events = [
    { sourceEventId: 'a', groupId: 'g1', pitch: { midi: 64 } },
    { sourceEventId: 'b', groupId: 'g1', pitch: { midi: 60 } },
    { sourceEventId: 'c', groupId: 'g2', pitch: { midi: 67 } },
  ];
  return { sessionId: 'source:x', sourceFingerprint: 'x', events, groups: [
    { groupId: 'g1', sourceEventIds: ['a','b'] },
    { groupId: 'g2', sourceEventIds: ['c'] },
  ] };
}

function key(key, extras = {}) { return { key, ctrlKey: false, shiftKey: false, ...extras }; }

test('numeric buffer supports two-digit fret and Tab commits within vertical group', async () => {
  const { createKeyboardController } = await loadController();
  assert.equal(typeof createKeyboardController, 'function');
  const session = makeSession();
  const doc = createTabAssignmentDocument(session);
  const ctl = createKeyboardController({ sourceSession: session, document: doc });
  ctl.handleKey(key('1'));
  ctl.handleKey(key('2'));
  assert.equal(ctl.getState().fretBuffer, '12');
  assert.equal(doc.getAssignment('a'), null);
  ctl.handleKey(key('ArrowDown'));
  ctl.handleKey(key('ArrowDown'));
  ctl.handleKey(key('ArrowDown'));
  ctl.handleKey(key('ArrowDown'));
  ctl.handleKey(key('ArrowDown'));
  assert.equal(ctl.getState().selectedString, 6);
  assert.throws(() => ctl.handleKey(key('Tab')), /pitch/i);
  assert.equal(ctl.getState().noteIndex, 0);
});

test('Tab commits valid note and moves to next note in same group; Enter advances complete group', async () => {
  const { createKeyboardController } = await loadController();
  const session = makeSession();
  const doc = createTabAssignmentDocument(session);
  const ctl = createKeyboardController({ sourceSession: session, document: doc });
  ctl.handleKey(key('0'));
  ctl.handleKey(key('Tab'));
  assert.deepEqual(doc.getAssignment('a'), { string: 1, fret: 0 });
  assert.equal(ctl.getState().noteIndex, 1);
  ctl.handleKey(key('ArrowDown'));
  ctl.handleKey(key('1'));
  ctl.handleKey(key('Enter'));
  assert.deepEqual(doc.getAssignment('b'), { string: 2, fret: 1 });
  assert.equal(ctl.getState().groupIndex, 1);
  assert.equal(ctl.getState().noteIndex, 0);
});

test('supports navigation, clear, undo redo and escape buffer cancel', async () => {
  const { createKeyboardController } = await loadController();
  const session = makeSession();
  const doc = createTabAssignmentDocument(session);
  const ctl = createKeyboardController({ sourceSession: session, document: doc });
  ctl.handleKey(key('ArrowRight'));
  assert.equal(ctl.getState().groupIndex, 1);
  ctl.handleKey(key('ArrowLeft'));
  assert.equal(ctl.getState().groupIndex, 0);
  ctl.handleKey(key('0'));
  ctl.handleKey(key('Tab'));
  ctl.handleKey(key('Backspace'));
  assert.equal(doc.getAssignment('b'), null);
  ctl.handleKey(key('z', { ctrlKey: true }));
  assert.equal(doc.getAssignment('a'), null);
  ctl.handleKey(key('y', { ctrlKey: true }));
  assert.deepEqual(doc.getAssignment('a'), { string: 1, fret: 0 });
  ctl.handleKey(key('1'));
  ctl.handleKey(key('Escape'));
  assert.equal(ctl.getState().fretBuffer, '');
});

test('Shift+Tab moves to previous note without source mutation', async () => {
  const { createKeyboardController } = await loadController();
  const session = makeSession();
  const doc = createTabAssignmentDocument(session);
  const ctl = createKeyboardController({ sourceSession: session, document: doc });
  ctl.handleKey(key('0'));
  ctl.handleKey(key('Tab'));
  ctl.handleKey(key('Tab', { shiftKey: true }));
  assert.equal(ctl.getState().noteIndex, 0);
  assert.deepEqual(doc.getAssignment('a'), { string: 1, fret: 0 });
});

test('Ctrl+Shift+Z performs redo rather than undo', async () => {
  const { createKeyboardController } = await loadController();
  const session = makeSession();
  const doc = createTabAssignmentDocument(session);
  const ctl = createKeyboardController({ sourceSession: session, document: doc });
  ctl.handleKey(key('0'));
  ctl.handleKey(key('Tab'));
  ctl.handleKey(key('z', { ctrlKey: true }));
  assert.equal(doc.getAssignment('a'), null);
  ctl.handleKey(key('z', { ctrlKey: true, shiftKey: true }));
  assert.deepEqual(doc.getAssignment('a'), { string: 1, fret: 0 });
});
