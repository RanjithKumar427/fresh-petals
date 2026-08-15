// Discovery Experience — Phase 1 (Save) milestone. Mirrors src/utils/cart.ts's
// localStorage pattern exactly: same get/persist shape, same
// dispatch-a-custom-event-on-write convention already consumed by other
// components (see cart.ts's `fresh-petals-cart-updated`) — a second state
// architecture was deliberately not introduced for this.
//
// Save is NOT a second product database. Only the product's slug is ever
// stored here. Authoritative product data (name, image, price,
// availability) always comes from the same PostgreSQL → ProductRepository
// → ProductPricing → Storefront chain every other storefront surface
// uses — see ProductPricing.ts.
const SAVED_KEY = "fresh_petals_saved";
export const SAVED_UPDATED_EVENT = "fresh-petals-saved-updated";

export function getSavedIds(): string[] {
  if (typeof window === "undefined") return [];

  const stored = window.localStorage.getItem(SAVED_KEY);

  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) return [];

    // Defensive: only ever trust non-empty string entries, and collapse
    // any duplicate that a corrupted write may have produced — callers
    // should never see a saved id rendered twice.
    return Array.from(
      new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))
    );
  } catch {
    return [];
  }
}

function persist(ids: string[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(SAVED_UPDATED_EVENT));
}

export function isSaved(id: string): boolean {
  if (!id) return false;

  return getSavedIds().includes(id);
}

/**
 * Adds the id if absent, removes it if present. Returns the resulting
 * saved state for that id (true = now saved) so callers can update their
 * own UI without a second lookup. Always derives from the current stored
 * array, so rapid/repeated clicks can never produce a duplicate entry.
 */
export function toggleSaved(id: string): boolean {
  if (!id) return false;

  const current = getSavedIds();
  const alreadySaved = current.includes(id);

  const next = alreadySaved
    ? current.filter((savedId) => savedId !== id)
    : [...current, id];

  persist(next);

  return !alreadySaved;
}

/**
 * Drops any stored id that isn't in validIds (e.g. a saved product that
 * no longer exists in the catalogue). No-ops, and does not dispatch the
 * update event, if nothing actually changes.
 */
export function pruneSaved(validIds: Iterable<string>) {
  const valid = new Set(validIds);
  const current = getSavedIds();
  const cleaned = current.filter((id) => valid.has(id));

  if (cleaned.length !== current.length) {
    persist(cleaned);
  }
}

export function getSavedCount(): number {
  return getSavedIds().length;
}
