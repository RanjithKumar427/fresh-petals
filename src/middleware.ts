import { defineMiddleware } from "astro:middleware";
import { AuthService } from "./server/services/AuthService";

// Every /admin/* page and /api/admin/* endpoint requires a valid session
// except the login page/endpoint themselves. Everything else on the site
// (the storefront) skips this entirely and stays untouched.
const PUBLIC_PATHS = new Set(["/admin/login", "/api/admin/auth/login"]);

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
