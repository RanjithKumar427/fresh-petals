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

### Phase 2 — Database (not started)

Postgres schema applied via `npm run db:migrate`, `productCatalog.ts` seeded through Postgres, row-count parity checked against current SQLite dev data. No application code touches Postgres yet.
