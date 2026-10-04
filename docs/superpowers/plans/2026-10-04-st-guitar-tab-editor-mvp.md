# ST Guitar TAB Editor MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PC-first independent TAB editor that reads supported MusicXML, lets a teacher assign exact guitar string/fret positions to source notes and 2–6-note simultaneous groups, and exports Student-App-compatible Guitar TAB MusicXML.

**Architecture:** The source MusicXML owns pitch and timing; the teacher-authored document owns only string/fret assignments. The browser UI always owns six fixed guitar-string rows and never depends on `musicxml-to-guitar-tab-engine` or alphaTab. A strict MusicXML intake builds deterministic source events, validation checks string/fret against source pitch, and a writer produces a separate Guitar TAB MusicXML artifact for the existing SesliTab/Student App boundary.

**Tech Stack:** JavaScript ESM, Node.js >=18, bounded internal strict XML intake for offline/browser use, vanilla HTML/CSS/JS, Node `node:test`, Playwright Test 1.63.0 for Chromium browser acceptance. No frontend framework and no alphaTab dependency in MVP.

**Spec:** `docs/superpowers/specs/2026-10-04-st-guitar-tab-editor-design.md`

## Global Constraints

- Repository: `khfy7wpr5p-maker/st-guitar-tab-editor` only until the cross-repo integration gate.
- The six TAB strings are editor-owned fixed UI primitives and must remain visible regardless of MusicXML renderability.
- No runtime dependency on `musicxml-to-guitar-tab-engine`.
- Source MusicXML remains authority for pitch, onset, duration, voice/staff identity, measure membership and grouping.
- Teacher authority is limited to `string + fret`; invalid assignments fail closed.
- MVP supports `score-partwise` MusicXML with exactly one pitched part; multipart, `score-timewise`, unpitched/percussion and unsupported timing semantics fail closed with an explicit capability result.
- Standard external MusicXML DOCTYPE declarations may be accepted without resolving external DTDs or network resources; internal subsets/entities fail closed.
- 1 note at an onset is a single event group; 2–6 supported pitched notes at the same onset are one vertical group; >6 fails closed.
- Default tuning is E2 A2 D3 G3 B3 E4; fret range is 0..20.
- No source-note creation/deletion or source pitch/rhythm/voice/staff/meter/tie mutation.
- No TAB beams/stems authoring UI, dead notes, strumming arrows, guitar techniques, mobile-first editing or production deploy.
- Original MusicXML bytes are never overwritten.
- Implementation is TDD-first; every task ends green before the next task begins.
- Merge, deploy, cross-repo writes, credentials and production configuration remain human gates.

## Review Focus

1. **Polyphonic source timing:** `backup`, `forward` and `<chord/>` combinations must produce deterministic onsets or fail closed; no guessed ordering.
2. **Accidentals and enharmonic spelling:** validation must compare sounding MIDI pitch while export preserves source `step/alter/octave` spelling.
3. **Ties:** source tie start/stop may be preserved in export, but teacher assignment is per source note event; the editor must not silently merge or rewrite tie chains.
4. **Unsupported MusicXML:** `score-timewise`, multiple parts, unpitched notes, tuplets/time-modification, malformed XML and unsafe DTD/entity constructs must return explicit unsupported/invalid results without corrupting the six-string UI.
5. **Stale editing state:** loading a new source invalidates prior event IDs/history; commands from the previous source session must be rejected.

---

## File Structure

```text
package.json
playwright.config.js
scripts/
  serve.js
src/
  musicxml/
    intake.js
    sourceEventReader.js
    guitarTabMusicXmlWriter.js
  model/
    sourceSession.js
    tabAssignmentDocument.js
  guitar/
    tuning.js
    positionValidator.js
  editor/
    commands.js
    history.js
    keyboardController.js
  ui/
    fixedSixStringView.js
    editorViewModel.js
  index.js
web/
  index.html
  app.css
  main.js
test/
  fixtures/
  intake.test.js
  sourceEventReader.test.js
  tabAssignmentDocument.test.js
  positionValidator.test.js
  keyboardController.test.js
  guitarTabMusicXmlWriter.test.js
  fixedSixStringView.test.js
browser-tests/
  editor-happy-path.spec.js
.github/workflows/
  ci.yml
```

## Task 1: Project foundation + strict XML intake

**Files:**
- Create: `package.json`
- Create: `src/musicxml/intake.js`
- Create: `src/index.js`
- Create: `test/intake.test.js`
- Create: `test/fixtures/minimal-valid.musicxml`

**Interfaces:**
- Produces: `inspectMusicXml(xmlText) -> { ok: true, rootName: 'score-partwise' } | { ok: false, code, message }`
- Later tasks may consume only `ok === true` documents.

- [ ] **Step 1: Write failing intake tests** for valid `score-partwise`, malformed XML, `score-timewise`, multiple `<part>` elements, and unpitched-only content capability rejection.
- [ ] **Step 2: Run `node --test test/intake.test.js`** and confirm RED because `inspectMusicXml` does not exist.
- [ ] **Step 3: Add minimal ESM package setup** with Node >=18 and test script; implement a bounded internal strict `inspectMusicXml` intake with explicit error codes, no external entity resolution, and safe handling of standard external MusicXML DOCTYPE declarations.
- [ ] **Step 4: Run `node --test test/intake.test.js`** and require PASS.
- [ ] **Step 5: Commit** foundation + intake as one coherent slice.

## Task 2: Deterministic source-event timeline and simultaneous groups

**Files:**
- Create: `src/musicxml/sourceEventReader.js`
- Create: `src/model/sourceSession.js`
- Create: `test/sourceEventReader.test.js`
- Add fixtures under: `test/fixtures/`

**Interfaces:**
- Consumes: `inspectMusicXml(xmlText)` from Task 1.
- Produces: `createSourceSession(xmlText) -> { sessionId, sourceFingerprint, measures, events, groups, divisionsByMeasure }`.
- Each pitched event exposes `sourceEventId`, `measureIndex`, `voice`, `staff`, `onsetDivisions`, `durationDivisions`, `pitch { step, alter, octave, midi }`, note type/dots, tie flags and `groupId`.
- Each group exposes ordered `sourceEventIds` and size 1..6.

- [ ] **Step 1: Write failing tests** for deterministic IDs, `<chord/>`, `backup`, `forward`, rests, multiple voices, accidentals, 2–6 simultaneous notes, >6 rejection, tuplets/time-modification rejection and identical-input determinism.
- [ ] **Step 2: Run `node --test test/sourceEventReader.test.js`** and confirm RED.
- [ ] **Step 3: Implement `createSourceSession(xmlText)`** using exact MusicXML time movement; group pitched notes by measure + onset, retain source pitch spelling, and generate a source fingerprint/session identity.
- [ ] **Step 4: Run Task 1–2 tests** and require PASS.
- [ ] **Step 5: Commit** the source-session slice.

## Task 3: Guitar tuning, exact position validation, assignments and history

**Files:**
- Create: `src/guitar/tuning.js`
- Create: `src/guitar/positionValidator.js`
- Create: `src/model/tabAssignmentDocument.js`
- Create: `src/editor/commands.js`
- Create: `src/editor/history.js`
- Create: `test/positionValidator.test.js`
- Create: `test/tabAssignmentDocument.test.js`

**Interfaces:**
- Produces: `STANDARD_TUNING`, `positionToMidi({ string, fret, tuning })`, `validatePositionForEvent(event, position, tuning)`.
- Produces: `createTabAssignmentDocument(sourceSession, options?)` with immutable source binding, current assignments and history.
- Command surface: `assignPosition(sourceEventId, { string, fret })`, `clearPosition(sourceEventId)`, `undo()`, `redo()`, `canExport()`.

- [ ] **Step 1: Write failing tests** for exact pitch match, open strings, fret 20, out-of-range fret/string, wrong-pitch rejection, duplicate string in one group, incomplete group, stale sourceEventId, undo/redo and history invalidation after a new source session.
- [ ] **Step 2: Run focused Task 3 tests** and confirm RED.
- [ ] **Step 3: Implement tuning + validator + document commands** without nearest-position guessing.
- [ ] **Step 4: Run Task 1–3 tests** and require PASS.
- [ ] **Step 5: Commit** the authoring-core slice.

## Task 4: Fixed six-string UI + keyboard-first editing

**Files:**
- Create: `src/ui/fixedSixStringView.js`
- Create: `src/ui/editorViewModel.js`
- Create: `src/editor/keyboardController.js`
- Create: `web/index.html`
- Create: `web/app.css`
- Create: `web/main.js`
- Create: `test/fixedSixStringView.test.js`
- Create: `test/keyboardController.test.js`

**Interfaces:**
- Consumes: source session + assignment document from Tasks 2–3.
- Produces: fixed rows keyed by guitar strings 1..6, active group/note state and keyboard command translation.
- Keyboard contract: Left/Right group navigation, Up/Down string choice, numeric 0..20 fret entry, Tab/Shift+Tab intra-group navigation, Enter validate+advance, Delete/Backspace clear, Ctrl+Z undo, Ctrl+Y redo, Esc cancel.

- [ ] **Step 1: Write failing UI/controller tests** proving six rows always exist before load, after valid load, and after unsupported/malformed load; pin all keyboard shortcuts and 2–6-note vertical group navigation.
- [ ] **Step 2: Run focused UI/controller tests** and confirm RED.
- [ ] **Step 3: Implement the static PC-first editor UI** with no notation renderer dependency and no mouse-only required action.
- [ ] **Step 4: Run Task 1–4 tests** and require PASS.
- [ ] **Step 5: Commit** the first usable editor slice.

## Task 5: Student-App-compatible Guitar TAB MusicXML writer

**Files:**
- Create: `src/musicxml/guitarTabMusicXmlWriter.js`
- Create: `test/guitarTabMusicXmlWriter.test.js`
- Add export fixtures under: `test/fixtures/`

**Interfaces:**
- Consumes: `sourceSession` + complete `tabAssignmentDocument`.
- Produces: `serializeGuitarTabMusicXml({ sourceSession, document }) -> string`.

**Output contract:**
- fresh `score-partwise` Guitar TAB artifact, never source overwrite;
- one Guitar part with a proven two-staff compatibility shape: standard notation mirror on staff 1 and six-line TAB on staff 2;
- staff 2 has `TAB` clef, `staff-lines=6`, standard tuning metadata and technical `<string>/<fret>` on each pitched TAB note;
- source pitch spelling and supported duration/onset/voice/tie facts are preserved;
- same-onset notes are emitted with correct MusicXML simultaneity semantics;
- TAB staff does not require beam elements; timing remains encoded by duration/onset;
- output reparses through Task 1 intake.

- [ ] **Step 1: Write failing writer tests** for single note, 2–6-note group, accidental preservation, multi-voice timing, rests/gaps, ties, exact string/fret technical nodes, six staff lines and incomplete-assignment rejection.
- [ ] **Step 2: Run writer tests** and confirm RED.
- [ ] **Step 3: Implement `serializeGuitarTabMusicXml`** as a deterministic writer independent of Guitar TAB Engine code/runtime.
- [ ] **Step 4: Reparse every generated fixture with `inspectMusicXml`** and require PASS.
- [ ] **Step 5: Run all Node tests** and require PASS.
- [ ] **Step 6: Commit** the export slice.

## Task 6: Real browser happy path and file export

**Files:**
- Create: `scripts/serve.js`
- Create: `playwright.config.js`
- Create: `browser-tests/editor-happy-path.spec.js`
- Modify: `web/main.js`
- Modify: `package.json`

**Interfaces:**
- User flow: open local MusicXML -> fixed six-string UI -> keyboard assign single/group positions -> undo/redo -> export `.musicxml` file.

- [ ] **Step 1: Add Playwright 1.63.0 and static server configuration**; use Chromium for the MVP gate.
- [ ] **Step 2: Write a failing browser test** that loads a fixture through the file-input path, asserts exactly six string rows, enters a single note and a multi-note vertical group by keyboard, undoes/redoes one assignment and exports MusicXML containing expected technical string/fret values.
- [ ] **Step 3: Run `npx playwright test browser-tests/editor-happy-path.spec.js`** and confirm RED before wiring the missing browser flow.
- [ ] **Step 4: Implement the minimum browser wiring and download/export path**; do not add playback or renderer dependencies.
- [ ] **Step 5: Run browser test and all Node tests** and require PASS.
- [ ] **Step 6: Commit** browser acceptance slice.

## Task 7: Compatibility regression fixture for SesliTab / Student App boundary

**Files:**
- Create: `test/studentAppCompatibility.test.js`
- Create: `test/fixtures/student-app-compat.musicxml`
- Modify: `README.md`

**Interfaces:**
- Consumes: exported MusicXML from Task 5.
- Produces: a pinned compatibility artifact whose shape matches the already-existing Student App expectation: valid MusicXML, TAB clef, six lines, technical string/fret and deterministic timing.

- [ ] **Step 1: Write failing compatibility assertions** against the generated artifact: `score-partwise`, `staves=2`, TAB clef, six staff lines, exact technical fields and no dependency/import/reference to `musicxml-to-guitar-tab-engine`.
- [ ] **Step 2: Run the focused compatibility test** and confirm RED if the artifact/README contract is absent.
- [ ] **Step 3: Add the deterministic compatibility fixture and document the later cross-repo handoff** as `guitarTabMusicXml`; do not modify SesliTab or Student App in this task.
- [ ] **Step 4: Run the complete local verification** and require PASS.
- [ ] **Step 5: Commit** the compatibility-contract slice.

## Task 8: CI, exact-head verification and merge-gate handoff

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`
- Add only minimal Sonar configuration if the repository is already connected to an existing Sonar project without creating/rotating credentials; otherwise record Sonar as an external provisioning gap.

**Interfaces:**
- Produces: exact-head evidence for Node tests + Chromium browser test + dependency/forbidden-import scan.

- [ ] **Step 1: Add GitHub Actions** for Node 18/20/22 unit tests and one Node 22 Chromium browser job.
- [ ] **Step 2: Add a forbidden-dependency check** that fails if production code imports/requires `musicxml-to-guitar-tab-engine` or alphaTab.
- [ ] **Step 3: Run local `npm test` and browser acceptance** and require PASS.
- [ ] **Step 4: Open/update the implementation PR and inspect exact-head CI**; fix only in-scope failures with TDD.
- [ ] **Step 5: If Sonar is already available, require exact-head Quality Gate evidence; if it is not provisioned, report that limitation without creating secrets, billing or production credentials.**
- [ ] **Step 6: Perform whole-branch scope/diff review**: no cross-repo writes, no deploy, no source MusicXML overwrite, no renderer/engine dependency.
- [ ] **Step 7: Stop at Human Gate 3** and report PR URL, exact head SHA, tests/CI evidence, Sonar state, limitations and next cross-repo integration step. Do not merge.

## Acceptance Matrix

- Supported MusicXML opens -> Tasks 1–2 + browser test.
- Six strings never disappear -> Task 4 + browser test.
- Single notes and 2–6 simultaneous notes accept exact string/fret -> Tasks 2–4.
- Invalid or impossible position never mutates source -> Task 3.
- Keyboard-first PC workflow -> Task 4 + Task 6.
- Undo/redo -> Tasks 3–4 + browser test.
- Separate Guitar TAB MusicXML export -> Task 5.
- Six-line TAB + technical string/fret + source timing/pitch preservation -> Task 5.
- Existing SesliTab/Student App contract target is documented and fixture-pinned -> Task 7.
- No Guitar TAB Engine/alphaTab dependency -> Tasks 4, 5 and 8.
- Malformed/unsupported/stale cases fail closed -> Tasks 1–3.
- No merge/deploy/cross-repo mutation before human gate -> Task 8.

## Execution Gate

After this plan is explicitly approved, execution may proceed autonomously task-by-task through Task 8 using the selected execution method. Implementation must stop before merge. Cross-repo SesliTab/Student App integration is a separate post-merge plan/gate.