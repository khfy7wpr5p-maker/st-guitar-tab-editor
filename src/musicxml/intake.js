import { XmlParseError, children, firstChild, parseXml } from './xml.js';

export function inspectMusicXml(xmlText) {
  let root;
  try {
    root = parseXml(xmlText);
  } catch (error) {
    if (error instanceof XmlParseError) return { ok: false, code: 'INVALID_XML', message: error.message };
    throw error;
  }
  if (root.name !== 'score-partwise') {
    return { ok: false, code: 'UNSUPPORTED_ROOT', message: 'Only score-partwise MusicXML is supported.' };
  }
  const parts = children(root, 'part');
  if (parts.length !== 1) {
    return { ok: false, code: 'UNSUPPORTED_MULTIPART', message: 'MVP requires exactly one part.' };
  }
  let pitched = 0;
  let unpitched = 0;
  for (const measure of children(parts[0], 'measure')) {
    for (const note of children(measure, 'note')) {
      if (firstChild(note, 'pitch')) pitched += 1;
      if (firstChild(note, 'unpitched')) unpitched += 1;
    }
  }
  if (pitched === 0 && unpitched > 0) {
    return { ok: false, code: 'UNSUPPORTED_UNPITCHED', message: 'Unpitched/percussion content is unsupported.' };
  }
  if (pitched === 0) {
    return { ok: false, code: 'NO_PITCHED_NOTES', message: 'No pitched notes found.' };
  }
  return { ok: true, rootName: 'score-partwise' };
}
