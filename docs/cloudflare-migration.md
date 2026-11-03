# Vercel → Cloudflare Workers migration

Status (2026-11-03): **tested locally in the Cloudflare runtime against the production baseline; not deployed; free hosting not demonstrated; not ready for cutover.** Production DNS, Vercel, Supabase and the live site are unchanged.

| | Evidence |
|---|---|
| Verified locally | Routes, content, SEO and workflows vs the production baseline; browser pass; CPU/query measurements (Node V8, not Cloudflare); backup scripts end to end against stand-ins |
| Verified remotely | Nothing on Cloudflare (no account access). GitHub: the Vercel integration refuses new builds ("Account is blocked") since 2026-11-03; last successful production deploy 2026-10-31 (`f0e85b1`) |
| Untested / blocked | Deployed Worker CPU and invocations, Hyperdrive → Supabase, zone purge, Images on real photos, GIF/EXIF upload output, Supabase sign-in/MFA/logout/recovery, production backup, any recovery target |

**Production baseline:** `f0e85b1` (`main`), the last commit Vercel deployed to Production (GitHub deployment 7458090058, 2026-10-31).

## What changed (branch `migrate/cloudflare-workers`)

One codebase, two build targets. `DEPLOY_TARGET` unset (every Vercel build) keeps the Vercel adapter and behaviour; `DEPLOY_TARGET=cloudflare` builds a Worker with static assets (`@astrojs/cloudflare` 14.4.4, Astro 7.4.0, wrangler 4.156.2).

| Area | Vercel | Cloudflare |
|---|---|---|
| Static pages (178) | CDN, CSP as response header | Workers static assets (free, no Worker run); CSP in a `<meta>` tag moved first in `<head>`, reviewed inline-script hashes added at build; other security headers + HSTS from `_headers` |
| On-demand pages/APIs | Vercel Function, shared `pg` pool | Worker; per-request `pg` pool through **Hyperdrive** (no query caching); same middleware, auth, CSRF and body limits |
| Public page cache | Vercel CDN, `s-maxage`, `Vercel-Cache-Tag`, purge via `@vercel/functions` | Cache API in the Worker (`src/server/platform/edgeCache.ts`): same `s-maxage`, full-URL key (tracking params excluded except for redirects), tags → `Cache-Tag`, lifetime enforced in code; admin saves purge by tag through the zone API |
| Stored garland photos | `/_vercel/image`, 4 widths | `/_image` via the Images binding, restricted in middleware to the same 4 widths, WebP, q75, Supabase `media` bucket only |
| Upload sanitising | sharp decode + re-encode | Images binding re-encode; GIF/WebP frame count and canvas checked from the file structure before decoding |
| Preview | Vercel preview (`VERCEL_ENV=preview`) | Separate Worker `fresh-petals-preview` on workers.dev (`FP_DEPLOY_ENV=preview`): admin + enquiry log refused, `noindex` on every response, no analytics, production canonicals |
| `/faqs/` | served | 307 → `/faqs` (canonical form) |

Files: `astro.config.mjs`, `wrangler.jsonc`, `src/server/platform/*`, `src/middleware.ts`, `src/server/db/postgres/client.ts`, `src/server/services/GarlandWebsite.ts`, `src/server/media/imageSafety*.ts`, `src/data/garlandRules.ts`, `src/server/http/requestGuard.ts`, `scripts/build/security-headers.mjs`, `scripts/cloudflare/*`, `scripts/backup/*`, `.github/workflows/cloudflare.yml`, `scripts/audit/cloudflare.test.mjs`.

## Configuration

Runtime secrets (`wrangler secret put NAME`, and again with `--env preview`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CF_ZONE_ID`, `CF_CACHE_PURGE_TOKEN` (token with only *Zone → Cache Purge* on onlyfreshpetals.in; production only). `DATABASE_URL` is not needed at runtime when Hyperdrive is bound.

Public vars (`wrangler.jsonc`): `SITE_URL=https://onlyfreshpetals.in`; preview adds `FP_DEPLOY_ENV=preview`.

Build-time (GitHub Actions secrets/vars): `CLOUDFLARE_API_TOKEN` (Workers Scripts edit + Account Hyperdrive read), `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL` (build reads the catalogue; a read-only role suffices), optional `PUBLIC_GA_MEASUREMENT_ID`, `PUBLIC_GOOGLE_SITE_VERIFICATION`, `PUBLIC_BING_SITE_VERIFICATION`. The preview build drops the three public ones.

### Hyperdrive (once)

```sh
npx wrangler cert upload certificate-authority --ca-cert src/server/db/postgres/supabase-ca.pem --name supabase-ca
npx wrangler hyperdrive create fresh-petals-db \
  --connection-string="postgres://postgres:<DB_PASSWORD>@db.hjhmetomcaskrrwkgrbp.supabase.co:5432/postgres" \
  --ca-certificate-id <CA_ID> --sslmode verify-full --caching-disabled
```

Use the **direct** connection (Cloudflare's Supabase guidance). If the direct host is IPv6-only and Hyperdrive cannot reach it, use the session pooler (`aws-0-<region>.pooler.supabase.com:5432`, user `postgres.hjhmetomcaskrrwkgrbp`) instead. Put the returned id in both `hyperdrive` entries of `wrangler.jsonc`. Caching stays disabled: prices and admin edits must be read fresh.

## Deploy

```sh
node scripts/cloudflare/deploy.mjs preview                          # https://fresh-petals-preview.<account>.workers.dev
node scripts/cloudflare/deploy.mjs production --confirm-production  # no traffic until the custom domain is attached
```

or GitHub → Actions → *Cloudflare deploy* → Run workflow. `build.mjs` fails the build if preview controls leak into production (or the reverse), if any static page lacks a CSP or runs an unhashed inline script, or if a canonical leaves onlyfreshpetals.in.

## Content updates

| Change | Vercel today | Cloudflare |
|---|---|---|
| Garland save/publish/unpublish, occasion assignments | purge on save; ≤180 s if purge fails | purge on save (zone API by tag); without a purge, visible after ≤120 s (measured in workerd: 120 s) |
| Catalogue product price, status, new/removed products, `sitemap.xml`, header menu | next deployment | next deployment: **Actions → Cloudflare deploy → Run workflow** (or `repository_dispatch` type `rebuild-site`; after cutover also every push to `main` when repo variable `CLOUDFLARE_AUTO_DEPLOY=true`) |

Purging a cache never rebuilds prerendered HTML; only a deployment does.

## Verified locally (workerd via wrangler 4.156.2, isolated fixture DB `127.0.0.1:55437/freshpetals_audit`, 245 synthetic products, 156 draft garlands)

Against the **unmodified production baseline `f0e85b1`** (Vercel build, served with its own `config.json` route headers) and this branch's Cloudflare production build, same fixture data and configuration:
- 266 URLs (all 233 sitemap URLs, redirects, 404s, filters, admin/API, probes): identical status, normalised HTML (per-render random element ids aside), every CSP directive including script/style hash sets, canonical, robots, title, JSON-LD, WhatsApp links. Intended differences only: HSTS sent by the Worker (Vercel adds it at its domain layer); static files carry `cache-control: public, max-age=0, must-revalidate`; on static pages `frame-ancestors` is absent from the `<meta>` policy (browsers ignore it there) while `X-Frame-Options: DENY` refuses framing; `/faqs/` → 307 `/faqs`.
- Workflows, same results on both: admin boundary (anonymous → login/401, first factor → 403, MFA page, full admin; private no-store); cross-site POST 403; enquiry 201 → one row → admin list; failed enquiries (invalid phone 400 with field error, `text/plain` 415, 40 KB 413, cross-site 403) write nothing; admin edit → DB change (Cloudflare: purge with `occasion-index`, `occasion:housewarming`); failed edits (empty name 400, unknown id 404).
- Browser (Chromium, 390 px and 1440 px, 9 pages each): no CSP violations, no script errors, no horizontal overflow; add to cart → item on the cart page. Of 349 same-origin requests, 339 were static files (no Worker run) and 10 were Worker renders.
- Edge cache MISS → HIT; freshness bound 120 s without purge. Upload sanitiser on the local Images binding: JPEG/PNG/WebP re-encoded; frame, canvas, type, SVG and truncated-file refusals.
- Preview build: noindex on static and dynamic responses, no analytics ID, production canonicals, admin/API/enquiry log 403.
- Tests 118/118; `astro check`: only the 20 pre-existing errors on both targets.

Not testable here: Supabase Auth (sign-in, MFA, logout, recovery) and Storage uploads need Supabase services; container registries are blocked, so no local Supabase stack could be started. The fixture doubles only the session lookup; logout returns 500 on both baseline and Cloudflare for that reason.

## Free-tier assessment

**Local measurements, not Cloudflare metrics.** Node 24 V8 CPU per uncached on-demand request (render + pg parsing, I/O wait excluded), 15 warm samples per route per run, 2–3 runs; ranges show run-to-run spread. Queries counted per request.

| Route | Queries | Warm median CPU | p90 | First request in a fresh process |
|---|---|---|---|---|
| `/` | 6 | 12.5–14.4 ms | 24–32 ms | ~0.9 s |
| `/categories/bouquets` (363 KB HTML) | 1 | 11.6–16.7 ms | 25–29 ms | 37–46 ms |
| `/locations/<city>` | 6 (was 11) | 10.7–11.6 ms (was 22.2) | 19 ms | 30–33 ms |
| `/locations/<city>/shop` | 5 | 9.6–11.4 ms (was 18.4) | 21–24 ms | 13–21 ms |
| `/occasions` | 6 | 8–11 ms | 16–17 ms | |
| `/occasions/<slug>` | 1 | 6.5–6.7 ms | 15–16 ms | |
| `/categories/garlands` | 5 | 7.3–7.6 ms | 10–11 ms | |
| guides, sitemaps | 1–5 | 3–5 ms | | |
| 404, filter 301, `/studio/*` | 0 | 0.2–1.3 ms | | |

The city-page reductions come from reading garlands once per request and reusing the snapshot-only category collections (commit `1eb1038`). What remains on `/` and the bouquet list is rendering and row mapping; further cuts would mean prerendering pages whose freshness on save is part of today's behaviour.

Workers Free: 10 ms CPU per request, 100,000 Worker requests/day (static files free and don't run the Worker), errors 1102/1027 when exceeded. Several page types exceed 10 ms on cache misses at the median and all heavy ones at p90 in local measurements. **Free hosting is not demonstrated.** Whether Cloudflare's own accounting agrees can only be settled with a deployed preview (Workers Observability `cpuTime`, invocation counts and 1102 errors).

Request volume: a full page view is typically one Worker request (the HTML of an on-demand page) plus static files; cache hits still count as Worker requests (<1 ms CPU). Peak traffic and the earlier automated spike could not be measured (no Vercel or Cloudflare analytics access). Hyperdrive Free 100,000 queries/day (≤6 per uncached page view); Images 5,000 unique transformations/month; tag purges 5/min.

If Cloudflare's metrics confirm the overrun, the practical options are: Workers Paid (US$5/month, 30 s CPU; needs approval); or prerendering `/`, the bouquet list and city pages and refreshing them by rebuild on save (minutes instead of seconds; a behaviour change to approve first).

## Backups (owner-run; no production backup exists from this work)

```sh
SUPABASE_DB_URL=… SUPABASE_URL=https://hjhmetomcaskrrwkgrbp.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
  scripts/backup/supabase-backup.sh ~/fresh-petals-backups
REHEARSAL_DB_URL=postgresql://postgres:pw@127.0.0.1:55440/rehearsal scripts/backup/restore-rehearsal.sh ~/fresh-petals-backups/<stamp>
```

Scope: exact row counts for every public table, Auth users/identities/MFA factors and Storage objects/bytes per bucket, before and after the dump (a difference means writes landed during the run; the dump itself is one snapshot); `public`, `auth` and `storage` schemas (custom format) plus a readable public schema; every Storage object with path, size and SHA-256, checked against `storage.objects`; SHA256SUMS. Files are owner-only (700/600). The restore rehearsal restores `public` into a local throwaway database and compares exact counts (**restore tested**); `auth`/`storage` are only checked for presence in the dump (**export verified**). Storage files and database rows are not captured at the same instant.

Tested against stand-ins (2026-11-03): local database named for the project with fixture public data and synthetic auth/storage rows; mock Storage API with 1,006 objects across two buckets and nested folders (crosses the 1,000-item page). Results: backup exit 0, counts unchanged, all 1,006 objects listed and matched; a size mismatch → exit 1 and no SHA256SUMS; repository-path and wrong-project guards refuse; rehearsal 19/19 tables match; a tampered file fails checksum verification; non-local rehearsal targets refused. Not tested: real Supabase permissions on `auth`/`storage` for the `postgres` role, pg_dump version against the server, real Storage API behaviour.

Excluded: Auth configuration (providers, email templates, redirect URLs, MFA settings, rate limits), API keys and secrets, database roles and passwords, extensions and Supabase-managed schemas, Realtime/Edge settings, project settings, logs. Never restore over production: recovery from a backup goes to a new project or a local database.

## Access needed to finish verification

| Check | What is needed |
|---|---|
| Preview deploy, Cloudflare CPU/invocation metrics | GitHub Actions secrets `CLOUDFLARE_API_TOKEN` (Account: Workers Scripts Edit, Workers Observability Read, Hyperdrive Edit, Account Settings Read) and `CLOUDFLARE_ACCOUNT_ID`, plus build `DATABASE_URL`; or a Cloudflare dashboard session in the browser for reading metrics. This workspace cannot reach api.cloudflare.com, so deploys run from GitHub Actions or your machine |
| Hyperdrive config | Supabase database password (direct or session-pooler connection), entered by you in `wrangler hyperdrive create` |
| Production backup | Supabase session-pooler `SUPABASE_DB_URL` and `SUPABASE_SERVICE_ROLE_KEY`, run on your machine (this workspace cannot reach supabase.co) |
| Auth/MFA/recovery/upload tests | A separate free Supabase project (synthetic users, own Storage bucket) wired to the preview Worker with write protections switched off for that project only; never the production project |
| Recovery host | Vercel account unblocked and confirmed serving, or approval of another host |

## Cutover (needs approval; nothing here has been done)

Current public DNS (2026-11-03, via dns.google): nameservers `ns21/ns22.domaincontrol.com` (GoDaddy); `@ A 216.198.79.1` (Vercel, TTL 600); `www CNAME 91b23daa6caaa54f.vercel-dns-017.com` (TTL 3600); `@ TXT google-site-verification=g14SkB…` (TTL 3600); no MX, no CAA, no DNSSEC (no DS). Other names can't be listed publicly: export the full zone from GoDaddy first.

A Worker custom domain needs the zone on Cloudflare (Free plan, full setup = nameserver change).

1. **Before:** backups taken and verified; preview deployed and checked (incl. real `cpuTime`); Hyperdrive verified; secrets set; GoDaddy zone exported; confirm the Vercel project is active (not paused) and still holds both domains — that is the rollback target.
2. **Zone:** add onlyfreshpetals.in to Cloudflare (Free). Recreate every exported record exactly, apex A and www CNAME as **DNS only** (grey), TXT unchanged. SSL/TLS → *Always Use HTTPS* on. Leave DNSSEC off until the move settles.
3. **Nameservers:** at GoDaddy, switch to the two Cloudflare nameservers. The site keeps serving from Vercel throughout (records unchanged). Wait for "Active" and check Search Console and Vercel domain status.
4. **Deploy** production (`deploy.mjs production --confirm-production`) and set `CF_ZONE_ID` and `CF_CACHE_PURGE_TOKEN`.
5. **Switch:** Workers → fresh-petals → Domains & Routes → add custom domain `onlyfreshpetals.in` (replaces the apex A record). For `www`, match today's Vercel behaviour (check Vercel → Domains; typically a redirect to the apex) with a Redirect Rule `www.onlyfreshpetals.in/*` → `https://onlyfreshpetals.in/${1}` 301, on a proxied `www` record.
6. **After:** set repo variable `CLOUDFLARE_AUTO_DEPLOY=true`; disconnect Vercel's Git deployments only after the rollback window.

**Post-launch checks (first hour, then daily for a week):** home, a static product, a garland page, an occasion page, a city page; `/sitemap*.xml`, `/robots.txt`; canonical + no `noindex` on production; admin sign-in with MFA, one product edit and its "Website" check; one real WhatsApp enquiry reaching the admin list; Workers Observability errors and `cpuTime`; Hyperdrive errors; Search Console coverage/crawl errors.

**Recovery coverage (no option is verified; Vercel is not operational).**

| Failure | Recovery | Status |
|---|---|---|
| Faulty release | `npx wrangler rollback` (or Actions → deploy the previous commit). Same Supabase backend, so enquiries recorded meanwhile stay | Available once deployed; not exercised |
| Daily quota exhausted (error 1027) | None free: static pages keep serving, every on-demand page (including `/`) fails until 00:00 UTC (05:30 IST) | Workers Paid would avoid it (approval needed) |
| CPU overrun (error 1102) | None free: the affected requests fail | Measure on preview first |
| Cloudflare hosting unavailable | Vercel was the only other host; its account refuses deployments ("Account is blocked") and an external fetch of onlyfreshpetals.in on 2026-11-03 got a client error (status not visible) | No working fallback host |

**Rollback triggers:** any error 1102 (CPU) or 1027 (daily limit); 5xx above 1 % over 5 min; enquiries not persisting; admin sign-in failing; pages missing vs sitemap; CSP blocking site scripts.
**Rollback to Vercel (only if its account is restored and it is confirmed serving):** remove the Worker custom domain; recreate `@ A 216.198.79.1` and `www CNAME 91b23daa6caaa54f.vercel-dns-017.com` as DNS-only. Traffic returns to Vercel within the record TTL (Cloudflare proxied → DNS-only takes effect in minutes). Both hosts use the same Supabase project, so enquiries received on Cloudflare stay in the database. Only catalogue changes made after cutover need a Vercel redeploy to appear there.
