import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('apps/extension/dist');
const runtime = await readFile(new URL('./demo-runtime.js', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Cache-Control', 'no-store');
  if (pathname === '/demo-runtime.js') { res.writeHead(200, { 'Content-Type': types['.js'] }); res.end(runtime); return; }
  const file = resolve(root, '.' + pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    let body = await readFile(file);
    if (extname(file) === '.html') body = body.toString().replace('<head>', '<head><script src="/demo-runtime.js"></script>');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404).end('Build the extension first: npm run build -w @better-cover/extension'); }
});
server.listen(4174, '127.0.0.1', () => console.log('Better Cover sample preview: http://127.0.0.1:4174 (no live authentication or AI calls)'));
