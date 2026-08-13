import { defineMiddleware } from "astro:middleware";
import { AuthService } from "./server/services/AuthService";

// Every /admin/* page and /api/admin/* endpoint requires a valid session
// except the login page/endpoint themselves, and the forgot/reset-password
// flow -- by definition, someone using that flow doesn't have a valid
// admin session yet. None of these grant admin access on their own:
// reset-password.astro's own server-side check (AuthService.hasSession /
// exchangeRecoveryCode) still gates whether the password form renders, and
// a successful reset signs the recovery session back out immediately
// (AuthService.updatePassword) -- the admin still has to sign in through
// /admin/login afterward like anyone else. Everything else on the site
// (the storefront) skips this entirely and stays untouched.
const PUBLIC_PATHS = new Set([
  "/admin/login",
  "/api/admin/auth/login",
  "/admin/forgot-password",
  "/api/admin/auth/forgot-password",
  "/admin/reset-password",
  "/api/admin/auth/reset-password",
  "/api/admin/auth/recovery-session",
]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, request, redirect } = context;

  const isAdminPage = url.pathname.startsWith("/admin");
  const isAdminApi = url.pathname.startsWith("/api/admin");

  if (!isAdminPage && !isAdminApi) return next();
  if (PUBLIC_PATHS.has(url.pathname)) return next();

  const admin = await AuthService.verifySession(request, cookies);

  if (!admin) {
    if (isAdminApi) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    return redirect(`/admin/login?next=${encodeURIComponent(url.pathname)}`);
  }

  context.locals.admin = { id: admin.id, email: admin.email };
  return next();
});
