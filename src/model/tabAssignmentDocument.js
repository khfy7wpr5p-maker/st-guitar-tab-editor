import { assertKnownEvent } from '../editor/commands.js';
import { createHistory } from '../editor/history.js';
import { STANDARD_TUNING } from '../guitar/tuning.js';
import { validatePositionForEvent } from '../guitar/positionValidator.js';

export function createTabAssignmentDocument(sourceSession, options = {}) {
  if (!sourceSession?.sessionId || !Array.isArray(sourceSession.events) || !Array.isArray(sourceSession.groups)) {
    throw new TypeError('A valid source session is required.');
  }
  const tuning = options.tuning ?? STANDARD_TUNING;
  const capo = options.capo ?? 0;
  const eventById = new Map(sourceSession.events.map((event) => [event.sourceEventId, event]));
  const groupById = new Map(sourceSession.groups.map((group) => [group.groupId, group]));
  let assignments = new Map();
  const history = createHistory();

  function getAssignment(sourceEventId) {
    assertKnownEvent(eventById, sourceEventId);
    const value = assignments.get(sourceEventId);
    return value ? { ...value } : null;
  }

  function assignPosition(sourceEventId, position) {
    const event = assertKnownEvent(eventById, sourceEventId);
    const result = validatePositionForEvent(event, position, tuning, capo);
    if (!result.ok) throw new Error(`Invalid guitar position: ${result.code.replaceAll('_', ' ').toLowerCase()}.`);
    const group = groupById.get(event.groupId);
    for (const peerId of group?.sourceEventIds ?? []) {
      if (peerId === sourceEventId) continue;
      const peer = assignments.get(peerId);
      if (peer?.string === position.string) throw new Error('Duplicate string assignment inside simultaneous group.');
    }
    history.record(assignments);
    assignments.set(sourceEventId, { string: position.string, fret: position.fret });
    return { string: position.string, fret: position.fret };
  }

  function clearPosition(sourceEventId) {
    assertKnownEvent(eventById, sourceEventId);
    if (!assignments.has(sourceEventId)) return false;
    history.record(assignments);
    assignments.delete(sourceEventId);
    return true;
  }

  function undo() {
    const previous = history.undo(assignments);
    if (!previous) return false;
    assignments = previous;
    return true;
  }

  function redo() {
    const next = history.redo(assignments);
    if (!next) return false;
    assignments = next;
    return true;
  }

  function canExport() {
    return sourceSession.events.length > 0 && sourceSession.events.every((event) => assignments.has(event.sourceEventId));
  }

  function listAssignments() {
    return sourceSession.events
      .filter((event) => assignments.has(event.sourceEventId))
      .map((event) => ({ sourceEventId: event.sourceEventId, ...assignments.get(event.sourceEventId) }));
  }

  return Object.freeze({
    sessionId: sourceSession.sessionId,
    sourceFingerprint: sourceSession.sourceFingerprint,
    getAssignment,
    assignPosition,
    clearPosition,
    undo,
    redo,
    canExport,
    listAssignments,
  });
}
