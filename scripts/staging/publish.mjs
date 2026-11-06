// Publishes the staging storefront when the database has changed since the deployed build.
// Run by .github/workflows/staging-publish.yml (on an admin save and on a schedule); runnable
// by hand for tests. It is not, by itself, automatic: the workflow is.
//
//   node scripts/staging/publish.mjs --env=<staging env file> [--db-port=6543] [--force]
//                                    [--ci-token] [--simulate-build-failure] [--out=<result.json>]
//
// 1. Compares the live content fingerprint (database) with the deployed one (/_publish/state.json).
// 2. If they differ (or --force), builds and deploys through deploy-worker.mjs, which checks the
//    target, builds, runs the output checks and only then deploys. A failed build or check
//    deploys nothing, so the previous release keeps serving.
// 3. Waits until the Worker serves the new build's fingerprint, and reports the timings.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { supabasePoolSsl } from "../../src/server/db/postgres/ssl.mjs";
import { FINGERPRINT_SQL } from "../../src/server/services/publishFingerprint.mjs";
import { clearInheritedSettings, loadEnvFile, targetFailures } from "./guard.mjs";
import { AUTH_ORIGIN as WORKER } from "./deploy-lib.mjs";
import { parseArgs } from "./test-lib.mjs";

const args = parseArgs();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const t0 = Date.now();
const secs = () => Math.round((Date.now() - t0) / 1000);
const log = (...a) => console.log(`+${String(secs()).padStart(4)}s`, ...a);
const result = { startedAt: new Date(t0).toISOString(), outcome: "", seconds: {} };
const finish = (outcome, code) => { result.outcome = outcome; result.seconds.total = secs(); log(`RESULT ${outcome}`); if (args.out) writeFileSync(args.out, JSON.stringify(result, null, 1)); process.exit(code); };

if (!args.env) { console.log("usage: --env=<staging env file> is required"); process.exit(2); }
const keepCi = { CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID };
clearInheritedSettings();
const file = loadEnvFile(args.env);
const failures = targetFailures(file);
if (failures.length) { console.log("STOP: target checks failed"); failures.forEach((f) => console.log(`  - ${f}`)); process.exit(2); }
const dbPort = args["db-port"];
if (dbPort !== undefined && !["5432", "6543"].includes(String(dbPort))) { console.log("STOP: --db-port must be 5432 or 6543"); process.exit(2); }
const dbUrl = (() => { const u = new URL(file.values.DATABASE_URL); if (dbPort) u.port = String(dbPort); return u.toString(); })();

const liveFingerprint = async () => {
  const client = new pg.Client({ connectionString: dbUrl, ssl: supabasePoolSsl, statement_timeout: 30000 });
  await client.connect();
  try { return (await client.query(FINGERPRINT_SQL)).rows[0].fingerprint; } finally { await client.end().catch(() => {}); }
};
// `bust` adds a query string; without it this is the address visitors' requests use, so it shows
// when the new build is actually served to them (static files can lag a deploy briefly).
const deployedState = async ({ bust = true } = {}) => {
  const r = await fetch(`${WORKER}/_publish/state.json${bust ? `?t=${Date.now()}` : ""}`, { signal: AbortSignal.timeout(20000) });
  return r.ok ? r.json() : { fingerprint: null, status: r.status };
};

const [live, deployed] = await Promise.all([liveFingerprint(), deployedState()]);
result.live = live; result.deployedBefore = deployed;
log(`live ${live.slice(0, 12)}; deployed ${String(deployed.fingerprint ?? "none").slice(0, 12)} (revision ${String(deployed.revision ?? "").slice(0, 7)})`);
if (live === deployed.fingerprint && !args.force) finish("up to date: nothing to publish", 0);

const deployArgs = [path.join(root, "scripts/staging/deploy-worker.mjs"), `--env=${args.env}`, "--apply", ...(dbPort ? [`--db-port=${dbPort}`] : []), ...(args["ci-token"] ? ["--ci-token"] : []), ...(args["simulate-build-failure"] ? ["--simulate-build-failure"] : [])];
const env = { ...process.env, ...(args["ci-token"] ? keepCi : {}) };
log("building and deploying");
const deploy = spawnSync(process.execPath, deployArgs, { cwd: root, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
const output = `${deploy.stdout}${deploy.stderr}`;
console.log(output.split("\n").filter((l) => /^(PASS|STOP|FAIL|INFO)|\[catalogue\]|build OK|FAILED|version/.test(l)).slice(-30).join("\n"));
result.seconds.buildAndDeploy = secs();
if (deploy.status !== 0) {
  const after = await deployedState().catch(() => ({}));
  result.deployedAfter = after;
  log(`build or deploy failed (exit ${deploy.status}); the Worker still serves ${String(after.fingerprint ?? "?").slice(0, 12)} (revision ${String(after.revision ?? "").slice(0, 7)})`);
  finish(after.fingerprint === deployed.fingerprint ? "failed; previous release still serving" : "failed; served build changed (investigate)", 1);
}
const built = JSON.parse(readFileSync(path.join(root, "dist/client/_publish/state.json"), "utf8"));
result.built = built;
for (const [key, bust] of [["live", true], ["visitors", false]]) {
  for (;;) {
    const now = await deployedState({ bust }).catch(() => ({}));
    if (now.fingerprint === built.fingerprint && now.builtAt === built.builtAt) { result.seconds[key] = secs(); break; }
    if (secs() - result.seconds.buildAndDeploy > 300) finish(`deployed, but the new build was not served ${bust ? "" : "at the plain address "}within 300 s`, 1);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
log(`live: the Worker serves build ${built.fingerprint.slice(0, 12)} from ${built.builtAt} (new address at ${result.seconds.live} s; the plain address visitors use at ${result.seconds.visitors} s)`);
finish(built.fingerprint === live ? "published" : "published (the database changed again during the build; the next check publishes again)", 0);
