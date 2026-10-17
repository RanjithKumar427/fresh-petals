# Admin access, two-step verification and recovery

Operator notes for the FreshPetals admin (`/admin`). No secrets belong in this file.

## Who can get in

Every `/admin/*` page and `/api/admin/*` endpoint goes through `src/middleware.ts`, which asks `AuthService.resolveAccess()` for one of three states on **every request**:

| State | Who | What they can reach |
|---|---|---|
| `none` | No valid Supabase session, or a valid session whose user has no approved `admin_users` row | Nothing. Pages redirect to `/admin/login`; APIs return `401`. A session belonging to an unapproved account is signed out on the spot. |
| `mfa` | Approved administrator who has entered the password only (session `aal1`) | Only `/admin/mfa` (set up an authenticator or enter its code) and sign-out. Other pages redirect to `/admin/mfa`; APIs return `403`. |
| `full` | Approved administrator whose session is `aal2` (TOTP code verified) | The dashboard and all admin APIs. |

- Identity is checked with Supabase Auth on each request (`getUser()` catches revoked sessions; `getClaims()` verifies the token before its `aal` claim is used).
- **Approved** means an existing `admin_users` row for that exact auth UUID with a role in `APPROVED_ADMIN_ROLES` (currently `admin`). The app never creates, changes or relinks these rows — not on login, session checks, password recovery or MFA. Email addresses and user metadata are never used to grant access.
- Admin responses are sent with `Cache-Control: private, no-store`, `X-Robots-Tag: noindex` and `Referrer-Policy: same-origin` (not `no-referrer`, which makes Chrome send `Origin: null` on the admin's own form posts and trips the origin check). Session cookies are `HttpOnly`, `SameSite=Lax` and `Secure` in production.
- If Supabase Auth or the database cannot be reached, protected requests get `503` (fail closed); the session cookies are kept, so an outage does not sign anyone out.

## Request and browser protections (17 October 2026)

- **Unsafe methods** (POST, PATCH, DELETE …) on every on-demand route, admin and public, JSON included: the `Origin` must be exactly the site's own origin and `Sec-Fetch-Site`, when sent, must be `same-origin`; otherwise `403` before authentication or any handler (`src/server/http/requestGuard.ts`). This stops other sites driving a visitor's browser; it is not bot protection.
- **Bodies** are read through bounded streaming readers (`src/server/http/body.ts`), not just checked against `Content-Length`: public JSON 32 KiB, admin JSON 256 KiB, sign-in/MFA forms 8 KiB, image uploads 4.5 MB (Vercel's own request ceiling). JSON endpoints require `application/json` (`415` otherwise).
- **Add Product** is a POST (dashboard and product-list buttons) answered with `303` to the editor. Visiting `/admin/products/new` with GET or HEAD only shows a button and creates nothing.
- **Uploads** (`src/server/media/imageSafety.ts`): the file's real format must be JPEG, PNG, WebP or GIF and match its declared type; at most 4 MB, 40 million decoded pixels and 100 frames; the image is fully decoded and re-encoded (metadata and anything appended removed, animation kept), stored under a name and extension derived from the real format. Disguised HTML/SVG, corrupt files and decompression bombs are refused before storage.
- **Privacy:** a successful public enquiry answers `{ "ok": true }` only. Database errors are logged as call, duration and driver code, never SQL, parameters or messages.
- **Headers:** every page has a hash-based `Content-Security-Policy` (Astro's own script/style hashes plus the reviewed inline scripts in `src/scripts/inline/`, rendered through `InlineScript.astro`); no `unsafe-inline`/`unsafe-eval` for scripts. Inline `style=""` attributes stay allowed. Every response also carries `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin` and a restrictive `Permissions-Policy` (`src/server/http/securityHeaders.mjs`). HSTS stays with Vercel. The build fails if a prerendered page lacks a CSP or runs an inline script whose hash is not in it (`scripts/build/security-headers.mjs`). Adding an inline script means putting it in `src/scripts/inline/` and rendering it with `<InlineScript code={…} />`; never add a blanket CSP in Vercel settings, which would block the hashed scripts.

## Preview deployments

Preview and Production share the same `DATABASE_URL` and Supabase keys (one Vercel variable targets both), so previews are **not** an isolated staging environment. On a preview (`VERCEL_ENV=preview`) every `/admin` page and `/api/admin` endpoint, including the recovery-link GET and the session bridge, and the enquiry log are refused before any handler runs. Browsing, the delivery check and WhatsApp drafts keep working. Give Preview its own database, Auth project and storage before ever allowing admin or writes there.

## Adding an administrator (trusted operator only)

1. In the Supabase dashboard for the production project: **Authentication → Users → Invite user** (signups stay disabled).
2. From a trusted machine with the production environment loaded: `node scripts/link-admin-identity.mjs --email=person@example.com`. This is the only place an `admin_users` row is written.
3. The new administrator signs in at `/admin/login` and is taken straight to two-step setup.

To **remove** an administrator: delete their `admin_users` row, then delete or ban the user under **Authentication → Users**. Their next request is denied.

## Two-step verification (TOTP)

- First sign-in after this release: password → **Set up authenticator** → scan the QR code (or type the key) into an authenticator app → enter the 6-digit code. Every later sign-in: password → current code.
- The QR code and key are shown once, in a `no-store` response, to the signed-in owner only. They are never stored or logged by the app.
- If the phone's clock is wrong, codes fail; set the phone to automatic time.
- Use an authenticator app with an encrypted backup (for example 1Password, or Google/Microsoft Authenticator with cloud backup), so a lost phone does not mean a lost authenticator.

## If the authenticator is lost

There is deliberately **no bypass password, recovery account or "skip MFA" switch** in the app. Recovery is done by the person who controls the Supabase project:

1. Sign in to the Supabase dashboard (that account should itself have two-step verification).
2. **Authentication → Users →** the administrator **→** delete their MFA factor.
3. The administrator signs in with their password and sets up a new authenticator on `/admin/mfa`.

## If the password is lost

1. `/admin/forgot-password` → enter the admin email. The page always shows the same message; an email is only sent if the address belongs to an approved administrator.
2. Open the link **in the same browser** that requested it (Supabase's server-side reset uses PKCE; the browser holds the matching verifier). To make links work on any device, change the Supabase **Reset password** email template link to:
   `{{ .SiteURL }}/admin/reset-password?token_hash={{ .TokenHash }}&type=recovery` — the app supports both forms.
3. Choose a new password (12–72 characters). If an authenticator is set up, its current code is required too.
4. The reset session is ended; sign in again with the new password and the code.

A reset link alone never gives admin access and never creates admin membership.

## Required Supabase project settings (production)

| Setting | Where | Required value |
|---|---|---|
| Allow new users to sign up | Authentication → Sign In / Providers | **Off** (admin-only identity project) |
| Anonymous sign-ins | Authentication → Sign In / Providers | Off |
| Confirm email | Authentication → Providers → Email | On |
| Minimum password length | Authentication → Providers → Email | **12** (the app enforces 12 too) |
| Site URL | Authentication → URL Configuration | `https://onlyfreshpetals.in` |
| Redirect URLs | Authentication → URL Configuration | `https://onlyfreshpetals.in/admin/reset-password` only (previews and local use their own project) |
| MFA (TOTP) | Authentication → Multi-Factor | Enabled (enroll + verify) |
| Rate limits | Authentication → Rate Limits | Defaults: sign-in/recover 30 per 5 min per IP, token 150 per 5 min per IP, MFA verify 15 per min per IP (not configurable). The built-in email sender allows only **2 emails per hour per project** — configure custom SMTP if more reset emails are needed. |

Checked on 17 October 2026 in the dashboard: sign-up turned **off** that day; anonymous sign-ins off; email confirmation on; email the only provider; TOTP enabled. Still to fix by the owner: minimum password length is **6** (set 12), Site URL is **`http://localhost:3000`** with **no redirect URLs** (set the two values above, then test a reset email). Dashboard-account two-step verification not checked.

New tables and sequences created by `postgres` in `public` are not granted to anon/authenticated by default (`drizzle/0013`, applied 17 October 2026); a migration that wants visitors to read a table grants SELECT and adds RLS explicitly.

The app does not implement its own login throttling; an in-memory counter would not hold across Vercel's instances, and Supabase's limits count its server, not each visitor. Since 17 October 2026 a Vercel Firewall rule ("Rate limit sign-in, MFA and enquiry POSTs") allows each IP 30 POSTs per 60 seconds (fixed window) to `/api/admin/auth/{login,forgot-password,reset-password,recovery-session}`, `/admin/mfa` and `/api/inquiries`, then answers 429. Storefront GETs, crawlers, the delivery check and editor autosaves are not matched. The Hobby plan allows one such rule; review it in Firewall → Overview after real traffic (shared office networks share one IP).

Vercel needs `SITE_URL=https://onlyfreshpetals.in` in **Production**. Without it the app refuses to send reset emails rather than building a link from the request's Host header.

## Publishing admin price edits to the storefront

The storefront is static: product and listing pages read prices from the database **when the site is built**. Saving a price in the admin updates the database, the cart's revalidation and the WhatsApp draft, but the public product pages keep showing the old price until the next production build.

After editing prices:

1. Rebuild production from the same verified source (Vercel dashboard → Deployments → the current production deployment → **Redeploy**, keeping "use existing build cache" off; or `vercel redeploy <production-deployment-url>`).
2. Check one edited product page on https://onlyfreshpetals.in shows the new price.

There is no automatic revalidation; a database save alone does not prove the public site has changed.
