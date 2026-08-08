// Typed, Vite-bundled sibling of ssl.mjs — see that file for the full
// explanation of why `ca` is required at all. This .ts version does NOT
// simply re-export ssl.mjs's runtime `readFileSync(caPath)` logic: that
// approach breaks once Vite bundles this file into a production chunk
// under a different directory than the source tree (caPath, computed via
// `import.meta.url`, points at wherever the *compiled* file ends up, and
// nothing copies supabase-ca.pem alongside it) — the same class of bug
// this project already hit once for schema.sql, fixed the same way there.
//
// Named `supabaseCa.ts`, deliberately NOT `ssl.ts`, after a second, more
// fundamental bug this phase found: with a same-base-name `ssl.ts` sitting
// next to `ssl.mjs`, `client.ts`'s `import { supabasePoolSsl } from
// "./ssl"` was silently resolving to `ssl.mjs` in Vite's production
// (Rollup) build — not `ssl.ts` — because Rollup's resolver prefers an
// already-valid-ESM `.mjs` file over one needing the TypeScript plugin
// when both share a base name. That means the fragile `readFileSync`
// path had been the one actually shipped in every production build since
// whichever phase first split this file out, invisible because `astro
// dev`'s resolver picks `.ts` over `.mjs` and no previous `astro build`
// had happened to prerender a page that exercised this exact code path
// with the chunk relocated far enough to trip it. Caught only when adding
// @supabase/ssr and @supabase/supabase-js reshuffled Vite's chunk
// boundaries enough to finally surface it as a real ENOENT during
// `astro build`. Removing the name collision outright (this file) is the
// actual fix; the `?raw` import below is necessary but wasn't sufficient
// on its own while the old filename let the wrong file win silently.
//
// `?raw` inlines the file's contents into the JS bundle at build time —
// no runtime file lookup, so it's immune to wherever Vite puts the
// compiled chunk. scripts/migrate-postgres.mjs and
// scripts/migrate-to-postgres.mjs (plain `node`, no bundler, no TS
// loader) keep using ssl.mjs's readFileSync version instead, which is
// correct for their context — the file genuinely sits next to them.
import type { PoolConfig } from "pg";
import supabaseCa from "./supabase-ca.pem?raw";

export const supabasePoolSsl: PoolConfig["ssl"] = {
  ca: supabaseCa,
  rejectUnauthorized: true,
};
