import { createFixedSixStringRows } from './fixedSixStringView.js';

export function createEditorViewState({ status = 'EMPTY', error = null, activeString = 1, placements = [] } = {}) {
  return Object.freeze({
    status,
    error,
    rows: createFixedSixStringRows({ activeString, placements }),
  });
}
