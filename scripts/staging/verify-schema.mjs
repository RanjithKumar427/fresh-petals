#!/usr/bin/env node
// Verifies staging after migrations. Writes nothing: every statement runs in a
// read-only transaction, and it prints names, counts and definitions only.
//   node scripts/staging/verify-schema.mjs --env=<file> --recorded=<catalog-fingerprint.json> [--result=<file>]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { supabasePoolSsl } from "../../src/server/db/postgres/ssl.mjs";
import { STAGING_ORIGIN, clearInheritedSettings, loadEnvFile, migrationSource, targetFailures } from "./guard.mjs";
import { assertLedger, assertMaintain, assertPrivileges, assertRoleReads, compareCatalog, contentCounts, defaultPrivileges } from "./schema-assertions.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.join("=") || true]; }));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
clearInheritedSettings();
const file = loadEnvFile(args.env);
const targets = targetFailures(file);
if (targets.length) { console.log("STOP: target checks failed", targets); process.exit(2); }

const client = new pg.Client({ connectionString: file.values.DATABASE_URL, ssl: supabasePoolSsl, connectionTimeoutMillis: 10000, query_timeout: 20000, statement_timeout: 15000 });
client.on("error", () => {});
await client.connect();
const q = async (sql) => (await client.query(sql)).rows;
const inReadOnly = async (fn) => { await q("begin read only"); try { return await fn(); } finally { await q("rollback"); } };

const source = migrationSource(root);
const result = { source: source.failures };
result.ledger = await inReadOnly(() => assertLedger(q, source.entries));
result.catalog = await inReadOnly(() => compareCatalog(q, JSON.parse(readFileSync(args.recorded, "utf8"))));
result.privileges = await inReadOnly(() => assertPrivileges(q));
result.defaults = await inReadOnly(() => defaultPrivileges(q));
result.roleReads = await assertRoleReads(q);
result.maintain = await assertMaintain(q);
result.content = await inReadOnly(() => contentCounts(q));
await client.end();

// The real visitor path. GETs only, publishable key, staging origin, no redirects.
result.dataApi = {};
for (const [name, url] of Object.entries({
  "admin_users": "/rest/v1/admin_users?select=id&limit=1",
  "inquiries": "/rest/v1/inquiries?select=id&limit=1",
  "products.cost_price": "/rest/v1/products?select=cost_price&limit=1",
  "media.uploaded_by": "/rest/v1/media?select=uploaded_by&limit=1",
})) {
  const r = await fetch(STAGING_ORIGIN + url, { headers: { apikey: file.values.SUPABASE_ANON_KEY }, redirect: "error" });
  const j = await r.json().catch(() => ({}));
  result.dataApi[name] = { status: r.status, code: /^[0-9A-Z]{3,10}$/.test(String(j.code)) ? j.code : null, refused: r.status >= 400 };
}

const failures = [...result.source, ...result.ledger.failures, ...result.privileges.failures, ...result.defaults.failures, ...result.roleReads, ...result.maintain.failures,
  ...Object.entries(result.content).filter(([, n]) => n !== 0).map(([k, n]) => `expected no content: ${k}=${n}`),
  ...Object.entries(result.dataApi).filter(([, v]) => !v.refused).map(([k]) => `Data API allowed ${k}`)];
const differs = Object.entries(result.catalog).filter(([, v]) => v.onlyProduction.length || v.onlyTarget.length).map(([k]) => k);
console.log(`ledger rows=${result.ledger.rows}`);
for (const [k, v] of Object.entries(result.catalog)) console.log(`catalog ${k}: production=${v.production} staging=${v.target} onlyProduction=${v.onlyProduction.length} onlyStaging=${v.onlyTarget.length}`);
console.log(JSON.stringify(result.privileges.summary));
for (const r of result.defaults.rows) console.log(`default ${r.owner}/${r.type} ${r.acl}`);
for (const row of result.catalog.grants.onlyTarget) console.log(`grant only on staging ${row}`);
console.log(JSON.stringify(result.dataApi));
console.log(`maintain: tables=${result.maintain.tables} effective=${result.maintain.effective} publicGrants=${result.maintain.publicGrants} refusedLocks=${result.maintain.refusedLocks} memberships=${JSON.stringify(result.maintain.memberships)}`);
console.log(`content: ${JSON.stringify(result.content)}`);
console.log(`failures=${failures.length}`); failures.forEach((f) => console.log(`  - ${f}`));
console.log(`catalog areas differing from production: ${differs.join(", ") || "none"}`);
if (args.result) writeFileSync(args.result, JSON.stringify(result, null, 1));
process.exit(failures.length ? 1 : 0);
