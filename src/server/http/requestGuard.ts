// Request checks that src/middleware.ts applies before any handler runs.
// Pure functions of the request, so the regression tests can call them.
import { BODY_LIMITS } from "./body";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
export const isUnsafeMethod = (method: string) => !SAFE_METHODS.has(method.toUpperCase());

/** Lower-cased path without trailing slashes, so /Admin/ or /api//x can't slip past a prefix check. */
export function normalisePath(pathname: string): string {
  return pathname.toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
}

export const isAdminPage = (path: string) => path === "/admin" || path.startsWith("/admin/");
export const isAdminApi = (path: string) => path === "/api/admin" || path.startsWith("/api/admin/");

/**
 * Preview deployments use the production database and Auth project (the
 * Vercel variables are shared with Production), so they are NOT an
 * isolated staging environment. Nothing there may sign in, refresh or
 * exchange a session, or write: every /admin page and /api/admin endpoint
 * (any method, including the recovery-link GET) and the enquiry log are
 * refused before a handler runs. Public pages, the delivery check (read
 * only) and WhatsApp drafts keep working.
 */
export function isPreviewDeployment(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "preview";
}

export function blockedOnPreview(path: string): boolean {
  return isAdminPage(path) || isAdminApi(path) || path === "/api/inquiries";
}

/**
 * Browser CSRF check for unsafe methods: the Origin must be exactly this
 * site's origin, and Fetch Metadata (when the browser sends it) must say
 * same-origin. A request with neither header is refused too: every real
 * caller is this site's own pages. This is not bot protection; it stops
 * another site from making a visitor's browser send the request.
 * Returns the reason for refusing, or null when the request may proceed.
 */
export function crossOriginReason(headers: Headers, requestOrigin: string): string | null {
  const origin = headers.get("origin");
  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return `sec-fetch-site ${site}`;
  if (origin === null) return site === "same-origin" ? null : "no origin";
  if (origin !== requestOrigin) return "cross-origin";
  return null;
}

type BodyRule = { limit: number; types: readonly string[] };
const JSON_ONLY = ["application/json"] as const;
const FORM = ["application/x-www-form-urlencoded", "multipart/form-data"] as const;

/** Form posts: sign-in, MFA, password reset, sign-out and "Add product". */
const FORM_PATHS = new Set([
  "/api/admin/auth/login",
  "/api/admin/auth/logout",
  "/api/admin/auth/forgot-password",
  "/api/admin/auth/reset-password",
  "/admin/mfa",
  "/admin/products/new",
]);

/** The body an unsafe request to this path may carry: size limit and media types. */
export function bodyRule(path: string): BodyRule {
  if (path === "/api/admin/media") return { limit: BODY_LIMITS.upload, types: ["multipart/form-data"] };
  if (FORM_PATHS.has(path)) return { limit: BODY_LIMITS.authForm, types: FORM };
  if (path === "/api/admin/auth/recovery-session") return { limit: BODY_LIMITS.authForm, types: JSON_ONLY };
  if (isAdminApi(path)) return { limit: BODY_LIMITS.adminJson, types: JSON_ONLY };
  if (isAdminPage(path)) return { limit: BODY_LIMITS.authForm, types: FORM };
  return { limit: BODY_LIMITS.publicJson, types: JSON_ONLY };
}

/**
 * Declared-size and media-type check for an unsafe request (the handlers
 * also read their bodies through the bounded readers in ./body.ts, which
 * enforce the same limit on the actual stream). A request declaring
 * Content-Length: 0 carries nothing to check; one with no Content-Length
 * counts as having a body if it is chunked or has a body stream (HTTP/2).
 */
export function bodyProblem(path: string, headers: Headers, hasStream = false): { status: 413 | 415; error: string } | null {
  const rule = bodyRule(path);
  const lengthHeader = headers.get("content-length");
  const declared = lengthHeader === null ? null : Number(lengthHeader);
  if (declared !== null && (!Number.isFinite(declared) || declared > rule.limit)) return { status: 413, error: "Request body is too large." };
  const hasBody = declared !== null ? declared > 0 : headers.has("transfer-encoding") || hasStream;
  if (!hasBody) return null;
  const type = (headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!rule.types.includes(type)) return { status: 415, error: "Unsupported request body type." };
  return null;
}
