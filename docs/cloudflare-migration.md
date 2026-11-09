# Vercel → Cloudflare Workers migration

## Launch (2026-11-07): `https://onlyfreshpetals.in` is served by the Worker `fresh-petals`

**The storefront is live on Cloudflare.** Its pages and photos are static files built from the production database (`hjhmetomcaskrrwkgrbp`), and enquiries are stored in that database. Supabase restricted the production project until its 8 Nov 2026 quota reset: Auth, Storage and the REST gateway answered **402**, and admin sign-in was blocked. **On 9 Nov 09:13 UTC, Auth and Storage answered 200 again**, so the restriction has lifted. The owner's own sign-in hasn't been exercised since; no production sign-in probes are run.

**Live setup**
- **Zone:** `onlyfreshpetals.in` on Cloudflare Free, active since 07:09 UTC. Nameservers were switched at GoDaddy, the registrar; the domain expires 15 May 2027 and auto-renew is **off**.
- **DNS:**
  - the apex is the Worker's custom domain;
  - `www` is a proxied CNAME, redirected 301 to the apex (path and query kept);
  - `_domainconnect` is DNS only;
  - both TXT records were kept;
  - there is no MX record (no mail was configured before);
  - DNSSEC is off, as it was at GoDaddy.
- **TLS:**
  - the Universal certificate covers the apex and `*.onlyfreshpetals.in`;
  - SSL mode is Full;
  - Always Use HTTPS is on;
  - HSTS `max-age=63072000` comes from `_headers`.
- **Production Hyperdrive** `fresh-petals-db`: session pooler, verify-full, origin connection limit **10**.
- **Worker secrets:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (production).
- **Publishing:**
  - `production-publish.yml` is enabled (`PRODUCTION_PUBLISH_ENABLED=true`, builds `main`);
  - the first CI publish (workflow_dispatch, 7 Nov 07:30 UTC) built from the production database and deployed `6b37dea` in 70 s, with nothing running on this PC.
- **Backup before launch:** read-only export of 7 Nov, identical to the 3 Nov export in all 25 tables (owner's private backup folder).

**Verified live (7 Nov)**
- `public-site.mjs --production`: **42/42** on `514db6a`. It checks every sitemap page as a static file, indexable, with the analytics tag and canonicals; redirects; WhatsApp links; garland enquiry; photos as static WebP with immutable caching; robots; headers.
- Synthetic enquiry `fp-live-check-enquiry-*` posted to `/api/inquiries`:
  - stored once with status `new`;
  - a cross-site post was refused;
  - the enquiry was removed afterwards;
  - the 7 real enquiries were unchanged by digest.
- Sign-in on the live site now says "temporarily unavailable" while Supabase Auth answers 402 (`6b37dea`). Before that fix it said "Invalid email or password".
- **Not verified live: admin sign-in with TOTP, and publishing on save.** Both need Supabase Auth.

**Live resource use, 7 Nov 07:00–10:50 UTC** (Cloudflare GraphQL analytics; GA4 as supporting evidence only)
- **Zone:** about 23,500 requests. 17,500 were static cache hits; 1,260 were cache misses served from static files.
- **Worker `fresh-petals`:** 3,259 invocations, 0 errors, 0 CPU refusals, CPU p50 0.7 ms, p99 13 ms.
  - About 2,990 were 404s for files that don't exist, and **2,874 of those came from one client** (`TLM-Audit-Scanner/2.0`, one address, 4,506 requests within 07:00–08:00).
  - Its paths were credential and config probes (`/.env`, `/.git/logs/...`, `s3.key`, `phpinfo.php`, `stripe.config.js`), none of which this site has ever served. That, not the user agent or country, is the evidence of abuse.
  - The `l9scan` (leakix) clients showed the same pattern at a smaller scale.
  - These 404s are answered before any database work (`staticFallback.ts`).
- **Production Hyperdrive:** 107 queries, 2.1 MB of results. That is enquiries, the publishing check and the live checks; builds read the database directly.
- **Heavy product-page traffic:** 600–940 requests per bouquet product, mostly from Meta's network (`2a03:2880::/32`). These were static cache hits that cost neither the Worker nor the database.
  - GA4 realtime at about 11:00 showed 16 users and 16 views in 30 minutes, so most of those hits are automated fetches, not people.
  - They are harmless; nothing was blocked.
- **The 23 `504`s on `/garland-enquiry` were not visitor errors.** All are `requestSource: edgeWorkerCacheAPI`: the middleware's Cache API lookup missing, one per real enquiry redirect. Visitors got their 302.
- **Not available:** Supabase's own usage figures, which need a management token. Production `pg_stat_statements` is cumulative since 25 Sep, so it mostly shows the October on-demand rendering incident.

**Protections active (Free plan)**
- **Custom WAF rule** "Block secret-file and config probes (paths this site never serves)", action Block, evaluated before the Worker. It matches:
  - paths starting with `/.` except `/.well-known/`;
  - `/.env` and `/.git` anywhere in the path;
  - a literal `*`;
  - extensions `php env yml yaml ini key pem log sql bak old conf cfg asp aspx jsp cgi sh swp save orig dist`.

  Cloudflare-verified bots are exempt (`not cf.client.bot`).
  - **Tested before deploying:** it matched 74% of the window's scanner 404s. Among the 1,306 built files and 387 sitemap URLs it matched only `/.assetsignore`, which static assets never serve.
  - **Checked live:** probes get 403. Pages, photos, sitemaps, robots, `/_publish/state.json`, `/api/publish/state` (with any query string), `/.well-known/`, `/garland-enquiry` and 404s for other missing pages behave as before.
- **Not enabled, deliberately:**
  - **Bot Fight Mode:** on the Free plan it can't be skipped by any rule, so it would challenge GitHub Actions' check of `/api/publish/state` and could affect link-preview fetchers.
  - **Country or ASN blocks:** these are not evidence of abuse.
  - **A rate-limiting rule (1 on Free):** it counts every request, including static photos, and the scanner's rate (about 12 requests per 10 s) is close to a real page load. No abuse of the enquiry endpoints was seen.
  - **Analytics:** left enabled.

**Rollback:** `npx wrangler rollback <version> --name fresh-petals`. The version before `6b37dea` is `514db6a`, the first production deploy (versions list). There is no other host: Vercel is disabled, and removing the custom domain takes the site offline.

**Still open**
- Now that the restriction has lifted (9 Nov), the owner checks:
  - admin sign-in with TOTP on the live site;
  - the Auth URL configuration (site URL, reset redirect);
  - one save moving from Pending to Live.
- **Admin sign-in on production** (above) is the remaining step for the admin side of publish on save there.

**Publish on save: working (9 Nov 2026)**
- **Token:** `FP_PUBLISH_GITHUB_TOKEN` is on both Workers (`fresh-petals`, `fresh-petals-staging`). It is a fine-grained token limited to this repository, with Contents read/write, installed by the owner with `scripts/cloudflare/set-publish-token.mjs` (hidden prompt). It needs replacing when it expires.
- **Events:**
  - staging saves send `publish-site`, which runs `staging-publish.yml`;
  - production saves send `publish-production`, which runs `production-publish.yml`;
  - both build `main`.
  - A dispatched run always publishes (`c1e908d`): the 30 s fingerprint cache could otherwise hide a fresh save from the check job.
- **Proven on staging through the admin save path** (`scripts/staging/publish-on-save.mjs`, 27/27, revision `ca182b9`).
  - A synthetic admin signed in at aal2. Unauthenticated and cross-site writes were refused (401, 403).
  - The editor save and the publish save each answered "Publishing requested", and GitHub started Staging publish runs by itself (`repository_dispatch`).
  - The editor's check stayed Pending until the new build was served, then turned **Live 82 s after the publish save**. The page, `sitemap-garlands.xml` and the garland list all showed the garland with its static photo.
  - Archiving through the admin removed it: **Hidden 81 s after the archive save**, then 404 and gone from the sitemap and list.
  - Runs: 42582155899, 42582165100, 42582319591. Each change was carried by the next dispatched run; a save made during a build is picked up by the queued run.
  - The fixture, its photo, its Storage object and the synthetic admin were removed. Every pre-existing table, Storage object and Auth user matched its digest.
  - Staging's live fingerprint now equals its deployed one.
- **Production:** a `publish-production` dispatch with no content change (run 42582864227, 9 Nov 08:00 UTC) built from the production database and deployed `ca182b9`, with the fingerprint unchanged (`ad8dd05b…`); public checks are 42/42.
  - That event was sent with the owner's GitHub CLI login, not by a production admin save: production admin saves wait on production sign-in. The production Worker holds the same token that staging used.
- **Defect found and fixed (`0aff6a8`):** admin uploads stored no `media.checksum`, so the build had no static copy for them.
  - The page kept `/_image`, and the output check refused every build. All staging runs failed from 7 Nov 15:44 for this reason, and production would have failed after its first admin upload.
  - Uploads now record the SHA-256 of the stored bytes, and the build hashes any older row that has none.
- **Scheduled checks** began running on 7 Nov from 12:52 UTC, though GitHub starts them only about every 2 hours, not every 15 minutes. They are a fallback; publishing doesn't depend on them.
- **Recovery email:** still unresolved (see *Email*). With the zone on Cloudflare, an SMTP sender's SPF and DKIM records can now be added.
- **Domain auto-renew** at GoDaddy is off.
- **Search Console:** resubmit the sitemaps.

## Staging status (2026-11-07)

**Staging runs reliably on the free plans, with the storefront prebuilt as static files.** Every workflow verified on staging passes.

Staging setup:
- Worker `fresh-petals-staging`: `https://fresh-petals-staging.branjith-kumar24-01.workers.dev`. It is noindex, carries no analytics, and refuses visitors' enquiry writes.
- Supabase project `wyndmywdtacucojvudxg`, holding the 3 Nov production export.
- Hyperdrive `fresh-petals-staging-db`, origin limit 10.

### What runs where (since `ea3d212`)

| Request | Served by | Database |
|---|---|---|
| Every storefront page (home, categories, bouquets, garland list and collections, garland pages, product pages, occasions, 59 city pages and 59 city shops, guides, search, sitemaps, robots.txt, the search fragment) with **any** query string | **Static files.** Workers static assets serve them without running the Worker | none |
| `/studio/*` | static `_redirects` (301) | none |
| An address with no file: a city's other spelling (301), `/products/<slug>` (404 "not on sale"), anything else (404) | Worker, answered statically before any database scope (`src/server/platform/staticFallback.ts`) | none |
| Stored photos `/photos/<sha256>-<width>.webp` (since `ac53dd9`) | **Static files**, resized at build time (`scripts/build/stored-photos.mjs`) and kept between CI builds by `actions/cache`. `/_image` remains only for previews | none |
| `/garland-enquiry`, `/api/*` (enquiries, delivery check, `/api/publish/state`), `/admin/*` | Worker | yes |

Query-string behaviour moved to the browser:
- **Filter links:** old `?colour=` and `?occasion=` links show their selection and move to the fragment address (the server 301 did this before).
- **Garland list:** the `?unavailable=` notice is filled in by the page.
- **City shop:** `?collection=` and `?page=` work as before (24 a page; an unknown collection shows everything; an out-of-range page shows the last). Without scripts every product is listed on one page.

The edge-cache code (`edgeCache.ts`) now has nothing public to cache, and the zone purge was removed (`GarlandWebsite.ts`).

### Verified on staging

Synthetic accounts and records only, all removed afterwards. Original records, photos and the owner's admin account were unchanged by digest.

| Area | Runner (`scripts/staging/`) | Result | Revision |
|---|---|---|---|
| Auth: login, MFA, recovery, reset cookies, logout, non-admin and no-profile refusal, CSRF | `auth-integration.mjs` | 52/52 | `8f48c0c` |
| Auth UI in a browser | `browser-auth.mjs` | 25/25 | `8f48c0c` |
| Catalogue lifecycle through real builds; details below the table | `catalogue-lifecycle.mjs` | 53/53 | `8f48c0c` |
| Basket → WhatsApp draft → enquiry stored with the test key; refused for visitors while WhatsApp still opens | `browser-basket.mjs` | 15/15 | `8f48c0c` |
| All 387 sitemap pages as static files, plus redirects, 404s, WhatsApp links, garland enquiry, photos, robots and headers | `public-site.mjs` | 41/41 | `206f545` |
| Browser-side query behaviour (city shop collection and page, filter links, unavailable notice, garland filter, search), no script or CSP errors | `browser-static.mjs` | 14/14 | `206f545` |
| Publishing run the way CI runs it (`--ci-token`, token in the environment) | `publish.mjs` | published, 160 s | `206f545` |
| Password-reset request: one answer for every address; nothing delivered | `email-probe.mjs` | 8/8 | `ffcafb3` |
| Rollback `wrangler rollback <version>` and back | manual drill | about 14 s each way | `6b5a1c0` ↔ `4116662` |

The catalogue lifecycle run covered:
- admin product create, edit, photo replace and publish;
- uploads (JPEG/PNG/WebP), media delete including the Storage object;
- three builds, plus a simulated failed build and a no-change check;
- filters in a browser;
- keyed enquiries.

Local: `astro check` 0 errors, 0 warnings; `node --test` 166/166 tracked; the staging build passes its output checks (473 pages, 919 files, 97 MB).

### Defects found on staging and fixed

- **6 Nov:**
  - Recovery-link tokens were left in the address bar (`a5a1ceb`).
  - JPEG/PNG uploads were refused (`d7b9a03`).
  - Deleted images left their Storage objects (`d25a8b7`).
  - Bot URLs bypassed the cache (`f08ba5c`, `ee97ccc`).
  - Crawls caused 500s: Hyperdrive opened more connections than Supavisor's 15 clients allow (`5b07423`).
- **6–7 Nov:**
  - Uncached renders exceeded Workers Free's 10 ms CPU, so crawls got 503s. Fixed by prerendering the storefront (`ea3d212`).
  - Static garland pages pointed visitors at the full-size Storage originals. They now use `/_image` (`4c618a2`).
  - Addresses with no file skipped the middleware. Fixed with a catch-all route (`4c618a2`).
  - The admin website check read the Worker, not the deployed files. It now reads them through `ASSETS` (`8f48c0c`).

### Free feasibility (6–7 Nov 2026)

**Measured on the deployed staging Worker** (Cloudflare GraphQL analytics, `scripts/staging/traffic-cost.mjs`, photo bursts, builds instrumented on this PC):

| What | Before prebuilding (on-demand, 6 Nov) | Now |
|---|---|---|
| Page with an invented query string (5 page types × 25) | p50 35–75 ms CPU, 8–146 KB of database results each | **0 Worker requests, 0 queries** |
| October incident replayed: 200 distinct filter-chip URLs, 8 at a time | 25% refused (`exceededCpu`, HTTP 503) in a smaller burst | **0 Worker requests, 0 queries** |
| Full sitemap crawl (213 URLs) | 58 renders, 9.5 MB of results, some 503s | **0 Worker requests, 0 queries** |
| Address with no file, city spelling | full render | Worker, p50 2.5 ms, no database |
| *Historical (until `ac53dd9`):* stored photos through `/_image`, cold: 60 at 12 at a time / 137 at 24 at a time | — | 0 refusals; p50 11 / 8.8 ms, p99 61 / 47 ms. Photos are now static files; this row no longer applies |
| Publishing check `/api/publish/state` | — | p50 7.3 ms, about 0.1 KB of results |
| Everything on staging 16:45–19:00 UTC (two lifecycle runs, Auth, admin uploads, photo bursts, traffic tests) | — | 1,313 Worker requests: **0 CPU refusals, 0 errors**; p50 9.2, p90 37, p99 128 ms (sign-in and uploads); 1,862 Hyperdrive queries, 2.1 MB |
| One build: database bytes received | — | **356 KB** (4 connections) |
| One build and deploy, from this PC | — | 156–262 s; the first upload of all files took 511 s |
| A failed build | — | stopped after 81–93 s; nothing deployed, previous release served |
| Delay after deploy before visitors' plain addresses show the new build | — | 1–13 s |

**Estimates** (not measured; for a small shop's traffic). The photo items below were written when photos went through `/_image`. Since `ac53dd9` photos are static files resized at build time, so those items are **historical**; see *Live resource use* in the Launch section for measured figures.
- **Worker requests.** Only missing addresses, enquiries, the publishing check and the admin run the Worker. Photos no longer do. 1,000 page views a day is far under 100,000 requests a day free. The October bot peak (about 56,000 filter-URL renders a day) now costs 0.
- **CPU.** Page renders and photo resizing no longer happen on request. *Historical:* photo requests averaged about 9–11 ms, which was the residual 10 ms risk; that risk is gone.
- **Supabase egress (5 GB a month, about 170 MB a day):**
  - Builds: 0.36 MB each, so 20 builds a day is about 7 MB. A build downloads only photos it hasn't cached (`actions/cache`).
  - Scheduled checks: about 0.1 MB a day.
  - Enquiries and the admin: small.
  - *Historical:* photo originals for the `/_image` resizer (up to about 88 MB per data centre). Visitors no longer read Storage at all.
  - Visitors' page views read nothing.
- *Historical:* **Images.** 156 photos × 4 widths was about 624 transformations a month against 5,000 free. Build-time resizing uses no Images quota.
- **Static assets.** 919 files and 97 MB, within 20,000 files and 25 MiB per file. Static requests are free and unlimited.
- **GitHub Actions** (public repository, standard runners at no charge):
  - The scheduled check runs 96 times a day, about 15 s each.
  - A publish is about 3–5 minutes.
  - GitHub suspends scheduled workflows in a public repository after 60 days without repository activity; re-enable it in the Actions tab if that happens.

**Verdict.** Static pages remove every on-demand render, and with them the CPU, request and database risks that broke the free plan. What remains on the Worker is small and measured within limits. **Free hosting is supported by these measurements** for a small shop's traffic. The former residual risk (photo resizing against the 10 ms CPU limit) was removed by build-time photos.

### Publishing

A storefront change is a new build: the build reads the database once, then deploys. Nothing runs on this PC.

1. **On save** (admin create/edit/status/delete, garland and occasion changes): the Worker calls GitHub `repository_dispatch` (`src/server/services/Publishing.ts`, event `publish-site` for staging, `publish-production` for production). It needs the Worker secret `FP_PUBLISH_GITHUB_TOKEN` (installed on both Workers 9 Nov; rotate with `node scripts/cloudflare/set-publish-token.mjs`); `FP_PUBLISH_REPOSITORY` is already in `wrangler.jsonc`. Without the token, the save says so, and step 2 publishes when GitHub runs it.
2. **Scheduled check** (`.github/workflows/staging-publish.yml`, every 15 minutes): compares the live database's content fingerprint (`GET /api/publish/state`) with the deployed build's (`/_publish/state.json`) and publishes only when they differ. It catches failed requests, failed builds and changes made outside the admin.
3. **Publish** (`scripts/staging/publish.mjs`, the same script for CI and tests):
   - build, then output checks, then deploy, then wait until the plain address serves the new build;
   - if the build or its checks fail, nothing is deployed;
   - one build at a time, and a newer request replaces a waiting one, so a burst of saves costs at most two builds;
   - a change saved during a build leaves the fingerprints different, so the next check publishes it.

What the admin sees (since `88ae20d`):
- A successful dispatch says **"Publishing requested"**. Without the token, or when GitHub refuses, the save says no build was requested.
- The editor's website check says **Live** only when the deployed page carries this save's version (`data-garland-version` equal to the record's `updatedAt`). It says **Pending** while the deployed page shows an earlier version, including a build that started before a later edit.
- **No deadline is promised.** The editor keeps checking for 30 minutes, then shows Pending with a retry.

`GET /api/publish/state` (since `88ae20d`):
- **Caching:** a successful fingerprint is reused for 30 s per isolate.
- **Deduplication:** concurrent requests share one read. This is not a rate limit.
- **Query strings:** they are not part of the key, so they can't bypass the cache.
- **Failures:** a failed or malformed read is never cached and returns 503, never an expired fingerprint.
- **Builds:** they read the database directly.
- **Measured on staging:** 30 requests (sequential, varied query strings, concurrent) made 3 fingerprint queries instead of 30 (`pg_stat_statements`). A change showed in the endpoint within 2 s.

| Change | Reaches the site | Verified (real builds on staging) |
|---|---|---|
| Product added in the admin | Next build: a storefront entry from the record (`src/data/dashboardCatalogue.ts`), its uploaded photo (static `/photos/` copies since `ac53dd9`; `/_image` before), its category page and `sitemap.xml` | live 1 s after the build was served |
| Edits to name, descriptions, stem count, photo | Next build: the dashboard values replace the catalogue copy, except deliberate rewrites, reviewed placeholders and photos the build can't serve. Category, collections and flowers stay with the catalogue entry | garland rename and photo swap after several saves and one build: visible 13 s after serving; the old photo gone from the page and sitemap |
| Removal (archive or delete) | Next build: 404 "not on sale", gone from sitemaps, lists and saved baskets | product 404 at 1 s; garland 404 at 2 s |
| A build that fails | Nothing deployed | previous release kept serving (old name visible) |
| No change | No build | "up to date" in 3 s |
| Prices | Never shown: every catalogue product is quote-only | — |

**Activation needs approval outside this work: push and repository settings.** Scheduled and dispatched workflows run only from the default branch.
1. Push `staging/schema-2026-11-04` and put `.github/workflows/staging-publish.yml` on `main`. `cloudflare.yml` on `main` does not deploy production on push unless `CLOUDFLARE_AUTO_DEPLOY=true`, which is not set.
2. Repository secret `STAGING_ENV_FILE` (the staging credentials file's four lines) and variable `STAGING_PUBLISH_REF=staging/schema-2026-11-04`. `CLOUDFLARE_API_TOKEN` already exists; it needs Workers Scripts edit, Account Settings read and Hyperdrive read.
3. For publishing on save: a fine-grained GitHub token for this repository with Contents read and write, stored with `npx wrangler secret put FP_PUBLISH_GITHUB_TOKEN --name fresh-petals-staging`. Without it, the 15-minute check publishes.

Until then, publishing on staging is the same script run by hand: `node scripts/staging/publish.mjs --env=<staging env> [--db-port=6543]`. That is **not** automatic.

### Email (password-recovery email)

**Unresolved: delivery has never been established.** No recovery or invitation email from either project is known to have arrived:
- On 4 Nov, emailed invitations were accepted by Supabase but did not usably arrive.
- The 6 Nov probes were refused: `email_address_invalid` for a reserved test address, then `429 over_email_send_rate_limit`.

That rate limit explains the later refusal only. It does **not** explain the earlier accepted messages failing to arrive, and the cause of those is unknown.
- **What it would take:** a custom SMTP sender with SPF/DKIM on `onlyfreshpetals.in` (an owner account and DNS records), then one real delivery to an inbox the owner checks.
- **Verified:** the Worker answers the same for every address.
- **Until then:** the admin recovers with a service-role recovery link (`auth.admin.generateLink`) in a fresh browser profile, plus TOTP. That is the path the synthetic Auth runs verify.

### Production: database choice, final synchronisation, rollback limits

**Proposed database: keep the production Supabase project `hjhmetomcaskrrwkgrbp`**, the system of record, once its restriction lifts. Why:
- It holds the current records, photos and the owner's admin and MFA, so no data has to move.
- `ap-northeast-2` is nearer India than staging's `eu-west-1`.
- With the storefront prebuilt, its egress is builds and photos (above), not page views. The October overrun came from page renders.

**Final synchronisation:** none is needed if production stays the system of record. At cutover:
1. Take a fresh read-only export (`prod-export.mjs`), encrypt it and copy it off this PC.
2. Compare it with the 3 Nov export, to see what changed while the site was down.

If production stays restricted after 8 Nov, the alternative is to promote a new project in its own organisation:
1. Apply migrations `0000`–`0014`.
2. Restore the fresh export with the staging-proven `restore-data.mjs` path.
3. Recreate the admin identity.

That is a data move, and it needs its own approval.

**Rollback limits:**
- A faulty release rolls back with `wrangler rollback` in about 14 s (drilled). It restores that version's code **and** static files.
- There is **no working fallback host:** Vercel refuses deployments. Removing the Worker's domain returns the site to today's 402.
- Data recovery is a restore into a new project, never over production.
- A DNS change back (nameservers) takes hours.
- Static pages only show what the last successful build read: while publishing is broken, the site stays up but stops changing.

## Cutover runbook (carried out 7 Nov 2026 except steps 1, 4 and the admin parts of 10, which wait on Supabase Auth; see *Launch*)

Facts as of 7 Nov 2026:
- The Cloudflare account holds only `fresh-petals-preview` and `fresh-petals-staging`, and no zones. Account and configuration IDs are in the owner's private cutover report.
- Production Hyperdrive `fresh-petals-db` points at the production session pooler, verify-full, caching off, **origin connection limit 20 (must become 10)**.
- DNS: GoDaddy nameservers; `@ A 216.198.79.1`; `www CNAME …vercel-dns-017.com`; a Google verification TXT record; no MX.

1. **Production Supabase:** after the 8 Nov reset, confirm a stored photo URL answers 200, not 402.
2. **Backup:** run `node <audit>/work/prod-export.mjs <new dir>`, encrypt it and copy it off this PC. Then compare the export with the 3 Nov export.
3. **Hyperdrive:** `npx wrangler hyperdrive update <fresh-petals-db id> --origin-connection-limit 10`.
4. **Supabase Auth (production):**
   - Site URL `https://onlyfreshpetals.in`.
   - Redirect URLs include `https://onlyfreshpetals.in/admin/reset-password`.
   - Signups off.
5. **Code on GitHub:** the push and merge of this branch to `main` (approval). Repository variables `HYPERDRIVE_ID` and `PUBLIC_GA_MEASUREMENT_ID=G-V75FJQ06ZS`; secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `DATABASE_URL` already exist.
6. **First production deploy.** It routes no traffic: `workers_dev` is off and there are no routes. Either:
   - **Actions:** *Production publish → Run workflow* after step 9, or
   - **locally:** `HYPERDRIVE_ID=<id> DATABASE_URL=<production pooler URL> PUBLIC_GA_MEASUREMENT_ID=G-V75FJQ06ZS node scripts/cloudflare/deploy.mjs production --confirm-production`.

   Then the secrets: `npx wrangler secret put SUPABASE_URL --name fresh-petals`, and the same for `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and, for publishing on save, `FP_PUBLISH_GITHUB_TOKEN`.
7. **Zone (owner, DNS):**
   - Add `onlyfreshpetals.in` to Cloudflare (Free).
   - Import the GoDaddy zone, keeping the Google TXT record.
   - Switch the nameservers and wait for "Active".
8. **Attach:**
   - Workers → `fresh-petals` → Domains → `onlyfreshpetals.in`.
   - A proxied `www` record with a Redirect Rule to the apex (301).
   - Optionally, one free rate-limiting rule on `/garland-enquiry` and `/api/*`.
9. **Publishing:** set `PRODUCTION_PUBLISH_ENABLED=true` (and `PRODUCTION_PUBLISH_REF` if needed). From then on the production workflow publishes on save and every 15 minutes.
10. **Verify:**
    - `node scripts/staging/public-site.mjs --production`: indexable, analytics, canonicals, redirects, WhatsApp, photos.
    - Admin sign-in with TOTP; one garland save, its website check moving from Pending to Live.
    - One real WhatsApp enquiry reaching the inbox.
    - Workers analytics: no `exceededCpu`.
    - Search Console: resubmit the three sitemaps.

### Rollback

| Failure | Action | Status |
|---|---|---|
| Faulty release | `npx wrangler versions list --name fresh-petals`, then `npx wrangler rollback <id> --name fresh-petals -y` | Drilled on staging: about 14 s each way |
| Publishing broken | The site keeps serving the last build; fix and run *Production publish* by hand | Failed-build path tested on staging |
| Worker or zone unusable | Remove the custom domain (back to today's 402). **No other host:** Vercel is not a fallback | — |
| Data loss or corruption | Restore the step-2 export into a new Supabase project (`restore-data.mjs` path, proven on staging), point a Hyperdrive config at it, redeploy. Never restore over production | Proven on staging |

**Rollback triggers:** `exceededCpu` or 5xx above 1% over 5 minutes; enquiries not stored; admin sign-in failing; sitemap pages missing; CSP blocking scripts.

## Earlier records (superseded)

The sections below are kept as history. Corrections:
- workers.dev **does** cache: the Cache API returned HIT. So the 3 Nov "P50 1–2 ms" CPU figures were cache hits.
- On-demand renders cost 35–75 ms (p50) and were refused in bursts on the Free plan.
- The on-demand pages, edge cache and zone purge they describe were replaced by the prebuilt storefront on 6–7 Nov.

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
