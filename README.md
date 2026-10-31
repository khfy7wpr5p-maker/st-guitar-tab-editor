# st-guitar-tab-editor

PC-first, keyboard-first teacher authoring tool for assigning exact six-string guitar TAB positions to notes already present in MusicXML.

## Current architecture

`MusicXML score -> teacher string/fret assignments -> separate Guitar TAB MusicXML -> SesliTab -> Student App`

The source MusicXML remains authoritative for note identity, written pitch, and timing. The teacher owns exact string/fret assignments; the editor owns validation, assignment/history state, and its fixed six-string UI. The editor does not rewrite source notes to force a TAB position.

## Current implemented boundaries

- Strict `score-partwise` MusicXML intake; unsupported structures fail closed.
- Default intake targets one pitched part. Explicit target selection supports selecting a part, staff, and voice in multipart source files.
- One to six simultaneous pitched notes are supported per onset group.
- Source-aware pitch validation applies explicit MusicXML `<transpose>` once; `clef-octave-change` does not add a hidden second octave shift.
- Tuplet `time-modification` ratios and tuplet start/stop notation are preserved by the editor MusicXML path.
- Standard tuning E2 A2 D3 G3 B3 E4; supported frets 0–20.
- Keyboard navigation/editing with undo and redo.
- Separate two-staff Guitar TAB MusicXML export carries exact `<technical><string>` and `<fret>` values.
- A browser-consumable runtime is built from the editor core; no network, persistence, or publication authority is added to that core.
- No runtime dependency on `musicxml-to-guitar-tab-engine` or alphaTab.

## SesliTab / Student App handoff

The exported file is the optional Guitar TAB companion to the original score. SesliTab owns downstream SCORE binding and package validation, and must preserve the teacher's string/fret choices. The editor's local source fingerprint is not a delivery trust authority.

## Development

```bash
npm install
npm test
npm run test:browser
npm start
```

The browser acceptance test covers the keyboard-first load/edit/undo/redo/export path.

## Architecture sync

Verified against `main@9d6532001c54a06dcc9b0a5db1db1a641d2fe1aa` on 2026-10-31. The initial one-part/no-tuplet MVP limits have since been extended as described above. This does not prove that the current SesliTab Reader consumes or has re-qualified this exact Editor revision.