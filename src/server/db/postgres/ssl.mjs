// Shared TLS config for every `pg.Pool` this project constructs against
// Supabase's Transaction Pooler. Canonical (plain-JS) implementation —
// ssl.ts re-exports this with types for app code; this .mjs form is what
// the standalone operator scripts (scripts/migrate-postgres.mjs,
// scripts/migrate-to-postgres.mjs) import directly, since they run under
// plain `node` with no TypeScript loader.
//
// Why `ca` is required at all: the pooler presents a chain rooted at
// Supabase's own self-issued CA ("Supabase Root 2021 CA"), not a publicly
// trusted one — it isn't in Node's default trust store. Without `ca` set
// explicitly, every connection throws `SELF_SIGNED_CERTIFICATE_IN_CHAIN`.
// This is not a network/proxy problem; it's how Supabase provisions the
// pooler. Their own docs confirm a "Server root certificate" is meant to
// be supplied by the client:
// https://supabase.com/docs/guides/database/connecting-to-postgres
//
// The cert is a public root certificate, not a secret — safe to commit,
// same as any CA bundle shipped in an npm package. Verified against the
// project's own pooler host via a live TLS handshake; fingerprint recorded
// in docs/architecture/supabase-migration.md.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const caPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "supabase-ca.pem");
const supabaseCa = readFileSync(caPath, "utf-8");

export const supabasePoolSsl = {
  ca: supabaseCa,
  rejectUnauthorized: true,
};
