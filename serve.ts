// serve.ts — a tiny static server for local testing only (not graded).
// Serves ./game on 127.0.0.1, correct MIME types, and refuses any path
// that climbs out of the game directory.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(join(fileURLToPath(new URL('.', import.meta.url)), 'game'));
const port = Number(process.argv[2]?.replace('--port=', '')) || Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const decoded = decodeURIComponent(url.pathname);
  const target = resolve(join(root, decoded === '/' ? 'index.html' : decoded));
  if (!target.startsWith(root + '/') && target !== root) {
    response.writeHead(403, { 'content-type': 'text/plain' });
    response.end('forbidden\n');
    return;
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found\n');
    return;
  }
  const type = MIME[extname(target).toLowerCase()] ?? 'application/octet-stream';
  response.writeHead(200, { 'content-type': type });
  response.end(readFileSync(target));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Starfall Keep dev server: http://127.0.0.1:${port}/`);
});
