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
 * Preview deployments (Vercel previews, the Cloudflare preview Worker) use the production database and Auth project (the
 * Vercel variables are shared with Production), so they are NOT an
 * isolated staging environment. Nothing there may sign in, refresh or
 * exchange a session, or write: every /admin page and /api/admin endpoint
 * (any method, including the recovery-link GET) and the enquiry log are
 * refused before a handler runs. Public pages, the delivery check (read
 * only) and WhatsApp drafts keep working.
 */
export function isPreviewDeployment(env: Record<string, string | undefined> = process.env): boolean {
  // FP_DEPLOY_ENV=preview marks the Cloudflare preview Worker (wrangler.jsonc env.preview).
  return env.VERCEL_ENV === "preview" || env.FP_DEPLOY_ENV === "preview";
}

export function blockedOnPreview(path: string): boolean {
  return isAdminPage(path) || isAdminApi(path) || path === "/api/inquiries";
}

/**
 * The staging Worker (wrangler.jsonc env.staging) has its own database, Auth
 * project and Storage, so admin and Auth routes work there. Public enquiry
 * submission stays refused: the restored enquiries must not change.
 *
 * One controlled exception, for tests only: while the Worker holds the secret
 * FP_STAGING_INQUIRY_TEST_KEY (at least 32 characters), a request carrying the
 * same value in STAGING_INQUIRY_TEST_HEADER may log an enquiry. Every other
 * visitor is still refused. Deleting the secret restores the full refusal
 * without a deployment.
 */
export function isStagingDeployment(env: Record<string, string | undefined> = process.env): boolean {
  return env.FP_DEPLOY_ENV === "staging";
}

export const STAGING_INQUIRY_TEST_HEADER = "x-fp-staging-inquiry-test";

function sameSecret(sent: string, expected: string): boolean {
  if (sent.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= sent.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

export function stagingInquiryTestAllowed(headers: Headers | undefined, env?: Record<string, string | undefined>): boolean {
  const sent = headers?.get(STAGING_INQUIRY_TEST_HEADER);
  if (!sent) return false;
  const settings = env ?? process.env;
  const key = settings.FP_STAGING_INQUIRY_TEST_KEY ?? "";
  if (settings.FP_DEPLOY_ENV !== "staging" || key.length < 32) return false;
  return sameSecret(sent, key);
}

export const blockedOnStaging = (path: string, headers?: Headers, env?: Record<string, string | undefined>) =>
  path === "/api/inquiries" && !stagingInquiryTestAllowed(headers, env);

const STAGING_SUPABASE_URL = "https://wyndmywdtacucojvudxg.supabase.co";
const PRODUCTION_REF = "hjhmetomcaskrrwkgrbp";
const CANONICAL_SITE = "https://onlyfreshpetals.in";
const STAGING_AUTH_ORIGIN = /^https:\/\/fresh-petals-staging\.[a-z0-9-]+\.workers\.dev$/;

/**
 * Where staging's Auth links return: the explicitly configured origin only.
 * Never SITE_URL, which stays the production canonical, and never the request's Host.
 */
export function stagingAuthOrigin(env: Record<string, string | undefined> = process.env): string | null {
  const origin = env.FP_AUTH_ORIGIN ?? "";
  return STAGING_AUTH_ORIGIN.test(origin) ? origin : null;
}

/**
 * Everything a staging Worker must prove before it answers a dynamic request.
 * Returns fixed descriptions, never a value. The database's own identity is
 * checked separately, by a query (src/middleware.ts).
 */
export function stagingConfigProblems(
  env: Record<string, string | undefined>,
  context: { stagingBuild: boolean; viaHyperdrive: boolean; requestOrigin: string }
): string[] {
  const problems: string[] = [];
  if (!context.stagingBuild) problems.push("the bundle was not built for staging");
  if (env.FP_DEPLOY_ENV !== "staging") problems.push("FP_DEPLOY_ENV is not staging");
  if (env.SUPABASE_URL !== STAGING_SUPABASE_URL) problems.push("SUPABASE_URL is not the staging project");
  if (!env.SUPABASE_ANON_KEY) problems.push("SUPABASE_ANON_KEY is missing");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) problems.push("SUPABASE_SERVICE_ROLE_KEY is missing");
  if (env.SITE_URL !== CANONICAL_SITE) problems.push("SITE_URL is not the production canonical");
  if (!stagingAuthOrigin(env)) problems.push("FP_AUTH_ORIGIN is missing or not the staging Worker");
  else if (context.requestOrigin !== env.FP_AUTH_ORIGIN) problems.push("the request did not arrive on the staging Worker's address");
  if (!/^\d+$/.test(env.FP_STAGING_DB_ID ?? "")) problems.push("FP_STAGING_DB_ID is missing");
  if (!context.viaHyperdrive) problems.push("the HYPERDRIVE binding is missing");
  for (const name of ["DATABASE_URL", "CF_ZONE_ID", "CF_CACHE_PURGE_TOKEN"]) if (env[name]) problems.push(`${name} must not be set on staging`);
  if (Object.values(env).some((value) => typeof value === "string" && value.includes(PRODUCTION_REF))) problems.push("a setting references the production project");
  return problems;
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
