import { defineMiddleware } from "astro:middleware";
import { AuthService } from "./server/services/AuthService";

// Every /admin/* page and /api/admin/* endpoint passes through here.
//
// Open without a session: the sign-in, forgot-password and reset-password
// pages/endpoints, and logout. None of them grants access: reset-password
// works on a recovery session, which is first-factor only and is ended as
// soon as the password changes (AuthService.updatePassword).
//
// Two-step pages (/admin/mfa): only an approved administrator who has passed
// the password step (state "mfa") or already finished both steps.
//
// Everything else: only an approved administrator whose session is aal2
// (state "full"). See AuthService.AdminAccess for the three states.
const OPEN_PATHS = new Set([
  "/admin/login",
  "/api/admin/auth/login",
  "/api/admin/auth/logout",
  "/admin/forgot-password",
  "/api/admin/auth/forgot-password",
  "/admin/reset-password",
  "/api/admin/auth/reset-password",
  "/api/admin/auth/recovery-session",
]);
const MFA_PATHS = new Set(["/admin/mfa"]);

// Admin responses carry session cookies and private data: never cached by
// a browser, CDN or shared proxy, and never indexed. The referrer is kept
// to this site only, so a reset link's one-time code never reaches another
// origin. (Not "no-referrer": with that policy Chrome sends `Origin: null`
// on same-site form posts, which Astro's origin check rightly rejects.)
const PRIVATE_HEADERS: Record<string, string> = {
  "cache-control": "private, no-store, max-age=0",
  pragma: "no-cache",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "same-origin",
};

function withPrivateHeaders(response: Response): Response {
  let res = response;
  try {
    for (const [k, v] of Object.entries(PRIVATE_HEADERS)) res.headers.set(k, v);
  } catch {
    // Some responses (e.g. Response.redirect) have immutable headers.
    res = new Response(response.body, response);
    for (const [k, v] of Object.entries(PRIVATE_HEADERS)) res.headers.set(k, v);
  }
  return res;
}

function json(status: number, error: string): Response {
  return new Response(JSON.stringify({ ok: false, error }), { status, headers: { "content-type": "application/json" } });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, request, redirect } = context;

  // Compare a normalised path so /Admin/… or a trailing slash can't slip
  // past the prefix checks.
  const path = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";
  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  const isAdminApi = path === "/api/admin" || path.startsWith("/api/admin/");
  if (!isAdminPage && !isAdminApi) return next();

  if (OPEN_PATHS.has(path)) return withPrivateHeaders(await next());

  const access = await AuthService.resolveAccess(request, cookies);
  const wanted = encodeURIComponent(url.pathname + url.search);

  if (access.state === "none") {
    if (isAdminApi) return withPrivateHeaders(json(401, "Unauthorized"));
    const reason = access.hadSession ? "&reason=ended" : "";
    return withPrivateHeaders(redirect(`/admin/login?next=${wanted}${reason}`));
  }

  if (access.state === "mfa") {
    if (MFA_PATHS.has(path)) {
      context.locals.pendingAdmin = { id: access.admin.id, email: access.admin.email, hasVerifiedFactor: access.hasVerifiedFactor };
      return withPrivateHeaders(await next());
    }
    if (isAdminApi) return withPrivateHeaders(json(403, "Two-step verification required"));
    return withPrivateHeaders(redirect(`/admin/mfa?next=${wanted}`));
  }

  // state === "full"
  if (MFA_PATHS.has(path)) return withPrivateHeaders(redirect("/admin/dashboard"));
  context.locals.admin = { id: access.admin.id, email: access.admin.email };
  return withPrivateHeaders(await next());
});
