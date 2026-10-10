import { OCCASION_FILTER_LABELS, BUDGET_LABELS, COLOUR_LABELS } from "../data/shoppingTaxonomy";
import type { FilterGroup, Intent, ShopItemData } from "../data/occasionJourneys";
export const FILTER_GROUPS = ["occasion", "budget", "colour"] as const;
export type FilterKey = typeof FILTER_GROUPS[number];
export type ShopFilterState = Record<FilterKey, string[]> & { intent: Intent | null };
const labels: Record<FilterKey, Record<string, string>> = { occasion: OCCASION_FILTER_LABELS, budget: BUDGET_LABELS, colour: COLOUR_LABELS };
/** Known zero-result selections survive; unknown URL values do not become selections. */
export function parseShopFilters(params: URLSearchParams): ShopFilterState {
  const state: ShopFilterState = { occasion: [], budget: [], colour: [], intent: null };
  for (const group of FILTER_GROUPS) state[group] = [...new Set((params.get(group) ?? "").split(",").map((key) => key.trim()).filter((key) => Object.hasOwn(labels[group], key)))];
  const intent = params.get("for");
  if (intent === "gift" || intent === "ceremony") state.intent = intent;
  return state;
}
export function matchesShopFilters(item: ShopItemData, state: ShopFilterState, except?: FilterKey): boolean {
  if (state.intent && item.intent !== state.intent) return false;
  const values: Record<FilterKey, string[]> = { occasion: item.occasions, colour: item.colours, budget: item.budget ? [item.budget] : [] };
  return FILTER_GROUPS.every((group) => group === except || !state[group].length || state[group].some((value) => values[group].includes(value)));
}
export function shopFilterUrl(pathname: string, state: ShopFilterState): string {
  const params = new URLSearchParams();
  for (const group of FILTER_GROUPS) if (state[group].length) params.set(group, state[group].join(","));
  if (state.intent) params.set("for", state.intent);
  return pathname + (params.size ? `?${params}` : "");
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
