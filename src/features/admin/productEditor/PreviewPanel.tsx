import { useEffect, useState } from "react";
import type { CategoryOption, ProductDraft } from "./types";

interface Props {
  draft: ProductDraft;
  categories: CategoryOption[];
  /** Changes exactly when an autosave completes — see ProductEditor (lastSavedAt.getTime()). */
  refreshKey: number | null;
}

type Device = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTH: Record<Device, string> = {
  desktop: "100%",
  tablet: "420px",
  mobile: "300px",
};

/**
 * Renders the *real* ProductCard.astro via a server round-trip (see
 * src/pages/api/admin/products/preview.ts for why that's the cleanest
 * option here, over duplicating the card's markup or an iframe).
 * Refreshes when autosave completes, not on every keystroke — matches
 * what the save-status indicator already tells the florist just happened.
 */
export default function PreviewPanel({ draft, categories, refreshKey }: Props) {
  const [device, setDevice] = useState<Device>("desktop");
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const primaryImage = draft.images.find((image) => image.isPrimary) ?? draft.images[0];
  const categoryName = categories.find((category) => category.id === draft.categoryId)?.name ?? "Uncategorized";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/admin/products/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        image: primaryImage?.url,
        category: categoryName,
        description: draft.shortDescription,
        slug: draft.slug,
        priceType: draft.priceType,
        sellingPrice: draft.sellingPrice,
      }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled && result.ok) setHtml(result.data.html);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Deliberately keyed on refreshKey (autosave completion), not on the
    // individual draft fields below — they're only read once refreshKey
    // fires, not watched independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#EEE5E8] px-4 py-3">
        <p className="fp-label text-[10px] text-[#9B6B78]">Live Preview</p>
        <div className="flex gap-1 rounded-full bg-[#F8F1F3] p-1">
          {(["desktop", "tablet", "mobile"] as Device[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDevice(option)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
                device === option ? "bg-white text-[#7C243E] shadow-sm" : "text-[#77706F]"
              }`}
            >
              {option === "desktop" ? "Desktop" : option === "tablet" ? "Tablet" : "Mobile"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-auto bg-[#FBF7F5] p-6">
        {loading && html === "" ? (
          <div style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }} className="animate-pulse">
            <div className="aspect-square rounded-2xl bg-[#EEE5E8]" />
            <div className="mt-4 h-3 w-1/3 rounded bg-[#EEE5E8]" />
            <div className="mt-2 h-4 w-2/3 rounded bg-[#EEE5E8]" />
            <div className="mt-2 h-3 w-full rounded bg-[#EEE5E8]" />
          </div>
        ) : (
          <div
            style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}
            className={`transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}
            // Server-rendered by our own /api/admin/products/preview endpoint
            // from the real ProductCard.astro component — see that file for
            // why this is safe to inject directly.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
