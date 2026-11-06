// Shared helpers for the staging integration runs (auth-integration.mjs, browser-auth.mjs,
// catalogue-lifecycle.mjs). Staging only: every request must go to the staging Supabase
// project or the staging Worker, and credentials come from the named env file alone.
//
// Nothing here prints or stores a credential, code, token, cookie value or id. Results are
// PASS/FAIL lines with statuses, counts and cookie attribute names.
import { createRequire } from "node:module";
import { createHmac, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { freemem, totalmem } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { STAGING_ORIGIN, STAGING_REF, clearInheritedSettings, loadEnvFile, targetFailures } from "./guard.mjs";
import { AUTH_ORIGIN } from "./deploy-lib.mjs";
import { supabasePoolSsl } from "../../src/server/db/postgres/ssl.mjs";

const require = createRequire(import.meta.url);
const pg = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const WORKER = AUTH_ORIGIN;
export const Z = "00000000-0000-0000-0000-000000000000";
/** Every synthetic identity, profile, product and file carries this prefix, and cleanup refuses anything without it. */
export const SYNTHETIC_PREFIX = "fp-staging-test-";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const random = (bytes = 24) => randomBytes(bytes).toString("base64url");
export const tag = () => randomBytes(5).toString("hex");

export function parseArgs(argv = process.argv.slice(2)) {
  return Object.fromEntries(argv.map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.join("=") || true]; }));
}

/** Strips anything that could be a URL, token or key from an error before it is printed. */
export const scrub = (message) => String(message).replace(/https?:\S+/g, "[url]").replace(/[A-Za-z0-9_\-.]{32,}/g, "[long]").slice(0, 240);

// ---------------------------------------------------------------------------- run context

export function startRun({ envFile, minFreeMb = 1000, deadlineMinutes = 15 }) {
  if (!envFile) throw new Error("--env=<file> is required");
  clearInheritedSettings();
  const file = loadEnvFile(envFile);
  const failures = targetFailures(file);
  if (failures.length) { console.log("STOP: target checks failed; nothing was sent"); failures.forEach((f) => console.log(`  - ${f}`)); process.exit(2); }
  if (!STAGING_ORIGIN.includes(STAGING_REF)) throw new Error("not the staging project");
  const values = file.values;

  const t0 = Date.now();
  const deadline = t0 + deadlineMinutes * 60000;
  const log = (...a) => console.log(`+${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s`, ...a);
  const results = [];
  const check = (area, name, ok, evidence = "") => {
    const status = ok === null ? "NOT RUN" : ok ? "PASS" : "FAIL";
    results.push({ area, name, status, evidence: String(evidence) });
    log(status.padEnd(7), `[${area}] ${name}`, evidence ? `| ${evidence}` : "");
    return ok;
  };
  const due = () => { if (Date.now() > deadline) throw new Error("run deadline reached"); };

  // Network: only the staging Supabase project and the staging Worker.
  const guarded = (url, init = {}) => {
    const s = String(url);
    if (!s.startsWith(`${STAGING_ORIGIN}/`) && !s.startsWith(`${WORKER}/`)) throw new Error("refused non-staging request");
    return fetch(url, { signal: AbortSignal.timeout(45000), ...init });
  };
  const q = async (sql, params = []) => {
    const c = new pg.Client({ connectionString: values.DATABASE_URL, ssl: supabasePoolSsl });
    c.on("error", () => {});
    await c.connect();
    try { return (await c.query(sql, params)).rows; } finally { await c.end().catch(() => {}); }
  };
  const service = createClient(STAGING_ORIGIN, values.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: guarded } });

  // A cookie jar as a browser keeps it for the one Worker host.
  async function w(method, route, { jar, headers = {}, body, store = true } = {}) {
    due();
    const r = await guarded(WORKER + route, { method, redirect: "manual", headers: { ...headers, ...(jar && jar.size ? { cookie: cookieHeader(jar) } : {}) }, body });
    const buffer = Buffer.from(await r.arrayBuffer());
    const set = parseSetCookie(r);
    if (jar && store) applyCookies(jar, set);
    return { status: r.status, to: (r.headers.get("location") ?? "").split("?")[0], location: r.headers.get("location") ?? "", text: buffer.toString("utf8"), bytes: buffer, set, headers: r.headers, cache: r.headers.get("cache-control") ?? "" };
  }

  /** The same @supabase/ssr cookie storage the Worker uses, over a jar. */
  const sdkFor = (jar, { write = false } = {}) => createServerClient(STAGING_ORIGIN, values.SUPABASE_ANON_KEY, {
    global: { fetch: guarded },
    auth: { autoRefreshToken: false },
    cookies: {
      getAll: () => [...jar].filter(([n]) => n.startsWith("sb-")).map(([name, value]) => ({ name, value })),
      setAll: (list) => { if (write) for (const { name, value } of list) value ? jar.set(name, value) : jar.delete(name); },
    },
  });

  function finish({ out, extra = {} } = {}) {
    const fails = results.filter((r) => r.status === "FAIL").length;
    const passes = results.filter((r) => r.status === "PASS").length;
    const notRun = results.filter((r) => r.status === "NOT RUN").length;
    if (out) writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), ...extra, results }, null, 1));
    log(`SUMMARY ${passes} PASS, ${fails} FAIL, ${notRun} NOT RUN, free memory MB ${Math.round(freemem() / 1048576)}`);
    return fails;
  }

  const freeMb = Math.round(freemem() / 1048576);
  log("free memory MB", freeMb, "of", Math.round(totalmem() / 1048576));
  if (freeMb < minFreeMb) { console.log(`STOP: under ${minFreeMb} MB free; nothing was created`); process.exit(2); }

  return { values, log, check, results, due, guarded, q, service, w, sdkFor, finish };
}

// ---------------------------------------------------------------------------- revision

/** The served revision, and whether it is a local commit that contains `required`. */
export async function servedRevision(guarded, required) {
  const served = (await guarded(`${WORKER}/`)).headers.get("x-fp-source-revision") ?? "";
  if (!/^[0-9a-f]{40}$/.test(served)) return { served, ok: false };
  try { execFileSync("git", ["-C", ROOT, "merge-base", "--is-ancestor", required, served], { stdio: "ignore" }); return { served, ok: true }; }
  catch { return { served, ok: false }; }
}

// ---------------------------------------------------------------------------- cookies

export const parseSetCookie = (r) => r.headers.getSetCookie().map((raw) => {
  const [pair, ...rest] = raw.split(";").map((x) => x.trim());
  const i = pair.indexOf("=");
  const a = {};
  for (const x of rest) { const j = x.indexOf("="); a[(j < 0 ? x : x.slice(0, j)).toLowerCase()] = j < 0 ? true : x.slice(j + 1); }
  return { name: pair.slice(0, i), value: pair.slice(i + 1), a };
});
export const removes = (c) => c.value === "" || (c.a["max-age"] !== undefined && Number(c.a["max-age"]) <= 0) || (!!c.a.expires && Date.parse(c.a.expires) < Date.now());
export const applyCookies = (jar, list) => { for (const c of list) { if (removes(c)) jar.delete(c.name); else jar.set(c.name, c.value); } };
export const cookieHeader = (jar) => [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
export const shortName = (n) => n.replace(/^sb-[a-z0-9]+-/, "sb-<ref>-");
export const describeCookie = (c) => `${shortName(c.name)}${removes(c) ? " (removed)" : ""}: ${["httponly", "secure"].filter((k) => c.a[k]).map((k) => (k === "httponly" ? "HttpOnly" : "Secure")).join(", ")}${c.a.samesite ? `, SameSite=${c.a.samesite}` : ""}, Path=${c.a.path ?? "(none)"}${c.a.domain ? ", Domain set" : ", host-only"}${c.a["max-age"] !== undefined ? `, Max-Age=${c.a["max-age"]}` : ""}`;
export const sessionCookieNames = (jar) => [...jar.keys()].filter((n) => n.startsWith("sb-"));
export const sessionCookieAttributesOk = (c) => c.a.httponly && c.a.secure && /^lax$/i.test(c.a.samesite) && c.a.path === "/" && !c.a.domain;

export const FORM = { origin: WORKER, "content-type": "application/x-www-form-urlencoded" };
export const JSON_HEADERS = { origin: WORKER, "content-type": "application/json" };
export const form = (o) => new URLSearchParams(o).toString();

// ---------------------------------------------------------------------------- TOTP

const base32 = (s) => {
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c).toString(2).padStart(5, "0");
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
};
/** RFC 6238 (SHA-1, 6 digits, 30 s), for test-only factors. */
export const totpAt = (secret, step) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32(secret)).update(b).digest();
  const o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, "0");
};
let lastStep = 0;
/** A code from a time step not used before in this process: Auth may refuse a reused one. */
export async function freshCode(secret, due = () => {}) {
  for (;;) {
    const step = Math.floor(Date.now() / 30000), into = Date.now() % 30000;
    if (step > lastStep && into < 24000) { lastStep = step; return totpAt(secret, step); }
    await sleep(Math.min(30000 - into + 300, 31000));
    due();
  }
}

// ---------------------------------------------------------------------------- integrity

/**
 * Digests of everything the runs must leave unchanged: every public table's rows,
 * Storage objects, and each pre-existing Auth user's password, factors and sessions.
 * Identities created by a run are removed before the second snapshot, so a match means
 * nothing that existed before was changed.
 */
export async function snapshot(q, { skipTables = [] } = {}) {
  const tables = (await q(`select table_name t from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`)).map((r) => r.t);
  const out = { tables: {}, sequences: {} };
  for (const t of tables) {
    if (skipTables.includes(t)) continue;
    const id = '"' + t.replaceAll('"', '""') + '"';
    const [r] = await q(`select count(*)::int n, md5(coalesce(string_agg(x::text, E'\\n' order by x::text),'')) h from (select to_jsonb(y) x from public.${id} y) z`);
    out.tables[t] = `${r.n}:${r.h}`;
  }
  for (const { s } of await q(`select sequence_name s from information_schema.sequences where sequence_schema='public' order by 1`)) {
    const [r] = await q(`select last_value::text v from public."${s.replaceAll('"', '""')}"`);
    out.sequences[s] = r.v;
  }
  [out.storage] = await q(`select count(*)::int n, md5(coalesce(string_agg(concat_ws('|',bucket_id,name,metadata->>'eTag',metadata->>'size',updated_at), E'\\n' order by bucket_id,name),'')) h from storage.objects`);
  [out.users] = await q(`select count(*)::int n, md5(coalesce(string_agg(concat_ws('|', u.id, u.email, md5(coalesce(u.encrypted_password,'')),
      (select string_agg(m.id::text||m.status::text||m.updated_at::text, ',' order by m.id) from auth.mfa_factors m where m.user_id=u.id),
      (select string_agg(s.id::text||s.aal::text, ',' order by s.id) from auth.sessions s where s.user_id=u.id)), E'\\n' order by u.id),'')) h from auth.users u`);
  [out.auth] = await q(`select (select count(*)::int from auth.users) users, (select count(*)::int from auth.mfa_factors) factors, (select count(*)::int from auth.identities) identities, (select count(*)::int from public.admin_users) admins, (select count(*)::int from auth.sessions) sessions`);
  return out;
}

export function compareSnapshots(check, before, after, { sequencesMayAdvance = true } = {}) {
  const changed = Object.keys(before.tables).filter((t) => before.tables[t] !== after.tables[t]);
  check("integrity", `all ${Object.keys(before.tables).length} public tables unchanged`, changed.length === 0 && Object.keys(after.tables).length === Object.keys(before.tables).length, changed.join(",") || "row digests equal");
  const moved = Object.keys(before.sequences).filter((s) => before.sequences[s] !== after.sequences[s]);
  if (moved.length) check("integrity", "sequences only advanced (inserts by this run), never moved back", sequencesMayAdvance && moved.every((s) => BigInt(after.sequences[s]) > BigInt(before.sequences[s])), moved.join(","));
  check("integrity", `Storage objects unchanged (${after.storage.n})`, JSON.stringify(after.storage) === JSON.stringify(before.storage));
  check("integrity", "pre-existing Auth users, passwords, factors and sessions unchanged", JSON.stringify(after.users) === JSON.stringify(before.users), `${after.users.n} users`);
  check("integrity", "Auth and admin counts back to their starting values", JSON.stringify(after.auth) === JSON.stringify(before.auth), JSON.stringify(after.auth));
}

// ---------------------------------------------------------------------------- synthetic identities

/**
 * Creates and tracks disposable identities. `approved` adds an admin_users row.
 * Every identity uses SYNTHETIC_PREFIX and a reserved example.com address, is created
 * with email_confirm (so no email is sent), and is removed by cleanup().
 */
export function syntheticIdentities({ q, service, check, log }) {
  const made = [];
  async function create({ approved, label }) {
    const email = `${SYNTHETIC_PREFIX}${label}-${tag()}@example.com`;
    const password = random();
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw new Error(`createUser refused, status ${created.error.status}`);
    const entry = { id: created.data.user.id, email, password, factorIds: [], profile: false };
    made.push(entry);
    if (approved) { await q(`insert into public.admin_users (id, email, role) values ($1, $2, 'admin')`, [entry.id, email]); entry.profile = true; }
    return entry;
  }
  async function cleanup() {
    for (const u of made) {
      if (!u.email.startsWith(SYNTHETIC_PREFIX) || !u.email.endsWith("@example.com")) { log("STOP: refusing to delete an unexpected identity"); process.exitCode = 3; continue; }
      await q(`delete from public.admin_users where id=$1 and email=$2`, [u.id, u.email]);
      for (const id of u.factorIds) { const { error } = await service.auth.admin.mfa.deleteFactor({ id, userId: u.id }); if (error) log("factor delete refused", error.status); }
      const { error } = await service.auth.admin.deleteUser(u.id);
      if (error) log("identity delete refused", error.status);
      const [left] = await q(`select (select count(*)::int from auth.users where id=$1) users, (select count(*)::int from auth.sessions where user_id=$1) sessions, (select count(*)::int from auth.refresh_tokens where user_id=$3) "refreshTokens", (select count(*)::int from auth.mfa_factors where user_id=$1) factors, (select count(*)::int from auth.identities where user_id=$1) identities, (select count(*)::int from public.admin_users where id=$1 or email=$2) profiles, (select count(*)::int from auth.one_time_tokens where user_id=$1) "oneTimeTokens"`, [u.id, u.email, String(u.id)]);
      check("cleanup", `synthetic ${u.profile ? "admin" : "no-profile"} identity: sessions, tokens, factors and profile removed`, Object.values(left).every((n) => n === 0), JSON.stringify(left));
    }
    if (!made.length) check("cleanup", "no synthetic identities were created", true);
  }
  const sessions = async (u) => q(`select s.aal::text aal, (select string_agg(m.authentication_method, ',' order by m.created_at) from auth.mfa_amr_claims m where m.session_id=s.id) amr from auth.sessions s where s.user_id=$1 order by s.created_at`, [u.id]);
  const passwordDigest = async (u) => (await q(`select md5(coalesce(encrypted_password,'')) h from auth.users where id=$1`, [u.id]))[0].h;
  return { create, cleanup, sessions, passwordDigest, made };
}

/** Enrols and verifies a test-only TOTP factor through the SDK, then signs that setup session out. */
export async function enrolFactor({ sdk, user, due }) {
  const s = await sdk.auth.signInWithPassword({ email: user.email, password: user.password });
  if (s.error) throw new Error(`setup sign-in refused, status ${s.error.status}`);
  const e = await sdk.auth.mfa.enroll({ factorType: "totp", friendlyName: "disposable integration test" });
  if (e.error) throw new Error(`enroll refused, status ${e.error.status}`);
  user.factorIds.push(e.data.id);
  user.factorId = e.data.id;
  user.secret = e.data.totp.secret;
  const v = await sdk.auth.mfa.challengeAndVerify({ factorId: user.factorId, code: await freshCode(user.secret, due) });
  if (v.error) throw new Error(`first verify refused, status ${v.error.status}`);
  await sdk.auth.signOut({ scope: "global" });
}

/** A writable SDK client over a fresh jar, for sessions the test opens directly against Auth. */
export function jarClient(sdkFor) {
  const jar = new Map();
  return { jar, sdk: sdkFor(jar, { write: true }) };
}

// ---------------------------------------------------------------------------- admin route sets

export const ADMIN_PAGES = ["/admin", "/admin/dashboard", "/admin/inquiries", "/admin/products", "/admin/products/new", `/admin/products/edit/${Z}`, "/admin/media", "/admin/media/folders", "/admin/media/upload"];
export const ADMIN_READS = ["/api/admin/products", `/api/admin/products/${Z}`, "/api/admin/products/check-slug?slug=x", `/api/admin/products/${Z}/occasion-pages`, `/api/admin/products/${Z}/website`, "/api/admin/inquiries", "/api/admin/media", `/api/admin/media/${Z}`, "/api/admin/media/folders"];
export const ADMIN_WRITES = [["PATCH", `/api/admin/products/${Z}`, JSON_HEADERS, "{}"], ["DELETE", `/api/admin/products/${Z}`, { origin: WORKER }], ["POST", `/api/admin/products/${Z}/status`, JSON_HEADERS, "{}"], ["POST", `/api/admin/products/${Z}/duplicate`, { origin: WORKER }], ["POST", `/api/admin/inquiries/${Z}/status`, JSON_HEADERS, "{}"], ["PATCH", `/api/admin/media/${Z}`, JSON_HEADERS, "{}"], ["DELETE", `/api/admin/media/${Z}`, { origin: WORKER }]];
