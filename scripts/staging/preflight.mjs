#!/usr/bin/env node
// Staging-only gate for `scripts/migrate-postgres.mjs`. Read-only unless --apply is
// given and every check passes; it never resets or removes anything.
//
//   node scripts/staging/preflight.mjs --env=<file> --dashboard-password-min=<n> [--apply]
//
// The minimum password length is not readable with project keys, so the value
// must be read from the dashboard and stated here. Do not use restore-rehearsal.sh.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { supabasePoolSsl } from "../../src/server/db/postgres/ssl.mjs";
import { STAGING_ORIGIN, clearInheritedSettings, emptinessFailures, loadEnvFile, migrationSource, settingFailures, targetFailures } from "./guard.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.join("=") || true]; }));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const stop = (title, failures) => { console.log(`STOP: ${title}`); for (const f of failures) console.log(`  - ${f}`); process.exit(2); };

if (!args.env) stop("usage", ["--env=<file> is required"]);
clearInheritedSettings();
const file = loadEnvFile(args.env);
const targets = targetFailures(file);
if (targets.length) stop("target checks failed; nothing was sent", targets);
console.log("PASS  file targets the staging origin and Session pooler");

const source = migrationSource(root);
if (source.failures.length) stop("migration source", source.failures);
console.log(`PASS  ${source.entries.length} migrations match Git byte for byte, newest ${source.entries.at(-1).tag}`);

const client = new pg.Client({ connectionString: file.values.DATABASE_URL, ssl: supabasePoolSsl, connectionTimeoutMillis: 10000, query_timeout: 15000, statement_timeout: 10000 });
client.on("error", () => {});
let state;
try {
  await client.connect();
  if (client.connection.stream.authorized !== true) stop("TLS", ["the server certificate was not verified"]);
  console.log("PASS  TLS verified against the repository CA, with hostname checking");
  await client.query("BEGIN READ ONLY");
  const one = async (sql) => (await client.query(sql)).rows[0];
  state = await one(`select
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S','f'))
    + (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
    + (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e') "publicObjects",
    to_regnamespace('drizzle') is not null "drizzleSchema", to_regnamespace('supabase_migrations') is not null "supabaseLedger"`);
  const objects = state.publicObjects > 0 ? (await client.query(`select c.relkind k, c.relname n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' order by 1,2 limit 50`)).rows : [];
  state.defaultAcls = (await client.query(`select pg_get_userbyid(d.defaclrole) owner, d.defaclobjtype "type", d.defaclacl::text acl from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='public'`)).rows;
  await client.query("ROLLBACK");
  const empty = emptinessFailures(state);
  if (empty.length) stop("staging is not empty; nothing was changed", [...empty, ...objects.map((o) => `object ${o.k} ${o.n}`)]);
  console.log("PASS  no application objects or migration history");
} catch (e) {
  stop("database check", [`failed with code ${/^[0-9A-Z_]{1,40}$/.test(String(e?.code)) ? e.code : "unknown"}`]);
} finally {
  await client.end().catch(() => {});
}

const auth = await fetch(`${STAGING_ORIGIN}/auth/v1/settings`, { headers: { apikey: file.values.SUPABASE_ANON_KEY }, redirect: "error" });
const authSettings = await auth.json().catch(() => ({}));
const schemas = await fetch(`${STAGING_ORIGIN}/rest/v1/preflight_probe?limit=0`, { headers: { apikey: file.values.SUPABASE_ANON_KEY, "Accept-Profile": "fp_no_such_schema" }, redirect: "error" });
const hint = (await schemas.json().catch(() => ({}))).hint ?? "";
console.log(`INFO  Data API schemas: ${/^[A-Za-z0-9 ,:_.-]+$/.test(hint) ? hint.replace(/^.*: /, "") : "not readable"}`);
if (auth.status !== 200) stop("Auth settings", [`status ${auth.status}`]);

const settings = settingFailures({ disableSignup: authSettings.disable_signup, defaultAcls: state.defaultAcls, passwordMinFromDashboard: Number(args["dashboard-password-min"]) });
if (settings.length) stop("required settings are not live; migrations were not run", settings);
console.log("PASS  signups off, password minimum stated as 12, new tables not granted to visitors");

if (!args.apply) { console.log("Preflight passed. No changes made (no --apply)."); process.exit(0); }

// A minimal environment: the runner sees staging's URL and nothing inherited.
const { SystemRoot, PATH, Path, TEMP, TMP } = process.env;
const run = spawnSync(process.execPath, ["scripts/migrate-postgres.mjs"], { cwd: root, stdio: ["ignore", "ignore", "pipe"], env: { SystemRoot, PATH: PATH ?? Path, TEMP, TMP, DATABASE_URL: file.values.DATABASE_URL } });
if (run.status !== 0) stop("migration runner failed; the runner uses one transaction, so check the ledger", [`exit ${run.status}`, `stderr ${/\bcode: '([0-9A-Z]{5})'/.exec(String(run.stderr))?.[1] ?? "no SQLSTATE found"}`]);
console.log("PASS  migration runner exited 0. This is not verification: run verify-schema.mjs");
