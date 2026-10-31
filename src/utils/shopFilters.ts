import { OCCASION_FILTER_LABELS, BUDGET_LABELS, COLOUR_LABELS, COLOUR_ALIASES } from "../data/shoppingTaxonomy";
import type { FilterGroup, Intent, ShopItemData } from "../data/occasionJourneys";
export const FILTER_GROUPS = ["occasion", "budget", "colour"] as const;
export type FilterKey = typeof FILTER_GROUPS[number];
export type ShopFilterState = Record<FilterKey, string[]> & { intent: Intent | null };
const labels: Record<FilterKey, Record<string, string>> = { occasion: OCCASION_FILTER_LABELS, budget: BUDGET_LABELS, colour: COLOUR_LABELS };
/** A colour value as written in a link, normalized (?colour=Lavender → purple); other groups are kept as written. */
const normalize = (group: FilterKey, key: string) => {
  const value = key.trim();
  if (group !== "colour") return value;
  const lower = value.toLowerCase();
  return Object.hasOwn(COLOUR_ALIASES, lower) ? COLOUR_ALIASES[lower] : lower;
};
/** Known zero-result selections survive; unknown URL values do not become selections. */
export function parseShopFilters(params: URLSearchParams): ShopFilterState {
  const state: ShopFilterState = { occasion: [], budget: [], colour: [], intent: null };
  for (const group of FILTER_GROUPS) state[group] = [...new Set((params.get(group) ?? "").split(",").map((key) => normalize(group, key)).filter((key) => Object.hasOwn(labels[group], key)))];
  const intent = params.get("for");
  if (intent === "gift" || intent === "ceremony") state.intent = intent;
  return state;
}
/**
 * Quote-only products have no displayed price, so no budget band. On a list
 * where nothing carries one, an old ?budget=… link is ignored instead of
 * emptying the list.
 */
export function withoutUnpricedBudget(state: ShopFilterState, items: Pick<ShopItemData, "budget">[]): ShopFilterState {
  return state.budget.length && !items.some((item) => item.budget) ? { ...state, budget: [] } : state;
}
export function matchesShopFilters(item: ShopItemData, state: ShopFilterState, except?: FilterKey): boolean {
  if (state.intent && item.intent !== state.intent) return false;
  const values: Record<FilterKey, string[]> = { occasion: item.occasions, colour: item.colours, budget: item.budget ? [item.budget] : [] };
  return FILTER_GROUPS.every((group) => group === except || !state[group].length || state[group].some((value) => values[group].includes(value)));
}
/** The URL parameters a filter selection is written in (groups plus the gift/ceremony intent). */
const FILTER_PARAMS: readonly string[] = [...FILTER_GROUPS, "for"];
const hasFilterParam = (params: URLSearchParams) => FILTER_PARAMS.some((key) => params.has(key));

/**
 * A filtered view's address keeps the selection in the fragment
 * (/categories/bouquets#colour=red&occasion=birthday), never the query.
 * The fragment never reaches the server, so every selection is served from
 * the one CDN copy of the page and filtered in the browser (ShopFilters).
 * With ?colour=…, each combination was its own cache entry: measured on
 * 31 Oct 2026, 1,863 of 1,868 function renders in an hour were filter URLs,
 * 1,848 of them distinct, mostly from crawlers following the chip links.
 * `pathname` may carry a non-filter query (?utm_source=…), which is kept.
 */
export function shopFilterUrl(pathname: string, state: ShopFilterState): string {
  const params = new URLSearchParams();
  for (const group of FILTER_GROUPS) if (state[group].length) params.set(group, state[group].join(","));
  if (state.intent) params.set("for", state.intent);
  return pathname + (params.size ? `#${params}` : "");
}

/** Where a selection is read from: the fragment, or an older ?colour=… query link. */
export function shopFilterParams(location: { search: string; hash: string }): URLSearchParams {
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
  return hasFilterParam(fragment) ? fragment : new URLSearchParams(location.search);
}

/** True for an in-page anchor such as #roses (a fragment with no filter in it). */
export function isPlainAnchor(hash: string): boolean {
  return hash.length > 1 && !hasFilterParam(new URLSearchParams(hash.slice(1)));
}

/** A query string with the filter parameters removed ("" or "?utm_source=…"). */
export function withoutFilterQuery(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of FILTER_PARAMS) params.delete(key);
  return params.size ? `?${params}` : "";
}

/**
 * For an older filter link (?colour=red&utm_source=x), the same view at its
 * fragment address (?utm_source=x#colour=red); null when the query has no
 * filter. Other parameters, such as campaign tags, stay in the query.
 */
export function filterQueryRedirect(url: URL): string | null {
  if (!hasFilterParam(url.searchParams)) return null;
  return shopFilterUrl(url.pathname + withoutFilterQuery(url.search), parseShopFilters(url.searchParams));
}

/** The 301 for filterQueryRedirect: no rendering or database work for an older filter link. */
export function filterRedirectResponse(location: string): Response {
  return new Response(null, {
    status: 301,
    headers: { Location: location, "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=60" },
  });
}
export function toggleShopFilter(state: ShopFilterState, group: FilterKey, value: string): ShopFilterState {
  return { ...state, [group]: state[group].includes(value) ? state[group].filter((key) => key !== value) : [...state[group], value] };
}
/** Facet counts apply every other selected group, as the browser does. */
export function countShopFacets(groups: FilterGroup[], items: ShopItemData[], state: ShopFilterState): FilterGroup[] {
  return groups.map((group) => ({ ...group, options: group.options.map((option) => ({ ...option,
    count: items.filter((item) => matchesShopFilters(item, state, group.id) &&
      (group.id === "occasion" ? item.occasions : group.id === "colour" ? item.colours : item.budget ? [item.budget] : []).includes(option.key as never)).length,
  })) }));
}
