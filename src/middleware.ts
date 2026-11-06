import { defineMiddleware } from "astro:middleware";
import type { MiddlewareHandler } from "astro";
import { AuthService } from "./server/services/AuthService";
import { SECURITY_HEADERS, storedMediaOrigin } from "./server/http/securityHeaders.mjs";
import {
  blockedOnPreview,
  blockedOnStaging,
  bodyProblem,
  crossOriginReason,
  isAdminApi,
  isAdminPage,
  isPreviewDeployment,
  isStagingDeployment,
  isUnsafeMethod,
  normalisePath,
  stagingConfigProblems,
} from "./server/http/requestGuard";
import { ON_CLOUDFLARE, STAGING_BUILD, inWorkersRuntime } from "./server/platform/target";
import { cloudflareEnv, requestScope, workerScope } from "./server/platform/requestScope";
import { servedStatically, staticFallback } from "./server/platform/staticFallback";
import { edgeCacheMatch, edgeCacheStore, edgeCacheable } from "./server/platform/edgeCache";
import { STORED_PHOTO_WIDTHS } from "./data/garlandRules";

// Every on-demand request passes through here, in this order:
//
// 1. Preview deployments share the production database and Auth project,
//    so all admin/Auth routes and the enquiry log are refused there before
//    anything else (requestGuard.blockedOnPreview).
// 2. Unsafe methods (POST, PATCH, DELETE, …) anywhere: exact same-origin
//    Origin / Fetch Metadata, a declared size within the route's limit and
//    the expected body type. Handlers read the body through bounded
//    readers (server/http/body.ts), so an undeclared or chunked body is
//    held to the same limit. This adds to Astro's own form origin check,
//    which does not cover JSON requests.
// 3. /admin/* pages and /api/admin/* endpoints: the administrator access
//    state below, decided on every request.
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
// (state "full"). See AuthService.AdminAccess for the states. If Supabase
// Auth or the database cannot be reached, access is refused with 503
// (state "unavailable") and the session cookies are kept.
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
// on same-site form posts, which the origin checks rightly reject.)
const PRIVATE_HEADERS: Record<string, string> = {
  "cache-control": "private, no-store, max-age=0",
  pragma: "no-cache",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "same-origin",
};

/**
 * Sets headers on a response. Headers of some responses (Response.redirect)
 * are immutable; those are copied into a new Response first. Astro attaches
 * session cookies to whatever response the middleware returns, and copied
 * headers keep each Set-Cookie separate.
 */
function withHeaders(response: Response, ...sets: Record<string, string>[]): Response {
  let res = response;
  try {
    for (const set of sets) for (const [k, v] of Object.entries(set)) res.headers.set(k, v);
  } catch {
    res = new Response(response.body, response);
    for (const set of sets) for (const [k, v] of Object.entries(set)) res.headers.set(k, v);
  }
  return res;
}

const withPrivateHeaders = (response: Response) => withHeaders(response, SECURITY_HEADERS, PRIVATE_HEADERS);

function json(status: number, error: string): Response {
  return new Response(JSON.stringify({ ok: false, error }), { status, headers: { "content-type": "application/json" } });
}

function page(status: number, message: string): Response {
  const body = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Fresh Petals</title><p>${message}</p></html>`;
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

const handle = async (context: Parameters<MiddlewareHandler>[0], next: Parameters<MiddlewareHandler>[1]): Promise<Response> => {
  const { url, cookies, request, redirect } = context;
  const path = normalisePath(url.pathname);
  const adminPage = isAdminPage(path);
  const adminApi = isAdminApi(path);
  const isPrivate = adminPage || adminApi;
  const refuse = (status: number, error: string) =>
    withHeaders(path.startsWith("/api/") ? json(status, error) : page(status, error), SECURITY_HEADERS, isPrivate ? PRIVATE_HEADERS : {});

  // 1. Preview deployments: no admin, Auth or enquiry log at all.
  if (isPreviewDeployment() && blockedOnPreview(path)) {
    return refuse(403, "Not available on preview deployments: they share the production database and sign-in.");
  }

  if (isStagingDeployment() && blockedOnStaging(path, request.headers)) {
    return refuse(403, "Not available on the staging deployment.");
  }

  // 2. Unsafe methods: same origin, bounded and of the expected type.
  if (isUnsafeMethod(request.method)) {
    if (crossOriginReason(request.headers, url.origin)) return refuse(403, "Cross-site request refused.");
    const problem = bodyProblem(path, request.headers, request.body !== null);
    if (problem) return refuse(problem.status, problem.error);
  }

  if (!isPrivate) return withHeaders(await next(), SECURITY_HEADERS);

  // 3. Administrator access.
  if (OPEN_PATHS.has(path)) return withPrivateHeaders(await next());

  const access = await AuthService.resolveAccess(request, cookies).catch(() => ({ state: "unavailable" }) as const);
  const wanted = encodeURIComponent(url.pathname + url.search);

  if (access.state === "unavailable") {
    return refuse(503, "Sign-in is temporarily unavailable. Please try again in a few minutes.");
  }

  if (access.state === "none") {
    if (adminApi) return withPrivateHeaders(json(401, "Unauthorized"));
    const reason = access.hadSession ? "&reason=ended" : "";
    return withPrivateHeaders(redirect(`/admin/login?next=${wanted}${reason}`));
  }

  if (access.state === "mfa") {
    if (MFA_PATHS.has(path)) {
      context.locals.pendingAdmin = { id: access.admin.id, email: access.admin.email, hasVerifiedFactor: access.hasVerifiedFactor };
      return withPrivateHeaders(await next());
    }
    if (adminApi) return withPrivateHeaders(json(403, "Two-step verification required"));
    return withPrivateHeaders(redirect(`/admin/mfa?next=${wanted}`));
  }

  // state === "full"
  if (MFA_PATHS.has(path)) return withPrivateHeaders(redirect("/admin/dashboard"));
  context.locals.admin = { id: access.admin.id, email: access.admin.email };
  return withPrivateHeaders(await next());
};

/**
 * Vercel adds HSTS at its domain layer; on Cloudflare the Worker sends the
 * same value (public/_headers carries it for static files).
 */
const PLATFORM_HEADERS: Record<string, string> = ON_CLOUDFLARE ? { "strict-transport-security": "max-age=63072000" } : {};
/** The Cloudflare preview and staging Workers are never indexed. */
const previewHeaders = (): Record<string, string> => (process.env.FP_DEPLOY_ENV === "preview" || process.env.FP_DEPLOY_ENV === "staging" ? { "x-robots-tag": "noindex, nofollow" } : {});

const storedMediaPrefix = () => `${storedMediaOrigin()}/storage/v1/object/public/media/`;

/**
 * A staging bundle, or a Worker configured as staging, answers nothing until
 * its configuration is exact and the database behind Hyperdrive reports the
 * expected system identifier. A binding's name proves nothing: this asks the
 * database itself. Success is remembered per isolate; failure never is.
 */
let stagingDatabaseVerified = false;
async function stagingRefusal(requestOrigin: string, viaHyperdrive: boolean): Promise<Response | null> {
  if (!STAGING_BUILD && !isStagingDeployment()) return null;
  const problems = stagingConfigProblems(process.env, { stagingBuild: STAGING_BUILD, viaHyperdrive, requestOrigin });
  if (!problems.length && !stagingDatabaseVerified) {
    try {
      const [{ sql }, { getDb }] = await Promise.all([import("drizzle-orm"), import("./server/db/postgres/client")]);
      const result = await getDb().execute(sql`select system_identifier::text as id from pg_control_system()`);
      if (result.rows[0]?.id === process.env.FP_STAGING_DB_ID) stagingDatabaseVerified = true;
      else problems.push("the database behind Hyperdrive is not the staging database");
    } catch {
      problems.push("the database identity could not be read");
    }
  }
  if (!problems.length) return null;
  console.error(`[staging] refused: ${problems.join("; ")}`);
  return withHeaders(page(503, "This staging deployment is not correctly configured."), SECURITY_HEADERS, PRIVATE_HEADERS);
}

/** On staging, dynamic responses name the deployed source revision. */
const revisionHeader = (): Record<string, string> => (process.env.FP_DEPLOY_ENV === "staging" && process.env.FP_SOURCE_REVISION ? { "x-fp-source-revision": process.env.FP_SOURCE_REVISION } : {});

/**
 * Cloudflare's /_image endpoint (Images binding) accepts only what
 * storedPhotoUrl() generates, as Vercel's optimiser accepts only its
 * configured sizes: a stored media photo, an allowed width, WebP, quality 75.
 * Anything else would let a stranger mint unlimited distinct transformations.
 */
function imageRequestAllowed(url: URL): boolean {
  const params = [...url.searchParams.keys()].sort().join(",");
  if (params !== "f,href,q,w") return false;
  const href = url.searchParams.get("href") ?? "";
  return (
    href.startsWith(storedMediaPrefix()) &&
    !href.includes("..") &&
    STORED_PHOTO_WIDTHS.includes(Number(url.searchParams.get("w"))) &&
    url.searchParams.get("q") === "75" &&
    url.searchParams.get("f") === "webp"
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!inWorkersRuntime()) return handle(context, next);
  if (context.url.pathname === "/_image" && !imageRequestAllowed(context.url)) {
    return withHeaders(new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=300" } }), SECURITY_HEADERS);
  }
  // A public GET/HEAD that reaches the Worker has no prebuilt file (static
  // assets are served before the Worker): a city spelled another way, or a 404.
  // Answered statically, before any database scope (src/server/platform/staticFallback.ts).
  if (servedStatically(context.request.method, normalisePath(context.url.pathname))) {
    const env = await cloudflareEnv();
    return staticFallback(context.url, context.request.method, env.ASSETS as Parameters<typeof staticFallback>[2], { ...SECURITY_HEADERS, ...PLATFORM_HEADERS, ...previewHeaders(), ...revisionHeader() });
  }
  // Cloudflare Workers: a per-request database scope, and the shared cache
  // that Vercel's CDN provided for public on-demand pages.
  const scope = await workerScope();
  return requestScope.run(scope, async () => {
    const refusal = await stagingRefusal(context.url.origin, scope.viaHyperdrive === true);
    if (refusal) return withHeaders(refusal, PLATFORM_HEADERS);
    const path = normalisePath(context.url.pathname);
    const cacheable = edgeCacheable(context.request, path);
    if (cacheable) {
      const hit = await edgeCacheMatch(context.request);
      if (hit) return hit;
    }
    const response = withHeaders(await handle(context, next), PLATFORM_HEADERS, previewHeaders(), revisionHeader());
    if (!cacheable) return response;
    const cf = (context.locals as { cfContext?: { waitUntil(promise: Promise<unknown>): void } }).cfContext;
    return edgeCacheStore(context.request, response, cf ? (promise) => cf.waitUntil(promise) : undefined);
  });
});
