import FormField, { inputClassName } from "../../shared/FormField";
import Chip from "../../shared/Chip";
import type { CategoryOption, ProductDraft, TagOption } from "../types";

interface Props {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
  categories: CategoryOption[];
  occasions: TagOption[];
  moods: TagOption[];
  uncategorizedCategoryId: number;
}

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
}: Props) {
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
          <label className="fp-label block text-[10px] text-[#66565D]">Occasions</label>
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
