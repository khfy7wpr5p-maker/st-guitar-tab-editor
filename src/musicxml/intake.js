import { XmlParseError, childText, children, firstChild, parseXml } from './xml.js';

function partNameMap(root) {
  const list = firstChild(root, 'part-list');
  const names = new Map();
  if (!list) return names;
  for (const scorePart of children(list, 'score-part')) {
    const partId = scorePart.attributes.id ?? '';
    if (!partId) continue;
    names.set(partId, childText(scorePart, 'part-name') || partId);
  }
  return names;
}

function inspectPart(part, names) {
  const partId = part.attributes.id ?? '';
  let pitchedCount = 0;
  let unpitchedCount = 0;
  for (const measure of children(part, 'measure')) {
    for (const note of children(measure, 'note')) {
      if (firstChild(note, 'pitch')) pitchedCount += 1;
      if (firstChild(note, 'unpitched')) unpitchedCount += 1;
    }
  }
  return {
    partId,
    partName: names.get(partId) ?? partId,
    pitchedCount,
    unpitchedCount,
  };
}

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

  const partNodes = children(root, 'part');
  if (partNodes.length === 0) {
    return { ok: false, code: 'NO_PARTS', message: 'No score parts found.' };
  }
  const names = partNameMap(root);
  const parts = partNodes.map((part) => inspectPart(part, names));
  const pitched = parts.reduce((sum, part) => sum + part.pitchedCount, 0);
  const unpitched = parts.reduce((sum, part) => sum + part.unpitchedCount, 0);

  if (pitched === 0 && unpitched > 0) {
    return { ok: false, code: 'UNSUPPORTED_UNPITCHED', message: 'Unpitched/percussion content is unsupported.' };
  }
  if (pitched === 0) {
    return { ok: false, code: 'NO_PITCHED_NOTES', message: 'No pitched notes found.' };
  }

  return {
    ok: true,
    rootName: 'score-partwise',
    parts,
    requiresPartSelection: parts.length > 1,
  };
}
