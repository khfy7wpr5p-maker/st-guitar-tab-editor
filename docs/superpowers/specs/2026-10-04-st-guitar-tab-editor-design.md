# ST Guitar TAB Editor — Architecture Design

Date: 2026-10-04
Status: DESIGN REVIEW GATE
Repository: `khfy7wpr5p-maker/st-guitar-tab-editor`

## 1. Product intent

Build a small PC-first teacher authoring tool whose job is deliberately narrow:

`MusicXML score -> teacher assigns guitar string/fret -> Guitar TAB MusicXML -> SesliTab -> Student App`

The editor is not a replacement notation editor and is not an automatic fingering engine. It lets a teacher follow the existing MusicXML notes and rapidly author the intended guitar TAB positions with the keyboard.

## 2. Why this is a separate repository

The existing `musicxml-to-guitar-tab-engine` remains an automatic MusicXML-to-TAB inference/review system. This project must not inherit its renderer reliability or solver complexity.

`st-guitar-tab-editor` therefore has these hard independence rules:

- it must function when the Guitar TAB Engine is unavailable;
- it must never depend on the Guitar TAB Engine to draw six strings;
- alphaTab or another notation renderer must not be semantic authority for authoring;
- the six guitar strings are editor-owned UI primitives and are always present;
- future engine integration may provide optional suggestions only.

## 3. MVP scope

### In scope

- Open supported MusicXML from local PC.
- Parse pitched note events and retain stable source event identity inside the editor session.
- Group 2–6 notes that start at the same musical onset into one vertical event group.
- Always display six fixed guitar strings.
- Assign one `string + fret` position to each pitched note.
- Support simultaneous vertical TAB entry for same-onset groups.
- Validate that the selected string/fret produces the source note pitch under the active tuning/capo configuration.
- Keyboard-first navigation and editing.
- Undo/redo.
- Export a separate Guitar TAB MusicXML artifact carrying the source musical timing/pitch plus MusicXML technical `string` and `fret` data.
- Produce output that can be passed as SesliTab `guitarTabMusicXml` and consumed by Student App.
- Fail closed for malformed XML, unsupported note semantics, impossible positions, duplicate string use inside one simultaneous group, or stale edit identity.

### Out of scope for MVP

- OMR.
- Automatic fingering optimization/solver.
- Editing source pitch, onset, duration, voice, staff, meter, ties, tuplets, beaming, notation spelling, or score structure.
- Creating or deleting musical notes.
- TAB stems, beams, rhythmic flags, dead notes, strumming arrows, chord-name analysis, ornaments, bends, slides, hammer-ons, pull-offs, palm mute, or other guitar techniques.
- Mobile/tablet-first editing.
- Production deployment.
- Direct Student App mutation.
- Dependence on the existing Guitar TAB Engine.

## 4. Authority model

The source MusicXML remains musical authority for:

- pitch;
- onset;
- duration;
- voice/staff identity;
- measure membership;
- simultaneous-note grouping.

The editor is authoritative only for:

- selected guitar string;
- selected fret;
- local edit history before export.

The editor must not silently change source musical facts to make a requested guitar position fit. If string/fret does not match the source pitch, the edit is rejected.

## 5. Data flow

```text
Local MusicXML
    |
    v
Strict XML intake
    |
    v
Source Event Model
    |  pitch/onset/duration/sourceEventId
    v
Simultaneous Event Grouper
    |
    v
TAB Assignment Document
    |  sourceEventId -> { string, fret }
    |
    +--> Fixed Six-String UI
    |
    +--> Position Validator
    |
    +--> Undo/Redo History
    |
    v
Guitar TAB MusicXML Writer
    |
    v
Separate Guitar TAB MusicXML
    |
    v
SesliTab StudentPracticePackageV1.guitarTab
    |
    v
Student App
```

## 6. Internal modules

Proposed module boundaries:

```text
src/
  musicxml/
    intake.js
    sourceEventReader.js
    guitarTabMusicXmlWriter.js
  model/
    sourceEvent.js
    simultaneousGroup.js
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
  main.js
test/
```

These names are design-level guidance, not a requirement to create every file on day one. Implementation should start with the smallest vertical slice and split only when behavior justifies it.

## 7. MusicXML parsing boundary

Use a strict XML parser rather than permissive recovery. `saxes` is the preferred initial parser candidate because its current documentation states that it enforces XML well-formedness more strictly than `sax` and is intended to work in browsers/CommonJS environments.

Parsing rule:

- any XML well-formedness error invalidates the intake;
- do not trust partially emitted parser events after an XML parse error;
- unsupported MusicXML semantics produce an explicit unsupported result instead of guessed authoring state;
- no remote entity/network resolution is permitted.

MVP capability should be declared explicitly rather than pretending to support every MusicXML form.

## 8. Event identity and simultaneous groups

Every editable note receives a deterministic session identity derived from source structure, for example:

`partId + measureIndex + voice + onset + source-order`

The exact identity algorithm will be pinned by tests before UI work. It must remain stable for the unchanged source document during one authoring session.

Notes that share the same supported musical onset become one `SimultaneousGroup`.

Rules:

- group size 1 = ordinary single-note TAB entry;
- group size 2–6 = vertical TAB column;
- group size >6 = unsupported/fail closed for MVP;
- two notes in one group may not occupy the same string;
- every selected string/fret must reproduce its source pitch.

## 9. Fixed six-string UI

The editor owns exactly six visible rows:

```text
e|----------------
B|----------------
G|----------------
D|----------------
A|----------------
E|----------------
```

The existence of these rows is independent of MusicXML renderer output. Loading unusual or partially unsupported MusicXML must never remove or reduce the six editor strings.

Unsupported source content may block editing/export, but it cannot corrupt the basic six-string view.

## 10. PC keyboard contract

Initial keyboard contract:

- `Left / Right`: previous / next event group.
- `Up / Down`: choose guitar string for the active note.
- numeric input `0–20`: enter fret.
- `Tab`: next note inside the same simultaneous group.
- `Shift+Tab`: previous note inside the same simultaneous group.
- `Enter`: validate/save current group and advance.
- `Delete` or `Backspace`: clear current note assignment without changing the source note.
- `Ctrl+Z`: undo.
- `Ctrl+Y` or platform equivalent redo binding: redo.
- `Esc`: cancel current uncommitted edit.

`Space` playback is not an MVP acceptance requirement. It may be added later without changing the authoring authority model.

## 11. Guitar position validation

For standard six-string guitar, default tuning is E2 A2 D3 G3 B3 E4. Tuning must be represented explicitly so alternate tuning can be added later without rewriting event logic.

Validation is deterministic:

`pitch(string open pitch) + fret semitones == source event pitch`

MVP fret range: `0..20` unless implementation evidence shows an existing ST-wide contract that should be reused.

A simultaneous group is valid only if:

- every assigned note matches source pitch;
- each assigned string is unique within the group;
- all strings are 1..6;
- all frets are within the supported range;
- every editable note in the group has a complete assignment before group commit/export.

No nearest-position correction is allowed. Invalid input is rejected; the editor does not guess.

## 12. Export contract

Export produces a new Guitar TAB MusicXML document. The original source MusicXML bytes are never overwritten by the MVP.

For each exported pitched note, technical guitar position is represented with standard MusicXML technical data:

```xml
<notations>
  <technical>
    <string>2</string>
    <fret>3</fret>
  </technical>
</notations>
```

The exported artifact must preserve the supported source event's pitch and timing. String/fret is additional guitar performance information, not permission to rewrite the music.

The artifact is designed to fit the already-existing SesliTab/Student App boundary where `guitarTabMusicXml` is optional MusicXML separate from the main score MusicXML.

## 13. Integration boundary

MVP repository responsibility ends at producing and validating a Guitar TAB MusicXML string/file.

Cross-repository integration is a later gate:

```text
st-guitar-tab-editor
        |
        v
Guitar TAB MusicXML
        |
        v
seslitab-guitar-reader
StudentPracticePackageV1.guitarTab
        |
        v
st-student-app
```

No Student App schema expansion should be required for the first integration attempt because the existing package contract already supports optional Guitar TAB MusicXML. This must still be proven with real cross-repo integration tests before release.

## 14. Failure behavior

Fail closed on at least:

- malformed XML;
- unsupported score representation required for identity/timing;
- missing pitch;
- unpitched/percussion content in the MVP editing path;
- simultaneous group >6 notes;
- duplicate string assignment within one group;
- pitch/string/fret mismatch;
- incomplete assignment at export;
- stale command against an event/group that no longer matches the loaded source session;
- writer output that cannot be reparsed as valid MusicXML.

A failure in parsing or validation must never be converted into a guessed TAB position.

## 15. Test strategy

Implementation is TDD-first in vertical slices.

Minimum evidence before the first merge gate:

1. XML intake tests: valid and malformed XML.
2. Deterministic source-event identity tests.
3. Single-note assignment tests.
4. 2–6 note simultaneous-group tests.
5. Duplicate-string and pitch-mismatch rejection tests.
6. Fixed six-string UI test proving all six rows remain present independent of loaded XML content.
7. Keyboard navigation/edit command tests.
8. Undo/redo tests.
9. MusicXML export tests containing exact technical string/fret fields.
10. Export reparse/round-trip structural test.
11. Browser-level test for the keyboard-first happy path.
12. Regression check proving no runtime dependency on `musicxml-to-guitar-tab-engine`.

## 16. Autonomous execution gates

After this written design is approved and the implementation plan is separately approved, development may proceed autonomously through implementation, tests, CI/Sonar fixes, and PR preparation.

Human approval is still required at these boundaries:

- Gate 1: written architecture/design approval;
- Gate 2: written implementation-plan approval / execution choice;
- Gate 3: merge of the `st-guitar-tab-editor` PR;
- Gate 4: cross-repo SesliTab/Student App merge(s);
- Gate 5: production deployment.

Autonomous work must not merge, deploy, widen the scope, alter Student App contracts, or introduce Guitar TAB Engine dependency without a new human decision.

## 17. MVP acceptance criteria

The MVP architecture is successful when a teacher on PC can:

1. open a supported MusicXML file;
2. see a stable six-string TAB editor;
3. move through source notes/groups using the keyboard;
4. assign valid string/fret positions to single notes and 2–6 simultaneous notes;
5. undo/redo assignments;
6. export a separate valid Guitar TAB MusicXML file;
7. prove that the output retains source pitch/timing plus exact technical string/fret values;
8. pass the output into the existing SesliTab/Student App Guitar TAB MusicXML path in a later integration stage.

## 18. Explicit architectural decision

`st-guitar-tab-editor` is a deterministic teacher-authoring tool, not an automatic TAB engine.

Its core invariant is:

**MusicXML owns the music. The teacher owns string/fret. The editor owns six fixed strings and validation.**
