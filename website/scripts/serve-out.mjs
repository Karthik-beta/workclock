// Serves out/ under /workclock/, as GitHub Pages will. Node built-ins only.
// Usage: node scripts/serve-out.mjs [port]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve('out');
const base = '/workclock';
const port = Number(process.argv[2] ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (pathname === '/' || pathname === base) {
    res.writeHead(302, { Location: `${base}/` }).end();
    return;
  }
  const file = pathname.startsWith(`${base}/`)
    ? path.join(root, pathname.slice(base.length))
    : undefined;
  if (file?.startsWith(root) && existsSync(file)) {
    const target = statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
    if (existsSync(target)) return send(res, 200, target);
  }
  send(res, 404, path.join(root, '404.html'));
}).listen(port, () => console.log(`http://localhost:${port}${base}/`));
