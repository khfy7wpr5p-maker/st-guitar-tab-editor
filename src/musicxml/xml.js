const NAME_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const MAX_XML_CHARS = 4 * 1024 * 1024;

export class XmlParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'XmlParseError';
  }
}

function decodeEntities(text) {
  const entityPattern = /&(#x[0-9A-Fa-f]+|#\d+|amp|lt|gt|quot|apos);/g;
  if (text.replace(entityPattern, '').includes('&')) {
    throw new XmlParseError('Undefined or malformed XML entity.');
  }
  return text.replace(entityPattern, (_, entity) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    if (entity === 'apos') return "'";
    const codePoint = entity.startsWith('#x')
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    if (!Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
      throw new XmlParseError('Invalid numeric entity.');
    }
    return String.fromCodePoint(codePoint);
  });
}

function parseAttributes(raw) {
  const attrs = Object.create(null);
  let rest = raw.trim();
  while (rest) {
    const match = /^([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*("[^"]*"|'[^']*')\s*/.exec(rest);
    if (!match) throw new XmlParseError('Malformed XML attribute.');
    const name = match[1];
    if (Object.hasOwn(attrs, name)) throw new XmlParseError(`Duplicate XML attribute: ${name}`);
    attrs[name] = decodeEntities(match[2].slice(1, -1));
    rest = rest.slice(match[0].length);
  }
  return attrs;
}

export function parseXml(xmlText) {
  if (typeof xmlText !== 'string' || xmlText.length === 0) throw new XmlParseError('XML must be a non-empty string.');
  if (xmlText.length > MAX_XML_CHARS) throw new XmlParseError('XML input is too large.');
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(xmlText)) throw new XmlParseError('DTD, ENTITY and CDATA are unsupported.');

  const document = { name: '#document', attributes: Object.create(null), children: [], text: '' };
  const stack = [document];
  let index = 0;
  while (index < xmlText.length) {
    const lt = xmlText.indexOf('<', index);
    if (lt < 0) {
      const tail = xmlText.slice(index);
      if (tail.trim()) stack.at(-1).text += decodeEntities(tail);
      break;
    }
    const text = xmlText.slice(index, lt);
    if (text) stack.at(-1).text += decodeEntities(text);
    if (xmlText.startsWith('<!--', lt)) {
      const end = xmlText.indexOf('-->', lt + 4);
      if (end < 0) throw new XmlParseError('Unclosed XML comment.');
      index = end + 3;
      continue;
    }
    if (xmlText.startsWith('<?', lt)) {
      const end = xmlText.indexOf('?>', lt + 2);
      if (end < 0) throw new XmlParseError('Unclosed processing instruction.');
      index = end + 2;
      continue;
    }
    const gt = xmlText.indexOf('>', lt + 1);
    if (gt < 0) throw new XmlParseError('Unclosed XML tag.');
    const body = xmlText.slice(lt + 1, gt).trim();
    if (!body || body.startsWith('!')) throw new XmlParseError('Unsupported XML markup.');

    if (body.startsWith('/')) {
      const name = body.slice(1).trim();
      if (!NAME_RE.test(name) || stack.length === 1 || stack.at(-1).name !== name) {
        throw new XmlParseError(`Mismatched XML closing tag: ${name}`);
      }
      stack.pop();
      index = gt + 1;
      continue;
    }

    const selfClosing = body.endsWith('/');
    const openBody = selfClosing ? body.slice(0, -1).trim() : body;
    const space = openBody.search(/\s/);
    const name = space < 0 ? openBody : openBody.slice(0, space);
    const attrRaw = space < 0 ? '' : openBody.slice(space + 1);
    if (!NAME_RE.test(name)) throw new XmlParseError(`Invalid XML tag name: ${name}`);
    const node = { name, attributes: parseAttributes(attrRaw), children: [], text: '' };
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
    index = gt + 1;
  }
  if (stack.length !== 1) throw new XmlParseError(`Unclosed XML tag: ${stack.at(-1).name}`);
  const roots = document.children.filter((node) => node.name !== '#text');
  if (roots.length !== 1) throw new XmlParseError('XML must have exactly one root element.');
  return roots[0];
}

export function children(node, name) {
  return node.children.filter((child) => child.name === name);
}

export function firstChild(node, name) {
  return node.children.find((child) => child.name === name) ?? null;
}

export function childText(node, name) {
  const child = firstChild(node, name);
  return child ? child.text.trim() : null;
}
