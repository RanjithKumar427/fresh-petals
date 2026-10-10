// Serves only the isolated Vercel build, using its actual fetch handler.
import { createServer } from 'node:http';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { COPY, PORT, env } from './local-fixture.mjs';

export async function serveBuild() {
  Object.assign(process.env, env);
  const output = path.join(COPY, '.vercel/output');
  const functions = path.join(output, 'functions');
  function find(dir) {
    if (existsSync(path.join(dir, '.vc-config.json'))) return dir;
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) { const match = find(full); if (match) return match; }
    }
  }
  const dir = find(functions);
  const config = JSON.parse(readFileSync(path.join(dir, '.vc-config.json'), 'utf8'));
  const entry = (await import(pathToFileURL(path.join(dir, config.handler)).href)).default;
  if (typeof entry.fetch !== 'function') throw new Error('Expected Vercel fetch handler');
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const staticRoot = path.join(output, 'static');
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const full = path.resolve(staticRoot, '.' + decodeURIComponent(url.pathname));
      const candidate = [full, path.join(full, 'index.html'), full + '.html'].find((file) => file.startsWith(staticRoot + path.sep) && existsSync(file) && statSync(file).isFile());
      if (candidate && req.method === 'GET') {
        res.setHeader('content-type', mime[path.extname(candidate)] ?? 'application/octet-stream'); res.end(readFileSync(candidate)); return;
      }
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const response = await entry.fetch(new Request(url, { method: req.method, headers: req.headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks), duplex: 'half' } : {}) }));
      res.statusCode = response.status;
      for (const [name, value] of response.headers) if (name !== 'set-cookie') res.setHeader(name, value);
      const cookies = response.headers.getSetCookie(); if (cookies.length) res.setHeader('set-cookie', cookies);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { console.error(error); res.statusCode = 500; res.end(String(error)); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
  return server;
}
