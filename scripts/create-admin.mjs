#!/usr/bin/env node
// One-time (or re-runnable) admin account bootstrap.
//
// Usage:
//   node scripts/create-admin.mjs --email=you@example.com --password="a strong password"
// or via env vars:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD="a strong password" node scripts/create-admin.mjs
//
// Deliberately plain JS talking to node:sqlite directly rather than importing
// the TypeScript repository layer: Node's ESM loader (unlike Vite/Astro)
// requires explicit file extensions on every relative import, which the
// app's .ts sources don't use. Duplicating a handful of INSERT statements
// here is a smaller cost than fighting that resolver for one-off ops
// tooling — schema.sql itself is still the single shared source of truth,
// loaded directly rather than re-declared.
import { DatabaseSync } from "node:sqlite";
import { scryptSync, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR, DB_PATH } from "../src/server/db/paths.mjs";

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, "").split("=");
      return [key, rest.join("=")];
    })
  );

  return {
    email: args.email || process.env.ADMIN_EMAIL,
    password: args.password || process.env.ADMIN_PASSWORD,
  };
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const { email, password } = parseArgs();

if (!email || !password) {
  console.error(
    'Usage: node scripts/create-admin.mjs --email=you@example.com --password="a strong password"'
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");

const schemaPath = fileURLToPath(new URL("../src/server/db/schema.sql", import.meta.url));
db.exec(fs.readFileSync(schemaPath, "utf-8"));

const normalizedEmail = email.trim().toLowerCase();
const passwordHash = hashPassword(password);
const now = new Date().toISOString();

const existing = db.prepare("SELECT id FROM admin_users WHERE email = ?").get(normalizedEmail);

if (existing) {
  db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").run(passwordHash, existing.id);
  console.log(`Updated password for existing admin: ${normalizedEmail}`);
} else {
  db.prepare("INSERT INTO admin_users (email, password_hash, created_at) VALUES (?, ?, ?)").run(
    normalizedEmail,
    passwordHash,
    now
  );
  console.log(`Created admin account: ${normalizedEmail}`);
}

db.close();
