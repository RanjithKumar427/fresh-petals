import type { ReactNode } from "react";
import SaveStatus from "./SaveStatus";
import OverflowMenu from "../shared/OverflowMenu";
import type { SaveStatus as Status } from "./useAutosave";
import type { ProductStatus } from "./types";

interface Props {
  productName: string;
  /** Garland design code — garlands can't be duplicated or deleted (permanent identity). */
  designCode?: string | null;
  productStatus: ProductStatus;
  saveStatus: Status;
  lastSavedAt: Date | null;
  saveError: string | null;
  onRetrySave: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  /** Garlands: take a published design off the website (back to draft). */
  onUnpublish?: () => void;
  onDelete: () => void;
  /** Garlands: whether the saved version is visible on the website yet. */
  websiteStatus?: ReactNode;
  sidebar: ReactNode;
  preview: ReactNode;
  children: ReactNode;
}

export default function EditorShell({
  productName,
  designCode = null,
  productStatus,
  saveStatus,
  lastSavedAt,
  saveError,
  onRetrySave,
  onSaveDraft,
  onPublish,
  onDuplicate,
  onArchive,
  onUnarchive,
  onUnpublish,
  onDelete,
  websiteStatus = null,
  sidebar,
  preview,
  children,
}: Props) {
  const overflowItems = designCode
    ? productStatus === "archived"
      ? [{ label: "Restore to Draft", onClick: onUnarchive }]
      : [
          ...(productStatus === "published" && onUnpublish ? [{ label: "Unpublish (back to draft)", onClick: onUnpublish }] : []),
          { label: "Archive", onClick: onArchive },
        ]
    : productStatus === "archived"
      ? [
          { label: "Duplicate", onClick: onDuplicate },
          { label: "Restore to Draft", onClick: onUnarchive },
          { label: "Delete", onClick: onDelete, danger: true },
        ]
      : [
          { label: "Duplicate", onClick: onDuplicate },
          { label: "Archive", onClick: onArchive },
          { label: "Delete", onClick: onDelete, danger: true },
        ];

  return (
    <div className="flex h-screen flex-col">
      {/* Sticky by construction, not by position:sticky — the header sits
          outside the scrolling <main>/<aside> below, so it's always visible
          without any extra CSS. */}
      <header className="flex items-center justify-between gap-4 border-b border-[#EEE5E8] bg-white px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/admin/products" className="shrink-0 text-[13px] text-[#66565D] hover:text-[#171717]">
            ← Products
          </a>
          <h1 className="truncate text-[14px] font-medium text-[#171717]">
            {productName === "Untitled Product" ? "Untitled Product" : productName}
          </h1>
          {designCode && (
            <span className="shrink-0 rounded-full bg-[#F8DCE5] px-2 py-0.5 text-[10px] font-bold tracking-[0.1em] text-[#7C243E]">{designCode}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <SaveStatus status={saveStatus} lastSavedAt={lastSavedAt} error={saveError} onRetry={onRetrySave} />

          <button
            type="button"
            onClick={onSaveDraft}
            title="Ctrl+S / Cmd+S"
            className="rounded-full border border-[#D8D1D4] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#171717] transition hover:border-[#7C243E] hover:text-[#7C243E]"
          >
            Save Draft
          </button>

          {productStatus !== "published" && (
            <button
              type="button"
              onClick={onPublish}
              className="rounded-full bg-[#111111] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#7C243E]"
            >
              Publish
            </button>
          )}

          <OverflowMenu items={overflowItems} />
        </div>
      </header>
      {websiteStatus}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_1fr_360px]">
        <aside className="hidden overflow-y-auto border-r border-[#EEE5E8] bg-white p-4 lg:block">{sidebar}</aside>

        <main className="overflow-y-auto bg-[#FBF7F5] px-4 py-6 md:px-8">
          <div className="mx-auto max-w-2xl space-y-6">{children}</div>
        </main>

        <aside className="hidden overflow-hidden border-l border-[#EEE5E8] bg-white lg:block">{preview}</aside>
      </div>
    </div>
  );
}
