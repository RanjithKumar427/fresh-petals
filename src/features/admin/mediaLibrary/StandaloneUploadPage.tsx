import { useState } from "react";
import UploadZone from "./UploadZone";
import type { Media, MediaFolder } from "./types";

/** The dedicated /admin/media/upload page — same UploadZone as the modal, just full-page for a focused bulk-upload session. */
export default function StandaloneUploadPage() {
  const [folder, setFolder] = useState<MediaFolder>("products");
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleUploaded = (_media: Media) => {
    setUploadedCount((count) => count + 1);
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="fp-card p-6">
        <UploadZone folder={folder} onFolderChange={setFolder} onUploaded={handleUploaded} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[13px] text-[#77706F]">
          {uploadedCount > 0 ? `${uploadedCount} image${uploadedCount === 1 ? "" : "s"} uploaded` : ""}
        </p>
        <a
          href="/admin/media"
          className="rounded-full bg-[#111111] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#7C243E]"
        >
          Go to Library
        </a>
      </div>
    </div>
  );
}
