#!/usr/bin/env node
// Builds and deploys the staging Worker only. Checks the live Cloudflare account,
// the actual Hyperdrive origin and the database's identity before anything is
// deployed. Read-only unless --apply is given. Prints names and IDs, never secrets.
//
//   node scripts/staging/deploy-worker.mjs --env=<file> [--apply] [--secrets] [--skip-build] [--db-id-override=<n>]
//
// --db-id-override deploys a deliberately wrong database identity, to prove the
// Worker refuses it. Deploy again without it afterwards.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { supabasePoolSsl } from "../../src/server/db/postgres/ssl.mjs";
import { PRODUCTION_REF, STAGING_ORIGIN, STAGING_REF, clearInheritedSettings, loadEnvFile, targetFailures } from "./guard.mjs";
import { originFailures, repoFailures, secretNamesToInstall, workerConfigFailures, EXPECTED_SUBDOMAIN, HYPERDRIVE_NAME, PRODUCTION_HYPERDRIVE_NAME, WORKER_NAME, AUTH_ORIGIN } from "./deploy-lib.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.join("=") || true]; }));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(root);
const stop = (title, failures = []) => { console.log(`STOP: ${title}`); failures.forEach((f) => console.log(`  - ${f}`)); process.exit(2); };
const pass = (s) => console.log(`PASS  ${s}`);
const WRANGLER = [path.join(root, "node_modules/wrangler/bin/wrangler.js")];

if (!args.env) stop("usage", ["--env=<file> is required"]);
const inheritedCloudflare = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_API_TOKEN;
if (inheritedCloudflare) stop("inherited Cloudflare settings are present; unset them so the signed-in account is checked");
clearInheritedSettings();
const file = loadEnvFile(args.env);
const targets = targetFailures(file);
if (targets.length) stop("target checks failed; nothing was sent", targets);
pass("credentials come from the named file only and target staging");

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const revision = git("rev-parse", "HEAD");
const repo = repoFailures({ status: git("status", "--porcelain"), envFiles: readdirSync(root).filter((f) => f.startsWith(".env") && f !== ".env.example") });
if (repo.failures.length) stop("working tree", repo.failures);
pass(`source revision ${revision}; tracked files clean; no .env files`);
repo.untracked.forEach((f) => console.log(`INFO  untracked, not part of the Worker: ${f}`));

// Wrangler's own sign-in, so no token is stored or passed around by this script.
const wranglerEnv = () => ({ ...process.env, WRANGLER_SEND_METRICS: "false" });
const wrangler = (argv, opts = {}) => spawnSync(process.execPath, [...WRANGLER, ...argv], { encoding: "utf8", env: { ...wranglerEnv(), ...opts.env }, input: opts.input, cwd: root });
const auth = wrangler(["auth", "token", "--json"]);
let token;
try { token = JSON.parse(auth.stdout).token; } catch { /* reported below */ }
if (auth.status !== 0 || !token) stop("Wrangler is not signed in", ["run: npx wrangler login"]);
const api = async (route, init = {}) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${route}`, { ...init, redirect: "error", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) stop(`Cloudflare API ${init.method ?? "GET"} failed`, [`status ${res.status}`, ...(body.errors ?? []).map((e) => `code ${e.code}`)]);
  return body.result;
};

// Account: the one holding the known workers.dev subdomain and the existing preview.
const accounts = await api("/accounts");
const matching = [];
for (const account of accounts) {
  const sub = await api(`/accounts/${account.id}/workers/subdomain`).catch(() => null);
  if (sub?.subdomain === EXPECTED_SUBDOMAIN) matching.push(account);
}
if (matching.length !== 1) stop("the expected Cloudflare account was not found exactly once", [`${matching.length} accounts have that workers.dev subdomain`]);
const account = matching[0].id;
const scripts = await api(`/accounts/${account}/workers/scripts`);
if (!scripts.some((s) => s.id === "fresh-petals-preview")) stop("this account does not hold the existing preview Worker");
pass(`Cloudflare account verified: workers.dev subdomain ${EXPECTED_SUBDOMAIN}, holds fresh-petals-preview`);

// Hyperdrive: the actual origin, not the name.
const url = new URL(file.values.DATABASE_URL);
const expectedOrigin = { host: url.hostname, port: Number(url.port), database: "postgres", user: `postgres.${STAGING_REF}` };
const configs = await api(`/accounts/${account}/hyperdrive/configs`);
const production = configs.find((c) => c.name === PRODUCTION_HYPERDRIVE_NAME);
let hyperdrive = configs.find((c) => c.name === HYPERDRIVE_NAME);
if (!hyperdrive) {
  if (!args.apply) { console.log(`INFO  ${HYPERDRIVE_NAME} does not exist; --apply would create it`); }
  else {
    const certs = await api(`/accounts/${account}/mtls_certificates`);
    const ca = certs.find((c) => c.name === "fresh-petals-supabase-ca");
    if (!ca) stop("the Supabase CA certificate is not in this account");
    hyperdrive = await api(`/accounts/${account}/hyperdrive/configs`, {
      method: "POST",
      body: JSON.stringify({
        name: HYPERDRIVE_NAME,
        origin: { scheme: "postgres", ...expectedOrigin, password: decodeURIComponent(url.password) },
        caching: { disabled: true },
        mtls: { ca_certificate_id: ca.id, sslmode: "verify-full" },
      }),
    });
    console.log(`INFO  created ${HYPERDRIVE_NAME}`);
  }
}
if (hyperdrive) {
  const live = await api(`/accounts/${account}/hyperdrive/configs/${hyperdrive.id}`);
  const failures = originFailures(live, expectedOrigin, production?.id);
  if (failures.length) stop("Hyperdrive origin", failures);
  hyperdrive = live;
  pass(`${HYPERDRIVE_NAME}: id ${live.id}; origin user is the staging project; session pooler; verify-full; caching off; not ${PRODUCTION_HYPERDRIVE_NAME}`);
}

// The database's identity, read directly through the staging credential.
const client = new pg.Client({ connectionString: file.values.DATABASE_URL, ssl: supabasePoolSsl, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
client.on("error", () => {});
await client.connect();
if (client.connection.stream.authorized !== true) stop("TLS", ["the server certificate was not verified"]);
const dbId = (await client.query("select system_identifier::text id from pg_control_system()")).rows[0].id;
await client.end();
pass("read the staging database's system identifier over verified TLS");

if (!args.skipBuild && !args["skip-build"]) {
  const { SystemRoot, PATH, Path, TEMP, TMP, USERPROFILE, APPDATA, LOCALAPPDATA, HOMEDRIVE, HOMEPATH, ComSpec } = process.env;
  const buildEnv = { SystemRoot, PATH: PATH ?? Path, TEMP, TMP, USERPROFILE, APPDATA, LOCALAPPDATA, HOMEDRIVE, HOMEPATH, ComSpec, DATABASE_URL: file.values.DATABASE_URL, NODE_ENV: "production" };
  const build = spawnSync(process.execPath, ["scripts/cloudflare/build.mjs", "staging"], { encoding: "utf8", env: buildEnv, cwd: root });
  const out = `${build.stdout}${build.stderr}`.split(file.values.DATABASE_URL).join("[redacted]");
  console.log(out.split("\n").filter((l) => /build OK|FAILED|error|Note:|references|analytics/i.test(l)).slice(-25).join("\n"));
  if (build.status !== 0) stop("build failed", [`exit ${build.status}`]);
  pass("staging build and its output checks passed");
}

const WORKER_JSON = "dist/server/wrangler.json";
if (!args.apply) { console.log("Checks passed. No deployment (no --apply)."); process.exit(0); }
if (!hyperdrive) stop("Hyperdrive was not created");

const worker = JSON.parse(readFileSync(WORKER_JSON, "utf8"));
worker.hyperdrive = worker.hyperdrive.map((h) => ({ ...h, id: hyperdrive.id }));
worker.vars = { ...worker.vars, FP_STAGING_DB_ID: args["db-id-override"] ?? dbId, FP_SOURCE_REVISION: revision };
const workerFailures = workerConfigFailures(worker, hyperdrive.id, production?.id);
if (workerFailures.length) stop("built Worker configuration", workerFailures);
writeFileSync(WORKER_JSON, JSON.stringify(worker));
pass(`deploy target verified: ${WORKER_NAME}, workers.dev only, no routes, own Hyperdrive, Images bound`);

const cf = { env: { CLOUDFLARE_ACCOUNT_ID: account } };
const deployed = wrangler(["deploy", "--config", WORKER_JSON, "--message", `staging ${revision}${args["db-id-override"] ? " refusal test" : ""}`], cf);
const output = `${deployed.stdout}${deployed.stderr}`;
if (deployed.status !== 0) stop("wrangler deploy failed", output.split("\n").filter((l) => /error|\[ERROR\]|code:/i.test(l)).slice(0, 8).map((l) => l.slice(0, 200)));
const deployedUrl = output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/)?.[0];
const version = output.match(/Current Version ID:\s*(\S+)/)?.[1];
if (deployedUrl !== AUTH_ORIGIN) stop("the deployed URL is not the configured staging origin");
pass(`deployed ${deployedUrl}, version ${version}`);

if (args.secrets) {
  const values = { SUPABASE_URL: STAGING_ORIGIN, SUPABASE_ANON_KEY: file.values.SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: file.values.SUPABASE_SERVICE_ROLE_KEY };
  for (const name of secretNamesToInstall) {
    const put = wrangler(["secret", "put", name, "--config", WORKER_JSON], { ...cf, input: values[name] });
    if (put.status !== 0) stop("secret installation failed", [name, `exit ${put.status}`]);
    pass(`Worker secret ${name} installed`);
  }
}

// What Cloudflare now reports, independent of the local config.
const settings = await api(`/accounts/${account}/workers/scripts/${WORKER_NAME}/settings`);
const liveBindings = settings.bindings ?? [];
const liveSub = await api(`/accounts/${account}/workers/scripts/${WORKER_NAME}/subdomain`);
const secretNames = liveBindings.filter((b) => b.type === "secret_text").map((b) => b.name).sort();
const liveHyperdrive = liveBindings.find((b) => b.type === "hyperdrive");
const summary = { worker: WORKER_NAME, enabledOnWorkersDev: liveSub.enabled, previewUrls: liveSub.previews_enabled, hyperdriveIsStaging: liveHyperdrive?.id === hyperdrive.id, hyperdriveIsProduction: liveHyperdrive?.id === production?.id, images: liveBindings.some((b) => b.type === "images"), plainVars: liveBindings.filter((b) => b.type === "plain_text").map((b) => b.name).sort(), secretNames, version, revision, productionRefInVars: liveBindings.some((b) => b.type === "plain_text" && String(b.text).includes(PRODUCTION_REF)) };
console.log(JSON.stringify(summary, null, 1));
if (existsSync("dist/server/wrangler.json")) console.log("INFO  wrangler.jsonc was not modified; the IDs exist only in the build output");
