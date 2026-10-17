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
| Database | `drizzle/0012_security_least_privilege.sql` records the migration applied through Supabase on 16 October (`20261016172741`), unchanged and idempotent; the Drizzle ledger has 12 entries (0000–0011) and will record it on the next `db:migrate`. `drizzle/0013_visitor_default_privileges.sql`: objects `postgres` creates in `public` are no longer granted to anon/authenticated by default (they had every table privilege including TRUNCATE, and sequence USAGE/SELECT/UPDATE); service_role, postgres, existing objects, RLS and policies unchanged. Applied to production on 17 October (see below). |

## Verification (17 October 2026)

| Check | Result |
|---|---|
| Production database metadata (read-only transaction) | anon/authenticated: 0 of 19 tables writable, 0 of 13 sequences usable; no SELECT on `admin_users`, `inquiries`, `products.cost_price`, `media.uploaded_by`; `products.slug` readable; 19/19 tables RLS, 17 read-only policies; `garland_design_code_is_immutable()` has `search_path=""` and its trigger is enabled. Supabase history has `20261016172741`; Drizzle ledger does not. Default privileges still grant new public tables to anon/authenticated (Supabase default; see owner actions). |
| Migrations on a fresh database | 0000–0012 applied to an isolated PGlite database seeded with Supabase-style default grants: same privilege result as production. |
| Default privileges (0013) | Isolated PGlite with production's default ACLs for both creators: migrations 0000–0013 applied; existing 32 tables/sequences keep identical grants, column grants and RLS, 17 policies; a second run changes nothing; a new postgres-created table and sequence give anon/authenticated nothing (anon insert refused), service_role and postgres keep full access; anon still reads `products.slug` and not `cost_price`; supabase_admin and function defaults untouched (37/37). Production: the two statements only (not `db:migrate`, which would replay 0012's run-time column grant), in one transaction that committed only after `pg_default_acl` showed the expected rows and a hash of all 32 object ACLs and RLS flags was unchanged; a separate read-only metadata check afterwards differs from the earlier one in those two default-ACL rows only. The Drizzle ledger records 0012 and 0013 on the next `db:migrate` (both idempotent). |
| Unit/regression | 45/45 existing (4 source checks now also read `src/scripts/inline/`), 27/27 `scripts/audit/security.test.mjs` (one checks 0013). Auth, database and storage are doubles at their boundaries; the real middleware, AuthService, guards, body readers, Sharp and CSP check run. |
| Type check | 20 errors, identical to the baseline (DiscoveryPostCard 4, MobileBottomBar 1, SubscriptionConfigurator 15). |
| Build | Pass; 178 prerendered pages, each with a CSP and every inline script hashed. |
| Browser (Chromium, 390 px and 1440 px) | 50/50. Production-backed build (reads only; enquiry log and admin handlers refused before the function): home, bouquets, garlands, Red Affair, FP-G106, wedding-garland guide, Bengaluru, Florist Cutter, basket; no CSP violation; scripts ran; FP-G106 draft with code and Bengaluru, Red Affair and basket drafts captured, never sent; optional pincode check; image sitemap 46 entries. Isolated fixture (PGlite, fixture Auth, local storage): admin list and editor hydrate; GET/HEAD create nothing, one POST creates one draft (303); injected inline script and handler blocked; reflected error escaped; deceptive JPEG/SVG refused with nothing stored; valid PNG re-encoded; 5 MB upload 413; cross-origin/cross-site writes 403; first factor 403/redirect; outage 503; chunked oversize 413; enquiry acknowledgement `{ok:true}`; preview refusals. |

These checks do not prove production CDN cache invalidation, the production image optimiser or Google Analytics end to end; the release checks on the live site cover headers, pages and analytics loading.

## Account changes

- Vercel Firewall: one rate-limit rule (the Hobby plan's one), 30 POSTs per IP per 60 s to sign-in, recovery, MFA and the enquiry log; no other rules existed. No plan change.
- Supabase Auth: "Allow new users to sign up" turned **off** (public settings now report `disable_signup: true`). Read in the dashboard, unchanged: anonymous sign-ins off, manual linking off, confirm email on, email the only provider, TOTP **Enabled**, phone MFA disabled, AAL1 session duration limited. Existing users, `admin_users` rows and recovery untouched.
- Database: default privileges for `postgres` in `public` (0013), as above.

## Owner actions

1. Supabase → Authentication → Sign In / Providers → Email: **minimum password length is 6**; set it to 12 (only enforced when a password is set, so current sign-ins are unaffected). The change was refused by this session's permission review and not made.
2. Supabase → Authentication → URL Configuration: **Site URL is `http://localhost:3000` and there are no redirect URLs**, so reset links that ask for `https://onlyfreshpetals.in/admin/reset-password` fall back to localhost. Set Site URL to `https://onlyfreshpetals.in` and add `https://onlyfreshpetals.in/admin/reset-password`, then test one reset email.
3. Two-step verification on the Supabase dashboard account itself (Account → Security): not checked.
4. Objects created by `supabase_admin` in `public` still get Supabase's default visitor grants; this project's tables are all owned by `postgres` and the connection cannot act as `supabase_admin`, so it was left alone. Every new table still needs RLS in its migration.
5. Give Preview its own database, Auth project and storage before allowing admin or writes there.
6. Leaked-password protection needs a paid Supabase plan; not enabled.
7. Check a restorable backup exists, and GitHub branch protection.
8. Review the firewall rule after a week of real traffic.
