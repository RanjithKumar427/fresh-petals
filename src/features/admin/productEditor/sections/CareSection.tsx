import EditableList from "../../shared/EditableList";
import type { ProductDraft } from "../types";

interface Props {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
}

export default function CareSection({ draft, onChange }: Props) {
  return (
    <section id="section-care" className="fp-card scroll-mt-6 p-6">
      <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">Care Instructions</h2>
      <p className="mt-1 text-[12px] text-[#9B948F]">e.g. Trim stems, Change water, Keep away from sunlight</p>

      <div className="mt-4">
        <EditableList
          items={draft.careInstructions}
          onChange={(items) => onChange({ careInstructions: items })}
          placeholder="e.g. Change water daily"
          addLabel="Add"
        />
      </div>
    </section>
  );
}
