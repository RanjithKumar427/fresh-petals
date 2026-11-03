// CI pipeline for the Cloudflare PREVIEW Worker (never production):
//   1. preflight: required secrets present (names only are reported)
//   2. Hyperdrive: reuse config "fresh-petals-db" or create it (TLS verify-full
//      against the repository's Supabase CA, query caching disabled)
//   3. build (scripts/cloudflare/build.mjs preview) and assert the output can
//      only deploy as fresh-petals-preview on workers.dev
//   4. deploy, then functional checks and timed load phases against the URL
//   5. Cloudflare GraphQL analytics per phase (requests, errors, CPU)
// Every run ends with a GitHub check run "Cloudflare preview evidence" on the
// commit (this repository is public: no secret or connection detail is ever
// written there; values are redacted).
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const env = process.env;
const SECRETS = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'DATABASE_URL', 'HYPERDRIVE_ORIGIN_URL'].map((n) => env[n]).filter(Boolean);
const redact = (text) => {
  let out = String(text);
  for (const secret of SECRETS) if (secret.length > 3) out = out.split(secret).join('[redacted]');
  return out.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, 'postgres://[redacted]').replace(/(password|token)=\S+/gi, '$1=[redacted]');
};
const report = { stage: 'preflight', ok: false, lines: [], data: {} };
const say = (line) => { report.lines.push(redact(line)); console.log(redact(line)); };
const W = [process.execPath, 'node_modules/wrangler/bin/wrangler.js'];
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: { ...env, WRANGLER_SEND_METRICS: 'false', ...opts.env }, input: opts.input });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (r.status !== 0) throw new Error(`${opts.label ?? args.slice(0, 2).join(' ')} failed (exit ${r.status}):\n${output.split('\n').slice(-25).join('\n')}`);
  return output;
};
const api = async (path, init = {}) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...init, headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json', ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(`Cloudflare API ${init.method ?? 'GET'} ${path.replace(env.CLOUDFLARE_ACCOUNT_ID, '<account>')} → ${res.status}: ${JSON.stringify(body.errors ?? body).slice(0, 400)}`);
  return body;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureHyperdrive() {
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  if (env.HYPERDRIVE_ID) { say('Hyperdrive: using the HYPERDRIVE_ID repository variable.'); return env.HYPERDRIVE_ID; }
  const configs = (await api(`/accounts/${account}/hyperdrive/configs`)).result ?? [];
  const existing = configs.find((c) => c.name === 'fresh-petals-db');
  if (existing) { say('Hyperdrive: reusing existing config "fresh-petals-db" (not modified).'); return existing.id; }
  // Origin: a session connection (Hyperdrive pools itself). Prefer the
  // dedicated secret; else the build's pooler URL moved from transaction (6543)
  // to session mode (5432) on the same Supabase pooler host.
  let origin = env.HYPERDRIVE_ORIGIN_URL;
  if (!origin) {
    const url = new URL(env.DATABASE_URL);
    if (url.port === '6543') url.port = '5432';
    origin = url.toString();
    say('Hyperdrive origin: DATABASE_URL in session mode (port 5432); set HYPERDRIVE_ORIGIN_URL to override.');
  }
  if (!/hjhmetomcaskrrwkgrbp/.test(origin)) throw new Error('Hyperdrive origin is not project hjhmetomcaskrrwkgrbp; refusing.');
  const certs = (await api(`/accounts/${account}/mtls_certificates`)).result ?? [];
  let ca = certs.find((c) => c.name === 'fresh-petals-supabase-ca');
  if (!ca) {
    run(W[0], [W[1], 'cert', 'upload', 'certificate-authority', '--ca-cert', 'src/server/db/postgres/supabase-ca.pem', '--name', 'fresh-petals-supabase-ca'], { label: 'wrangler cert upload' });
    ca = ((await api(`/accounts/${account}/mtls_certificates`)).result ?? []).find((c) => c.name === 'fresh-petals-supabase-ca');
    if (!ca) throw new Error('CA certificate upload did not appear in the certificate list.');
    say('Uploaded the Supabase CA certificate (name fresh-petals-supabase-ca).');
  }
  run(W[0], [W[1], 'hyperdrive', 'create', 'fresh-petals-db', `--connection-string=${origin}`, '--caching-disabled', '--sslmode', 'verify-full', '--ca-certificate-id', ca.id], { label: 'wrangler hyperdrive create' });
  const created = ((await api(`/accounts/${account}/hyperdrive/configs`)).result ?? []).find((c) => c.name === 'fresh-petals-db');
  if (!created) throw new Error('Hyperdrive config was not found after creation.');
  say('Hyperdrive: created "fresh-petals-db" (caching disabled, sslmode verify-full).');
  return created.id;
}

async function checks(base) {
  const results = [];
  const check = async (name, path, expect, init) => {
    try {
      const res = await fetch(base + path, { redirect: 'manual', ...init });
      const body = /text|xml|json/.test(res.headers.get('content-type') ?? '') ? await res.text() : (await res.arrayBuffer(), '');
      const problem = expect(res, body);
      results.push({ name, path, status: res.status, ok: !problem, problem: problem || '' });
      return { res, body };
    } catch (error) { results.push({ name, path, status: 0, ok: false, problem: String(error.message) }); return {}; }
  };
  const robots = (res) => (/noindex/.test(res.headers.get('x-robots-tag') ?? '') ? '' : 'missing noindex');
  const page = (res, body) => robots(res) || (res.status !== 200 ? `status ${res.status}` : '') || (/<link rel="canonical" href="https:\/\/onlyfreshpetals\.in/.test(body) ? '' : 'canonical not on onlyfreshpetals.in') || (/var measurementId = "G-/.test(body) ? 'analytics ID present' : '');
  await check('home (on demand)', '/', page);
  await check('static page', '/faqs', page);
  await check('bouquet list', '/categories/bouquets', page);
  await check('product (static)', '/products/red-affair', page);
  await check('occasion', '/occasions/birthday', page);
  await check('city', '/locations/hyderabad', page);
  await check('city shop page 2', '/locations/hyderabad/shop?page=2', page);
  const garlands = await check('garlands (live DB)', '/categories/garlands', page);
  await check('filter link → fragment', '/categories/bouquets?occasion=birthday', (r) => (r.status === 301 && /#/.test(r.headers.get('location') ?? '') ? '' : `status ${r.status} location ${r.headers.get('location')}`));
  await check('legacy /studio', '/studio', (r) => (r.status === 301 ? '' : `status ${r.status}`));
  await check('trailing slash', '/faqs/', (r) => ([301, 307, 308].includes(r.status) && /\/faqs$/.test(r.headers.get('location') ?? '') ? '' : `status ${r.status}`));
  await check('unknown path', '/no-such-page-preview-check', (r) => (r.status === 404 ? '' : `status ${r.status}`));
  await check('sitemap', '/sitemap.xml', (r, b) => (r.status === 200 && b.includes('https://onlyfreshpetals.in/') ? '' : `status ${r.status}`));
  await check('garland sitemap (live)', '/sitemap-garlands.xml', (r) => (r.status === 200 ? '' : `status ${r.status}`));
  await check('robots.txt', '/robots.txt', (r) => (r.status === 200 ? '' : `status ${r.status}`));
  await check('admin refused on preview', '/admin/login', (r) => (r.status === 403 ? '' : `status ${r.status}`));
  await check('admin API refused', '/api/admin/products', (r) => (r.status === 403 ? '' : `status ${r.status}`));
  await check('enquiry log refused', '/api/inquiries', (r) => (r.status === 403 ? '' : `status ${r.status}`), { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: '{}' });
  await check('image endpoint rejects other hosts', '/_image?href=https%3A%2F%2Fexample.com%2Fa.jpg&w=480&q=75&f=webp', (r) => (r.status === 404 ? '' : `status ${r.status}`));
  // Every distinct stored photo on the garland page, one width each: the
  // original from Storage (status, type, signature) next to the resized
  // response, so a missing source is told apart from a resizing fault.
  const imagePaths = [...new Set([...(garlands.body ?? '').matchAll(/\/_image\?href=[^"\s,]+/g)].map((m) => m[0].replaceAll('&amp;', '&')))];
  const byHref = new Map();
  for (const p of imagePaths) { const href = new URL(p, base).searchParams.get('href'); if (!byHref.has(href)) byHref.set(href, p); }
  report.data.images = [];
  let img = null;
  for (const [href, p] of [...byHref].slice(0, 12)) {
    const row = { source: href.replace(/^.*\/media\//, 'media/'), resized: p.replace(/^.*?&/, '&') };
    try {
      const src = await fetch(href);
      const bytes = new Uint8Array(await src.arrayBuffer());
      row.sourceStatus = src.status; row.sourceType = src.headers.get('content-type'); row.sourceBytes = bytes.length;
      row.sourceSignature = [...bytes.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('');
      if (!src.ok) row.sourceBody = new TextDecoder().decode(bytes.slice(0, 160));
    } catch (error) { row.sourceStatus = 0; row.sourceBody = error.message; }
    try {
      const res = await fetch(base + p);
      row.status = res.status; row.type = res.headers.get('content-type');
      const body = new Uint8Array(await res.arrayBuffer());
      row.bytes = body.length;
      if (!res.ok) row.body = new TextDecoder().decode(body.slice(0, 160));
    } catch (error) { row.status = 0; row.body = error.message; }
    report.data.images.push(row);
    if (!img && row.status === 200) img = [p];
  }
  const sourced = report.data.images.filter((r) => r.sourceStatus === 200);
  const resized = sourced.filter((r) => r.status === 200 && /image\/webp/.test(r.type ?? ''));
  const broken = report.data.images.filter((r) => r.sourceStatus === 200 && r.status !== 200);
  if (!report.data.images.length) results.push({ name: 'stored photo resized by Images binding', path: '-', status: 0, ok: true, problem: 'not exercised: no stored (uploaded) garland photo is public' });
  else results.push({ name: 'stored photos resized by Images binding', path: `${report.data.images.length} sources`, status: broken.length ? 500 : 200, ok: broken.length === 0 && resized.length > 0, problem: `${resized.length}/${sourced.length} available sources resized; ${report.data.images.length - sourced.length} source(s) unavailable in Storage` });
  if (!img && imagePaths.length) img = [imagePaths[0]];
  return { results, imagePath: img?.[0]?.replaceAll('&amp;', '&') };
}

async function phases(base, imagePath) {
  const rnd = () => Math.random().toString(36).slice(2, 8);
  const list = [
    ['first requests (cold isolates, all routes)', ['/', '/categories/bouquets', '/locations/hyderabad', '/occasions', '/categories/garlands'], 1],
    ['/ (home)', ['/'], 25],
    ['/categories/bouquets', ['/categories/bouquets'], 25],
    ['/locations/hyderabad', ['/locations/hyderabad'], 25],
    ['/locations/hyderabad/shop?page=2', ['/locations/hyderabad/shop?page=2'], 25],
    ['/occasions', ['/occasions'], 25],
    ['/occasions/birthday', ['/occasions/birthday'], 25],
    ['/categories/garlands', ['/categories/garlands'], 25],
    ['tracking-parameter variants of /occasions/birthday', Array.from({ length: 25 }, () => `/occasions/birthday?utm_source=${rnd()}`), 1],
    ['filter-query variants (301)', Array.from({ length: 25 }, () => `/categories/bouquets?occasion=${rnd()}`), 1],
    ['unknown paths (404)', Array.from({ length: 25 }, () => `/x-${rnd()}`), 1],
    ['static pages (assets, no Worker)', Array.from({ length: 25 }, () => '/faqs'), 1],
  ];
  if (imagePath) list.push(['stored photo /_image', [imagePath], 10]);
  const out = [];
  for (const [name, paths, repeat] of list) {
    await sleep(20_000); // separate the phases in the analytics windows
    const start = new Date(); let errors = 0; let n = 0; const wall = [];
    for (let i = 0; i < repeat; i++) for (const p of paths) {
      const t = performance.now();
      const r = await fetch(base + p, { redirect: 'manual' }).catch(() => null);
      wall.push(performance.now() - t); n++;
      if (!r || r.status >= 500) errors++;
      if (r) await r.arrayBuffer();
    }
    const end = new Date();
    wall.sort((a, b) => a - b);
    out.push({ name, sent: n, http5xx: errors, wallMedianMs: Math.round(wall[Math.floor(wall.length / 2)]), start: start.toISOString(), end: new Date(end.getTime() + 2000).toISOString() });
  }
  return out;
}

async function analytics(windows) {
  const query = `query($a:String!,$s:String!,$from:Time!,$to:Time!){viewer{accounts(filter:{accountTag:$a}){workersInvocationsAdaptive(limit:50,filter:{scriptName:$s,datetime_geq:$from,datetime_leq:$to}){sum{requests errors subrequests}quantiles{cpuTimeP50 cpuTimeP90 cpuTimeP99}dimensions{status}}}}}`;
  const rows = [];
  for (const w of windows) {
    try {
      const res = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables: { a: env.CLOUDFLARE_ACCOUNT_ID, s: 'fresh-petals-preview', from: w.start, to: w.end } }) });
      const body = await res.json();
      if (body.errors?.length) { rows.push({ ...w, analytics: `error: ${redact(body.errors[0].message)}` }); continue; }
      const groups = body.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
      const requests = groups.reduce((a, g) => a + g.sum.requests, 0);
      const cfErrors = groups.reduce((a, g) => a + g.sum.errors, 0);
      const subrequests = groups.reduce((a, g) => a + g.sum.subrequests, 0);
      const weighted = (k) => (requests ? Math.round(groups.reduce((a, g) => a + g.quantiles[k] * g.sum.requests, 0) / requests) : null);
      rows.push({ ...w, workerRequests: requests, workerErrors: cfErrors, subrequests, statuses: groups.map((g) => `${g.dimensions.status}:${g.sum.requests}`).join(' '), cpuP50us: weighted('cpuTimeP50'), cpuP90us: Math.max(0, ...groups.map((g) => g.quantiles.cpuTimeP90)), cpuP99us: Math.max(0, ...groups.map((g) => g.quantiles.cpuTimeP99)) });
    } catch (error) { rows.push({ ...w, analytics: `error: ${redact(error.message)}` }); }
  }
  return rows;
}

async function publish() {
  const ok = report.ok;
  const md = [`Stage reached: **${report.stage}** — ${ok ? 'completed' : 'FAILED'}`, '', ...report.lines.map((l) => (l.includes('\n') ? '```\n' + l + '\n```' : `- ${l}`))];
  if (report.data.url) md.push('', `Preview: ${report.data.url}`);
  if (report.data.checks) md.push('', '| check | path | status | result |', '|---|---|---|---|', ...report.data.checks.map((c) => `| ${c.name} | \`${c.path.slice(0, 60)}\` | ${c.status} | ${c.ok ? 'ok' : 'FAIL'} ${c.problem} |`));
  if (report.data.images?.length) md.push('', 'Stored photos (original from Supabase Storage vs /_image):', '', '| source | source status | source type | bytes | signature | source error | resized status | resized type | resized error |', '|---|---|---|---|---|---|---|---|---|', ...report.data.images.map((r) => `| ${r.source} | ${r.sourceStatus} | ${r.sourceType ?? ''} | ${r.sourceBytes ?? ''} | ${r.sourceSignature ?? ''} | ${(r.sourceBody ?? '').replace(/[|\n]/g, ' ')} | ${r.status} | ${r.type ?? ''} | ${(r.body ?? '').replace(/[|\n]/g, ' ')} |`));
  if (report.data.metrics) md.push('', 'Cloudflare analytics (workersInvocationsAdaptive; CPU in microseconds as reported; P90/P99 are the maximum over status groups):', '', '| phase | sent | 5xx seen | Worker requests | Worker errors | subrequests | CPU P50 | CPU P90 | CPU P99 | statuses | wall median ms |', '|---|---|---|---|---|---|---|---|---|---|---|', ...report.data.metrics.map((m) => `| ${m.name} | ${m.sent} | ${m.http5xx} | ${m.workerRequests ?? '-'} | ${m.workerErrors ?? '-'} | ${m.subrequests ?? '-'} | ${m.cpuP50us ?? '-'} | ${m.cpuP90us ?? '-'} | ${m.cpuP99us ?? '-'} | ${m.statuses ?? m.analytics ?? ''} | ${m.wallMedianMs} |`));
  const summary = redact(md.join('\n')).slice(0, 60000);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary + '\n');
  writeFileSync('preview-evidence.json', redact(JSON.stringify(report, null, 1)));
  if (env.GITHUB_TOKEN && env.GITHUB_REPOSITORY && env.GITHUB_SHA) {
    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/check-runs`, { method: 'POST', headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' }, body: JSON.stringify({ name: 'Cloudflare preview evidence', head_sha: env.GITHUB_SHA, status: 'completed', conclusion: ok ? 'success' : 'failure', output: { title: ok ? `Preview deployed: ${report.data.url ?? ''}` : `Failed at ${report.stage}`, summary } }) });
    if (!res.ok) console.log(`check run not created: ${res.status}`);
  }
}

try {
  if (env.PREVIEW_URL) {
    // Re-check an already deployed preview (or a local `wrangler dev` preview): checks only, plus
    // load phases and analytics when MEASURE=1 and Cloudflare credentials are present.
    report.data.url = env.PREVIEW_URL.replace(/\/$/, '');
    report.stage = 'checks';
    const { results, imagePath } = await checks(report.data.url);
    report.data.checks = results;
    const failed = results.filter((r) => !r.ok);
    say(`Functional checks: ${results.length - failed.length}/${results.length} passed.`);
    if (env.MEASURE === '1') {
      report.stage = 'load';
      const windows = await phases(report.data.url, imagePath);
      if (env.CLOUDFLARE_API_TOKEN) { report.stage = 'analytics'; await sleep(240_000); report.data.metrics = await analytics(windows); } else report.data.metrics = windows;
    }
    report.stage = 'done';
    report.ok = failed.length === 0;
    throw null;
  }
  const missing = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'DATABASE_URL'].filter((n) => !env[n]);
  if (missing.length) throw new Error(`Missing repository secrets: ${missing.join(', ')}. Add them under Settings → Secrets and variables → Actions.`);
  say('Secrets present: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, DATABASE_URL.');
  report.stage = 'token';
  const verify = await api('/user/tokens/verify').catch(() => api(`/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/tokens/verify`));
  say(`API token status: ${verify.result?.status ?? 'unknown'}.`);
  report.stage = 'hyperdrive';
  const id = await ensureHyperdrive();
  const config = readFileSync('wrangler.jsonc', 'utf8');
  writeFileSync('wrangler.jsonc', config.replaceAll('REPLACE_WITH_HYPERDRIVE_ID', id)); // runner checkout only, never committed
  report.stage = 'build';
  run(process.execPath, ['scripts/cloudflare/build.mjs', 'preview'], { label: 'preview build' });
  const worker = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
  const guard = [worker.name !== 'fresh-petals-preview' && `name is ${worker.name}`, worker.workers_dev !== true && 'workers_dev is not true', (worker.routes?.length || worker.route) && 'routes are set', worker.vars?.FP_DEPLOY_ENV !== 'preview' && 'FP_DEPLOY_ENV is not preview'].filter(Boolean);
  if (guard.length) throw new Error(`Refusing to deploy: the build is not a preview-only Worker (${guard.join('; ')}).`);
  say(`Build OK; deploy target verified: Worker fresh-petals-preview, workers.dev only, no routes, FP_DEPLOY_ENV=preview, commit ${env.GITHUB_SHA ?? 'local'}.`);
  report.stage = 'deploy';
  const deployed = run(W[0], [W[1], 'deploy', '--config', 'dist/server/wrangler.json', '--message', `preview ${env.GITHUB_SHA ?? ''}`.trim()], { label: 'wrangler deploy' });
  const url = deployed.match(/https:\/\/fresh-petals-preview\.[a-z0-9-]+\.workers\.dev/)?.[0];
  if (!url) throw new Error(`Deployed, but no workers.dev URL in the output:\n${deployed.split('\n').slice(-15).join('\n')}`);
  report.data.url = url;
  say(`Deployed version: ${deployed.match(/Current Version ID:\s*(\S+)/)?.[1] ?? 'see deploy output'}.`);
  report.stage = 'checks';
  for (let i = 0; i < 12; i++) { const r = await fetch(url + '/faqs').catch(() => null); if (r?.ok) break; await sleep(5000); }
  const { results, imagePath } = await checks(url);
  report.data.checks = results;
  const failed = results.filter((r) => !r.ok);
  say(`Functional checks: ${results.length - failed.length}/${results.length} passed.`);
  report.stage = 'load';
  const windows = await phases(url, imagePath);
  report.stage = 'analytics';
  say('Waiting 4 minutes for Cloudflare analytics ingestion.');
  await sleep(240_000);
  report.data.metrics = await analytics(windows);
  report.stage = 'done';
  report.ok = failed.length === 0;
} catch (error) {
  if (error !== null) say(`ERROR at ${report.stage}: ${error.message}`);
} finally {
  await publish();
  process.exit(report.ok ? 0 : 1);
}
