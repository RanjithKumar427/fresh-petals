#!/usr/bin/env node
// Creates the one staging admin through Supabase's invitation and links its UUID
// to an approved admin profile. Staging only. Read-only without --send. It never
// generates, receives or prints a link, password or token, and never sends twice:
// an existing identity is inspected and reused.
//
//   node scripts/staging/invite-admin.mjs --env=<file> --email=<address> --redirect=<url> [--send]
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { supabasePoolSsl } from "../../src/server/db/postgres/ssl.mjs";
import { STAGING_ORIGIN, clearInheritedSettings, loadEnvFile, targetFailures } from "./guard.mjs";
import { AUTH_ORIGIN } from "./deploy-lib.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.join("=") || true]; }));
const stop = (title, failures = []) => { console.log(`STOP: ${title}`); failures.forEach((f) => console.log(`  - ${f}`)); process.exit(2); };
if (!args.env || !args.email || !args.redirect) stop("usage", ["--env, --email and --redirect are required"]);
if (args.redirect !== `${AUTH_ORIGIN}/admin/reset-password`) stop("the redirect is not the exact staging reset-password address");
clearInheritedSettings();
const file = loadEnvFile(args.env);
const targets = targetFailures(file);
if (targets.length) stop("target checks failed; nothing was sent", targets);
const email = args.email.trim().toLowerCase();

const client = new pg.Client({ connectionString: file.values.DATABASE_URL, ssl: supabasePoolSsl, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
client.on("error", () => {});
await client.connect();
if (client.connection.stream.authorized !== true) stop("TLS", ["the server certificate was not verified"]);
const q = async (sql, params) => (await client.query(sql, params)).rows;
const state = async () => (await q(`select
  (select count(*)::int from auth.users) users,
  (select count(*)::int from auth.users where lower(email) = $1) matching,
  (select count(*)::int from auth.users where lower(email) = $1 and invited_at is not null) invited,
  (select count(*)::int from auth.users where lower(email) = $1 and email_confirmed_at is not null) confirmed,
  (select count(*)::int from auth.users where lower(email) = $1 and encrypted_password is not null and encrypted_password <> '') "hasPassword",
  (select count(*)::int from auth.mfa_factors) factors,
  (select count(*)::int from public.admin_users) admins,
  (select count(*)::int from public.admin_users a join auth.users u on u.id = a.id where lower(u.email) = $1 and lower(a.email) = $1 and a.role = 'admin') linked,
  (select count(*)::int from public.inquiries) inquiries`, [email]))[0];

const before = await state();
console.log(`before: ${JSON.stringify(before)}`);
if (before.users !== before.matching) stop("another Auth identity exists; nothing was changed");
if (before.admins !== before.linked) stop("an unexpected admin profile exists; nothing was changed");
if (before.inquiries !== 7) stop("the restored enquiry count differs; nothing was changed");
if (!args.send) { console.log("No changes made (no --send)."); await client.end(); process.exit(0); }

if (before.matching === 0) {
  const fetchStaging = (url, init) => {
    if (!String(url).startsWith(`${STAGING_ORIGIN}/`)) throw new Error("refused: request is not for staging");
    return fetch(url, { ...init, redirect: "error" });
  };
  const admin = createClient(STAGING_ORIGIN, file.values.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchStaging } }).auth.admin;
  const { error } = await admin.inviteUserByEmail(email, { redirectTo: args.redirect });
  if (error) {
    const after = await state();
    console.log(`after failed invitation: ${JSON.stringify(after)}`);
    stop("the invitation failed; inspect state before retrying", [`status ${error.status ?? "unknown"}`, `code ${error.code ?? "unknown"}`]);
  }
  console.log("invitation requested once");
} else console.log("identity already exists; reused, and no email was sent");

const [user] = await q(`select id from auth.users where lower(email) = $1`, [email]);
if (!user) stop("the identity was not found after the invitation");
await q(`insert into public.admin_users (id, email, role) values ($1, $2, 'admin') on conflict (id) do nothing`, [user.id, email]);
const after = await state();
console.log(`after: ${JSON.stringify(after)}`);
await client.end();
if (after.users !== 1 || after.matching !== 1 || after.admins !== 1 || after.linked !== 1 || after.factors !== 0 || after.inquiries !== 7) stop("the final state is not one linked identity with no MFA factor");
console.log("PASS  one fresh identity linked by UUID to one approved admin profile; no old password or factor imported");
