import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.xml':'application/xml; charset=utf-8', '.musicxml':'application/vnd.recordare.musicxml+xml' };

createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const decoded = decodeURIComponent(url.pathname);
    const relative = decoded === '/' ? '/web/index.html' : decoded.endsWith('/') ? `${decoded}index.html` : decoded;
    const target = resolve(root, `.${relative}`);
    if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error('path outside root');
    if (!statSync(target).isFile()) throw new Error('not file');
    res.writeHead(200, { 'content-type': types[extname(target)] || 'application/octet-stream', 'cache-control':'no-store' });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type':'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`ST Guitar TAB Editor: http://127.0.0.1:${port}/web/`));
