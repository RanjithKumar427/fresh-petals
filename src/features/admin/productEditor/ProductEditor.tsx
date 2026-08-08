import { useCallback, useEffect, useRef, useState } from "react";
import EditorShell from "./EditorShell";
import Sidebar from "./Sidebar";
import PreviewPanel from "./PreviewPanel";
import { useAutosave } from "./useAutosave";
import { SECTIONS } from "./completion";
import { toProductInput, type CategoryOption, type ProductDraft } from "./types";
import BasicInfoSection from "./sections/BasicInfoSection";
import ImagesSection from "./sections/ImagesSection";
import PlaceholderSection from "./sections/PlaceholderSection";
import ConfirmDialog from "../shared/ConfirmDialog";

interface Props {
  product: ProductDraft;
  categories: CategoryOption[];
}

async function saveProduct(draft: ProductDraft): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`/api/admin/products/${draft.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(toProductInput(draft)),
  });
  const result = await response.json();
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export default function ProductEditor({ product, categories }: Props) {
  const [draft, setDraft] = useState<ProductDraft>(product);
  const [activeSectionId, setActiveSectionId] = useState(SECTIONS[0].id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const { status, error, lastSavedAt, saveNow } = useAutosave(
    draft,
    saveProduct,
    product.updatedAt ? new Date(product.updatedAt) : null
  );

  const updateDraft = useCallback((patch: Partial<ProductDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  // Tracks which section is most in view so the sidebar highlight follows
  // scrolling, not just clicks.
  useEffect(() => {
    const sectionEls = SECTIONS.map((section) => document.getElementById(`section-${section.id}`)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^section-/, "");
          setActiveSectionId(id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleDuplicate = async () => {
    const response = await fetch(`/api/admin/products/${draft.id}/duplicate`, { method: "POST" });
    const result = await response.json();
    if (result.ok) window.location.href = `/admin/products/edit/${result.data.id}`;
  };

  const handleDelete = async () => {
    await fetch(`/api/admin/products/${draft.id}`, { method: "DELETE" });
    window.location.href = "/admin/products";
  };

  return (
    <>
      <EditorShell
        productName={draft.name}
        saveStatus={status}
        lastSavedAt={lastSavedAt}
        saveError={error}
        onRetrySave={saveNow}
        onSaveDraft={saveNow}
        onDuplicate={handleDuplicate}
        onDelete={() => setConfirmingDelete(true)}
        sidebar={<Sidebar draft={draft} activeSectionId={activeSectionId} />}
        preview={<PreviewPanel draft={draft} categories={categories} />}
      >
        <div ref={contentRef} className="space-y-6">
          <BasicInfoSection draft={draft} onChange={updateDraft} />
          <ImagesSection draft={draft} onChange={updateDraft} />
          {SECTIONS.filter((section) => !section.available).map((section) => (
            <PlaceholderSection key={section.id} id={section.id} label={section.label} />
          ))}
        </div>
      </EditorShell>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this product?"
        message={`"${draft.name}" will be permanently removed. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
