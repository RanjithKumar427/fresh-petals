# Local audit regressions

Run from `C:\Users\ranji\Downloads\fresh-petals`. The repository's environment targets production. Do not run writable tests or a development/build command in that environment. The scripts below ignore repository environment files and use only a hardcoded loopback database named `freshpetals_audit`.

## Source regressions

```powershell
node --test scripts/audit/regression.test.mjs
node --test scripts/import-garlands.test.mjs scripts/import-garlands-full.test.mjs
node scripts/audit/business.mjs
```

The first suite executes repository TypeScript with explicit database/network doubles. It covers valid empty versus invalid filters, counts, assignment additions/removals/restoration, the real website checker, ceremony suitability/public gates, 156 private drafts, multi-occasion context, mixed basket identities, retryable development prices and failed cache refresh feedback. The importer suites use temporary fixture directories. `business.mjs` records the eight bouquets' included features and verifies scene photographs against their linked catalogue designs.

## Isolated database and browser

Requires Docker, the cached `postgres:16-alpine` image, installed repository dependencies and Playwright Chromium. Check that ports **55437, 55438, 45123 and 45124** are available. Do not stop another server to free a port.

```powershell
docker run --detach --name freshpetals-codex-audit-20261007 --publish 127.0.0.1:55437:5432 --env POSTGRES_PASSWORD=local-audit-only --env POSTGRES_DB=freshpetals_audit postgres:16-alpine
node scripts/audit/local-fixture.mjs prepare
node scripts/audit/local-fixture.mjs build
# Point this at an installed playwright-core/index.mjs; no download is required.
$env:FP_PLAYWRIGHT_MODULE = 'C:\Users\ranji\calc\node_modules\.pnpm\playwright-core@1.62.1\node_modules\playwright-core\index.mjs'
node scripts/audit/browser.mjs
node scripts/audit/startup.mjs
node scripts/audit/local-fixture.mjs check
```

`prepare` resets **only the dedicated local fixture schema** and seeds 89 catalogue products plus 156 draft garlands. These are synthetic test records, not confirmed business data. Repeat `prepare` and `build` before another browser run. The browser test serves the actual Vercel production-mode build on port 45123, blocks external browser requests and intercepts `/api/inquiries`. It runs at 360, 390 and 1440px, including no JavaScript, reloads, Back, admin assignment removal, mixed basket drafts, bouquet snapshots and synthetic garland live-price/unpublication checks. It creates **FP-G900**, a separate synthetic design; it never publishes any of the 156 drafts.

The ignored source copy changes only the database TLS transport for this localhost fixture and doubles `AuthService.resolveAccess` to supply `none`, `mfa` and `full` states. The actual permission middleware, admin UI, APIs, repositories and page checker run unchanged. These tests verify application permission handling, **not Supabase sign-in/MFA or production authorization**. The copied production TLS and authentication source remains unchanged in the repository.

`startup` starts its own dev server on 45124 with an unavailable database on 55438, verifies an explicit failed product request, connects a local proxy to the fixture database and verifies recovery in the same process. It then stops its own server/proxy and checks that an unavailable database fails a production-mode build. `check` runs with the unavailable database; the known 20-error baseline still gives a nonzero exit.

Output goes to ignored `data/focused-audit-2026-10-07/`: logs, screenshots, fixture metadata and the isolated copy. No environment file, database, screenshots, generated output, temporary diagnostic scripts or unapproved image belongs in the release. The original preservation baseline is retained separately under ignored `data/codex-audit-2026-10-07/`.

To stop the container created by these instructions after testing, use `docker stop freshpetals-codex-audit-20261007`. Do not stop any other container or development server. A later deployed production check must verify real MFA, CDN purge/freshness, deployed prices and absence of draft photos; this local audit does not certify them.
