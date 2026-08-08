import { useEffect, useState } from "react";
import ConfirmDialog from "../shared/ConfirmDialog";
import { FOLDER_LABELS, MEDIA_FOLDERS, formatBytes, formatDate, usageCount, type MediaFolder, type MediaWithUsage } from "./types";

interface Props {
  mediaId: number | null;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}

export default function MediaDetailPanel({ mediaId, onClose, onChanged, onDeleted }: Props) {
  const [media, setMedia] = useState<MediaWithUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState("");
  const [altText, setAltText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState<"path" | "url" | null>(null);

  useEffect(() => {
    if (mediaId === null) {
      setMedia(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/admin/media/${mediaId}`)
      .then((response) => response.json())
      .then((result) => {
        if (result.ok) {
          setMedia(result.data);
          setFilename(result.data.filename);
          setAltText(result.data.altText ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, [mediaId]);

  if (mediaId === null) return null;

  const patch = async (body: Record<string, unknown>) => {
    if (!media) return;
    const response = await fetch(`/api/admin/media/${media.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (result.ok) {
      setMedia((prev) => (prev ? { ...prev, ...result.data } : prev));
      onChanged();
    } else {
      setError(result.error || "Update failed.");
    }
  };

  const handleDelete = async () => {
    if (!media) return;
    const response = await fetch(`/api/admin/media/${media.id}`, { method: "DELETE" });
    const result = await response.json();
    if (result.ok) {
      onDeleted();
    } else {
      setConfirmingDelete(false);
      setError(result.error || "Couldn't delete this file.");
    }
  };

  const copy = (value: string, kind: "path" | "url") => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const inUse = media ? usageCount(media.usage) > 0 : false;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EEE5E8] px-5 py-4">
          <p className="fp-label text-[10px] text-[#9B6B78]">Image Details</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[18px] text-[#9B948F] hover:text-[#171717]">
            ×
          </button>
        </div>

        {loading || !media ? (
          <div className="p-5">
            <div className="aspect-square animate-pulse rounded-xl bg-[#EEE5E8]" />
          </div>
        ) : (
          <div className="p-5">
            {error && <div className="mb-4 rounded-lg bg-[#FBEAEE] px-3 py-2 text-[12px] text-[#7C243E]">{error}</div>}

            <div className="overflow-hidden rounded-xl bg-[#F8F1F3]">
              <img src={media.url} alt={media.altText ?? ""} className="max-h-80 w-full object-contain" />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="fp-label block text-[10px] text-[#66565D]">Filename</label>
                <input
                  type="text"
                  value={filename}
                  onChange={(event) => setFilename(event.target.value)}
                  onBlur={() => filename.trim() && filename !== media.filename && patch({ filename: filename.trim() })}
                  className="mt-1 w-full rounded-lg border border-[#D8D1D4] px-3 py-2 text-[13px] text-[#171717] outline-none focus:border-[#7C243E]"
                />
              </div>

              <div>
                <label className="fp-label block text-[10px] text-[#66565D]">Alt Text</label>
                <input
                  type="text"
                  value={altText}
                  placeholder="Describe this image for accessibility & SEO"
                  onChange={(event) => setAltText(event.target.value)}
                  onBlur={() => altText !== (media.altText ?? "") && patch({ altText })}
                  className="mt-1 w-full rounded-lg border border-[#D8D1D4] px-3 py-2 text-[13px] text-[#171717] outline-none focus:border-[#7C243E]"
                />
              </div>

              <div>
                <label className="fp-label block text-[10px] text-[#66565D]">Folder</label>
                <select
                  value={media.folder}
                  disabled={!media.path}
                  onChange={(event) => patch({ folder: event.target.value as MediaFolder })}
                  className="mt-1 w-full rounded-lg border border-[#D8D1D4] px-3 py-2 text-[13px] text-[#171717] outline-none focus:border-[#7C243E] disabled:bg-[#FBF7F5] disabled:text-[#9B948F]"
                >
                  {MEDIA_FOLDERS.map((folder) => (
                    <option key={folder} value={folder}>
                      {FOLDER_LABELS[folder]}
                    </option>
                  ))}
                </select>
                {!media.path && <p className="mt-1 text-[11px] text-[#9B948F]">Seeded images can't be moved.</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className="fp-eyebrow">Resolution</p>
                  <p className="mt-1 text-[#171717]">{media.width && media.height ? `${media.width} × ${media.height}` : "Unknown"}</p>
                </div>
                <div>
                  <p className="fp-eyebrow">File Size</p>
                  <p className="mt-1 text-[#171717]">{formatBytes(media.sizeBytes)}</p>
                </div>
                <div>
                  <p className="fp-eyebrow">Uploaded</p>
                  <p className="mt-1 text-[#171717]">{formatDate(media.createdAt)}</p>
                </div>
                <div>
                  <p className="fp-eyebrow">Type</p>
                  <p className="mt-1 text-[#171717]">{media.mimeType}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copy(media.path ? `/uploads/${media.path}` : media.url, "path")}
                  className="flex-1 rounded-full border border-[#D8D1D4] px-3 py-2 text-[11px] font-semibold text-[#171717] transition hover:border-[#7C243E]"
                >
                  {copied === "path" ? "Copied!" : "Copy Path"}
                </button>
                <button
                  type="button"
                  onClick={() => copy(media.url, "url")}
                  className="flex-1 rounded-full border border-[#D8D1D4] px-3 py-2 text-[11px] font-semibold text-[#171717] transition hover:border-[#7C243E]"
                >
                  {copied === "url" ? "Copied!" : "Copy URL"}
                </button>
              </div>

              <div>
                <p className="fp-label text-[10px] text-[#66565D]">
                  Used By {inUse && <span className="text-[#9B948F]">({usageCount(media.usage)})</span>}
                </p>
                {!inUse ? (
                  <p className="mt-1.5 text-[13px] text-[#9B948F]">Not currently used anywhere.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {media.usage.products.map((product) => (
                      <li key={`p-${product.id}`}>
                        <a
                          href={`/admin/products/edit/${product.id}`}
                          className="text-[13px] text-[#7C243E] hover:underline"
                        >
                          {product.name}
                        </a>
                        {product.isPrimary && <span className="ml-1.5 text-[10px] text-[#9B948F]">(primary)</span>}
                      </li>
                    ))}
                    {media.usage.categories.map((category) => (
                      <li key={`c-${category.id}`} className="text-[13px] text-[#171717]">
                        {category.name} <span className="text-[10px] text-[#9B948F]">(category)</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                disabled={inUse}
                onClick={() => setConfirmingDelete(true)}
                title={inUse ? "Remove this image from every product/category first." : undefined}
                className="w-full rounded-full border border-[#B3352D] py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#B3352D] transition hover:bg-[#B3352D] hover:text-white disabled:cursor-not-allowed disabled:border-[#D8D1D4] disabled:text-[#B8AEB3] disabled:hover:bg-transparent"
              >
                Delete Image
              </button>
            </div>
          </div>
        )}
      </aside>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this image?"
        message={`"${media?.filename}" will be permanently removed. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
