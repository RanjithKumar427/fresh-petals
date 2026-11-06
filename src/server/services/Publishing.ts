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
//   2. A scheduled check in the same workflow compares the live database's
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

/** Upper bound the admin is told: one scheduled check (15 min) plus a build and deploy (about 8 min). */
export const PUBLISH_MAX_DELAY_SECONDS = 25 * 60;
/** Typical delay when the save's own request starts the build. */
export const PUBLISH_TYPICAL_DELAY_SECONDS = 8 * 60;

export type PublishRequest = {
  ok: boolean;
  method: "github" | "scheduled";
  at: string;
  error?: string;
  /** Plain-language explanation for the admin. */
  message: string;
};

/** The live database's content fingerprint (see publishFingerprint.mjs). */
export async function contentFingerprint(): Promise<string> {
  // Loaded here, so code that only requests publication never loads the database client.
  const [{ sql }, { getDb }] = await Promise.all([import("drizzle-orm"), import("../db/postgres/client")]);
  const result = await getDb().execute(sql.raw(FINGERPRINT_SQL));
  const rows = (result as unknown as { rows: { fingerprint: string }[] }).rows;
  return rows[0].fingerprint;
}

/**
 * Asks for a new build after an admin change. Never throws and never reports
 * success it can't confirm: without the dispatch settings, or when GitHub
 * refuses, the scheduled check still publishes the change.
 */
export async function requestPublication(reason: string, { fetcher = fetch }: { fetcher?: typeof fetch } = {}): Promise<PublishRequest> {
  const at = new Date().toISOString();
  const repository = process.env.FP_PUBLISH_REPOSITORY ?? "";
  const token = process.env.FP_PUBLISH_GITHUB_TOKEN ?? "";
  const scheduled = `The change is saved. The scheduled publishing check puts it on the website within about ${Math.ceil(PUBLISH_MAX_DELAY_SECONDS / 60)} minutes.`;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !token) {
    return { ok: false, method: "scheduled", at, message: `Automatic publishing on save isn't connected here. ${scheduled}` };
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
    return { ok: true, method: "github", at, message: `Publishing started. The website shows the change in about ${Math.ceil(PUBLISH_TYPICAL_DELAY_SECONDS / 60)} minutes.` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, method: "scheduled", at, error: detail, message: `Publishing couldn't be started (${detail}). ${scheduled}` };
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
