# Security hardening release (17 October 2026)

Follows the 16 October security review (`2026-10-16-security-hardening.md`, kept outside the repository). Its tested commit (067bebc) was not available here, so the requirements were implemented again on top of `c4e4949`, keeping the newer lily wording, photo-review build check, idle-pool handler and guide date. A second review on 17 October (`FreshPetals_Security_Findings_and_Claude_Prompt_2026-10-17.md`, also outside the repository) checked production `57d3385` and the live platform; its findings and evidence limits are reflected below. Operator detail: `docs/admin-security.md`.

## Release status

The application changes in this file are **not live** until this branch reaches `main` and Vercel reports Production Ready. On 17 October production was still `57d3385bc9a5c12f817206e70a6e438634895976` (deployment `dpl_77tUKYvrSGiiL75xH7DE2Qp2L9cc`), and its responses carried HSTS but no CSP, frame-denial or nosniff header. Pushing `main` from the working session was refused by the session's permission review ("Excess Sensitive Detail", no itemised reason); a scan of the outgoing commits found no environment values other than the public Supabase project URL, already on `main`. Publishing is a separate owner step.

Live independently of the application release: the Vercel firewall rule, Supabase sign-up off, and the database privilege changes (see "Controls verified").

## What changed (application, unreleased)

| Area | Change |
|---|---|
| Dependencies | Astro 6.4.8 → 7.4.0, @astrojs/vercel 10.0.8 → 11.0.15, @astrojs/react 6.0.2 → 7.1.0, Sharp 0.34.5 → 0.35.5, @vercel/functions 3.10.1, drizzle-kit 0.31.11; Node `24.x` (as the Vercel project). Narrow overrides: path-to-regexp 6.3.0 (adapter routing), esbuild ≥0.28.1 (Vite) and ≥0.25.12 (drizzle-kit loader), fast-uri ≥3.1.8 (type-check tooling). `npm audit`: 19 advisories (1 critical, 14 high) before, **0** after, on 17 October. An advisory database result, not proof of absence. |
| CSP | Hash-based policy on every static and on-demand page (`astro.config.mjs` `security.csp`, adapter `staticHeaders`). Reviewed inline scripts moved to `src/scripts/inline/` and rendered by `InlineScript.astro` with their hash. The build fails on any unhashed inline script or a page without a policy. Trailing-slash URLs get the same policy. |
| Headers | DENY framing, nosniff, `same-origin` referrer, restrictive Permissions-Policy, COOP `same-origin-allow-popups` on every response; private `no-store` admin headers and separate Set-Cookie headers kept; HSTS left to Vercel. |
| Requests | Exact-origin + Fetch Metadata check on every unsafe method; streamed body limits; JSON required on JSON routes. |
| Auth outages | In `57d3385`, a provider error from `getUser`/`getClaims` or a failed approved-admin lookup was treated as "no session" and deleted the session cookies (the lookup failure also signed out). Now a network failure, 5xx or 429 from Auth, an SDK exception, or a database exception during the lookup throws `AuthUnavailableError`; the middleware answers a generic 503, the handler never runs, and cookies and session are kept. A definitely invalid session (e.g. 401) is still cleared, an unapproved UUID/role is still signed out, and aal1 is still refused outside `/admin/mfa`. Unknown answers are never treated as approval. |
| Draft creation | `/admin/products/new`: POST only, 303 to the editor; GET/HEAD create nothing. |
| Uploads | Real-format check against declared type, size/pixel/frame limits, full decode and re-encode, metadata and trailing bytes removed, derived names; 4 MB client and server limit (Vercel's 4.5 MB ingress). |
| Privacy | Public enquiry answers `{ok:true}` only; repository logs carry code and duration, not SQL/parameters; the existing idle-pool listener is kept. |
| Enquiry delivery fields | The requested delivery option, timing and fee in an enquiry are what the customer's browser sent; they are shape-validated and stored, not recomputed by the server. The admin enquiry view now labels them requested / customer-submitted, unverified, with a reminder to confirm pincode, date, slot and fee before accepting the order. The inaccurate "authoritative server result" comments in `inquirySchema.ts` and `schema.ts` are corrected. Stored records, pricing, the optional pincode and the WhatsApp journey are unchanged. |
| Preview | Admin, Auth (including recovery GET and session bridge) and enquiry logging refused on preview deployments, which share production credentials. This reduces risk; it does not make Preview an isolated staging environment. |
| Migration files | `drizzle/0012_security_least_privilege.sql` (text of Supabase migration `20261016172741`) and `drizzle/0013_visitor_default_privileges.sql`, both already applied directly; see "Migration bookkeeping". |

## Controls verified (production, 17 October)

Read-only metadata, Supabase public settings and Vercel configuration. No customer rows were read.

| Control | Evidence | Limit |
|---|---|---|
| Registration | Sign-up turned off in the dashboard on 17 October; the public settings endpoint reports `disable_signup: true`, anonymous sign-in off, email provider on, auto-confirm off. Confirmed again by the second review. | The endpoint does not show password minimum, redirects or templates. |
| Visitor table access | 19 public tables, RLS on all 19; anon/authenticated have no INSERT/UPDATE/DELETE/TRUNCATE on any of them and no usable sequence. | The server uses a privileged connection; RLS does not replace application authorisation. |
| Private fields | anon/authenticated have no SELECT on `admin_users`, `inquiries`, `products.cost_price`, `media.uploaded_by`; `products.slug` stays readable. | A checked set of fields, not a proof about columns added later. |
| Public functions and views | No public views; the only public function is the design-code trigger, not SECURITY DEFINER, not visitor-executable, `search_path=""`. | Current public schema only. |
| Future-object defaults (0013) | For objects **`postgres`** creates in `public`, tables and sequences no longer give anon/authenticated anything by default (previously every table privilege including TRUNCATE, and sequence USAGE/SELECT/UPDATE). All 19 app tables are owned by `postgres`. service_role and postgres defaults kept. | **Not** changed: function EXECUTE defaults, and every default of `supabase_admin` (this connection cannot act as that role). "Every future object is locked down" would be inaccurate; each new table still needs RLS and explicit grants in its migration. |
| Vercel firewall | One active fixed-window rule, "Rate limit sign-in, MFA and enquiry POSTs": 30 POSTs per IP per 60 s to `/api/admin/auth/{login,forgot-password,reset-password,recovery-session}`, `/admin/mfa`, `/api/inquiries`; no pending draft. | Configuration only, not a threshold test; does not cover direct requests to Supabase Auth. |

How 0013 was applied: the two `ALTER DEFAULT PRIVILEGES` statements only, in one transaction that committed only after `pg_default_acl` showed the expected rows and a hash of all 32 table/sequence ACLs and RLS flags was unchanged. A separate read-only check afterwards differed from the earlier one in those two default-ACL rows only. Before that, an isolated PGlite database with production's default ACLs for both creators ran 0000–0013: existing grants, column grants, RLS and the 17 policies identical; a second run changed nothing; a new postgres-created table and sequence gave visitors nothing; service_role and postgres kept full access (37/37).

The private-table "RLS enabled, no policy" advisor notices are expected (they deny visitors); do not add permissive policies to clear them.

## Settings read in the dashboard but not re-verified

Read by the working session in the Supabase dashboard on 17 October and not independently confirmed by the second review (the public endpoint does not expose them). Treat them as reported until the owner reads them again.

| Setting | Reported value | Wanted |
|---|---|---|
| Email provider minimum password length | 6 (a change to 12 was refused by the session's permission review; not changed) | 12, matching the app's own minimum |
| Site URL | `http://localhost:3000` | `https://onlyfreshpetals.in` |
| Redirect URLs | none | include exactly `https://onlyfreshpetals.in/admin/reset-password`, keeping any other entry that is confirmed necessary |
| Reset-password email template | not inspected | review before editing (see owner action 2) |
| TOTP MFA | Enabled; phone MFA disabled; AAL1 session duration limited | unchanged |
| Supabase dashboard account two-step verification | not inspected | on |

No code in this release changes these settings.

## Migration bookkeeping (outstanding)

The Drizzle ledger (`drizzle.__drizzle_migrations`) still ends with the record for 0011 (row id 12, hash prefix `d7bde24187e4c029`, per the second review). 0012 and 0013 were applied outside it: 0012 through Supabase's own history (`20261016172741`), 0013 directly as above. The repository's journal lists both files.

Do **not** run `npm run db:migrate` to "catch up", replay the grant files, insert ledger rows with guessed hashes, or delete migration files to make the two histories agree. 0012 grants SELECT on the columns `products`/`media` have at run time, so replaying it after a schema change can expose a new column. Reconcile deliberately before the next migration: decide whether to record 0012/0013 as applied with the hash Drizzle computes for the committed files, and check the column list first. The build does not run migrations, so this is not a deployment blocker.

## Validation

Local, on the release tree; not production end-to-end evidence.

| Check | Result |
|---|---|
| Unit/regression | 45/45 `regression.test.mjs`; 28/28 `security.test.mjs` (real middleware, AuthService, guards, body readers, Sharp and CSP check; Auth SDK, database and storage are doubles). The outage test runs the real AuthService inside the real middleware for: getUser 503, 429, network failure and thrown exception; getClaims 503 and thrown exception; approved-admin lookup throwing. Each is a generic 503 on API GET, page GET and PATCH, handler not run, no cookie deleted, no sign-out. The same path keeps invalid session → 401 with cookie cleared, unapproved role or missing row → 401 with sign-out, aal1 → 403, aal2 → 200. Mutation check: removing 429 from the outage classifier, or restoring the old `findById(...).catch(() => null)`, fails both outage tests. |
| Type check | 20 errors, identical to the baseline in file, line and column (DiscoveryPostCard 4, MobileBottomBar 1, SubscriptionConfigurator 15). |
| Build | Pass; 178 prerendered pages, each with a CSP and every inline script hashed. |
| Admin enquiry display | Isolated fixture (local database, fixture Auth): the expanded enquiry shows the requested option and the unverified timing/fee labels and reminder, with stored values unchanged and HTML in customer fields shown as text. |
| Browser (Chromium, 390 px and 1440 px), run on `42e32d3` | 50/50. Production-backed build (reads only; enquiry log and admin handlers refused before the function): home, bouquets, garlands, Red Affair, FP-G106, wedding-garland guide, Bengaluru, Florist Cutter, basket; no CSP violation; FP-G106, Red Affair and basket WhatsApp drafts captured, never sent; optional pincode; image sitemap 46 entries. Isolated fixture: admin hydrate; safe draft creation; injected script blocked; deceptive uploads refused; cross-site 403; aal1 403; outage 503; body limits; `{ok:true}`; preview refusals. The follow-up changed only the outage classifier, comments and admin enquiry labels, which these checks do not exercise beyond the outage path tested above. |

These checks do not prove production CDN behaviour, the image optimiser, Google Analytics receipt or Supabase SDK cookie behaviour during every refresh failure; the live checks after release cover headers, pages and analytics loading.

## Owner actions

1. Supabase → Authentication → Sign In / Providers → Email: read the minimum password length; if still 6, set 12 (only applied when a password is set; current sign-ins are unaffected).
2. Supabase → Authentication → URL Configuration: read Site URL and Redirect URLs; if still as reported, set Site URL `https://onlyfreshpetals.in` and add `https://onlyfreshpetals.in/admin/reset-password`, keeping other confirmed entries. Then open Emails → Reset password and read the template before changing it. The app already sends the full callback URL as `redirectTo`, so a link built as `{{ .RedirectTo }}/admin/reset-password` would duplicate the path; if switching to the token-hash form, use `{{ .SiteURL }}/admin/reset-password?token_hash={{ .TokenHash }}&type=recovery`. Test with one deliberate reset of the owner's own account.
3. Two-step verification on the Supabase dashboard account.
4. Publish this branch to `main` (see Release status) and run the live checks.
5. Reconcile the Drizzle ledger for 0012/0013 before any future `db:migrate` (see above).
6. Give Preview its own database, Auth project and storage before allowing admin or writes there.
7. Managed PostgreSQL: the second review reports the server at 17.6 with Supabase's 17.11 maintenance update available, and found none of the documented upgrade hazards in metadata. Schedule the provider update separately from an application release, after confirming a restorable backup.
8. Check a restorable backup exists, and GitHub branch protection.
9. Leaked-password protection needs a paid Supabase plan; not enabled, no plan change made.
10. Review the firewall rule after a week of real traffic.

## Rollback (after release)

- Security work only: `git revert` the security commits (keeps `aefdafd`/`c4e4949`).
- Whole site: promote `dpl_77tUKYvrSGiiL75xH7DE2Qp2L9cc` (also drops `aefdafd`/`c4e4949`).
- Either way, keep the tightened database grants and 0013 defaults.
