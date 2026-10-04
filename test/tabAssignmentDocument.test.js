import assert from 'node:assert/strict';
import { test } from 'node:test';

async function api() {
  try { return await import('../src/model/tabAssignmentDocument.js'); } catch { return {}; }
}

function session() {
  const events = [
    { sourceEventId: 's:m0:v1:o0:n0', groupId: 'm0:o0', pitch: { midi: 64 } },
    { sourceEventId: 's:m0:v1:o0:n1', groupId: 'm0:o0', pitch: { midi: 60 } },
    { sourceEventId: 's:m0:v1:o4:n2', groupId: 'm0:o4', pitch: { midi: 67 } },
  ];
  return {
    sessionId: 'source:abc', sourceFingerprint: 'abc', events,
    groups: [
      { groupId: 'm0:o0', sourceEventIds: events.slice(0, 2).map((e) => e.sourceEventId) },
      { groupId: 'm0:o4', sourceEventIds: [events[2].sourceEventId] },
    ],
  };
}

test('assigns exact positions and reports incomplete export', async () => {
  const { createTabAssignmentDocument } = await api();
  assert.equal(typeof createTabAssignmentDocument, 'function');
  const doc = createTabAssignmentDocument(session());
  assert.deepEqual(doc.assignPosition('s:m0:v1:o0:n0', { string: 1, fret: 0 }), { string: 1, fret: 0 });
  assert.equal(doc.canExport(), false);
  assert.deepEqual(doc.getAssignment('s:m0:v1:o0:n0'), { string: 1, fret: 0 });
});

test('rejects wrong pitch, duplicate string in a group, and stale event identity', async () => {
  const { createTabAssignmentDocument } = await api();
  const doc = createTabAssignmentDocument(session());
  assert.throws(() => doc.assignPosition('s:m0:v1:o0:n0', { string: 2, fret: 4 }), /pitch/i);
  doc.assignPosition('s:m0:v1:o0:n0', { string: 2, fret: 5 });
  assert.throws(() => doc.assignPosition('s:m0:v1:o0:n1', { string: 2, fret: 1 }), /duplicate string/i);
  assert.throws(() => doc.assignPosition('old:m0:v1:o0:n0', { string: 1, fret: 0 }), /stale|unknown/i);
});

test('requires complete groups before export', async () => {
  const { createTabAssignmentDocument } = await api();
  const doc = createTabAssignmentDocument(session());
  doc.assignPosition('s:m0:v1:o0:n0', { string: 1, fret: 0 });
  doc.assignPosition('s:m0:v1:o0:n1', { string: 2, fret: 1 });
  assert.equal(doc.canExport(), false);
  doc.assignPosition('s:m0:v1:o4:n2', { string: 1, fret: 3 });
  assert.equal(doc.canExport(), true);
});

test('undo and redo restore assignment state and clear truncates redo after new command', async () => {
  const { createTabAssignmentDocument } = await api();
  const doc = createTabAssignmentDocument(session());
  doc.assignPosition('s:m0:v1:o0:n0', { string: 1, fret: 0 });
  assert.equal(doc.undo(), true);
  assert.equal(doc.getAssignment('s:m0:v1:o0:n0'), null);
  assert.equal(doc.redo(), true);
  assert.deepEqual(doc.getAssignment('s:m0:v1:o0:n0'), { string: 1, fret: 0 });
  doc.clearPosition('s:m0:v1:o0:n0');
  assert.equal(doc.redo(), false);
});

test('a new source session rejects prior event ids and starts with empty history', async () => {
  const { createTabAssignmentDocument } = await api();
  const oldSession = session();
  const oldDoc = createTabAssignmentDocument(oldSession);
  oldDoc.assignPosition('s:m0:v1:o0:n0', { string: 1, fret: 0 });
  const fresh = { ...oldSession, sessionId: 'source:new', sourceFingerprint: 'new', events: oldSession.events.map((e) => ({ ...e, sourceEventId: `new:${e.sourceEventId}` })), groups: oldSession.groups.map((g) => ({ ...g, sourceEventIds: g.sourceEventIds.map((id) => `new:${id}`) })) };
  const freshDoc = createTabAssignmentDocument(fresh);
  assert.throws(() => freshDoc.assignPosition('s:m0:v1:o0:n0', { string: 1, fret: 0 }), /stale|unknown/i);
  assert.equal(freshDoc.undo(), false);
});
