import FormField, { inputClassName } from "../../shared/FormField";
import type { ProductDraft } from "../types";

interface Props {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
}

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

function CharCount({ value, max }: { value: string; max: number }) {
  const length = value.length;
  const over = length > max;
  return <span className={`text-[11px] ${over ? "text-[#B3352D]" : "text-[#9B948F]"}`}>{length}/{max}</span>;
}

export default function SEOSection({ draft, onChange }: Props) {
  const title = draft.seoTitle || draft.name;
  const description = draft.seoDescription || draft.shortDescription || "";

  return (
    <section id="section-seo" className="fp-card scroll-mt-6 p-6">
      <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">SEO</h2>

      <div className="mt-5 space-y-5">
        <FormField
          label="URL Slug"
          hint="Set in Basic Information."
        >
          <p className="mt-1 rounded-lg border border-dashed border-[#D8D1D4] bg-[#FBF7F5] px-3 py-2.5 text-[13px] text-[#66565D]">
            /products/{draft.slug || "…"}
          </p>
        </FormField>

        <div>
          <div className="flex items-baseline justify-between">
            <label className="fp-label block text-[10px] text-[#66565D]" htmlFor="seoTitle">
              Meta Title
            </label>
            <CharCount value={title} max={TITLE_MAX} />
          </div>
          <input
            id="seoTitle"
            type="text"
            value={draft.seoTitle ?? ""}
            placeholder={draft.name}
            onChange={(event) => onChange({ seoTitle: event.target.value || null })}
            className={inputClassName}
          />
          {title.length > TITLE_MAX && (
            <p className="mt-1 text-[12px] text-[#B3352D]">
              This is a little long — search engines usually cut titles off around {TITLE_MAX} characters.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label className="fp-label block text-[10px] text-[#66565D]" htmlFor="seoDescription">
              Meta Description
            </label>
            <CharCount value={description} max={DESCRIPTION_MAX} />
          </div>
          <textarea
            id="seoDescription"
            rows={3}
            value={draft.seoDescription ?? ""}
            placeholder={draft.shortDescription ?? ""}
            onChange={(event) => onChange({ seoDescription: event.target.value || null })}
            className={inputClassName}
          />
          {description.length > 0 && description.length < 50 && (
            <p className="mt-1 text-[12px] text-[#7C243E]">
              <span aria-hidden>✨ </span>A bit short — a fuller sentence gives search engines more to show.
            </p>
          )}
          {description.length > DESCRIPTION_MAX && (
            <p className="mt-1 text-[12px] text-[#B3352D]">
              This will likely get cut off around {DESCRIPTION_MAX} characters.
            </p>
          )}
        </div>

        <div>
          <p className="fp-label text-[10px] text-[#66565D]">Google Preview</p>
          <div className="mt-2 rounded-lg border border-[#EEE5E8] bg-white p-4">
            <p className="truncate text-[13px] text-[#1a0dab]">{title || "Untitled Product"}</p>
            <p className="text-[12px] text-[#075838]">freshpetals.com › products › {draft.slug || "…"}</p>
            <p className="mt-1 line-clamp-2 text-[13px] text-[#4d5156]">
              {description || "Add a meta description so this shows something useful in search results."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
