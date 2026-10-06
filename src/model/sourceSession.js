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

export function createSourceSession(xmlText, options = {}) {
  const parsed = readSourceEvents(xmlText, options);
  const sourceFingerprint = deterministicFingerprint(xmlText);
  const partSuffix = parsed.partCount > 1 ? `:part:${parsed.selectedPartId}` : '';
  return {
    sessionId: `source:${sourceFingerprint}${partSuffix}`,
    sourceFingerprint,
    sourceXml: xmlText,
    ...parsed,
  };
}
