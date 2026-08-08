import { useRef, useState } from "react";
import { uploadFile } from "../../shared/uploadFile";
import MediaPickerModal from "../../mediaLibrary/MediaPickerModal";
import type { MediaListItem } from "../../mediaLibrary/types";
import type { ProductDraft, ProductImageDraft } from "../types";

interface Props {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
}

type PendingUpload = { key: string; filename: string; progress: number; error: string | null };

const MAX_IMAGES = 12;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function withRecalculatedOrder(images: ProductImageDraft[]): ProductImageDraft[] {
  return images.map((image, index) => ({ ...image, sortOrder: index }));
}

export default function ImagesSection({ draft, onChange }: Props) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dragImageIndex = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const room = MAX_IMAGES - draft.images.length;
    const accepted = list.slice(0, Math.max(0, room));

    for (const file of accepted) {
      const key = `${file.name}-${Date.now()}-${Math.random()}`;

      if (!file.type.startsWith("image/")) {
        setPendingUploads((prev) => [...prev, { key, filename: file.name, progress: 0, error: "Not an image file." }]);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setPendingUploads((prev) => [...prev, { key, filename: file.name, progress: 0, error: "Larger than 8MB." }]);
        continue;
      }

      setPendingUploads((prev) => [...prev, { key, filename: file.name, progress: 0, error: null }]);

      // Compression/background-removal/AI-enhancement would slot in here
      // later (transform `file` before uploadFile) — same seam as
      // MediaService.upload's comment on the server side.
      uploadFile(file, "products", (progress) => {
        setPendingUploads((prev) => prev.map((entry) => (entry.key === key ? { ...entry, progress } : entry)));
      })
        .then((media) => {
          setPendingUploads((prev) => prev.filter((entry) => entry.key !== key));
          onChange({
            images: withRecalculatedOrder([
              ...draft.images,
              {
                mediaId: media.id,
                url: media.url,
                altText: draft.name === "Untitled Product" ? null : draft.name,
                sortOrder: draft.images.length,
                isPrimary: draft.images.length === 0,
                sizeBytes: media.sizeBytes,
              },
            ]),
          });
        })
        .catch((error: Error) => {
          setPendingUploads((prev) =>
            prev.map((entry) => (entry.key === key ? { ...entry, error: error.message } : entry))
          );
        });
    }
  };

  const setPrimary = (index: number) => {
    onChange({
      images: draft.images.map((image, i) => ({ ...image, isPrimary: i === index })),
    });
  };

  const removeImage = (index: number) => {
    const remaining = draft.images.filter((_, i) => i !== index);
    if (draft.images[index]?.isPrimary && remaining.length > 0) remaining[0] = { ...remaining[0], isPrimary: true };
    onChange({ images: withRecalculatedOrder(remaining) });
  };

  const reorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...draft.images];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange({ images: withRecalculatedOrder(next) });
  };

  /** "Choose from Library" — same Media Library used everywhere else, no separate upload path or duplicated picker. */
  const handleChooseFromLibrary = (selected: MediaListItem[]) => {
    const alreadyAttached = new Set(draft.images.map((image) => image.mediaId));
    const room = MAX_IMAGES - draft.images.length;
    const toAdd = selected.filter((media) => !alreadyAttached.has(media.id)).slice(0, Math.max(0, room));
    if (toAdd.length === 0) return;

    onChange({
      images: withRecalculatedOrder([
        ...draft.images,
        ...toAdd.map((media) => ({
          mediaId: media.id,
          url: media.url,
          altText: media.altText ?? (draft.name === "Untitled Product" ? null : draft.name),
          sortOrder: 0,
          isPrimary: false,
          sizeBytes: media.sizeBytes,
        })),
      ]).map((image, index, all) => ({ ...image, isPrimary: all.some((i) => i.isPrimary) ? image.isPrimary : index === 0 })),
    });
  };

  return (
    <section id="section-images" className="fp-card scroll-mt-6 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">Images</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7C243E] hover:underline"
          >
            Choose from Library
          </button>
          <span className="text-[12px] text-[#9B948F]">
            {draft.images.length} of {MAX_IMAGES}
          </span>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDraggingOver(false);
          handleFiles(event.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          isDraggingOver ? "border-[#7C243E] bg-[#F8DCE5]/30" : "border-[#D8D1D4] hover:border-[#9B6B78]"
        }`}
      >
        <p className="text-[13px] font-medium text-[#171717]">Drag & drop photos here</p>
        <p className="mt-1 text-[12px] text-[#9B948F]">or click to browse — JPG, PNG, WebP or GIF, up to 8MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {pendingUploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {pendingUploads.map((upload) => (
            <div key={upload.key} className="rounded-lg border border-[#EEE5E8] px-3 py-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="truncate text-[#171717]">{upload.filename}</span>
                <span className={upload.error ? "text-[#B3352D]" : "text-[#9B948F]"}>
                  {upload.error || `${upload.progress}%`}
                </span>
              </div>
              {!upload.error && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#F3F0EE]">
                  <div
                    className="h-full rounded-full bg-[#7C243E] transition-all"
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {draft.images.length === 0 && pendingUploads.length === 0 && (
        <p className="mt-4 text-[12px] text-[#9B6B78]">
          <span aria-hidden>✨ </span>
          Add at least one photo so customers can see this product on the storefront.
        </p>
      )}

      {draft.images.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {draft.images.map((image, index) => (
            <div
              key={image.mediaId}
              draggable
              onDragStart={() => (dragImageIndex.current = index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragImageIndex.current !== null) reorder(dragImageIndex.current, index);
                dragImageIndex.current = null;
              }}
              className="group relative cursor-grab overflow-hidden rounded-xl border border-[#EEE5E8] bg-white active:cursor-grabbing"
            >
              <div className="relative aspect-square bg-[#F8F1F3]">
                <img src={image.url} alt={image.altText ?? ""} className="h-full w-full object-cover" />
                {image.isPrimary && (
                  <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#7C243E] shadow-sm">
                    Primary
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  aria-label="Remove image"
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[13px] text-[#171717] opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white"
                >
                  ×
                </button>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[10px] text-[#9B948F]">{formatBytes(image.sizeBytes)}</span>
                {!image.isPrimary && (
                  <button
                    type="button"
                    onClick={() => setPrimary(index)}
                    className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#7C243E] opacity-0 transition group-hover:opacity-100"
                  >
                    Set primary
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <MediaPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onChoose={handleChooseFromLibrary} />
    </section>
  );
}
