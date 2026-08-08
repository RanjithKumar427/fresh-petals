import { useState } from "react";
import UploadZone from "./UploadZone";
import type { Media, MediaFolder } from "./types";

interface Props {
  open: boolean;
  defaultFolder: MediaFolder;
  onUploaded: (media: Media) => void;
  onClose: () => void;
}

export default function UploadModal({ open, defaultFolder, onUploaded, onClose }: Props) {
  const [folder, setFolder] = useState(defaultFolder);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="fp-card w-full max-w-lg p-6" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="fp-serif text-lg text-[#171717]">Upload Images</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[18px] text-[#9B948F] hover:text-[#171717]">
            ×
          </button>
        </div>

        <UploadZone folder={folder} onFolderChange={setFolder} onUploaded={onUploaded} />

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#111111] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#7C243E]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
