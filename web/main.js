import { createSourceSession } from '../src/model/sourceSession.js';
import { createTabAssignmentDocument } from '../src/model/tabAssignmentDocument.js';
import { createKeyboardController } from '../src/editor/keyboardController.js';
import { createFixedSixStringRows } from '../src/ui/fixedSixStringView.js';
import { serializeGuitarTabMusicXml } from '../src/musicxml/guitarTabMusicXmlWriter.js';

const fileInput = document.querySelector('#musicxml-file');
const editor = document.querySelector('#tab-editor');
const rowHost = document.querySelector('#tab-rows');
const status = document.querySelector('#status');
const positionStatus = document.querySelector('#position-status');
const exportButton = document.querySelector('#export-button');

let session = null;
let tabDocument = null;
let keyboard = null;

function currentPlacements() {
  if (!session || !keyboard || !tabDocument) return [];
  const state = keyboard.getState();
  const group = session.groups[state.groupIndex];
  return group.sourceEventIds.map((id) => {
    const assignment = tabDocument.getAssignment(id);
    return assignment ? { sourceEventId: id, ...assignment } : null;
  }).filter(Boolean);
}

function render() {
  const state = keyboard?.getState() ?? { groupIndex: 0, noteIndex: 0, selectedString: 1, fretBuffer: '' };
  const rows = createFixedSixStringRows({ activeString: state.selectedString, placements: currentPlacements() });
  rowHost.replaceChildren(...rows.map((row) => {
    const el = document.createElement('div');
    el.className = `tab-row${row.active ? ' active' : ''}`;
    el.dataset.string = String(row.string);
    el.innerHTML = `<span>${row.label}</span><span class="tab-line">${row.fret === null ? '' : `<span class="tab-fret">${row.fret}</span>`}</span>`;
    return el;
  }));
  const groupCount = session?.groups.length ?? 0;
  const noteCount = session && groupCount ? session.groups[state.groupIndex].sourceEventIds.length : 0;
  positionStatus.textContent = `Grup ${groupCount ? state.groupIndex + 1 : '—'}/${groupCount || '—'} · Nota ${noteCount ? state.noteIndex + 1 : '—'}/${noteCount || '—'} · Tel ${state.selectedString} · Perde ${state.fretBuffer || '—'}`;
  exportButton.disabled = !tabDocument?.canExport();
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const xml = await file.text();
    session = createSourceSession(xml);
    tabDocument = createTabAssignmentDocument(session);
    keyboard = createKeyboardController({ sourceSession: session, document: tabDocument });
    status.textContent = `${session.events.length} nota yüklendi.`;
    editor.focus();
  } catch (error) {
    session = null; tabDocument = null; keyboard = null;
    status.textContent = `Açılamadı: ${error.message}`;
  }
  render();
});

exportButton.addEventListener('click', () => {
  if (!session || !tabDocument?.canExport()) return;
  const xml = serializeGuitarTabMusicXml({ sourceSession: session, document: tabDocument });
  const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'guitar-tab.musicxml';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
});

editor.addEventListener('keydown', (event) => {
  if (!keyboard) return;
  const handled = ['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Delete','Backspace','Escape'].includes(event.key) || /^[0-9]$/.test(event.key) || event.ctrlKey;
  if (!handled) return;
  event.preventDefault();
  try { keyboard.handleKey(event); status.textContent = 'Hazır.'; }
  catch (error) { status.textContent = error.message; }
  render();
});

render();
