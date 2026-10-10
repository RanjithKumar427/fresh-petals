// How garland changes reach the live website without a deployment.
//
// Garland pages and sections are rendered on request (not at build time) and
// cached by the CDN for a short time. Every garland response carries the
// cache tag GARLAND_CACHE_TAG. When an admin saves, publishes or unpublishes a
// garland that is (or was) public, refreshGarlandPages() purges that tag, so
// the next visitor gets a freshly rendered page — normally within seconds.
// If a purge fails, the cache lifetime below is the backstop: nothing can be
// served stale for longer than GARLAND_MAX_STALE_SECONDS.
//
// Purge methods, tried in order:
//   1. On Vercel: the platform purge API (@vercel/functions), which needs no
//      token or configuration inside a Vercel Function.
//   2. SITE_CACHE_PURGE_URL (optional): POST {"tags":[...]} to another CDN's
//      purge hook. Also used by the local test harness.
//   3. Neither (local development): there is no shared cache to purge.
import { dangerouslyDeleteByTag } from "@vercel/functions";

export const GARLAND_CACHE_TAG = "garlands";
const S_MAXAGE = 120;
const STALE_WHILE_REVALIDATE = 60;
/** Upper bound on how long a visitor can see an outdated garland page if a purge fails. */
export const GARLAND_MAX_STALE_SECONDS = S_MAXAGE + STALE_WHILE_REVALIDATE;

/** Response headers for every on-demand garland page, section and the sitemap. */
export function garlandCacheHeaders(): Record<string, string> {
  return {
    // Browsers always revalidate; the CDN keeps a copy for S_MAXAGE seconds
    // (Vercel strips s-maxage / stale-while-revalidate before the browser sees them).
    "Cache-Control": `public, max-age=0, s-maxage=${S_MAXAGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
    "Vercel-Cache-Tag": GARLAND_CACHE_TAG,
  };
}

// ---------------------------------------------------------------------------
// Occasion pages (bouquet occasion assignments) use the same mechanism: each
// occasion page is tagged with its own `occasion:<slug>` tag; pages that list
// several occasions (the homepage, /occasions, the bouquet list, the occasion
// sitemap) carry OCCASION_INDEX_TAG. Saving a product whose occasions changed
// purges the tags of every occasion added or removed, plus the index.
//
// They use the same freshness limit as garlands: a purge takes effect at
// once, and if one fails nothing is served stale for longer than
// OCCASION_MAX_STALE_SECONDS. The cost (not hidden by a longer stale
// window): a cache miss renders the page in the function region against the
// database — about 1.1–1.4 s to first byte, measured on uncached garland
// pages on 6 Oct 2026 — where prebuilt pages answered in about 0.2 s.
// ---------------------------------------------------------------------------
export const OCCASION_INDEX_TAG = "occasion-index";
export const occasionTag = (slug: string) => `occasion:${slug}`;
/** Upper bound on how long a visitor can see an outdated occasion listing if a purge fails. */
export const OCCASION_MAX_STALE_SECONDS = S_MAXAGE + STALE_WHILE_REVALIDATE;

/** Cache headers for on-demand occasion responses; `tags` from occasionTag()/OCCASION_INDEX_TAG. */
export function occasionCacheHeaders(tags: string[]): Record<string, string> {
  return {
    "Cache-Control": `public, max-age=0, s-maxage=${S_MAXAGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
    "Vercel-Cache-Tag": tags.join(","),
  };
}

/** The live occasion pages a change to these occasion slugs can affect (housewarming also lists pooja). */
export function occasionTagsFor(changed: string[]): string[] {
  const pages = new Set(changed);
  if (pages.has("pooja")) pages.add("housewarming");
  return [OCCASION_INDEX_TAG, ...[...pages].sort().map(occasionTag)];
}

export type RefreshResult = {
  ok: boolean;
  method: "vercel" | "purge-url" | "none";
  at: string;
  error?: string;
  /** Plain-language explanation for the admin. */
  message: string;
};

function vercelPurgeAvailable(): boolean {
  const context = (globalThis as Record<symbol, { get?: () => { purge?: unknown } } | undefined>)[Symbol.for("@vercel/request-context")];
  return Boolean(context?.get?.()?.purge);
}

/** Purges every cached garland page/section so the next visitor sees the saved version. */
export function refreshGarlandPages(): Promise<RefreshResult> {
  return refreshWebsite([GARLAND_CACHE_TAG]);
}

/** Purges the cached responses carrying any of these tags. Never reports success it can't confirm. */
export async function refreshWebsite(tags: string[]): Promise<RefreshResult> {
  const at = new Date().toISOString();
  try {
    if (vercelPurgeAvailable()) {
      // Vercel accepts at most 16 tags per purge call.
      for (let i = 0; i < tags.length; i += 16) await dangerouslyDeleteByTag(tags.slice(i, i + 16));
      return { ok: true, method: "vercel", at, message: "Website cache cleared — the next visitor gets the saved version." };
    }
    const purgeUrl = process.env.SITE_CACHE_PURGE_URL;
    if (purgeUrl) {
      const response = await fetch(purgeUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`purge request returned ${response.status}`);
      return { ok: true, method: "purge-url", at, message: "Website cache cleared — the next visitor gets the saved version." };
    }
    if (process.env.VERCEL) {
      // On Vercel but the purge API isn't reachable from this request: never report success.
      throw new Error("the Vercel cache-purge API isn't available to this request");
    }
    return { ok: true, method: "none", at, message: "No shared website cache here (local development) — pages already show the saved version." };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      method: vercelPurgeAvailable() ? "vercel" : process.env.SITE_CACHE_PURGE_URL ? "purge-url" : "none",
      at,
      error: reason,
      message: `The website refresh failed (${reason}). The change is saved and appears on its own within ${Math.ceil(GARLAND_MAX_STALE_SECONDS / 60)} minutes, or retry now.`,
    };
  }
}

type GarlandLike = {
  slug: string;
  status: string;
  updatedAt: string;
  images: unknown[];
  garland: { photoPermission: string; sampleVerified: boolean } | null;
};

/** What an admin save did to the website, returned alongside the saved product. */
export type WebsiteChange = {
  /** Public on the website after this save. */
  listed: boolean;
  /** Was public before this save. */
  wasListed: boolean;
  /** Why it isn't public (null when it is). */
  reason: string | null;
  /** Its storefront address. */
  path: string;
  /** The version (updatedAt) the website should now show. */
  version: string;
  /** Null when the save couldn't change the website (not public before or after). */
  refresh: RefreshResult | null;
  maxDelaySeconds: number;
};

/**
 * After a garland is saved or its status changes: refresh the website if the
 * change can be seen there (it was or is public). Bouquets return null —
 * their storefront pages are still rebuilt by a deployment.
 */
export async function garlandWebsiteChange(before: GarlandLike | null, after: GarlandLike): Promise<WebsiteChange | null> {
  if (!after.garland) return null;
  const wasListed = !!before && isPublicGarlandRecord(before);
  const listed = isPublicGarlandRecord(after);
  return {
    listed,
    wasListed,
    reason: listed ? null : hiddenReason(after),
    path: `/products/${after.slug}`,
    version: after.updatedAt,
    refresh: listed || wasListed ? await refreshGarlandPages() : null,
    maxDelaySeconds: GARLAND_MAX_STALE_SECONDS,
  };
}

export type WebsiteCheck = {
  state: "live" | "hidden" | "pending" | "error";
  expected: "listed" | "hidden";
  path: string;
  checkedAt: string;
  /** HTTP status and garland version the storefront returned. */
  seen: { status: number; version: string | null } | null;
  message: string;
};

/**
 * Asks the storefront — through the same CDN visitors use — whether it shows
 * this garland's saved version (or, once unpublished, no longer shows it).
 * `preview` is true where drafts are shown (local development).
 */
export async function checkGarlandOnWebsite(product: GarlandLike, origin: string, preview: boolean): Promise<WebsiteCheck> {
  const path = `/products/${product.slug}`;
  const checkedAt = new Date().toISOString();
  const shouldShow = preview ? product.status !== "archived" : isPublicGarlandRecord(product);
  const expected = shouldShow ? "listed" : "hidden";
  const minutes = Math.ceil(GARLAND_MAX_STALE_SECONDS / 60);
  if (!/^[a-z0-9-]+$/.test(product.slug)) {
    return { state: "error", expected, path, checkedAt, seen: null, message: "This address can't be checked." };
  }
  try {
    const response = await fetch(new URL(path, origin), {
      redirect: "manual",
      headers: { accept: "text/html", "user-agent": "FreshPetals-admin-website-check" },
      signal: AbortSignal.timeout(8000),
    });
    const html = response.status === 200 ? await response.text() : "";
    const version = html.match(/data-garland-version="([^"]*)"/)?.[1] ?? null;
    const seen = { status: response.status, version };
    if (response.status === 401 || response.status === 403) {
      // e.g. Vercel deployment protection on a Preview deployment.
      return { state: "error", expected, path, checkedAt, seen, message: `The website refused the check (HTTP ${response.status}) — it can't confirm what visitors see from here.` };
    }
    if (shouldShow) {
      if (response.status === 200 && version === product.updatedAt) {
        return { state: "live", expected, path, checkedAt, seen, message: "Visible on the website with the saved details." };
      }
      return {
        state: "pending",
        expected,
        path,
        checkedAt,
        seen,
        message:
          response.status === 200
            ? `The website is still showing the previous version. It updates within ${minutes} minutes, or use “Refresh website”.`
            : `The website doesn't show this garland yet (HTTP ${response.status}). It appears within ${minutes} minutes, or use “Refresh website”.`,
      };
    }
    if (response.status === 404) {
      return { state: "hidden", expected, path, checkedAt, seen, message: "Not on the website — its page and enquiry link are closed." };
    }
    return {
      state: "pending",
      expected,
      path,
      checkedAt,
      seen,
      message: `A cached copy of the page is still visible (enquiries are already closed). It disappears within ${minutes} minutes, or use “Refresh website”.`,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { state: "error", expected, path, checkedAt, seen: null, message: `Couldn't reach the website to check (${reason}).` };
  }
}

/** A garland is on the public website: published, photo permission granted, sample verified, and a stored photo. */
export function isPublicGarlandRecord(product: {
  status: string;
  images: unknown[];
  garland: { photoPermission: string; sampleVerified: boolean } | null;
}): boolean {
  return (
    !!product.garland &&
    product.status === "published" &&
    product.garland.photoPermission === "granted" &&
    product.garland.sampleVerified === true &&
    product.images.length > 0
  );
}

/** Why a garland is not on the website (for admin feedback). */
export function hiddenReason(product: {
  status: string;
  images: unknown[];
  garland: { photoPermission: string; sampleVerified: boolean } | null;
}): string {
  if (product.status === "archived") return "archived";
  if (product.status !== "published") return "draft — publish to show it";
  if (product.garland?.photoPermission !== "granted") return "photo permission not granted";
  if (!product.garland?.sampleVerified) return "sample not verified";
  if (product.images.length === 0) return "no photo";
  return "not public";
}
