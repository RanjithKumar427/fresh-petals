#!/usr/bin/env node
// Applies exactly one expected migration to the existing staging schema, through
// scripts/migrate-postgres.mjs. preflight.mjs stays the gate for an empty database.
// Read-only unless --apply is given and every check passes. Never retries or resets.
//
//   node scripts/staging/apply-next.mjs --env=<file> --expect=<tag> [--apply] [--snapshot=<file>]
import { spawnSync } from "node:child_process";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { supabasePoolSsl } from "../../src/server/db/postgres/ssl.mjs";
import { clearInheritedSettings, loadEnvFile, migrationSource, pendingDecision, snapshotDiff, targetFailures } from "./guard.mjs";
import { contentCounts, permissionSnapshot } from "./schema-assertions.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.join("=") || true]; }));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const stop = (title, failures = []) => { console.log(`STOP: ${title}`); for (const f of failures) console.log(`  - ${f}`); process.exit(2); };
const sanitizedCode = (e) => (/^[0-9A-Z_]{1,40}$/.test(String(e?.code)) ? e.code : "unknown");

if (!args.env || !args.expect) stop("usage", ["--env=<file> and --expect=<tag> are required"]);
clearInheritedSettings();
const file = loadEnvFile(args.env);
const targets = targetFailures(file);
if (targets.length) stop("target checks failed; nothing was sent", targets);
console.log("PASS  file targets the staging origin and Session pooler");

const source = migrationSource(root);
if (source.failures.length) stop("migration source", source.failures);
if (execFileSync("git", ["status", "--porcelain", "--", "drizzle"], { cwd: root, encoding: "utf8" }).trim()) stop("migration source", ["drizzle has uncommitted changes"]);
console.log(`PASS  ${source.entries.length} journal entries match Git byte for byte`);

const open = async () => {
  const client = new pg.Client({ connectionString: file.values.DATABASE_URL, ssl: supabasePoolSsl, connectionTimeoutMillis: 10000, query_timeout: 20000, statement_timeout: 15000 });
  client.on("error", () => {});
  await client.connect();
  if (client.connection.stream.authorized !== true) stop("TLS", ["the server certificate was not verified"]);
  return client;
};
const readState = async () => {
  const client = await open();
  const q = async (sql) => (await client.query(sql)).rows;
  try {
    await q("begin read only");
    const state = {
      ledger: await q(`select hash, created_at from drizzle.__drizzle_migrations order by id`),
      content: await contentCounts(q),
      snapshot: await permissionSnapshot(q),
      visitorMaintain: (await q(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values ('anon'),('authenticated')) r(role) where n.nspname='public' and c.relkind in ('r','p') and has_table_privilege(r.role, c.oid, 'MAINTAIN')`))[0].n,
    };
    await q("rollback");
    return state;
  } finally { await client.end().catch(() => {}); }
};

let before;
try { before = await readState(); } catch (e) { stop("database check", [`failed with code ${sanitizedCode(e)}`]); }
console.log("PASS  TLS verified against the repository CA, with hostname checking");

const decision = pendingDecision(before.ledger, source.entries, args.expect);
if (decision.state === "refuse") stop("ledger does not allow this migration; nothing was changed", decision.failures);
if (decision.state === "applied") { console.log(`DONE  ${args.expect} is already recorded with the correct hash. Run verify-schema.mjs.`); process.exit(0); }
console.log(`PASS  ledger holds the ${before.ledger.length} earlier migrations exactly; only pending: ${args.expect}`);

const contentFailures = Object.entries(before.content).filter(([, n]) => n !== 0).map(([k, n]) => `${k}=${n}`);
if (contentFailures.length) stop("staging is expected to hold no data; nothing was changed", contentFailures);
console.log("PASS  no application rows, Auth users or Storage contents");
console.log(`INFO  visitor MAINTAIN grants before: ${before.visitorMaintain}`);

if (!args.apply) { console.log("Checks passed. No changes made (no --apply)."); process.exit(0); }

const { SystemRoot, PATH, Path, TEMP, TMP } = process.env;
const run = spawnSync(process.execPath, ["scripts/migrate-postgres.mjs"], { cwd: root, stdio: ["ignore", "ignore", "pipe"], env: { SystemRoot, PATH: PATH ?? Path, TEMP, TMP, DATABASE_URL: file.values.DATABASE_URL } });
console.log(`INFO  runner exit ${run.status}, SQLSTATE ${/\bcode: '([0-9A-Z]{5})'/.exec(String(run.stderr))?.[1] ?? "none found"}`);

// Whatever the exit code, report what the database now holds. Never assume a rollback.
let after;
try { after = await readState(); } catch (e) { stop("could not read state after the runner; do not retry until inspected", [`failed with code ${sanitizedCode(e)}`, `runner exit ${run.status}`]); }
const diff = snapshotDiff(before.snapshot, after.snapshot);
console.log(`INFO  ledger rows ${before.ledger.length} -> ${after.ledger.length}; visitor MAINTAIN grants ${before.visitorMaintain} -> ${after.visitorMaintain}`);
console.log(`INFO  permission snapshot: ${before.snapshot.length} -> ${after.snapshot.length} entries, removed ${diff.removed.length}, added ${diff.added.length}`);
const unexpected = [...diff.removed.filter((s) => !/^object \S+ \S+ > (anon|authenticated) MAINTAIN /.test(s)).map((s) => `removed: ${s}`), ...diff.added.map((s) => `added: ${s}`)];
unexpected.forEach((s) => console.log(`UNEXPECTED  ${s}`));
if (args.snapshot) writeFileSync(args.snapshot, JSON.stringify({ removed: diff.removed, added: diff.added }, null, 1));
if (run.status !== 0) stop("migration runner failed; state is reported above. Do not retry until reviewed");
if (unexpected.length) stop("the migration changed more than expected");
console.log("PASS  runner exit 0; the only permission changes are visitor MAINTAIN. Now run verify-schema.mjs");
