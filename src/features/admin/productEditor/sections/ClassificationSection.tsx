import FormField, { inputClassName } from "../../shared/FormField";
import Chip from "../../shared/Chip";
import type { CategoryOption, ProductDraft, TagOption } from "../types";
import OccasionWebsiteStatus, { type OccasionChange } from "../OccasionWebsiteStatus";

interface Props {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
  categories: CategoryOption[];
  occasions: TagOption[];
  moods: TagOption[];
  uncategorizedCategoryId: number;
  /** Which occasion pages list this product: the launch range (also the homepage and bouquet list), other catalogue products (the older occasion pages), or none. */
  liveOccasions?: "launch" | "catalogue" | null;
  /** What the last save did to the live occasion pages. */
  occasionChange?: OccasionChange | null;
}

// Garlands imported from the catalogue were given these occasions by default
// (scripts/seed-garlands.mjs); a design still carrying exactly this set is
// flagged for the owner to confirm.
const IMPORT_DEFAULT_OCCASIONS = ["engagement", "wedding"];

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

export default function ClassificationSection({
  draft,
  onChange,
  categories,
  occasions,
  moods,
  uncategorizedCategoryId,
  liveOccasions = null,
  occasionChange = null,
}: Props) {
  const chosen = occasions.filter((occasion) => draft.occasionIds.includes(occasion.id)).map((occasion) => occasion.name.toLowerCase()).sort();
  const isImportDefault = !!draft.garland && chosen.join(",") === IMPORT_DEFAULT_OCCASIONS.join(",");
  return (
    <section id="section-classification" className="fp-card scroll-mt-6 p-6">
      <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">Classification</h2>

      <div className="mt-5 space-y-5">
        <FormField
          label="Category"
          htmlFor="categoryId"
          tip={draft.categoryId === uncategorizedCategoryId ? "Select where this product belongs." : undefined}
        >
          <select
            id="categoryId"
            value={draft.categoryId}
            disabled={!!draft.garland}
            title={draft.garland ? "Garland designs stay in the Garlands category." : undefined}
            onChange={(event) => onChange({ categoryId: Number(event.target.value) })}
            className={inputClassName}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>

        <div>
          <label className="fp-label block text-[10px] text-[#66565D]">Suitable occasions</label>
          <p className="mt-1 text-[12px] leading-5 text-[#77706F]" data-occasion-help>
            {draft.garland
              ? "Shown as ceremony flowers on the matching occasion pages (Wedding, Engagement) while the design is public. Changes reach the website without a deployment."
              : liveOccasions === "launch"
                ? "The occasion pages, the bouquet list's occasion filter and the homepage occasion cards follow these choices — no deployment needed. Removing an occasion takes the bouquet off that page."
                : liveOccasions === "catalogue"
                  ? "The occasion pages that list this product (such as Thank you or Love & proposal) follow these choices — no deployment needed. It isn't in the launch range, so it doesn't appear on the homepage or the bouquet list."
                  : "Saved with the product. No occasion page lists this product."}
          </p>
          {occasionChange && !draft.garland && <OccasionWebsiteStatus productId={draft.id} change={occasionChange} />}
          {isImportDefault && (
            <p className="mt-2 rounded-lg bg-[#FFF7E8] px-3 py-2 text-[12px] text-[#7A5210]" data-occasion-review>
              These are the import defaults (Wedding and Engagement), not a confirmed choice. Please check which occasions this design suits.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {occasions.map((occasion) => (
              <Chip
                key={occasion.id}
                label={occasion.name}
                selected={draft.occasionIds.includes(occasion.id)}
                onClick={() => onChange({ occasionIds: toggleId(draft.occasionIds, occasion.id) })}
              />
            ))}
          </div>
        </div>

        <p className="text-[12px] text-[#77706F]" data-intent-info>
          Shown to customers as: <strong className="text-[#171717]">{draft.garland ? "For the ceremony" : "Send a gift"}</strong>
          {" "}(set by the product type).
        </p>

        <div>
          <label className="fp-label block text-[10px] text-[#66565D]">Moods</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {moods.map((mood) => (
              <Chip
                key={mood.id}
                label={mood.name}
                selected={draft.moodIds.includes(mood.id)}
                onClick={() => onChange({ moodIds: toggleId(draft.moodIds, mood.id) })}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="fp-label block text-[10px] text-[#66565D]">Merchandising</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip label="★ Featured" selected={draft.featured} onClick={() => onChange({ featured: !draft.featured })} />
            <Chip
              label="🔥 Bestseller"
              selected={draft.bestseller}
              onClick={() => onChange({ bestseller: !draft.bestseller })}
            />
            <Chip
              label="✨ New Arrival"
              selected={draft.newArrival}
              onClick={() => onChange({ newArrival: !draft.newArrival })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
