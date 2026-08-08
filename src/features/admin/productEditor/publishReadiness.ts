import type { ProductDraft } from "./types";

/**
 * Client-side mirror of ProductService.getPublishBlockers — used for
 * instant checklist feedback in PublishingSection. The server's copy is
 * still what actually gates the transition (see setStatus); this one only
 * needs to be close enough to guide the florist, not airtight.
 */
export function getPublishBlockers(draft: ProductDraft, uncategorizedCategoryId: number): string[] {
  const blockers: string[] = [];

  if (!draft.name.trim() || draft.name === "Untitled Product") {
    blockers.push("Give this product a name.");
  }
  if (draft.images.length === 0) {
    blockers.push("Add at least one image.");
  }
  if (draft.categoryId === uncategorizedCategoryId) {
    blockers.push("Select where this product belongs.");
  }
  if ((draft.priceType === "fixed" || draft.priceType === "from") && !draft.sellingPrice) {
    blockers.push("Enter a selling price.");
  }

  return blockers;
}
