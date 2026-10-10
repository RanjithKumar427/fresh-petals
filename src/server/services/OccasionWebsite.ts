// How a change to a bouquet's "Suitable occasions" reaches the live website.
//
// Every occasion page, the /occasions index, the homepage, the bouquet list
// and the occasion sitemap are read from the admin's assignments on request
// and CDN-cached (src/server/services/GarlandWebsite.ts occasion tags). After
// a save that adds or removes occasions, the pages of every occasion added or
// removed (old and new memberships) — and the index tag those listings carry —
// are purged. The editor then checks the affected live pages until each one
// lists (or no longer lists) the bouquet, so "updated" means the website
// really shows it, not merely that a purge was sent.
import { OCCASION_MAX_STALE_SECONDS, occasionTagsFor, refreshWebsite, type RefreshResult } from "./GarlandWebsite";
import { occasionSlugsForIds } from "./OccasionMembership";
import { LIVE_OCCASION_ROUTES, catalogueSlugs, launchSlugs, occasionProductEligible } from "../../data/occasionJourneys";
import { LAUNCH_OCCASION_ROUTES } from "../../data/launchCatalogue";

type ProductLike = { slug: string; occasionIds: number[]; garland?: unknown };

export type OccasionChange = {
  /** Occasion slugs added or removed by this save. */
  changed: string[];
  /** The occasion pages those changes affect for this product (housewarming also covers pooja for launch bouquets). */
  routes: string[];
  /** Whether occasion pages can list this product (catalogue products; launch bouquets also on the homepage and bouquet list). */
  listed: boolean;
  /** Null when nothing on the website depends on the change. */
  refresh: RefreshResult | null;
  maxDelaySeconds: number;
};

/**
 * Occasion pages a change to these occasion slugs affects for one product.
 * Launch bouquets appear on every occasion page they are assigned to (and
 * pooja ones on Housewarming); other catalogue products only on the older
 * pages — the launch occasion pages list the launch range alone.
 */
export function affectedRoutes(changed: string[], launch = true): string[] {
  const routes = new Set<string>();
  for (const slug of changed) {
    if (LIVE_OCCASION_ROUTES.has(slug) && (launch || !LAUNCH_OCCASION_ROUTES.has(slug))) routes.add(slug);
    if (launch && slug === "pooja") routes.add("housewarming");
  }
  return [...routes].sort();
}

export async function occasionWebsiteChange(before: ProductLike | null, after: ProductLike): Promise<OccasionChange | null> {
  if (after.garland) return null; // garland occasion sections refresh with the garland pages
  const old = new Set(before?.occasionIds ?? []);
  const now = new Set(after.occasionIds);
  const diff = [...new Set([...old, ...now])].filter((id) => old.has(id) !== now.has(id));
  if (diff.length === 0) return null;
  const changed = await occasionSlugsForIds(diff);
  const listed = catalogueSlugs().includes(after.slug);
  return {
    changed,
    routes: listed ? affectedRoutes(changed, launchSlugs().includes(after.slug)) : [],
    listed,
    refresh: listed ? await refreshWebsite(occasionTagsFor(changed)) : null,
    maxDelaySeconds: OCCASION_MAX_STALE_SECONDS,
  };
}

/** Retry: purge the given occasions' pages (or every occasion page) and the index. */
export function refreshOccasionPages(changed: string[] | null): Promise<RefreshResult> {
  return refreshWebsite(occasionTagsFor(changed && changed.length ? changed : [...LIVE_OCCASION_ROUTES, "pooja"]));
}

export type OccasionPageCheck = {
  route: string;
  expected: "listed" | "absent";
  seen: "listed" | "absent" | "error";
  ok: boolean;
  status: number | null;
};

/**
 * Fetches each live occasion page through the same address (and CDN) visitors
 * use and reports whether it lists the bouquet as its assignments say it
 * should.
 */
export async function checkOccasionPages(product: { slug: string }, assigned: string[], routes: string[], origin: string): Promise<OccasionPageCheck[]> {
  return Promise.all(
    routes.map(async (route): Promise<OccasionPageCheck> => {
      const expected = occasionProductEligible(product.slug, route, assigned) ? "listed" : "absent";
      try {
        const response = await fetch(new URL(`/occasions/${route}`, origin), {
          redirect: "manual",
          headers: { accept: "text/html", "user-agent": "FreshPetals-admin-website-check" },
          signal: AbortSignal.timeout(8000),
        });
        if (response.status !== 200) return { route, expected, seen: "error", ok: false, status: response.status };
        const html = await response.text();
        const seen = html.includes(`data-occasion-product-slug="${product.slug}"`) ? "listed" : "absent";
        return { route, expected, seen, ok: seen === expected, status: 200 };
      } catch {
        return { route, expected, seen: "error", ok: false, status: null };
      }
    })
  );
}
