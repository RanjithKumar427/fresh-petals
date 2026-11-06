// What bot-like and crawler traffic costs on the deployed staging Worker: Worker
// requests and CPU, and database queries and result bytes through Hyperdrive,
// per traffic pattern. GET requests only, to the staging Worker only; it reads
// Cloudflare's GraphQL analytics afterwards (read-only).
//
//   node scripts/staging/traffic-cost.mjs [--n=25] [--out=<results.json>] [--account=<id>]
//
// Analytics token: CLOUDFLARE_API_TOKEN, or wrangler's own login. It is never printed.
//
// Each phase sends requests of one shape. The storefront is prebuilt, so a page
// (with any query string) is a static file and should cost no Worker request
// and no database read; an address with no file costs one Worker request
// answered statically; stored photos cost one Worker request each (/_image) and
// one Storage read per photo per data centre. "incident replay" sends the
// October 2026 crawl pattern (distinct filter-chip URLs) 8 at a time; "sitemap"
// fetches every sitemap URL once (a full search-engine crawl).
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { AUTH_ORIGIN as WORKER, WORKER_NAME, HYPERDRIVE_NAME } from "./deploy-lib.mjs";
import { parseArgs } from "./test-lib.mjs";

const args = parseArgs();
const N = Math.max(5, Math.min(100, Number(args.n ?? 25)));
const tag = () => randomBytes(5).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function token() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const file = `${process.env.APPDATA ?? `${process.env.HOME}/.config`}/xdg.config/.wrangler/config/default.toml`;
  const found = /oauth_token\s*=\s*"([^"]+)"/.exec(readFileSync(file, "utf8"))?.[1];
  if (!found) throw new Error("no Cloudflare token: set CLOUDFLARE_API_TOKEN or run wrangler login");
  return found;
}
const cf = async (path, init = {}) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...init, headers: { authorization: `Bearer ${token()}`, "content-type": "application/json", ...init.headers } });
  return r.json();
};

const get = async (path) => {
  if (!path.startsWith("/")) throw new Error("path only");
  const t0 = Date.now();
  const r = await fetch(WORKER + path, { redirect: "manual", headers: { "user-agent": "fp-staging-traffic-cost" }, signal: AbortSignal.timeout(30000) });
  const bytes = (await r.arrayBuffer()).byteLength;
  return { status: r.status, cache: r.headers.get("x-fp-edge-cache") ?? "", bytes, ms: Date.now() - t0 };
};

async function sitemapUrls() {
  const seen = new Set();
  const index = await (await fetch(`${WORKER}/sitemap-index.xml`)).text();
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  for (const map of maps.length ? maps : ["/sitemap.xml"]) {
    const xml = await (await fetch(WORKER + map)).text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = new URL(m[1]);
      if (!/\.(jpe?g|png|webp|gif|svg)$/i.test(u.pathname)) seen.add(u.pathname + u.search);
    }
  }
  return [...seen];
}

const city = (await sitemapUrls()).find((p) => /^\/locations\/[a-z-]+$/.test(p)) ?? "/locations/chennai";
// Stored garland photos as a visitor's browser asks for them (the 480 px candidate of each card).
const photos = [...new Set([...(await (await fetch(`${WORKER}/categories/garlands`)).text()).matchAll(/\/_image\?href=[^"\s,]+w=480[^"\s,]*/g)].map((m) => m[0].replaceAll("&amp;", "&")))];
const phases = [
  // Bot-invented variations of real pages: each is the page's own static file (no Worker run).
  { name: "home ?unknown", path: () => `/?ref_${tag()}=1` },
  { name: "garland list ?unknown", path: () => `/categories/garlands?x=${tag()}` },
  { name: "occasion ?unknown", path: () => `/occasions/wedding?x=${tag()}` },
  { name: "city ?unknown", path: () => `${city}?x=${tag()}` },
  { name: "city shop ?page=<invented>", path: () => `${city}/shop?page=${tag()}&collection=${tag()}` },
  { name: "bouquets old filter link", path: () => `/categories/bouquets?colour=${tag()}` },
  // Addresses with no file: answered by the Worker's static fallback (no database).
  { name: "product invented slug", path: () => `/products/zz-${tag()}` },
  { name: "random 404 path", path: () => `/zz-${tag()}` },
  { name: "city other spelling", path: () => `/locations/Bangalore?x=${tag()}` },
  // Photos through the Worker's resizer: first request per data centre fetches the original once.
  { name: "garland photos, distinct", urls: photos.slice(0, N) },
  { name: "garland photos, repeat", urls: photos.slice(0, N) },
  // The scheduled publishing check's live side.
  { name: "publish state check", urls: Array.from({ length: 5 }, () => "/api/publish/state") },
  // The October incident replayed: a burst of distinct filter-chip URLs, 8 at a time.
  { name: "incident replay (filter URLs)", urls: Array.from({ length: 8 * N }, () => `/categories/bouquets?occasion=${tag()}&colour=${tag()}&budget=${tag()}`), concurrency: 8 },
  { name: "sitemap crawl", urls: await sitemapUrls() },
];

const results = [];
for (const phase of phases) {
  const urls = phase.urls ?? Array.from({ length: N }, phase.path);
  const start = new Date();
  const statuses = {};
  const cache = {};
  let bytes = 0;
  const step = phase.concurrency ?? 4;
  for (let i = 0; i < urls.length; i += step) {
    const batch = await Promise.all(urls.slice(i, i + step).map(get));
    for (const r of batch) { statuses[r.status] = (statuses[r.status] ?? 0) + 1; cache[r.cache || "-"] = (cache[r.cache || "-"] ?? 0) + 1; bytes += r.bytes; }
  }
  const end = new Date();
  results.push({ name: phase.name, sent: urls.length, start: start.toISOString(), end: end.toISOString(), statuses, cache, htmlBytes: bytes });
  console.log(`${phase.name.padEnd(26)} sent ${String(urls.length).padStart(3)} ${JSON.stringify(statuses)} ${JSON.stringify(cache)}`);
  await sleep(4000);
}

const account = args.account ?? (await cf("/accounts")).result?.[0]?.id;
const hyperdriveId = (await cf(`/accounts/${account}/hyperdrive/configs`)).result?.find((c) => c.name === HYPERDRIVE_NAME)?.id;
console.log("waiting 180 s for analytics to arrive");
await sleep(180000);

const gql = async (query, variables) => (await cf("/graphql", { method: "POST", body: JSON.stringify({ query, variables }) }));
const W = `query ($a: String!, $s: Time!, $e: Time!, $w: String!) { viewer { accounts(filter: { accountTag: $a }) {
  workersInvocationsAdaptive(limit: 10, filter: { datetime_geq: $s, datetime_leq: $e, scriptName: $w }) { sum { requests errors subrequests } quantiles { cpuTimeP50 cpuTimeP90 cpuTimeP99 } max { cpuTime } dimensions { status } } } } }`;
const H = `query ($a: String!, $s: Time!, $e: Time!, $h: String!) { viewer { accounts(filter: { accountTag: $a }) {
  hyperdriveQueriesAdaptiveGroups(limit: 10, filter: { datetime_geq: $s, datetime_leq: $e, configId: $h }) { count sum { queryBytes resultBytes } } } } }`;

const ms = (us) => (us == null ? null : Math.round(us / 100) / 10);
for (const r of results) {
  const v = { a: account, s: r.start, e: new Date(Date.parse(r.end) + 1000).toISOString() };
  const w = (await gql(W, { ...v, w: WORKER_NAME })).data?.viewer.accounts[0]?.workersInvocationsAdaptive ?? [];
  const h = (await gql(H, { ...v, h: hyperdriveId })).data?.viewer.accounts[0]?.hyperdriveQueriesAdaptiveGroups ?? [];
  const requests = w.reduce((s, x) => s + x.sum.requests, 0);
  const main = w.sort((x, y) => y.sum.requests - x.sum.requests)[0];
  r.worker = { requests, errors: w.reduce((s, x) => s + x.sum.errors, 0), statuses: w.map((x) => `${x.dimensions.status}:${x.sum.requests}`), cpuMsP50: ms(main?.quantiles.cpuTimeP50), cpuMsP90: ms(main?.quantiles.cpuTimeP90), cpuMsP99: ms(main?.quantiles.cpuTimeP99), cpuMsMax: ms(main?.max.cpuTime) };
  const queries = h.reduce((s, x) => s + x.count, 0);
  const resultBytes = h.reduce((s, x) => s + x.sum.resultBytes, 0);
  r.database = { queries, resultBytes, queriesPerRequest: Math.round((queries / r.sent) * 10) / 10, resultKBPerRequest: Math.round(resultBytes / r.sent / 100) / 10 };
  console.log(`${r.name.padEnd(26)} worker ${requests} req, cpu p50 ${r.worker.cpuMsP50} p90 ${r.worker.cpuMsP90} max ${r.worker.cpuMsMax} ms | db ${queries} queries, ${Math.round(resultBytes / 1024)} KB (${r.database.resultKBPerRequest} KB/request)`);
}
if (args.out) writeFileSync(args.out, JSON.stringify({ worker: WORKER, n: N, at: new Date().toISOString(), results }, null, 2));
