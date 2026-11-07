// How admin changes reach the prebuilt storefront on Cloudflare.
//
// Every public page, sitemap and the search fragment is a static file built
// from the database (the build reads it once). An admin save changes the
// database; the site changes when a new build is deployed. Two things start
// that build, so no one has to run anything:
//
//   1. On save, requestPublication() asks GitHub Actions to publish
//      (repository_dispatch, workflow .github/workflows/staging-publish.yml).
//      Needs FP_PUBLISH_REPOSITORY and the secret FP_PUBLISH_GITHUB_TOKEN (a
//      fine-grained token for that repository with Contents: read & write,
//      the permission GitHub requires for repository_dispatch).
//   2. A scheduled check in the same workflow (when GitHub runs it) compares the live database's
//      contentFingerprint() (GET /api/publish/state) with the deployed build's
//      (/_publish/state.json) and publishes when they differ. That catches a
//      save whose request failed, a failed build and changes made outside the
//      admin.
//
// A build or its output checks failing deploys nothing, so the previous
// release keeps serving; the next scheduled check retries. Changes made
// while a build runs are caught by the next comparison. The workflow allows
// one build at a time plus one queued, so a burst of saves costs at most two
// builds.
import { FINGERPRINT_SQL } from "./publishFingerprint.mjs";
import { ON_CLOUDFLARE } from "../platform/target";

// No publication deadline is promised: a successful dispatch only means a build
// was requested (GitHub may queue it, and the build or its checks may fail).
// "Published" is shown only when the deployed site is seen to carry the saved
// version (GarlandWebsite.checkGarlandOnWebsite, OccasionWebsite.checkOccasionPages).
const NEXT_RUN = "The website changes when the next publishing run includes this save.";

export type PublishRequest = {
  ok: boolean;
  method: "github" | "scheduled";
  at: string;
  error?: string;
  /** Plain-language explanation for the admin. */
  message: string;
};

/** The live database's content fingerprint (see publishFingerprint.mjs). Always a fresh read. */
export async function contentFingerprint(): Promise<string> {
  // Loaded here, so code that only requests publication never loads the database client.
  const [{ sql }, { getDb }] = await Promise.all([import("drizzle-orm"), import("../db/postgres/client")]);
  const result = await getDb().execute(sql.raw(FINGERPRINT_SQL));
  const rows = (result as unknown as { rows: { fingerprint: string }[] }).rows;
  return rows[0].fingerprint;
}

/** How long one isolate reuses a successful fingerprint read for GET /api/publish/state. */
export const PUBLISH_STATE_TTL_MS = 30_000;
/** A request waiting on another request's read gives up after this long (the read keeps its own timeouts). */
const SHARED_READ_WAIT_MS = 15_000;
const FINGERPRINT_PATTERN = /^[0-9a-f]{32}$/;

/**
 * Caching and deduplication for the publishing check, per isolate (not a rate
 * limit): a successful read is reused for `ttlMs`, measured from when the read
 * started, and concurrent requests share one read in flight. The key is
 * nothing about the request, so query strings can't bypass it. A failed or
 * malformed read is never cached and clears any expired value, so callers see
 * the failure rather than an old fingerprint. Builds read the database
 * directly (scripts/cloudflare/build.mjs) and are unaffected.
 */
export function fingerprintCache(read: () => Promise<string>, { ttlMs = PUBLISH_STATE_TTL_MS, now = Date.now, waitMs = SHARED_READ_WAIT_MS } = {}) {
  let cached: { value: string; expires: number } | null = null;
  let inflight: Promise<string> | null = null;
  return async function get(): Promise<string> {
    if (cached && now() < cached.expires) return cached.value;
    cached = null;
    let mine = false;
    if (!inflight) {
      mine = true;
      const started = now();
      inflight = (async () => {
        try {
          const value = await read();
          if (typeof value !== "string" || !FINGERPRINT_PATTERN.test(value)) throw new Error("invalid fingerprint");
          cached = { value, expires: started + ttlMs };
          return value;
        } finally {
          inflight = null;
        }
      })();
    }
    if (mine) return inflight;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([inflight, new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error("shared read timed out")), waitMs)))]);
    } finally {
      clearTimeout(timer);
    }
  };
}

/** GET /api/publish/state's fingerprint: cached and deduplicated per isolate (fingerprintCache). */
export const publishedStateFingerprint = fingerprintCache(contentFingerprint);

/**
 * Asks for a new build after an admin change. Never throws and never reports
 * success it can't confirm: without the dispatch settings, or when GitHub
 * refuses, the scheduled check still publishes the change.
 */
export async function requestPublication(reason: string, { fetcher = fetch }: { fetcher?: typeof fetch } = {}): Promise<PublishRequest> {
  const at = new Date().toISOString();
  const repository = process.env.FP_PUBLISH_REPOSITORY ?? "";
  const token = process.env.FP_PUBLISH_GITHUB_TOKEN ?? "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !token) {
    return { ok: false, method: "scheduled", at, message: `Saved. Publishing on save isn't connected here, so no build was requested. ${NEXT_RUN}` };
  }
  try {
    const response = await fetcher(`https://api.github.com/repos/${repository}/dispatches`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "fresh-petals-admin",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({ event_type: process.env.FP_PUBLISH_EVENT || "publish-site", client_payload: { reason: reason.slice(0, 80), at } }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status !== 204) throw new Error(`GitHub answered ${response.status}`);
    return { ok: true, method: "github", at, message: "Publishing requested. The website changes once a build that includes this save is deployed." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, method: "scheduled", at, error: detail, message: `Saved, but the publishing request failed (${detail}). ${NEXT_RUN}` };
  }
}

type Change = { refresh?: { method?: string } | null } | null | undefined;

/**
 * After an admin write the storefront may show (create, save, status, delete):
 * ask for a build, unless the garland or occasion website change already did.
 * Off Cloudflare (Vercel, development) nothing is prebuilt from the database
 * on save, so nothing is requested.
 */
export async function publishAfterChange(reason: string, ...already: Change[]): Promise<PublishRequest | null> {
  if (!ON_CLOUDFLARE) return null;
  if (already.some((change) => change?.refresh?.method === "publish")) return null;
  return requestPublication(reason);
}
