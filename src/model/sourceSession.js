import { readSourceEvents } from '../musicxml/sourceEventReader.js';

function deterministicFingerprint(text) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < text.length; index += 1) {
    const unit = BigInt(text.charCodeAt(index));
    hash ^= unit & 0xffn;
    hash = BigInt.asUintN(64, hash * prime);
    hash ^= (unit >> 8n) & 0xffn;
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

function targetFingerprint(targetSelection) {
  if (targetSelection === null) return null;
  return deterministicFingerprint([
    targetSelection.partId,
    targetSelection.partIndex,
    targetSelection.staff,
    targetSelection.voice,
  ].join('\u0000'));
}

export function createSourceSession(xmlText, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Source session options must be an object.');
  }
  if (Object.hasOwn(options, 'guitarOctaveTransposition')) {
    throw new Error('UNSUPPORTED_PITCH_POLICY: guitarOctaveTransposition cannot override source MusicXML transpose semantics.');
  }
  const { targetSelection = null } = options;
  const parsed = readSourceEvents(xmlText, { targetSelection });
  const sourceFingerprint = deterministicFingerprint(xmlText);
  const target = parsed.targetSelection;
  const selectionFingerprint = targetFingerprint(target);
  return {
    sessionId: selectionFingerprint === null
      ? `source:${sourceFingerprint}`
      : `source:${sourceFingerprint}:target:${selectionFingerprint}`,
    sourceFingerprint,
    sourceXml: xmlText,
    ...parsed,
  };
}
