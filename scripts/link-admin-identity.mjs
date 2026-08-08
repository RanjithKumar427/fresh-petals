#!/usr/bin/env node
// One-time (or re-runnable) bridge between a Supabase Auth user and this
// app's `admin_users` profile table — the Postgres/Supabase-Auth
// equivalent of scripts/create-admin.mjs, run once per admin as part of
// Phase 2B.3's cutover. Deliberately takes no hardcoded email/UUID: those
// are real PII and shouldn't live in a committed script or migration file
// (see drizzle/0003_supabase_auth_identity.sql's own comment on this).
//
// What this does NOT do: create or know a password. The Supabase Auth
// user itself must already exist (created via an invite/recovery link
// generated through the Supabase dashboard or admin API — the admin sets
// their own password by opening that link, never typed anywhere this
// script or its caller can see). This script only links that already-
// existing identity to an `admin_users` profile row, preserving
// created_at from the old row if one is supplied.
//
// Usage:
//   node scripts/link-admin-identity.mjs --email=you@example.com [--createdAt=2026-01-01T00:00:00.000Z] [--lastLoginAt=...]
import { Pool } from "pg";
import { supabasePoolSsl } from "../src/server/db/postgres/ssl.mjs";

function parseArgs() {
  return Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, "").split("=");
      return [key, rest.join("=")];
    })
  );
}

const { email, createdAt, lastLoginAt } = parseArgs();
if (!email) {
  console.error("Usage: node scripts/link-admin-identity.mjs --email=you@example.com");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
  console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DATABASE_URL must all be set.");
  process.exit(1);
}

// Look up the Supabase Auth user by email via the admin API — never
// assumed, never hardcoded. Fails loudly (not silently) if the invite
// link hasn't been created/opened yet, since inserting a profile row for
// a nonexistent auth user would violate the FK this table is meant to
// enforce (Postgres would reject it anyway, but this gives a clearer
// message about *why*).
const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
  headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
});
if (!usersRes.ok) {
  console.error("Failed to list Supabase Auth users:", await usersRes.text());
  process.exit(1);
}
const { users } = await usersRes.json();
const authUser = users.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
if (!authUser) {
  console.error(
    `No Supabase Auth user found for ${email}. Create one first (invite link via the admin API or dashboard), ` +
      `then re-run this script.`
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl, max: 1, ssl: supabasePoolSsl });
const client = await pool.connect();
try {
  const result = await client.query(
    `INSERT INTO admin_users (id, email, role, created_at, last_login_at)
     VALUES ($1, $2, 'admin', COALESCE($3::timestamptz, now()), $4::timestamptz)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, email, role, created_at, last_login_at`,
    [authUser.id, authUser.email, createdAt ?? null, lastLoginAt ?? null]
  );
  console.log("Linked admin profile:", result.rows[0]);
} finally {
  client.release();
  await pool.end();
}
