export function cloneAssignments(assignments) {
  return new Map([...assignments].map(([id, value]) => [id, value ? { ...value } : value]));
}

export function createHistory() {
  const undoStack = [];
  const redoStack = [];
  return {
    record(snapshot) { undoStack.push(cloneAssignments(snapshot)); redoStack.length = 0; },
    undo(current) {
      if (!undoStack.length) return null;
      redoStack.push(cloneAssignments(current));
      return undoStack.pop();
    },
    redo(current) {
      if (!redoStack.length) return null;
      undoStack.push(cloneAssignments(current));
      return redoStack.pop();
    },
    clear() { undoStack.length = 0; redoStack.length = 0; },
  };
}
