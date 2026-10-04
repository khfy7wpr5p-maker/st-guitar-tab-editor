import assert from 'node:assert/strict';
import { test } from 'node:test';

async function api() {
  try { return await import('../src/ui/fixedSixStringView.js'); } catch { return {}; }
}

test('always creates exactly six fixed guitar rows', async () => {
  const { createFixedSixStringRows } = await api();
  assert.equal(typeof createFixedSixStringRows, 'function');
  const rows = createFixedSixStringRows();
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((r) => [r.string, r.label]), [[1,'e'],[2,'B'],[3,'G'],[4,'D'],[5,'A'],[6,'E']]);
});

test('six rows remain present for no-source and error states', async () => {
  const { createEditorViewState } = await import('../src/ui/editorViewModel.js').catch(() => ({}));
  assert.equal(typeof createEditorViewState, 'function');
  assert.equal(createEditorViewState({ status: 'EMPTY' }).rows.length, 6);
  assert.equal(createEditorViewState({ status: 'ERROR', error: 'INVALID_XML' }).rows.length, 6);
});
