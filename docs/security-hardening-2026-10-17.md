# Security hardening release (17 October 2026)

Follows the 16 October security review (`2026-10-16-security-hardening.md`, kept outside the repository). Its tested commit (067bebc) was not available here, so the requirements were implemented again on top of `c4e4949`, keeping the newer lily wording, photo-review build check, idle-pool handler and guide date. Operator detail: `docs/admin-security.md`.

## What changed

| Area | Change |
|---|---|
| Dependencies | Astro 6.4.8 → 7.4.0, @astrojs/vercel 10.0.8 → 11.0.15, @astrojs/react 6.0.2 → 7.1.0, Sharp 0.34.5 → 0.35.5, @vercel/functions 3.10.1, drizzle-kit 0.31.11; Node `24.x` (as the Vercel project). Narrow overrides: path-to-regexp 6.3.0 (adapter routing), esbuild ≥0.28.1 (Vite) and ≥0.25.12 (drizzle-kit loader), fast-uri ≥3.1.8 (type-check tooling). `npm audit`: 19 advisories (1 critical, 14 high) before, **0** after, on 17 October. An advisory database result, not proof of absence. |
| CSP | Hash-based policy on every static and on-demand page (`astro.config.mjs` `security.csp`, adapter `staticHeaders`). Reviewed inline scripts moved to `src/scripts/inline/` and rendered by `InlineScript.astro` with their hash. The build fails on any unhashed inline script or a page without a policy. Trailing-slash URLs get the same policy. |
| Headers | DENY framing, nosniff, `same-origin` referrer, restrictive Permissions-Policy, COOP `same-origin-allow-popups` on every response; private `no-store` admin headers and separate Set-Cookie headers kept; HSTS left to Vercel. |
| Requests | Exact-origin + Fetch Metadata check on every unsafe method; streamed body limits; JSON required on JSON routes; Auth/database outage → 503 without signing out. |
| Draft creation | `/admin/products/new`: POST only, 303 to the editor; GET/HEAD create nothing. |
| Uploads | Real-format check against declared type, size/pixel/frame limits, full decode and re-encode, metadata and trailing bytes removed, derived names; 4 MB client and server limit (Vercel's 4.5 MB ingress). |
| Privacy | Public enquiry answers `{ok:true}` only; repository logs carry code and duration, not SQL/parameters; the existing idle-pool listener is kept. |
| Preview | Admin, Auth (including recovery GET and session bridge) and enquiry logging refused on preview deployments, which share production credentials. |
| Database | `drizzle/0012_security_least_privilege.sql` records the migration applied through Supabase on 16 October (`20261016172741`), unchanged and idempotent; the Drizzle ledger has 12 entries (0000–0011) and will record it on the next `db:migrate`. |

## Verification (17 October 2026)

| Check | Result |
|---|---|
| Production database metadata (read-only transaction) | anon/authenticated: 0 of 19 tables writable, 0 of 13 sequences usable; no SELECT on `admin_users`, `inquiries`, `products.cost_price`, `media.uploaded_by`; `products.slug` readable; 19/19 tables RLS, 17 read-only policies; `garland_design_code_is_immutable()` has `search_path=""` and its trigger is enabled. Supabase history has `20261016172741`; Drizzle ledger does not. Default privileges still grant new public tables to anon/authenticated (Supabase default; see owner actions). |
| Migrations on a fresh database | 0000–0012 applied to an isolated PGlite database seeded with Supabase-style default grants: same privilege result as production. |
| Unit/regression | 45/45 existing (4 source checks now also read `src/scripts/inline/`), 26/26 new `scripts/audit/security.test.mjs`. Auth, database and storage are doubles at their boundaries; the real middleware, AuthService, guards, body readers, Sharp and CSP check run. |
| Type check | 20 errors, identical to the baseline (DiscoveryPostCard 4, MobileBottomBar 1, SubscriptionConfigurator 15). |
| Build | Pass; 178 prerendered pages, each with a CSP and every inline script hashed. |
| Browser (Chromium, 390 px and 1440 px) | 50/50. Production-backed build (reads only; enquiry log and admin handlers refused before the function): home, bouquets, garlands, Red Affair, FP-G106, wedding-garland guide, Bengaluru, Florist Cutter, basket; no CSP violation; scripts ran; FP-G106 draft with code and Bengaluru, Red Affair and basket drafts captured, never sent; optional pincode check; image sitemap 46 entries. Isolated fixture (PGlite, fixture Auth, local storage): admin list and editor hydrate; GET/HEAD create nothing, one POST creates one draft (303); injected inline script and handler blocked; reflected error escaped; deceptive JPEG/SVG refused with nothing stored; valid PNG re-encoded; 5 MB upload 413; cross-origin/cross-site writes 403; first factor 403/redirect; outage 503; chunked oversize 413; enquiry acknowledgement `{ok:true}`; preview refusals. |

These checks do not prove production CDN cache invalidation, the production image optimiser or Google Analytics end to end; the release checks on the live site cover headers, pages and analytics loading.

## Account changes

- Vercel Firewall: one rate-limit rule (the Hobby plan's one), 30 POSTs per IP per 60 s to sign-in, recovery, MFA and the enquiry log; no other rules existed. No plan change.
- Supabase: nothing changed. Public settings show sign-up **enabled**; the dashboard could not be opened from this session.

## Owner actions

1. Supabase → Authentication → Sign In / Providers: turn **off** "Allow new users to sign up". Then confirm minimum password length 12, Site URL, the single reset redirect URL, TOTP MFA enabled, and two-step verification on the Supabase dashboard account.
2. Decide whether to change Supabase's default privileges so future public tables are not granted to anon/authenticated automatically (`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;` and the same for sequences and functions, run as each role that owns objects). Until then, every new table needs RLS and explicit grants in its migration.
3. Give Preview its own database, Auth project and storage before allowing admin or writes there.
4. Leaked-password protection needs a paid Supabase plan; not enabled.
5. Check a restorable backup exists, and GitHub branch protection.
6. Review the firewall rule after a week of real traffic.
