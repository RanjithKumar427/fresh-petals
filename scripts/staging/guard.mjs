// Target checks for operator scripts that write to the staging Supabase project.
// Pure where possible, so they can be tested without a network. Nothing here
// prints or returns a credential value: failures are fixed descriptions only.
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parseEnv } from "node:util";
import path from "node:path";

export const STAGING_REF = "wyndmywdtacucojvudxg";
export const PRODUCTION_REF = "hjhmetomcaskrrwkgrbp";
export const STAGING_ORIGIN = `https://${STAGING_REF}.supabase.co`;
export const REQUIRED_NAMES = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

const PLACEHOLDER = /\[[^\]]*\]|<[^>]*>|\{[^}]*\}|your[-_ ]?|placeholder|example|changeme|replace|dummy|todo|xxxx|\.\.\.|•|\*\*\*/i;
const URI = /^(postgres(?:ql)?):\/\/([^:@/?#]*):(.*)@([^:@/?#]+):(\d+)\/([^/?#]*)(\?.*)?$/;

/** Parses only the named file. Never reads inherited variables or repository .env files. */
export function loadEnvFile(file) {
  const text = readFileSync(file, "utf8");
  const declared = text.split(/\r?\n/).map((line) => /^\s*(?:export\s+)?([A-Za-z_][\w.-]*)\s*=/.exec(line)?.[1]).filter(Boolean);
  return { values: parseEnv(text), declared };
}

/** Removes settings that could redirect a connection or weaken TLS from this process. */
export function clearInheritedSettings(env = process.env) {
  for (const key of Object.keys(env)) {
    if (/^PG|^DATABASE_URL$|^SUPABASE_|^NODE_TLS_REJECT_UNAUTHORIZED$|^NODE_EXTRA_CA_CERTS$/i.test(key)) delete env[key];
  }
}

/** Returns the failed checks, empty when the file targets staging's Session pooler. */
export function targetFailures({ values, declared }) {
  const failures = [];
  for (const name of REQUIRED_NAMES) {
    if (!values[name]?.trim()) failures.push(`${name} is missing or empty`);
    if (declared.filter((n) => n === name).length > 1) failures.push(`${name} is defined more than once`);
  }
  const { DATABASE_URL: db = "", SUPABASE_URL: api = "", SUPABASE_ANON_KEY: anon = "", SUPABASE_SERVICE_ROLE_KEY: secret = "" } = values;
  if ([db, api, anon, secret].some((v) => v.includes(PRODUCTION_REF))) failures.push("a value references the production project");
  if (api !== STAGING_ORIGIN && api !== `${STAGING_ORIGIN}/`) failures.push("SUPABASE_URL is not the staging origin");
  const m = URI.exec(db);
  if (!m) return [...failures, "DATABASE_URL is not postgresql://user:password@host:port/database"];
  const [, , user, password, host, port, database, query] = m;
  if (user !== `postgres.${STAGING_REF}`) failures.push("DATABASE_URL user is not the staging pooler user");
  if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host)) failures.push("DATABASE_URL host is not a Supabase pooler endpoint");
  if (port !== "5432") failures.push("DATABASE_URL port is not the Session pooler's 5432");
  if (database !== "postgres") failures.push("DATABASE_URL database is not postgres");
  if (query) failures.push("DATABASE_URL has query parameters, which can override TLS settings");
  if (!password) failures.push("DATABASE_URL has no password");
  if (/%(?![0-9A-Fa-f]{2})/.test(password)) failures.push("DATABASE_URL password has a malformed percent escape");
  if (/[@/?#[\]:]/.test(password)) failures.push("DATABASE_URL password has an unescaped URI delimiter");
  if (PLACEHOLDER.test(password)) failures.push("DATABASE_URL password looks like a placeholder");
  return failures;
}

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Reads the journal and checks every migration file is byte-identical to Git. */
export function migrationSource(root) {
  const dir = path.join(root, "drizzle");
  const journal = JSON.parse(readFileSync(path.join(dir, "meta", "_journal.json"), "utf8"));
  const failures = [];
  const entries = journal.entries.map((entry) => {
    const bytes = readFileSync(path.join(dir, `${entry.tag}.sql`));
    const blob = execFileSync("git", ["cat-file", "blob", `HEAD:drizzle/${entry.tag}.sql`], { cwd: root, maxBuffer: 1 << 26 });
    if (!bytes.equals(blob)) failures.push(`${entry.tag}.sql differs from Git (check line endings)`);
    return { tag: entry.tag, when: entry.when, hash: sha256(bytes) };
  });
  const onDisk = readdirSync(dir).filter((f) => f.endsWith(".sql")).map((f) => f.replace(/\.sql$/, "")).sort();
  const listed = entries.map((e) => e.tag).sort();
  if (onDisk.join() !== listed.join()) failures.push("SQL files and the journal list different migrations");
  entries.forEach((e, i) => {
    if (i && e.when <= entries[i - 1].when) failures.push(`${e.tag} is not newer than the migration before it, so the runner would skip it`);
  });
  return { entries, failures };
}

/** Failures in settings that must be live before migrations run. */
export function settingFailures({ disableSignup, defaultAcls, passwordMinFromDashboard }) {
  const failures = [];
  if (disableSignup !== true) failures.push("Auth still allows new signups");
  if (passwordMinFromDashboard !== 12) failures.push("dashboard minimum password length was not confirmed as 12");
  // Saving the toggle off was observed on 4 November 2026 to remove arwd from tables
  // and rU from sequences, but to leave Dxtm and w for visitors. Those leftovers are
  // not the toggle being on: 0012 and 0013 must deal with them, and verify-schema.mjs
  // judges the result. So this checks only the rights the toggle does control.
  const CONTROLLED = { r: /[arwd]/, S: /[rU]/ };
  for (const row of defaultAcls) {
    if (row.owner !== "postgres" || !CONTROLLED[row.type]) continue;
    for (const [, letters] of row.acl.matchAll(/\b(?:anon|authenticated)=([A-Za-z*]*)\//g)) {
      if (CONTROLLED[row.type].test(letters)) {
        failures.push(`new ${row.type === "r" ? "tables" : "sequences"} would still be granted to visitor roles (Automatically expose new tables is still on)`);
        break;
      }
    }
  }
  return failures;
}

/**
 * Decides whether exactly one expected migration may run on an existing schema.
 * Uses the runner's own rule: an entry is pending if newer than the last ledger row.
 * Returns state "applied" (recorded with the right hash), "ready" or "refuse".
 */
export function pendingDecision(ledger, entries, expectedTag) {
  const index = entries.findIndex((e) => e.tag === expectedTag);
  if (index < 0) return { state: "refuse", failures: [`${expectedTag} is not in the journal`] };
  if (index !== entries.length - 1) return { state: "refuse", failures: [`${expectedTag} is not the newest journal entry`] };
  const failures = [];
  if (ledger.length > entries.length) failures.push(`ledger has ${ledger.length} rows, more than the journal's ${entries.length}`);
  ledger.slice(0, entries.length).forEach((row, i) => {
    if (row.hash !== entries[i].hash) failures.push(`ledger row ${i + 1} hash differs from ${entries[i].tag}`);
    if (String(row.created_at) !== String(entries[i].when)) failures.push(`ledger row ${i + 1} timestamp differs from ${entries[i].tag}`);
  });
  if (failures.length) return { state: "refuse", failures };
  if (ledger.length === entries.length) return { state: "applied", failures: [] };
  if (ledger.length !== index) return { state: "refuse", failures: [`expected ${index} ledger rows before ${expectedTag}, found ${ledger.length}`] };
  const last = Number(ledger.at(-1)?.created_at ?? 0);
  const pending = entries.filter((e) => e.when > last).map((e) => e.tag);
  if (pending.length !== 1 || pending[0] !== expectedTag) return { state: "refuse", failures: [`pending migrations are not exactly ${expectedTag}: ${pending.join(", ") || "none"}`] };
  return { state: "ready", failures: [] };
}

/** Set difference of two permission snapshots. */
export const snapshotDiff = (before, after) => ({ removed: before.filter((x) => !after.includes(x)), added: after.filter((x) => !before.includes(x)) });

export const emptinessFailures = (s) => [
  ...(Number(s.publicObjects) ? [`public holds ${s.publicObjects} application objects`] : []),
  ...(s.drizzleSchema ? ["a drizzle schema already exists"] : []),
  ...(s.supabaseLedger ? ["a supabase_migrations schema already exists"] : []),
];
