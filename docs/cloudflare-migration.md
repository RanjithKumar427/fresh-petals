# Vercel → Cloudflare Workers migration

Status: **migration branch built and tested locally in the Cloudflare runtime; not deployed; not ready for cutover** (see "Open items"). Production DNS, Vercel, Supabase and the live site are unchanged.

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

## Verified locally (workerd via wrangler 4.156.2, isolated fixture DB `127.0.0.1:55437/freshpetals_audit`)

- 266 URLs (all 233 sitemap URLs + redirects, 404s, filters, admin/API, probes): identical status, visible text, canonical, robots meta, title, JSON-LD and WhatsApp links vs the Vercel build of the same tree. The remaining header differences come from the local Vercel harness, which serves static files without Vercel's route headers.
- `/studio` and `/studio/` → 301; unknown paths → 404 with `noindex`; `/media/*` → 404 (was 500 before a fix in `src/server/db/paths.mjs`).
- Admin: anonymous → login/401, first factor → 403, MFA page, full admin; private no-store, never edge-cached; cross-site POST 403. Enquiry POST 201 → one row persisted → visible in admin. Admin edit → DB change → purge with tags `occasion-index`, `occasion:housewarming` → restored.
- Edge cache MISS → HIT; tag hidden from visitors; freshness bound 120 s without purge.
- Upload sanitiser on the local Images binding: JPEG/PNG/WebP re-encoded, EXIF absent; 101-frame GIF/WebP, oversized canvas, type mismatch, SVG and truncated files refused.
- Preview build: noindex on static + dynamic responses, no analytics ID, canonicals on onlyfreshpetals.in, admin/API/enquiry log 403.
- Tests: 118/118 (`security`, `regression`, `catalogue`, `measurement`, new `cloudflare`). `astro check`: the same 20 pre-existing errors on both targets, no new ones.

**Not verifiable here** (no Cloudflare account access, no Supabase Auth in the fixture, no outbound network): real Supabase sign-in/MFA/logout/password reset; Hyperdrive → Supabase TLS; zone purge API; `/_image` resizing of real Supabase photos; GIF upload output and animation preservation (the local Images simulator cannot output GIF); JPEG EXIF removal with `metadata: none` on the real service; CPU limits in production; the self-check that fetches a page from the Worker's own domain (`SITE_CHECK_ORIGIN` can point it elsewhere).

## Free-tier assessment

Measured per uncached on-demand request (V8 CPU, render + pg parsing, warm median / p90; fixture with 245 products): `/` 12.5 / ~30 ms (6 queries); `/categories/bouquets` 12.1 / ~25 ms (1); `/locations/hyderabad` 22.2 / ~28 ms (11); `/locations/*/shop` 18.4 / ~24 ms (5); `/occasions` 8 ms (6); `/occasions/birthday` 6.5 ms (1); `/categories/garlands` 7.3 ms (5); guides 3.8 ms; 404 1.3 ms (0); filter-query 301 ~1 ms (0). First request in a fresh isolate: ~0.9 s CPU on `/`.

Workers Free allows **10 ms CPU per request** and 100,000 Worker requests/day; static assets are free and don't run the Worker. Cache hits are cheap (<1 ms), but every cache miss on the four heaviest page types exceeds 10 ms at the median. **Free hosting is therefore not demonstrated.** Options: measure real `cpuTime` on the deployed preview (Workers Observability) before deciding; Workers Paid (US$5/month, 30 s CPU, needs approval); or reduce render cost of those pages (separate change).

Other limits: Hyperdrive Free 100,000 queries/day, ~20 origin connections; Images 5,000 unique transformations/month (stored photos × ≤4 widths + uploads; over the limit new transforms fail, cached ones keep serving); tag purges 5/min (bucket 25); Supabase quotas unchanged (same project, fewer pooled connections).

Traffic: the earlier automated spike could not be measured from here (no Vercel analytics access). Filter crawl-traps already 301 cheaply; unknown paths cost ~1 ms and no queries; tracking-parameter variants share one cached copy; every other distinct query string is a separate render, as on Vercel. Projection: daily Worker requests ≈ uncached HTML views + cache hits + API calls; at 100,000/day the Free plan returns error 1027.

## Backups (owner-run; nothing was backed up from here)

```sh
SUPABASE_DB_URL=… SUPABASE_URL=https://hjhmetomcaskrrwkgrbp.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
  scripts/backup/supabase-backup.sh ~/fresh-petals-backups
REHEARSAL_DB_URL=postgresql://postgres:pw@127.0.0.1:55440/rehearsal scripts/backup/restore-rehearsal.sh ~/fresh-petals-backups/<stamp>
```

Covers: timestamped inventory (row counts, exact enquiry/product counts, Auth users and MFA factors, Storage objects per bucket, latest enquiry time); `public` (catalogue, enquiries, media records, admin links), `auth` (users, identities, MFA factors) and `storage` (object metadata) schemas; every Storage object with path, size and SHA-256; SHA256SUMS. Restore rehearsal covers `public` only ("restore tested"); `auth`/`storage` are "export verified".
Excluded: Auth configuration (providers, email templates, redirect URLs, MFA settings, rate limits), API keys and secrets, database roles and passwords, extensions/Supabase-managed schemas, Realtime/Edge settings, project settings, logs. Encrypt the backup (it holds password hashes, MFA secrets and customer data) and keep it off the repository.

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

**Recovery target — currently unconfirmed.** On 2026-11-03 Vercel refused to build this branch with "Account is blocked." The last successful Vercel production deployment is from 2026-10-31 (`f0e85b1`, the current `main`). Until Vercel is unblocked and confirmed to serve onlyfreshpetals.in, rollback to Vercel is not available. The only remaining recovery is redeploying an earlier Cloudflare Worker version (`npx wrangler rollback`), which covers a bad deploy, not a problem with Cloudflare itself.

**Rollback triggers:** any error 1102 (CPU) or 1027 (daily limit); 5xx above 1 % over 5 min; enquiries not persisting; admin sign-in failing; pages missing vs sitemap; CSP blocking site scripts.
**Rollback:** remove the Worker custom domain; recreate `@ A 216.198.79.1` and `www CNAME 91b23daa6caaa54f.vercel-dns-017.com` as DNS-only. Traffic returns to Vercel within the record TTL (Cloudflare proxied → DNS-only takes effect in minutes). Both hosts use the same Supabase project, so enquiries received on Cloudflare stay in the database. Only catalogue changes made after cutover need a Vercel redeploy to appear there.
