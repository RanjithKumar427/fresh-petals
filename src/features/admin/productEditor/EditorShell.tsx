import type { ReactNode } from "react";
import SaveStatus from "./SaveStatus";
import OverflowMenu from "../shared/OverflowMenu";
import type { SaveStatus as Status } from "./useAutosave";

interface Props {
  productName: string;
  saveStatus: Status;
  lastSavedAt: Date | null;
  saveError: string | null;
  onRetrySave: () => void;
  onSaveDraft: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  sidebar: ReactNode;
  preview: ReactNode;
  children: ReactNode;
}

export default function EditorShell({
  productName,
  saveStatus,
  lastSavedAt,
  saveError,
  onRetrySave,
  onSaveDraft,
  onDuplicate,
  onDelete,
  sidebar,
  preview,
  children,
}: Props) {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-[#EEE5E8] bg-white px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/admin/products" className="shrink-0 text-[13px] text-[#66565D] hover:text-[#171717]">
            ← Products
          </a>
          <h1 className="truncate text-[14px] font-medium text-[#171717]">
            {productName === "Untitled Product" ? "Untitled Product" : productName}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <SaveStatus status={saveStatus} lastSavedAt={lastSavedAt} error={saveError} onRetry={onRetrySave} />

          <button
            type="button"
            onClick={onSaveDraft}
            className="rounded-full border border-[#D8D1D4] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#171717] transition hover:border-[#7C243E] hover:text-[#7C243E]"
          >
            Save Draft
          </button>

          <span title="Available once Classification & Pricing are set up in a later milestone">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-full bg-[#111111]/40 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white"
            >
              Publish
            </button>
          </span>

          <OverflowMenu
            items={[
              { label: "Duplicate", onClick: onDuplicate },
              { label: "Delete", onClick: onDelete, danger: true },
            ]}
          />
        </div>
      </header>

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
