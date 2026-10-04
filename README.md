# st-guitar-tab-editor

PC-first, keyboard-first teacher authoring tool for assigning exact six-string guitar TAB positions to notes that already exist in MusicXML.

## MVP flow

`MusicXML score -> teacher string/fret assignments -> separate Guitar TAB MusicXML -> SesliTab -> Student App`

The source MusicXML remains the musical authority for pitch and timing. The editor owns only string/fret assignments and always renders six fixed guitar strings independently of any notation renderer.

## Current MVP boundaries

- `score-partwise` MusicXML with exactly one pitched part.
- Standard external MusicXML DOCTYPE declarations are accepted without network/DTD resolution; internal subsets/entities fail closed.
- Single notes and 2–6 simultaneous notes.
- Standard tuning E2 A2 D3 G3 B3 E4.
- Frets 0–20.
- Keyboard navigation/editing with undo/redo.
- Separate two-staff Guitar TAB MusicXML export with exact `<technical><string>...<fret>...` data.
- Unsupported or malformed source content fails closed; the editor never changes source pitch/rhythm to fit a TAB position.
- No runtime dependency on `musicxml-to-guitar-tab-engine` or alphaTab.

## SesliTab / Student App handoff

The exported file is designed for the existing separate optional Guitar TAB payload. SesliTab should pass the generated XML as `guitarTabMusicXml` / `StudentPracticePackageV1.guitarTab` while keeping the original score MusicXML as the score authority.

Cross-repository wiring is intentionally outside this repository's first merge gate.

## Development

```bash
npm install
npm test
npm run test:browser
npm start
```

The browser acceptance test uses Chromium and validates the keyboard-first load/edit/undo/redo/export path.
