// Serves out/ at the site root, as GitHub Pages will. Node built-ins only.
// Usage: node scripts/serve-out.mjs [port]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve('out');
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
  const file = path.join(root, pathname);
  if (file.startsWith(root + path.sep) && existsSync(file)) {
    const target = statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
    if (existsSync(target)) return send(res, 200, target);
  }
  send(res, 404, path.join(root, '404.html'));
}).listen(port, () => console.log(`http://localhost:${port}/`));
