import EditableList from "../../shared/EditableList";
import type { ProductDraft } from "../types";

interface Props {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
}

export default function IncludedSection({ draft, onChange }: Props) {
  return (
    <section id="section-whats-included" className="fp-card scroll-mt-6 p-6">
      <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">What's Included</h2>
      <p className="mt-1 text-[12px] text-[#9B948F]">e.g. Fresh Flowers, Premium Wrapping, Greeting Card</p>

      <div className="mt-4">
        <EditableList
          items={draft.whatsIncluded}
          onChange={(items) => onChange({ whatsIncluded: items })}
          placeholder="e.g. Premium Wrapping"
          addLabel="Add"
        />
      </div>
    </section>
  );
}
