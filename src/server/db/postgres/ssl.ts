// Typed re-export of the canonical SSL config — see ssl.mjs for the full
// explanation of why `ca` is required at all. This .ts wrapper exists only
// so app code (client.ts) importing through Vite/TypeScript gets proper
// types; scripts/migrate-postgres.mjs and scripts/migrate-to-postgres.mjs
// (plain `node`, no TS loader) import ssl.mjs directly instead.
import type { PoolConfig } from "pg";
import { supabasePoolSsl as ssl } from "./ssl.mjs";

export const supabasePoolSsl: PoolConfig["ssl"] = ssl;
