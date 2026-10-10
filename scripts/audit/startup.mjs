import assert from 'node:assert/strict';
import { createServer, connect } from 'node:net';
import { once } from 'node:events';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { copySource, astro, OUT } from './local-fixture.mjs';

copySource();
const child = await astro(['dev', '--host', '127.0.0.1', '--port', '45124'], { outage: true, name: 'dev-outage' });
const base = 'http://127.0.0.1:45124';
let proxy;
const sockets = new Set();
const evidence = [];
const log = (s) => { evidence.push(s); console.log(s); };
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode != null) throw new Error('Dev server exited before becoming ready');
    try { if ((await fetch(base + '/faqs')).status === 200) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, 'dev starts with unavailable database');
  log('PASS dev server starts with unavailable localhost database; /faqs responds 200.');
  const failure = await fetch(base + '/categories/bouquets'); assert.equal(failure.status, 500);
  log('PASS database-dependent bouquet page fails explicitly, without zero or stale fallback prices.');
  proxy = createServer((socket) => {
    sockets.add(socket); socket.once('close', () => sockets.delete(socket));
    const upstream = connect(55437, '127.0.0.1'); sockets.add(upstream); upstream.once('close', () => sockets.delete(upstream));
    socket.pipe(upstream); upstream.pipe(socket); upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy());
  });
  await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(55438, '127.0.0.1', resolve); });
  const recovery = await fetch(base + '/categories/bouquets'); assert.equal(recovery.status, 200); assert((await recovery.text()).includes('From ₹'));
  log('PASS same running development process recovers when the local database becomes available; rejected price read does not poison later requests.');
} finally {
  for (const socket of sockets) socket.destroy();
  if (proxy) await new Promise((resolve) => proxy.close(resolve));
  const closed = once(child, 'close'); child.kill(); await closed;
  writeFileSync(path.join(OUT, 'startup.log'), evidence.join('\n') + '\n');
}
const build = await astro(['build'], { outage: true, name: 'build-outage' });
const [code] = await once(build, 'close'); assert.notEqual(code, 0);
log('PASS production-mode build refuses an unavailable database instead of publishing fallback prices.');
writeFileSync(path.join(OUT, 'startup.log'), evidence.join('\n') + '\n');
