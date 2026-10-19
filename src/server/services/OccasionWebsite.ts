// How a change to a bouquet's "Suitable occasions" reaches the live website.
//
// Every occasion page, the /occasions index, the homepage, the bouquet list
// and the occasion sitemap are read from the admin's assignments on request
// and CDN-cached (src/server/services/GarlandWebsite.ts occasion tags). After
// a save that adds or removes occasions, the pages of every occasion added or
// removed (old and new memberships) — and the index tag those listings carry —
// are purged. The editor then checks the affected live pages until each one
// lists (or no longer lists) the product, so "updated" means the website
// really shows it, not merely that a purge was sent.
//
// Which pages can list a product follows the deployed public catalogue
// (src/server/services/PublicCatalogue.ts): any public bouquet on the gift
// occasions (birthday, anniversary, wedding, engagement, housewarming,
// mom-to-be, sympathy), any public product on the older occasion pages. A
// product the deployment doesn't publish is on no page until the next
// deployment, whatever its assignments; the prebuilt header's occasion menu
// also changes only with a deployment.
import { OCCASION_MAX_STALE_SECONDS, occasionTagsFor, refreshWebsite, type RefreshResult } from "./GarlandWebsite";
import { occasionSlugsForIds } from "./OccasionMembership";
import { BOUQUET_ONLY_ROUTES, LIVE_OCCASION_ROUTES, occasionProductEligible } from "../../data/occasionJourneys";
import { isBouquet } from "../../data/catalogueRange";
import type { Product } from "../../data/productCatalog";
import { loadPublicCatalogue } from "./PublicCatalogue";

type ProductLike = { slug: string; occasionIds: number[]; garland?: unknown };

export type OccasionChange = {
  /** Occasion slugs added or removed by this save. */
  changed: string[];
  /** The occasion pages those changes affect for this product. */
  routes: string[];
  /** Whether occasion pages can list this product (it is in this deployment's public catalogue). */
  listed: boolean;
  /** Null when nothing on the website depends on the change. */
  refresh: RefreshResult | null;
  maxDelaySeconds: number;
};

/**
 * Occasion pages a change to these occasion slugs affects for one product.
 * A public bouquet appears on every occasion page it is assigned to; any
 * other public product only on the older pages (the gift occasions list
 * bouquets only). No related occasion is implied (pooja does not add
 * housewarming).
 */
export function affectedRoutes(changed: string[], bouquet = true): string[] {
  return [...new Set(changed.filter((slug) => LIVE_OCCASION_ROUTES.has(slug) && (bouquet || !BOUQUET_ONLY_ROUTES.has(slug))))].sort();
}

export async function occasionWebsiteChange(before: ProductLike | null, after: ProductLike, catalogue?: Product[]): Promise<OccasionChange | null> {
  if (after.garland) return null; // garland occasion sections refresh with the garland pages
  const old = new Set(before?.occasionIds ?? []);
  const now = new Set(after.occasionIds);
  const diff = [...new Set([...old, ...now])].filter((id) => old.has(id) !== now.has(id));
  if (diff.length === 0) return null;
  const changed = await occasionSlugsForIds(diff);
  const product = (catalogue ?? (await loadPublicCatalogue())).find((item) => item.slug === after.slug);
  const listed = !!product;
  return {
    changed,
    routes: product ? affectedRoutes(changed, isBouquet(product)) : [],
    listed,
    refresh: listed ? await refreshWebsite(occasionTagsFor(changed)) : null,
    maxDelaySeconds: OCCASION_MAX_STALE_SECONDS,
  };
}

/** Retry: purge the given occasions' pages (or every occasion page) and the index. */
export function refreshOccasionPages(changed: string[] | null): Promise<RefreshResult> {
  return refreshWebsite(occasionTagsFor(changed && changed.length ? changed : [...LIVE_OCCASION_ROUTES]));
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
 * use and reports whether it lists the product as its assignments and the
 * deployed public catalogue say it should.
 */
export async function checkOccasionPages(product: { slug: string }, assigned: string[], routes: string[], origin: string, catalogue?: Product[]): Promise<OccasionPageCheck[]> {
  const publicCatalogue = catalogue ?? (await loadPublicCatalogue());
  return Promise.all(
    routes.map(async (route): Promise<OccasionPageCheck> => {
      const expected = occasionProductEligible(product.slug, route, assigned, publicCatalogue) ? "listed" : "absent";
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
