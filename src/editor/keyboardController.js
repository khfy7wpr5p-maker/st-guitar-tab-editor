function isDigitKey(key) {
  return /^[0-9]$/.test(key);
}

export function createKeyboardController({ sourceSession, document }) {
  if (!sourceSession?.groups?.length) throw new TypeError('Source session with groups is required.');
  let groupIndex = 0;
  let noteIndex = 0;
  let selectedString = 1;
  let fretBuffer = '';

  function currentGroup() { return sourceSession.groups[groupIndex]; }
  function currentEventId() { return currentGroup().sourceEventIds[noteIndex]; }

  function commitCurrent() {
    if (fretBuffer === '') return false;
    const fret = Number(fretBuffer);
    document.assignPosition(currentEventId(), { string: selectedString, fret });
    fretBuffer = '';
    return true;
  }

  function getState() {
    return Object.freeze({
      groupIndex,
      groupCount: sourceSession.groups.length,
      noteIndex,
      noteCount: currentGroup().sourceEventIds.length,
      selectedString,
      fretBuffer,
      currentGroupId: currentGroup().groupId,
      currentEventId: currentEventId(),
    });
  }

  function handleKey(event) {
    const key = event?.key ?? '';
    if (event?.ctrlKey && (key.toLowerCase() === 'y' || (event.shiftKey && key.toLowerCase() === 'z'))) {
      document.redo(); fretBuffer = ''; return getState();
    }
    if (event?.ctrlKey && key.toLowerCase() === 'z') {
      document.undo(); fretBuffer = ''; return getState();
    }
    if (key === 'Escape') { fretBuffer = ''; return getState(); }
    if (key === 'ArrowUp') { selectedString = Math.max(1, selectedString - 1); return getState(); }
    if (key === 'ArrowDown') { selectedString = Math.min(6, selectedString + 1); return getState(); }
    if (key === 'ArrowLeft') {
      groupIndex = Math.max(0, groupIndex - 1); noteIndex = 0; fretBuffer = ''; return getState();
    }
    if (key === 'ArrowRight') {
      groupIndex = Math.min(sourceSession.groups.length - 1, groupIndex + 1); noteIndex = 0; fretBuffer = ''; return getState();
    }
    if (key === 'Delete' || key === 'Backspace') {
      fretBuffer = '';
      document.clearPosition(currentEventId());
      return getState();
    }
    if (key === 'Tab' && event?.shiftKey) {
      noteIndex = Math.max(0, noteIndex - 1); fretBuffer = ''; return getState();
    }
    if (key === 'Tab') {
      commitCurrent();
      noteIndex = Math.min(currentGroup().sourceEventIds.length - 1, noteIndex + 1);
      return getState();
    }
    if (key === 'Enter') {
      commitCurrent();
      const complete = currentGroup().sourceEventIds.every((id) => document.getAssignment(id) !== null);
      if (!complete) throw new Error('Current simultaneous group is incomplete.');
      if (groupIndex < sourceSession.groups.length - 1) {
        groupIndex += 1; noteIndex = 0; selectedString = 1; fretBuffer = '';
      }
      return getState();
    }
    if (isDigitKey(key)) {
      const candidate = `${fretBuffer}${key}`;
      const value = Number(candidate);
      if (value <= 20 && candidate.length <= 2) fretBuffer = candidate;
      return getState();
    }
    return getState();
  }

  return Object.freeze({ getState, handleKey });
}
