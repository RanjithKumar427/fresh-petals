import { useCallback, useEffect, useState } from "react";
import EditorShell from "./EditorShell";
import Sidebar from "./Sidebar";
import PreviewPanel from "./PreviewPanel";
import { useAutosave } from "./useAutosave";
import { SECTIONS } from "./completion";
import { getPublishBlockers } from "./publishReadiness";
import { toProductInput, type CategoryOption, type ProductDraft, type ProductStatus, type TagOption } from "./types";
import BasicInfoSection from "./sections/BasicInfoSection";
import ImagesSection from "./sections/ImagesSection";
import PricingSection from "./sections/PricingSection";
import ClassificationSection from "./sections/ClassificationSection";
import FlowerDetailsSection from "./sections/FlowerDetailsSection";
import IncludedSection from "./sections/IncludedSection";
import CareSection from "./sections/CareSection";
import SEOSection from "./sections/SEOSection";
import PublishingSection from "./sections/PublishingSection";
import ConfirmDialog from "../shared/ConfirmDialog";

interface Props {
  product: ProductDraft;
  categories: CategoryOption[];
  occasions: TagOption[];
  moods: TagOption[];
  flowerTypes: TagOption[];
  uncategorizedCategoryId: number;
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

export default function ProductEditor({
  product,
  categories,
  occasions,
  moods,
  flowerTypes,
  uncategorizedCategoryId,
}: Props) {
  const [draft, setDraft] = useState<ProductDraft>(product);
  const [activeSectionId, setActiveSectionId] = useState(SECTIONS[0].id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

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

  // Ctrl+S / Cmd+S saves immediately instead of waiting for the debounce —
  // and stops the browser's own "Save Page" dialog from popping up.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveNow();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveNow]);

  const changeStatus = async (nextStatus: ProductStatus) => {
    setStatusError(null);
    const response = await fetch(`/api/admin/products/${draft.id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const result = await response.json();

    if (result.ok) {
      setDraft((prev) => ({
        ...prev,
        status: result.data.status,
        publishedAt: result.data.publishedAt,
        updatedAt: result.data.updatedAt,
      }));
    } else {
      setStatusError(result.error || "Couldn't update status.");
    }
  };

  const blockers = getPublishBlockers(draft, uncategorizedCategoryId);

  const handlePublish = async () => {
    if (blockers.length > 0) {
      document.getElementById("section-publishing")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    await changeStatus("published");
  };

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
        productStatus={draft.status}
        saveStatus={status}
        lastSavedAt={lastSavedAt}
        saveError={error}
        onRetrySave={saveNow}
        onSaveDraft={saveNow}
        onPublish={handlePublish}
        onDuplicate={handleDuplicate}
        onArchive={() => changeStatus("archived")}
        onUnarchive={() => changeStatus("draft")}
        onDelete={() => setConfirmingDelete(true)}
        sidebar={<Sidebar draft={draft} activeSectionId={activeSectionId} uncategorizedCategoryId={uncategorizedCategoryId} />}
        preview={
          <PreviewPanel draft={draft} categories={categories} refreshKey={lastSavedAt ? lastSavedAt.getTime() : null} />
        }
      >
        {statusError && (
          <div className="rounded-lg bg-[#FBEAEE] px-4 py-3 text-[13px] text-[#7C243E]">{statusError}</div>
        )}

        <BasicInfoSection draft={draft} onChange={updateDraft} />
        <ImagesSection draft={draft} onChange={updateDraft} />
        <PricingSection draft={draft} onChange={updateDraft} />
        <ClassificationSection
          draft={draft}
          onChange={updateDraft}
          categories={categories}
          occasions={occasions}
          moods={moods}
          uncategorizedCategoryId={uncategorizedCategoryId}
        />
        <FlowerDetailsSection draft={draft} onChange={updateDraft} flowerTypes={flowerTypes} />
        <IncludedSection draft={draft} onChange={updateDraft} />
        <CareSection draft={draft} onChange={updateDraft} />
        <SEOSection draft={draft} onChange={updateDraft} />
        <PublishingSection
          draft={draft}
          blockers={blockers}
          onSaveDraft={saveNow}
          onPublish={handlePublish}
          onArchive={() => changeStatus("archived")}
          onUnarchive={() => changeStatus("draft")}
        />
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
