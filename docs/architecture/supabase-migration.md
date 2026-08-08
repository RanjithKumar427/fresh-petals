# SQLite → Supabase Migration

Internal engineering log for the persistence-layer migration approved after the architecture review in this project's history. Read this before touching anything under `src/server/db/postgres/` or the old `src/server/db/` (SQLite) — the two coexist deliberately during the transition and this doc explains why, and when each phase retires part of the old system.

## Why

FreshPetals is moving from a single-admin flower-catalogue app toward a Commerce OS (Studio, AI Florist, Corporate Dashboard, Marketplace, multiple admins/florists, customer accounts, mobile apps). SQLite is a fine development database; it is not the right long-term persistence layer for that roadmap — no real multi-writer story, no managed backups, no path to serverless deployment on Vercel. This migration happens now, before more features are built on top of SQLite, because doing it later is exponentially more expensive.

## Approved architecture

```
Browser → Astro → API Routes → Application Services → Repository Interfaces
                                                              │
                                                    Drizzle ORM (repositories only)
                                                              │
                                                    pg (node-postgres), pooled
                                                              │
                                                    Supabase Transaction Pooler
                                                              │
                                                    PostgreSQL (Supabase)

Supabase SDK (supabase-js) is used ONLY for Storage and Auth — never as the
application's persistence layer. Repositories never depend on supabase-js
CRUD APIs; only Drizzle talks to Postgres.
```

Everything above the repository layer — API routes, services, React islands, Astro pages — keeps its exact current interface throughout every phase. If a phase requires changing a service's public method signature or an API route's request/response shape, that's a signal something has gone wrong, not a normal cost of migrating.

## Supabase environment (discovered, not created)

One organization (`freshpetals`), one project (`freshpetals`, ref `hjhmetomcaskrrwkgrbp`, `ap-northeast-2`, Nano compute). Confirmed empty at discovery time: zero tables, zero Storage buckets, zero real users, zero RLS policies, zero migrations. Uses Supabase's newer `publishable`/`secret` API key naming, not the legacy `anon`/`service_role` names. Nano tier's Supavisor pooler: 15 backend connections, 200 max client connections — this is why `client.ts`'s pool is capped at `max: 5` per instance rather than left at a library default.

## Key decisions (with reasoning, not just conclusions)

- **Supabase Auth, adopted now rather than deferred.** Originally recommended deferring this to minimize blast radius. Reversed after the roadmap was spelled out in full: Customers, Florists, and Corporate Dashboard are three *distinct* future identity audiences, not variations on "admin," and all imply real password-reset/email-verification flows that don't exist anywhere in this codebase today. Building that once, now, while the surface is one admin user with no sessions worth preserving, is far cheaper than building it twice — once for admin later, once for customers separately.
- **Direct pooled Postgres (`pg`) for all repository reads/writes, not `supabase-js`.** `ProductRepository.create/update` already writes to up to 7 tables atomically inside `withTransaction()`. PostgREST (what `supabase-js` talks to) has no client-side multi-statement transaction — the alternative is pushing that logic into a Postgres function, which conflicts with this codebase's standing rule that repositories hold SQL and services hold logic, nothing else. A pooled `pg` connection keeps `withTransaction()` working almost exactly as it did against SQLite. `supabase-js` still has a real, narrow job — Storage and Auth SDK calls — just not this one.
- **Drizzle ORM**, used only inside repositories (services still only ever import repositories). Chosen over hand-written parameterized `pg` queries because this codebase already had two concrete bugs from that style during this project: a SQLite `CHECK` constraint silently not applying to an existing table, and a manual hunt through every call site when a column was renamed. Drizzle's typed schema turns both classes of bug into compile errors. Chosen over Prisma for lower cold-start overhead on serverless; over Kysely (a legitimate, similarly-good alternative) for more mature migration tooling that fits the "migrations as reviewed SQL files" convention already in place.
- **Idiomatic Postgres types, not a byte-for-byte SQLite port**: native `boolean` instead of `INTEGER 0/1`, `timestamptz` instead of app-managed ISO `TEXT`, real `pgEnum` types instead of `CHECK (col IN (...))`. All three are internal representation details — every repository translates to/from the exact same TypeScript shapes services already depend on, so this is invisible above the repository boundary. The enum change specifically closes the exact bug class hit with SQLite's `CHECK` list.
- **Media is a platform resource, not product-owned** — already true in the SQLite design (`product_images`/`categories.image_id` reference `media.id`, never the reverse) and preserved exactly. Metadata enriched with `bucket`, `checksum`, `dominant_color`, `blur_hash`, `uploaded_by` per the migration brief's explicit minimum set — added at schema time now because retrofitting columns onto a large, live media table later is expensive; populating them (Storage provider computing checksum/blurhash/dominant color at upload time) is Phase 4's job, not Phase 1's.
- **Deliberately deferred, not forgotten**: audit log, soft deletes, optimistic-concurrency versioning, full-text search column, background-jobs table. All flagged as real future value in the architecture review; none are in scope for *this* migration, which is a persistence-layer swap, not a new-features phase. Each is a small, additive schema change to make later — noted here so a future engineer knows they were considered, not missed.

## Phase log

### Phase 1 — Infrastructure (Drizzle, schema, migration framework, repository foundation)

**Status:** complete, committed in isolation. Purely additive — no existing repository, service, API route, or page was touched. The application's SQLite-backed behavior is unchanged; nothing yet reads from or writes to Postgres.

**Files added:**
- `src/server/db/postgres/schema.ts` — the full Drizzle schema, table-for-table equivalent of `src/server/db/schema.sql` plus the enriched `media` metadata columns.
- `src/server/db/postgres/client.ts` — the Postgres equivalent of `src/server/db/client.ts`: a lazy singleton `pg.Pool` + Drizzle instance (`getDb()`), plus a `withTransaction()` wrapper with the same call shape repositories already use, backed by Drizzle's native `db.transaction()`.
- `drizzle.config.ts` — Drizzle Kit config; schema path, migration output folder (`./drizzle`), `DATABASE_URL`-driven credentials.
- `drizzle/0000_wild_boomer.sql` — the generated initial migration (15 tables, 4 enums, all FKs/indexes/constraints). Generated fully offline — `drizzle-kit generate` only diffs the TypeScript schema against local migration history, no database connection required.
- `scripts/migrate-postgres.mjs` — applies `./drizzle`'s migrations to `DATABASE_URL` via Drizzle's own migrator, which creates and tracks its own migration-history table automatically (this supersedes the old hand-rolled `migrations` table pattern from `schema.sql` — that pattern existed specifically to compensate for SQLite having no migration tooling of its own; Drizzle needs no such compensation).
- `.env.example` — documents the four required variables (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) with no real values.
- `package.json` — added `drizzle-orm`, `pg` (dependencies), `drizzle-kit`, `@types/pg` (devDependencies), `db:generate`/`db:migrate` scripts.

**Why files were NOT changed:** every existing repository, service, API route, and page still points at the SQLite client. Phase 3 is where repositories get their internals swapped, one at a time, each independently verified.

**Migration risk carried by this phase:** none against the live application (nothing wired yet). The schema-translation risk (enum/boolean/timestamp type changes, the new media columns) is real but contained entirely to files nothing depends on yet — reviewable and correctable with zero blast radius before Phase 2 actually applies it to the real database.

**Rollback:** delete the four new files and the two new dependencies; nothing else references them. Trivial, because nothing else exists yet that could depend on them.

**Verification performed:** `drizzle-kit generate` succeeded offline and produced the expected 15 tables/4 enums/all FKs and indexes (manually read and checked against `schema.sql`, table by table). `astro check` — clean on every new file, same 18 pre-existing/unrelated errors as before this phase. `astro build` — succeeds. `getDb()`'s fail-fast behavior (clear error when `DATABASE_URL` is unset, rather than a cryptic driver crash) is verified by code inspection and by `astro check`'s type-level validation; a raw-`node` runtime smoke test hit the same Node-ESM-vs-Vite extensionless-import limitation already documented for every other `src/server/**.ts` file in this codebase (Vite/Astro resolves it; bare `node` does not) — this is an existing, known characteristic of the codebase, not a defect introduced here, and full runtime exercise of `getDb()` happens naturally once Phase 2 gives it real work to do.

**Blocking for Phase 2:** the database password (Supabase Settings → Database → "Reset database password" — it isn't retrievable, only resettable) and the secret key (Settings → API Keys → "Secret keys" → reveal, copied directly into your own `.env`, never through chat) need to be in a local `.env` before migrations can actually be applied or the catalogue seeded.

**Self-review pass (post-first-draft, before this phase was finalized):** re-read `client.ts` adversarially rather than accepting the first version. Found and fixed three real issues, none cosmetic:
1. *Performance/scalability reasoning was mechanically wrong, not just unlucky.* The original comment justified `max: 5` against the pooler's 15-connection *backend* budget, but Supavisor (transaction mode) multiplexes many client pools onto that backend budget itself — the actual constraint on this side is the 200-connection *client* limit. Fixed the number (`max: 3`, conservative against many concurrent serverless instances) and rewrote the comment to reflect how the pooler actually works, not a plausible-sounding guess.
2. *Security gap: no explicit SSL configuration.* TLS was only implicit — dependent on a human-copied connection string happening to retain its `sslmode` parameter. Added `ssl: { rejectUnauthorized: true }` explicitly in code, since Supabase's pooler always requires TLS and that shouldn't depend on how carefully a connection string was retyped.
3. *Dev-mode connection leak via Vite HMR.* The original module-level `let pool` would not survive Vite's SSR module re-execution during `astro dev` — repeated edits to this file during a long local session would each construct a fresh, never-closed pool against a small real connection budget. Fixed with a `globalThis`-cached instance (the same pattern Prisma/Next.js document for the identical problem), a no-op in production where each serverless instance's module scope is fresh exactly once anyway.

Amended into the same commit rather than shipped as a separate "Phase 1 fixes" commit — same phase, same unpushed local history, no reason to fragment one milestone into two.

### Phase 2A — PostgreSQL Schema Creation & Data Seeding

**Status:** complete, committed in isolation. Scope was narrow and deliberate: build, populate, and certify PostgreSQL as the *future* production database while SQLite continues to power the live application. Nothing in `src/pages`, `src/server/services`, `src/server/db/repositories`, or the SQLite client was touched. Postgres now holds a verified, byte-for-byte-parity copy of the current SQLite data — nothing reads from it yet.

**Environment setup.** No `.env`/`.env.local` existed anywhere on this machine at the start of this phase, contradicting an earlier claim that it did — confirmed by checking the filesystem, the process environment, and Windows' user/machine-level persisted variables before touching anything, then reported back rather than assumed. `.env.local` now holds `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. `.gitignore`'s env rule was widened from two literal filenames (`.env`, `.env.production`) to `.env*` / `!.env.example` — the old rule would not have caught `.env.local`.

**Real bug found during first connection attempt, not before:** every SSL config written in Phase 1 (`client.ts`, plus the two migration scripts) used `ssl: { rejectUnauthorized: true }` with no `ca` — this looks correct and passes `astro check`, but fails every real connection with `SELF_SIGNED_CERTIFICATE_IN_CHAIN`. Root cause, confirmed by manually performing the Postgres `SSLRequest` handshake and walking the certificate chain: Supabase's Transaction Pooler presents a chain rooted at Supabase's own self-issued `Supabase Root 2021 CA`, not a publicly trusted one. Node's default trust store doesn't include it. (A separate, unrelated red herring surfaced during diagnosis: this machine's antivirus — Avast — independently intercepts port-443 HTTPS traffic with its own injected root; that was ruled out specifically by fetching Supabase's own docs over a different network path and by manually inspecting the actual TLS chain on port 6543, which showed a self-consistent `Supabase Inc`-issued leaf → intermediate → root, not Avast's.) Fixed once, centrally: the CA certificate is committed at `src/server/db/postgres/supabase-ca.pem` (a public root certificate, not a secret — safe to commit, same as any CA bundle shipped in an npm package; fingerprint below) behind a shared `supabasePoolSsl` config (`ssl.ts` for TypeScript app code, `ssl.mjs` for the plain-`node` operator scripts, one re-exporting the other) — all three sites (`client.ts`, `scripts/migrate-postgres.mjs`, `scripts/migrate-to-postgres.mjs`) now import the same config instead of each hardcoding it.
```
Subject / Issuer: C=US, ST=Delware, L=New Castle, O=Supabase Inc, CN=Supabase Root 2021 CA
Fingerprint256:   80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
Valid:            2021-04-28 -> 2031-04-26
```

**Pre-migration inspection (before changing anything):** connected read-only and confirmed the `public` schema was genuinely empty — zero tables, enums, indexes, FKs, RLS policies, migrations. Supabase's own default schemas (`auth`, `storage`, `realtime`, `graphql`, `pgbouncer`, `vault`, `extensions`) were present and untouched, as expected for any Supabase project. "Fresh database detected" — confirmed programmatically, not assumed, before Task 6 (schema application) began.

**Schema deployment.** Applied `drizzle/0000_wild_boomer.sql` (from Phase 1, generated offline, already reviewed table-by-table against `schema.sql`) via `scripts/migrate-postgres.mjs`. Re-inspected afterward: all 15 tables, 4 enums, every FK, and every index present, matching the migration file exactly. Tracked in Drizzle's own `drizzle.__drizzle_migrations` table.

**Row Level Security.** `drizzle-kit generate` doesn't produce RLS policies from `schema.ts` (no `pgPolicy` declarations were used), so this needed a hand-authored migration — scaffolded via `drizzle-kit generate --custom` (so it's tracked in the same journal as everything else) at `drizzle/0001_enable_rls.sql`. Enabled RLS on all 15 tables. Policy shape:
- `admin_users`, `sessions` — RLS enabled, **zero policies**. Password hashes and session tokens are never readable through PostgREST by `anon`/`authenticated`, full stop.
- `categories`, `occasions`, `moods`, `flower_types`, `media` — unconditional public `SELECT`. Pure taxonomy/asset metadata; no "draft" concept applies.
- `products` — public `SELECT` gated on `status = 'published'`.
- `product_variants`, `product_images`, `product_occasions`, `product_moods`, `product_flower_types`, `product_whats_included`, `product_care_instructions` — public `SELECT` gated on the parent product being published, via an `EXISTS` join back to `products`.
- No `INSERT`/`UPDATE`/`DELETE` policies anywhere for `anon`/`authenticated`: with RLS enabled and no policy for a command, Postgres denies that command outright. That absence *is* the "public read-only" guarantee.

Deliberately **not** included: an `authenticated`-role "admin full CRUD" policy. There is no Supabase Auth identity yet — admin auth is still `AdminUserRepository` + opaque session tokens, and every Postgres connection this app makes (Drizzle via `client.ts`, both migration scripts) authenticates as the `postgres` role through the pooler, which — like `service_role` — has `BYPASSRLS` and ignores every policy above regardless. Writing an `authenticated` policy now would be dead code today. This is explicitly Phase 5's job, when Supabase Auth becomes the real identity provider.

Why this matters even though the application doesn't read Postgres yet: Supabase auto-exposes every `public`-schema table over its PostgREST REST API to anyone holding the project's publishable (anon) key the moment the table exists. Between schema deployment and this RLS migration, the 15 new (then-empty) tables were technically exposed that way. Closing that gap was treated as immediate, not deferred to "whenever Phase 3 gets here."

**Data migration.** Source: live SQLite (`data/freshpetals.sqlite`), not `productCatalog.ts` — SQLite is the richer, current source since real admin edits have happened since the original seed (documented in the script itself so this isn't silently assumed later). `scripts/migrate-to-postgres.mjs` (written and self-reviewed before this phase's execution): VALIDATE (read-only against SQLite, no Postgres connection) → TRANSFORM → one transactional, identity-preserving, upsert-on-conflict INSERT pass → VERIFY. `sessions` deliberately excluded from migration and from the parity check (a SQLite session token is a credential for logging into the *old* system; copying it into Postgres wouldn't let anyone "stay logged in" across a cutover the application hasn't made yet, and comparing its count would report a false mismatch for something never meant to match).

A second self-review pass, done specifically *because* this was about to run against the real database rather than a draft, found the `ON CONFLICT DO UPDATE SET` clauses on 5 of the 12 populated tables (`categories`, `occasions`/`moods`/`flower_types`, `media`, `products`, `product_variants`) were incomplete — they'd insert every column correctly on first run, but a *second* run (e.g. re-syncing after more admin edits, before Phase 3 cuts the app over) would silently skip updating columns like `slug`, `colour_theme`, `arrangement_style`, `seo_title`, `folder`, `sku`. Fixed by listing every mutable column in each `SET` clause before this ever touched production — this is exactly the "idempotent AND safe to rerun without stale data" bar the brief set, not merely "doesn't crash twice."

Validation found zero issues (duplicate slugs, orphaned references, invalid enums, empty required fields) across all 14 migrated tables — consistent with the ad hoc checks run earlier against the same SQLite database. Migration executed inside one transaction; committed once, no partial state possible.

**Data certification — actual numbers, not summarized:**
```
admin_users                  SQLite 1    Postgres 1    ✓ MATCH
media                        SQLite 90   Postgres 90   ✓ MATCH
categories                   SQLite 18   Postgres 18   ✓ MATCH
occasions                    SQLite 14   Postgres 14   ✓ MATCH
moods                        SQLite 5    Postgres 5    ✓ MATCH
flower_types                 SQLite 72   Postgres 72   ✓ MATCH
products                     SQLite 89   Postgres 89   ✓ MATCH
product_variants              SQLite 0    Postgres 0    ✓ MATCH
product_images                SQLite 89   Postgres 89   ✓ MATCH
product_occasions             SQLite 300  Postgres 300  ✓ MATCH
product_moods                 SQLite 46   Postgres 46   ✓ MATCH
product_flower_types          SQLite 155  Postgres 155  ✓ MATCH
product_whats_included        SQLite 356  Postgres 356  ✓ MATCH
product_care_instructions     SQLite 267  Postgres 267  ✓ MATCH
```
`sessions` (SQLite: 1) excluded from this table per the exclusion reasoning above — reported separately as informational only, never compared.

**Referential integrity, queried directly against Postgres after the migration committed:**
```
orphaned products (missing category)          0  ✓
orphaned product_images (missing product)     0  ✓
orphaned product_images (missing media)       0  ✓
```

**Performance review.** At current data volume (89 products, 90 media, largest table `products` at 144 kB) query-plan shape is more informative than raw timings. `EXPLAIN (ANALYZE, BUFFERS)` against four representative queries:
- Published-products listing (`WHERE status = 'published' ORDER BY published_at DESC LIMIT 24`) — index scan (backward) on `idx_products_published_at`, 0.05ms.
- Category page (`WHERE category_id = ? AND status = 'published'`) — index scan on `idx_products_category_id`, 0.04ms.
- Product images for one product — sequential scan on `product_images`, *not* `idx_product_images_product_id`. This is Postgres's planner correctly judging a seq scan cheaper than an index scan at 89 total rows, not a missing index — the index exists and will be picked up automatically once the table is large enough (thousands of rows) that the cost crosses over. No schema change needed; flagged here so a future reader doesn't mistake "seq scan in the plan" for "index missing."
- Admin product list (`products JOIN categories`) — nested loop with a `Memoize` node caching category lookups, 0.3ms for 89 rows.
All four query patterns the brief asked to plan for (storefront listing, category filter, product detail, admin list) already have a supporting index; none require new ones at this schema. What genuinely needs revisiting *before* 100k products / 1M media / 100 concurrent admins, tracked as follow-up rather than done here since none of it is exercised by anything yet:
- `client.ts`'s pool (`max: 3`) is sized for the Nano tier's 200-client Supavisor limit assuming a modest number of concurrent serverless instances; this was never designed against 100 concurrent *admins* specifically, and revisiting it is meaningfully informed only once Phase 3 actually puts this pool behind real request traffic — sizing it now would be guessing.
- `product_images`/`product_occasions`/etc. queries filtering by `product_id` will want to confirm (via the same `EXPLAIN` approach used here) that the planner has switched to index scans once real volume exists — a one-line check to re-run after Phase 3, not a schema change to make speculatively now.
- No pagination cursor strategy exists yet for `products` beyond `LIMIT`/`OFFSET`-style access; fine at 89 rows, worth a keyset-pagination pass before 100k.

**Staff Engineer self-review — "if this ran on production tonight, what could fail?"**
1. *The SSL bug above* would have failed 100% of connections, tonight or any night, until diagnosed — the highest-value finding of this phase precisely because it wasn't a hypothetical, it blocked the very first real connection attempt.
2. *The idempotency gaps in `ON CONFLICT DO UPDATE`* wouldn't have failed tonight's run (fresh DB, first insert always takes the `INSERT` branch) but would have silently produced stale data on any *future* rerun — the kind of bug that looks fine in every test because tests don't naturally re-run a migration twice with changed data in between.
3. *RLS being unset between schema deployment and the RLS migration* was a real, if brief and low-consequence (empty tables), window where the publishable key granted full read/write over PostgREST. Treated as urgent rather than deferred.
4. What did *not* fail and was verified rather than assumed: transaction atomicity (single `BEGIN…COMMIT`, verified nothing partial could land), identity preservation (explicit-id inserts + `setval` sequence reset per table, so the next real `INSERT` won't collide with migrated history), and RLS's actual effect on the app's own connections (none — `postgres`/`service_role` bypass RLS by design, confirmed rather than assumed, which is *why* Phase 5's `authenticated`-role policies are still pending rather than guessed at now).
5. Deliberately not fixed in this phase, flagged instead: pool sizing against real concurrent-admin load (see Performance review), and the fact that `.env.example` still documents the newer `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY` naming while `.env.local` (and this phase's own scripts) use the legacy `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` names — harmless today since nothing reads either yet, but worth reconciling before Phase 4/5 actually consume them.

**Rollback plan.** Every artifact this phase added is additive and inert until Phase 3 wires the application to read from it:
- Schema/RLS: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` against the Supabase project fully reverts to the pre-Phase-2A empty state (this project's Postgres has no other consumer of `public` yet). Re-running `scripts/migrate-postgres.mjs` afterward reapplies both migrations from scratch.
- Data: since every insert is `ON CONFLICT (id) DO UPDATE`, rerunning `scripts/migrate-to-postgres.mjs` after any partial or bad state is always safe — it reconciles Postgres back to whatever SQLite currently holds, it never duplicates.
- SQLite is untouched by any part of this phase (script opens it `{ readOnly: true }`) — the live application's actual behavior has zero exposure to anything in this phase succeeding or failing.
- Code rollback: `git revert` the single commit this phase produces; nothing outside `src/server/db/postgres/`, `drizzle/`, `scripts/migrate-to-postgres.mjs`, and this doc was touched.

**Verification performed:** `astro check` — same 18 pre-existing, unrelated errors as Phase 1's own documented baseline (`MobileBottomBar.astro`, `SubscriptionConfigurator.astro`, `bouquetStore.ts`, `search.astro`); zero new errors from any file this phase touched. `astro build` — succeeds. Live connection, full schema inspection, full data migration, and full verification all executed for real against the actual Supabase project (not simulated) — every number in this section came from an actual query result, not an estimate.

**Blocking for Phase 2B (not started, not begun without further approval):** nothing technical — Postgres is now a fully certified, populated, RLS-protected replica of current SQLite data. Phase 2B is repository migration, service migration, authentication migration, and storage migration — each its own reviewable milestone per the standing "one architectural milestone, one commit" rule.
