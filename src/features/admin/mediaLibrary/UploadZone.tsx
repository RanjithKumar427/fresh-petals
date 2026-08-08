import { useRef, useState } from "react";
import { useMediaUpload } from "./useMediaUpload";
import { FOLDER_LABELS, MEDIA_FOLDERS, formatBytes, type Media, type MediaFolder } from "./types";

interface Props {
  folder: MediaFolder;
  onFolderChange: (folder: MediaFolder) => void;
  onUploaded: (media: Media) => void;
}

/** Drag-drop + multi-upload with real progress, cancel and retry — shared by the upload modal and /admin/media/upload. */
export default function UploadZone({ folder, onFolderChange, onUploaded }: Props) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { items, addFiles, cancel, retry, dismiss } = useMediaUpload(onUploaded);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <label className="fp-label text-[10px] text-[#66565D]">Upload to</label>
        <select
          value={folder}
          onChange={(event) => onFolderChange(event.target.value as MediaFolder)}
          className="rounded-full border border-[#D8D1D4] px-3 py-1.5 text-[12px] text-[#171717] outline-none focus:border-[#7C243E]"
        >
          {MEDIA_FOLDERS.map((option) => (
            <option key={option} value={option}>
              {FOLDER_LABELS[option]}
            </option>
          ))}
        </select>
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
          addFiles(event.dataTransfer.files, folder);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
          isDraggingOver ? "border-[#7C243E] bg-[#F8DCE5]/30" : "border-[#D8D1D4] hover:border-[#9B6B78]"
        }`}
      >
        <p className="text-[14px] font-medium text-[#171717]">Drag & drop images here</p>
        <p className="mt-1 text-[12px] text-[#9B948F]">or click to browse — JPG, PNG, WebP or GIF, up to 8MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files, folder);
            event.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#EEE5E8] px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="truncate text-[#171717]">{item.file.name}</span>
                <span className="shrink-0 text-[#9B948F]">{formatBytes(item.file.size)}</span>
              </div>

              {item.status === "uploading" && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#F3F0EE]">
                    <div className="h-full rounded-full bg-[#7C243E] transition-all" style={{ width: `${item.progress}%` }} />
                  </div>
                  <button type="button" onClick={() => cancel(item.id)} className="text-[11px] text-[#9B948F] hover:text-[#B3352D]">
                    Cancel
                  </button>
                </div>
              )}

              {item.status === "done" && <p className="mt-1 text-[11px] text-[#075838]">Uploaded</p>}

              {item.status === "canceled" && (
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[11px] text-[#9B948F]">Cancelled</p>
                  <button type="button" onClick={() => retry(item.id)} className="text-[11px] font-semibold text-[#7C243E]">
                    Retry
                  </button>
                </div>
              )}

              {item.status === "error" && (
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[11px] text-[#B3352D]">{item.error}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => retry(item.id)} className="text-[11px] font-semibold text-[#7C243E]">
                      Retry
                    </button>
                    <button type="button" onClick={() => dismiss(item.id)} className="text-[11px] text-[#9B948F]">
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
