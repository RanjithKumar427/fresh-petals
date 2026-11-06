# Vercel → Cloudflare Workers migration

## Status (2026-11-06)

**Functionally verified end to end on the staging Worker; not yet cut over.** Production DNS, Supabase, the live domain and Vercel are unchanged. `onlyfreshpetals.in` itself answers **402** (Vercel `DEPLOYMENT_DISABLED`), and the production Supabase project answers **402 `exceed_egress_quota`** until its usage cycle resets on 8 Nov 2026.

**Blocking decision (owner): Workers Free enforces its 10 ms CPU limit, and an uncached page render costs 35–75 ms.** See *Free hosting* below. Either approve Workers Paid (US$5 a month), or accept prerendering the storefront, which means garland edits appear after a deployment instead of within seconds. Everything else in this document works on either choice.

Staging: Worker `fresh-petals-staging` on `https://fresh-petals-staging.branjith-kumar24-01.workers.dev` (noindex, no analytics, enquiry writes refused), Supabase project `wyndmywdtacucojvudxg` holding the 3 Nov production export, Hyperdrive `fresh-petals-staging-db`.

### Verified on staging (synthetic accounts and records, all removed afterwards; original records, photos and the owner's admin account unchanged by digest)

| Area | Runner (`scripts/staging/`) | Result | Revision |
|---|---|---|---|
| Auth: login, MFA, recovery, reset cookies, logout, non-admin and no-profile refusal, CSRF | `auth-integration.mjs` | 52/52 | `6b5a1c0` |
| Auth UI in a browser: forms, recovery link cleared from the address bar, autofill hints, cross-site POST, CSP | `browser-auth.mjs` | 25/25 | `a5a1ceb` |
| Catalogue, uploads (JPEG/PNG/WebP), image replacement and deletion, garland publish/edit/photo/archive, sitemaps, filters, enquiries (keyed window) | `catalogue-lifecycle.mjs` | see the 6 Nov report | `5a4df99` |
| Catalogue addition, photo edit and removal through a deployment | temporary branch, removed | 15/15 | throwaway commits on `6b5a1c0` |
| Customer basket → WhatsApp draft → enquiry stored (keyed) / refused for visitors while WhatsApp still opens | `browser-basket.mjs` | 15/15 | app source of `6b5a1c0` |
| Every sitemap page (387): status, canonical, noindex, no analytics, title, description, JSON-LD; redirects; 404s; WhatsApp links; garland enquiry; image delivery; robots; headers | `public-site.mjs` | 36/37: one page 503 under a 6-way crawl (CPU limit) | app source of `6b5a1c0` |
| Bot/crawler cost per traffic pattern (Cloudflare analytics) | `traffic-cost.mjs` | below | `ab6e7ed` |
| Password-reset email: Worker gives one answer for every address; nothing delivered | `email-probe.mjs` | see below | `6b5a1c0` |
| Rollback: `wrangler rollback <version>` and back | manual drill | about 14 s each way | `6b5a1c0` ↔ `4116662` |

Local: `astro check` 0 errors, 0 warnings; `node --test` 162/162 tracked; staging builds pass their output checks.

### Defects found on staging and fixed (6 Nov 2026)

- Recovery-link tokens stayed in the address bar in a signed-in browser (`a5a1ceb`).
- JPEG/PNG uploads refused by the Images binding (`d7b9a03`).
- Deleted images left their Storage objects (`d25a8b7`).
- **Bot cost.** Every unknown query parameter forced a fresh render, costing 60–150 KB of database results and 35–75 ms of CPU. `/products/<anything>` read every garland. Fixed in `f08ba5c` and `ee97ccc`: the cache key keeps only the parameters each path reads, an invented garland slug or code costs one indexed lookup, and robots.txt also disallows `/locations/*/shop?` and `/garland-enquiry`.
- **500s under a crawl.** Supavisor's session mode allows 15 clients, but Hyperdrive opened up to 20 (`EMAXCONNSESSION`). The staging Hyperdrive is now limited to 10, and deploys refuse a config above 10 (`5b07423`). **The production config `fresh-petals-db` still has 20; fixing it is a cutover step.**
- Worker database errors now log the driver's code and message (`4116662`).

### Free hosting (measured on the deployed staging Worker, 6 Nov 2026)

Cloudflare GraphQL analytics (`workersInvocationsAdaptive`, `hyperdriveQueriesAdaptiveGroups`), 25 distinct URLs per pattern, 4 at a time (`traffic-cost.mjs`):

| Pattern | DB results per request, before → after the bot fixes | Worker CPU p50 before → after |
|---|---|---|
| `/?<unknown param>` | 91 KB → 8 KB | 39 → 1.6 ms |
| `/categories/garlands?<unknown>` | 61 KB → 25 KB | 62 → 2.2 ms |
| `/occasions/wedding?<unknown>` | 80 KB → 9 KB | 60 → 3.8 ms |
| `/locations/<city>?<unknown>` | 146 KB → 20 KB | 76 → 1.9 ms |
| `/products/<invented slug>` | 106 KB → 0 KB (one indexed lookup) | 59 ms → (too few to report) |
| old `?colour=` filter link (301) | 0 KB | 6 ms |
| cache hit | 0 KB | 2–3 ms |
| full sitemap crawl (213 URLs, 58 Worker renders) | 9.5 MB in total, about 163 KB per render | 35 ms |

The remaining "after" cost comes from the first concurrent batch, before the cache fills. Across the six bot patterns, database results fell from 14.0 MB to 2.1 MB.

- **Workers Free, CPU: not demonstrated.** An uncached render costs p50 34–76 ms and p90 78–220 ms, against a 10 ms limit. Isolated renders were tolerated, but bursts were not:
  - 20 of 80 uncached requests at 4 at a time were refused (`exceededCpu`, HTTP 503), cut off at about 10 ms;
  - after the fixes, 2 of 255 failed in a 387-page crawl at 6 at a time.

  The earlier "P50 1–2 ms" preview figures (3 Nov) were cache hits: workers.dev does cache.
- **Workers Free, requests:** 100,000 a day. Static pages and assets don't count. A page view costs one request, and the incident's 56,000 filter-link renders a day would now be cached 301s, within the limit.
- **Hyperdrive Free:** query volume is far below the free allowance, at 4–8 queries per uncached render.
- **Images:** 156 photos × 4 widths is about 624 unique transformations, against a free allowance of 5,000 a month.
- **Supabase Free:** egress is 5 GB a month, about 170 MB a day, which covers about 1,000–2,800 uncached renders a day. A full search-engine crawl costs about 10 MB. Database is 28 MB of 500 MB; Storage is 22 MB of 1 GB.
  - The October incident (2.8 GB a day) came from uncached renders. With the edge cache, cache-key normalisation and robots rules, link-following crawlers now mostly hit the cache.
  - Adversarial bots that vary real parameters (such as `?page=` on the city shop) can still force renders. After cutover, add the zone's free rate-limiting rule (see the runbook).
- **Deployments:** built and deployed from this PC with wrangler; about 4–5 minutes and about 1.5 GB of memory per build. No paid service is used.

**Verdict.** Requests, database size, Storage, Images and deployments fit the free tiers, and Supabase egress fits ordinary traffic. **Workers Free CPU does not:** uncached on-demand pages exceed 10 ms by 4–20×, and Cloudflare refuses some of them in bursts. There are two remedies, both needing the owner's approval:

| Option | Cost | Effect |
|---|---|---|
| **Workers Paid (recommended)** | US$5 a month | 30 s CPU, 10 M requests a month. No code change; live garland publishing stays as it is |
| Prerender the storefront | free | Static pages never run the Worker or read the database. Garland and occasion edits then appear after a deployment (minutes) instead of a purge (seconds); the Website check and purge logic need rework |

### Publishing process (verified on staging)

| Change | How it reaches the site | Verified |
|---|---|---|
| Garland: publish, edit, photo swap, archive (admin) | Live render. On production a save purges the zone cache by tag; on workers.dev the 120 s cache expires (102–113 s measured) | lifecycle runner |
| Catalogue product: status, occasions (admin) | Next deployment (status); occasions live | lifecycle + publishing test |
| Catalogue product: new product, photo, copy | An entry in `src/data/productCatalog.ts` (photo under `public/images/`), committed, then a deployment. The deploy's `[catalogue]` report lists what is live | publishing test: added → live in page, list and `sitemap.xml`; photo swapped → new `og:image`; archived → 404, gone from sitemap and list, saved baskets drop it |
| Prices | Never shown: every catalogue product is quote-only ("Price on WhatsApp") | — |
| Sitemap images | Only photos reviewed in `src/data/productPhotos.ts` are listed as `image:loc` | — |

Deploy commands:
- Staging: `node scripts/staging/deploy-worker.mjs --env=<staging env> --apply [--db-port=6543]`.
- Production: see the runbook.

### Email (password-recovery email)

- **Blocked externally.** Supabase's built-in email service sends only to the organisation's team members, about 2 an hour. Reliable recovery email needs a custom SMTP sender (for example Resend's free tier, or Cloudflare Email Sending once the zone is on Cloudflare) with SPF/DKIM records on `onlyfreshpetals.in`. That means a new provider account and DNS records, both owner actions.
- **What was verified:** the Worker answers identically for known and unknown addresses (no enumeration), and Supabase refused the reserved test address, so nothing was delivered.
- **Until SMTP exists,** the admin recovers through a service-role recovery link (`auth.admin.generateLink`), opened in a fresh browser profile, followed by TOTP. This is the path the synthetic Auth runs verify, without email.

## Cutover runbook (each step needs the owner's go-ahead; none has been done)

Facts as of 6 Nov 2026:
- The Cloudflare account holds only `fresh-petals-preview` and `fresh-petals-staging`, and no zones. Account and configuration IDs are in the owner's private cutover report, not in this public repository.
- Production Hyperdrive `fresh-petals-db` points at the production project's session pooler (port 5432), verify-full, caching off, **origin connection limit 20**.
- DNS: GoDaddy nameservers; `@ A 216.198.79.1`; `www CNAME …vercel-dns-017.com`; a Google verification TXT record; no MX.

**0. Decide** Workers Paid (or prerendering), see *Free hosting*.

**1. Wait for production Supabase.** After the 8 Nov reset, check that `https://hjhmetomcaskrrwkgrbp.supabase.co/storage/v1/object/public/media/<a stored path>` answers 200, not 402.

**2. Final backup and data check.**
- Run the read-only snapshot export: `node <audit>/work/prod-export.mjs <new dir outside the repo>` (one REPEATABLE READ READ ONLY transaction; it doesn't need pg_dump).
- The 156 photos are on this PC, byte-exact in `public/images/garlands/` of the original checkout.
- Encrypt the export as on 4 Nov and copy it off this PC.
- Compare the export's table digests with `report/staging-restore-baseline.json`. Production is the system of record and the Worker will use it directly, so no data copy is needed. The comparison only shows whether anything changed since 3 Nov.

**3. Production Hyperdrive limit:**

```sh
npx wrangler hyperdrive update <fresh-petals-db id> --origin-connection-limit 10   # id: npx wrangler hyperdrive list
```

**4. Supabase production Auth settings:**
- Site URL `https://onlyfreshpetals.in`.
- Redirect URLs include `https://onlyfreshpetals.in/admin/reset-password`.
- Signups off.
- Custom SMTP when available.

**5. Deploy the production Worker.** This routes no traffic: `workers_dev` is off and there are no routes. Run from a clean checkout of the tested branch:

```sh
HYPERDRIVE_ID=<fresh-petals-db id> DATABASE_URL=<production transaction pooler URL> \
PUBLIC_GA_MEASUREMENT_ID=G-V75FJQ06ZS node scripts/cloudflare/deploy.mjs production --confirm-production
npx wrangler secret put SUPABASE_URL --name fresh-petals          # and SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (production values)
```

**6. Zone (owner, DNS):**
- Add `onlyfreshpetals.in` to Cloudflare (Free plan).
- Import the exported GoDaddy zone, keeping the Google TXT record.
- Switch GoDaddy's nameservers to the two Cloudflare nameservers, then wait for "Active". The site stays on Vercel's 402 meanwhile.

**7. Attach:**
- Workers → `fresh-petals` → Domains → add `onlyfreshpetals.in`.
- Add a proxied `www` record with a Redirect Rule `www.onlyfreshpetals.in/*` → `https://onlyfreshpetals.in/${1}` (301).
- Set the secrets `CF_ZONE_ID` and `CF_CACHE_PURGE_TOKEN` (Zone → Cache Purge only).
- Add one rate-limiting rule (free plan) for requests with a query string to `/locations/*/shop`, `/categories/*` and `/occasions/*`.

**8. Verify:**
- `node scripts/staging/public-site.mjs --production`: every sitemap page indexable, with analytics, canonicals, redirects, WhatsApp and images.
- Sign in as admin with TOTP; save one garland and confirm its "Website" check reports Live.
- Send one real WhatsApp enquiry and confirm it reaches the admin inbox.
- Watch Workers analytics for `exceededCpu` and 5xx.
- Search Console: resubmit the three sitemaps.

### Rollback

| Failure | Action | Status |
|---|---|---|
| Faulty release | `npx wrangler rollback <previous version id> --name fresh-petals -y` (`npx wrangler versions list --name fresh-petals` lists them) | **Drilled on staging, 6 Nov:** live within about 14 s each way |
| Worker or zone unusable | Remove the Worker's custom domain. The domain then serves nothing, which is today's state (402). No other host exists: Vercel refuses deployments, so it is **not** a fallback | — |
| Data loss or corruption | Restore the step-2 export into a new Supabase project (the `restore-data.mjs` path, proven on staging on 4 Nov), then point a Hyperdrive config at it and redeploy. Never restore over production | Proven on staging |
| Production Supabase restricted again | Same as data loss, using the staging-proven restore into a separate organisation. This needs a fresh export first | Proven on staging |

**Rollback triggers:** `exceededCpu` or 5xx above 1% over 5 minutes; enquiries not stored; admin sign-in failing; sitemap pages missing; CSP blocking scripts.

Status (2026-11-03, superseded above): **tested locally in the Cloudflare runtime against the production baseline; not deployed; free hosting not demonstrated; not ready for cutover.** Production DNS, Vercel, Supabase and the live site are unchanged.

| | Evidence |
|---|---|
| Verified locally | Routes, content, SEO and workflows vs the production baseline; browser pass; CPU/query measurements (Node V8, not Cloudflare); backup scripts end to end against stand-ins |
| Verified remotely | Nothing on Cloudflare (no account access). GitHub: the Vercel integration refuses new builds ("Account is blocked") since 2026-11-03; last successful production deploy 2026-10-31 (`f0e85b1`) |
| Verified on staging (2026-11-04, `0f75e03`) | Isolated Worker `fresh-petals-staging` on workers.dev, Hyperdrive to the staging database, stored photos through Images, admin sign-in, TOTP MFA, logout and the password-only block. Not production |
| Untested / blocked | Deployed Worker CPU and invocations, zone purge, GIF/EXIF upload output, **email delivery and email-based password recovery**, editing, upload, enquiry and bot-resilience workflows on staging, any recovery target |

**Production baseline:** `f0e85b1` (`main`), the last commit Vercel deployed to Production (GitHub deployment 7458090058, 2026-10-31).

## Remote preview results (2026-11-03, runs for `d0b6173`, `97cbba2`, `4a7123c`)

Preview: https://fresh-petals-preview.branjith-kumar24-01.workers.dev (Worker `fresh-petals-preview`, workers.dev only, noindex, no analytics, admin/API/enquiry log 403). Hyperdrive `fresh-petals-db` created by the pipeline (CA-verified, caching off). 19/20 functional checks pass on every run.

**Stored-photo resizing (the failing check):** every stored photo's original returns **HTTP 402** from Supabase Storage: `Service for this project is restricted due to the following violations: exceed_egress_quota. The project owner must upgrade their plan or remove spe[nd caps]…`. The Images binding then receives that JSON instead of image bytes and the endpoint answers 400 "Source is not an image". The resizing path (allowlist → fetch → binding) is unchanged and correct. The cause is the Supabase project's egress restriction, which equally breaks those photos on the live site, since their `src` is the same Supabase URL. Resizing on Cloudflare stays unverified until Storage serves the files again.

**Correction (6 Nov 2026):** workers.dev does cache (the Cache API returned HIT), so most of the requests below were cache hits. Uncached renders measured 6 Nov cost p50 34–76 ms; see *Free hosting* above.

**Cloudflare CPU (GraphQL `workersInvocationsAdaptive`, µs; 25 sequential uncached requests per route, workers.dev has no edge cache):** P50 1.1–2.1 ms and P90 1.3–2.8 ms on every page route across two runs; P99 up to 6 ms on most routes, with single outliers of 24–95 ms on `/occasions/birthday` and `/categories/garlands`; first requests in fresh isolates up to 29–74 ms; 404s ~3.6–4 ms; `/_image` ~4–7 ms. 0 Worker errors and 0 HTTP 5xx in ~300 requests per run; static pages never invoked the Worker. These are far below the local Node estimates further down, which overstated CPU.

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

### Preview: what the owner sets up (once)

The preview deploys from GitHub Actions on every push to `migrate/cloudflare-workers` (job `preview`). It needs three repository secrets (Settings → Secrets and variables → Actions → New repository secret):

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | A Cloudflare API token (My Profile → API Tokens → Create custom token) with **Account** permissions: Workers Scripts – Edit, Hyperdrive – Edit, Account Analytics – Read, SSL and Certificates – Edit (for the CA upload), Account Settings – Read. Account resources: your account only. No zone permissions are needed for the preview |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard → Workers & Pages → Account ID |
| `DATABASE_URL` | The same transaction-pooler URL Vercel uses (build-time catalogue read) |

Optional: `HYPERDRIVE_ORIGIN_URL` (secret) if the session pooler should not be derived from `DATABASE_URL`; `HYPERDRIVE_ID` (variable) to pin an existing config. Your workers.dev subdomain must exist (Workers & Pages → it is created on first visit).

Then push any commit to the branch (or re-run the latest "Cloudflare deploy" run). `scripts/cloudflare/preview-pipeline.mjs`:
1. reports missing secret **names** and stops if any are absent;
2. reuses the Hyperdrive config `fresh-petals-db`, or uploads `supabase-ca.pem` as `fresh-petals-supabase-ca` and creates the config from the session pooler (`DATABASE_URL` with port 6543 → 5432), `--caching-disabled --sslmode verify-full`; the id is patched into the runner's checkout only;
3. builds the preview and refuses to deploy unless the output is the Worker `fresh-petals-preview`, workers.dev only, no routes, `FP_DEPLOY_ENV=preview`;
4. deploys, runs 20 functional checks (pages, filters, redirects, 404, sitemaps, admin/API/enquiry refusal, image endpoint, noindex, canonicals, no analytics ID), then timed load phases per route;
5. reads Cloudflare GraphQL analytics (`workersInvocationsAdaptive`: requests, errors, subrequests, CPU P50/P90/P99) per phase.

Results appear on the commit as the check run **"Cloudflare preview evidence"** (also the run's job summary). The repository is public, so the pipeline writes no secret, connection string or account detail there.

Re-check an existing preview without deploying: `PREVIEW_URL=https://fresh-petals-preview.<sub>.workers.dev node scripts/cloudflare/preview-pipeline.mjs` (add `MEASURE=1` and the two Cloudflare variables for metrics).

Write workflows (sign-in, MFA, recovery, uploads, enquiries, admin edits) stay refused on this preview because it reads the production database. Testing them remotely needs a separate free Supabase project with synthetic users and its own Storage bucket, and a second preview Worker bound to it; that has not been set up.

### Hyperdrive by hand (alternative)

```sh
npx wrangler cert upload certificate-authority --ca-cert src/server/db/postgres/supabase-ca.pem --name fresh-petals-supabase-ca
npx wrangler hyperdrive create fresh-petals-db --connection-string="<session pooler URL, port 5432>" \
  --ca-certificate-id <CA_ID> --sslmode verify-full --caching-disabled --origin-connection-limit 10
```

## Deploy

Preview: automatic, above. Production (only at cutover): Actions → *Cloudflare deploy* → Run workflow → production (requires this workflow on `main`), or locally `HYPERDRIVE_ID=<id> node scripts/cloudflare/deploy.mjs production --confirm-production`. `deploy.mjs` refuses a build whose Worker name and workers.dev setting don't match the requested environment.

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

*Superseded by the 6 Nov measurements in Free hosting above; kept for history.*

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

## Backups (owner-run)

Status (2026-11-04): a production export taken on 2026-11-03 is held as an encrypted archive with an off-PC copy on the owner's Google Drive. The Drive copy was downloaded and its SHA-256 matched, and the export's records and 156 photos were restored to the staging project with 0 verification failures. The archive holds a point-in-time copy only, so take a fresh backup before any cutover. The stand-in results below describe the scripts, which were not exercised by this status.

```sh
SUPABASE_DB_URL=… SUPABASE_URL=https://hjhmetomcaskrrwkgrbp.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
  scripts/backup/supabase-backup.sh ~/fresh-petals-backups
REHEARSAL_DB_URL=postgresql://postgres:pw@127.0.0.1:55440/rehearsal scripts/backup/restore-rehearsal.sh ~/fresh-petals-backups/<stamp>
```

Scope: exact row counts for every public table, Auth users/identities/MFA factors and Storage objects/bytes per bucket, before and after the dump (a difference means writes landed during the run; the dump itself is one snapshot); `public`, `auth` and `storage` schemas (custom format) plus a readable public schema; every Storage object with path, size and SHA-256, checked against `storage.objects`; SHA256SUMS. Files are owner-only (700/600). The restore rehearsal restores `public` into a local throwaway database and compares exact counts (**restore tested**); `auth`/`storage` are only checked for presence in the dump (**export verified**). Storage files and database rows are not captured at the same instant.

Tested against stand-ins (2026-11-03): local database named for the project with fixture public data and synthetic auth/storage rows; mock Storage API with 1,006 objects across two buckets and nested folders (crosses the 1,000-item page). Results: backup exit 0, counts unchanged, all 1,006 objects listed and matched; a size mismatch → exit 1 and no SHA256SUMS; repository-path and wrong-project guards refuse; rehearsal 19/19 tables match; a tampered file fails checksum verification; non-local rehearsal targets refused. Not tested: real Supabase permissions on `auth`/`storage` for the `postgres` role, pg_dump version against the server, real Storage API behaviour.

Excluded: Auth configuration (providers, email templates, redirect URLs, MFA settings, rate limits), API keys and secrets, database roles and passwords, extensions and Supabase-managed schemas, Realtime/Edge settings, project settings, logs. Never restore over production: recovery from a backup goes to a new project or a local database.

## Access needed to finish verification

*Superseded (3 Nov): Cloudflare access now exists through wrangler, and staging covers the write workflows. What still needs the owner is listed in the Status and Cutover runbook sections.*

| Check | What is needed |
|---|---|
| Preview deploy, Cloudflare CPU/invocation metrics | GitHub Actions secrets `CLOUDFLARE_API_TOKEN` (Account: Workers Scripts Edit, Workers Observability Read, Hyperdrive Edit, Account Settings Read) and `CLOUDFLARE_ACCOUNT_ID`, plus build `DATABASE_URL`; or a Cloudflare dashboard session in the browser for reading metrics. This workspace cannot reach api.cloudflare.com, so deploys run from GitHub Actions or your machine |
| Hyperdrive config | Supabase database password (direct or session-pooler connection), entered by you in `wrangler hyperdrive create` |
| Fresh production backup before cutover | Supabase session-pooler `SUPABASE_DB_URL` and `SUPABASE_SERVICE_ROLE_KEY`, run on your machine |
| Email recovery test | Confirmed delivery to the staging admin's inbox; the default email service reaches team members only, at 2 emails an hour. Never the production project |
| Upload and workflow tests | The staging Worker and project; never the production project |
| Recovery host | Vercel account unblocked and confirmed serving, or approval of another host |

## Cutover (needs approval; nothing here has been done)

*Superseded by the Cutover runbook above (6 Nov). In particular, Vercel is not a working rollback target.*

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
