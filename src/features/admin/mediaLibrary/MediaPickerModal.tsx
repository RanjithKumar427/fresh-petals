import { useEffect, useState } from "react";
import UploadZone from "./UploadZone";
import { FOLDER_LABELS, MEDIA_FOLDERS, type Media, type MediaFolder, type MediaListItem } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  onChoose: (media: MediaListItem[]) => void;
}

/**
 * The product editor's "Choose from Library" flow — browse/search the same
 * Media Library used everywhere else, or upload new images, without
 * leaving the product editor. Multi-select; confirms with "Add N images".
 */
export default function MediaPickerModal({ open, onClose, onChoose }: Props) {
  const [tab, setTab] = useState<"browse" | "upload">("browse");
  const [items, setItems] = useState<MediaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState<MediaFolder | "">("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const refresh = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (folder) params.set("folder", folder);
    if (search.trim()) params.set("search", search.trim());
    const response = await fetch(`/api/admin/media?${params.toString()}`);
    const result = await response.json();
    if (result.ok) setItems(result.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, folder]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(refresh, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (!open) return null;

  const toggle = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  };

  const handleUploaded = (media: Media) => {
    refresh();
    setSelectedIds((prev) => [...prev, media.id]);
    setTab("browse");
  };

  const confirm = () => {
    onChoose(items.filter((item) => selectedIds.includes(item.id)));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="fp-card flex h-[80vh] w-full max-w-3xl flex-col p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="fp-serif text-lg text-[#171717]">Choose Images</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[18px] text-[#9B948F] hover:text-[#171717]">
            ×
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-full bg-[#F8F1F3] p-1">
          <button
            type="button"
            onClick={() => setTab("browse")}
            className={`flex-1 rounded-full py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
              tab === "browse" ? "bg-white text-[#7C243E] shadow-sm" : "text-[#77706F]"
            }`}
          >
            Browse Library
          </button>
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`flex-1 rounded-full py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
              tab === "upload" ? "bg-white text-[#7C243E] shadow-sm" : "text-[#77706F]"
            }`}
          >
            Upload New
          </button>
        </div>

        {tab === "upload" ? (
          <div className="flex-1 overflow-y-auto">
            <UploadZone folder="products" onFolderChange={() => {}} onUploaded={handleUploaded} />
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search images…"
                className="flex-1 rounded-full border border-[#D8D1D4] px-4 py-2 text-[13px] text-[#171717] outline-none focus:border-[#7C243E]"
              />
              <select
                value={folder}
                onChange={(event) => setFolder(event.target.value as MediaFolder | "")}
                className="rounded-full border border-[#D8D1D4] px-3 py-2 text-[12px] text-[#171717] outline-none focus:border-[#7C243E]"
              >
                <option value="">All folders</option>
                {MEDIA_FOLDERS.map((option) => (
                  <option key={option} value={option}>
                    {FOLDER_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div key={index} className="aspect-square animate-pulse rounded-lg bg-[#EEE5E8]" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-[#9B948F]">No images found.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggle(item.id)}
                        className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                          isSelected ? "border-[#7C243E]" : "border-transparent hover:border-[#D8D1D4]"
                        }`}
                      >
                        <img src={item.url} alt="" className="h-full w-full object-cover" />
                        {isSelected && (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#7C243E] text-[11px] text-white">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-[#EEE5E8] pt-4">
          <p className="text-[12px] text-[#9B948F]">{selectedIds.length} selected</p>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={confirm}
            className="rounded-full bg-[#111111] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#7C243E] disabled:cursor-not-allowed disabled:bg-[#D8D1D4]"
          >
            Add {selectedIds.length > 0 ? selectedIds.length : ""} Image{selectedIds.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
