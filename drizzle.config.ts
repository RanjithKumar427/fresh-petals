import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only diffs this schema against ./drizzle's local
// migration history — it does not need a reachable database. `drizzle-kit
// migrate` (via scripts/migrate-postgres.mjs) is the one command that
// actually connects, using this same DATABASE_URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/postgres/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
