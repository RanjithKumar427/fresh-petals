import { useEffect, useRef, useState } from "react";
import FormField, { inputClassName } from "../../shared/FormField";
import { slugify } from "../../shared/slugify";
import type { ProductDraft } from "../types";

interface Props {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
}

type SlugCheck = { state: "idle" | "checking" | "available" | "taken"; suggestions: string[] };

export default function BasicInfoSection({ draft, onChange }: Props) {
  // Auto-derive the slug from the name only until the admin edits it
  // directly, and only for a genuinely fresh draft — an existing product's
  // established URL should never silently change just because its name
  // was tweaked.
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    () => !(draft.name === "Untitled Product" && draft.slug.startsWith("untitled-product"))
  );
  const [slugCheck, setSlugCheck] = useState<SlugCheck>({ state: "idle", suggestions: [] });
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    setSlugCheck({ state: "checking", suggestions: [] });

    checkTimer.current = setTimeout(async () => {
      if (!draft.slug) return;
      try {
        const response = await fetch(
          `/api/admin/products/check-slug?slug=${encodeURIComponent(draft.slug)}&excludeId=${draft.id}`
        );
        const result = await response.json();
        setSlugCheck(
          result.data.available
            ? { state: "available", suggestions: [] }
            : { state: "taken", suggestions: result.data.suggestions }
        );
      } catch {
        setSlugCheck({ state: "idle", suggestions: [] });
      }
    }, 500);

    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [draft.slug, draft.id]);

  const handleNameChange = (name: string) => {
    if (slugManuallyEdited) {
      onChange({ name });
    } else {
      onChange({ name, slug: slugify(name) });
    }
  };

  return (
    <section id="section-basic-information" className="fp-card scroll-mt-6 p-6">
      <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">Basic Information</h2>

      <div className="mt-5 space-y-5">
        <FormField label="Product Name" htmlFor="name">
          <input
            id="name"
            type="text"
            value={draft.name === "Untitled Product" ? "" : draft.name}
            placeholder="e.g. Blue Mountain Grace"
            onChange={(event) => handleNameChange(event.target.value || "Untitled Product")}
            className={inputClassName}
          />
        </FormField>

        <FormField
          label="URL Slug"
          htmlFor="slug"
          hint={
            slugCheck.state === "checking"
              ? "Checking availability…"
              : slugCheck.state === "available"
                ? "This URL is available."
                : undefined
          }
          error={slugCheck.state === "taken" ? "This URL is already used by another product." : undefined}
        >
          <input
            id="slug"
            type="text"
            value={draft.slug}
            onChange={(event) => {
              setSlugManuallyEdited(true);
              onChange({ slug: slugify(event.target.value) });
            }}
            className={inputClassName}
          />
          <p className="mt-1 text-[12px] text-[#9B948F]">/products/{draft.slug || "…"}</p>
          {slugCheck.state === "taken" && slugCheck.suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {slugCheck.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setSlugManuallyEdited(true);
                    onChange({ slug: suggestion });
                  }}
                  className="rounded-full border border-[#D8D1D4] px-3 py-1 text-[11px] text-[#171717] transition hover:border-[#7C243E] hover:text-[#7C243E]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </FormField>

        <FormField
          label="Short Description"
          htmlFor="shortDescription"
          tip={
            !draft.shortDescription
              ? "Write a one-line summary — it's what shoppers see on the product card."
              : undefined
          }
        >
          <textarea
            id="shortDescription"
            rows={2}
            value={draft.shortDescription ?? ""}
            placeholder="A graceful blue and white bouquet with white roses…"
            onChange={(event) => onChange({ shortDescription: event.target.value || null })}
            className={inputClassName}
          />
        </FormField>

        <FormField label="Full Description" htmlFor="description">
          <textarea
            id="description"
            rows={5}
            value={draft.description ?? ""}
            placeholder="The full story customers see on the product page…"
            onChange={(event) => onChange({ description: event.target.value || null })}
            className={inputClassName}
          />
        </FormField>
      </div>
    </section>
  );
}
