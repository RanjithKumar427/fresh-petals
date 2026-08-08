import { FOLDER_LABELS, MEDIA_FOLDERS, type MediaFolder } from "./types";

interface Props {
  active: MediaFolder | null;
  onChange: (folder: MediaFolder | null) => void;
  counts: Record<MediaFolder, number>;
  total: number;
}

/** Horizontal folder filter row — an Apple-Photos-style "Albums" strip, not a Windows-Explorer tree. */
export default function FolderChips({ active, onChange, counts, total }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
          active === null ? "bg-[#111111] text-white" : "bg-[#F8F1F3] text-[#66565D] hover:text-[#171717]"
        }`}
      >
        All <span className="opacity-70">{total}</span>
      </button>
      {MEDIA_FOLDERS.map((folder) => (
        <button
          key={folder}
          type="button"
          onClick={() => onChange(folder)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
            active === folder ? "bg-[#111111] text-white" : "bg-[#F8F1F3] text-[#66565D] hover:text-[#171717]"
          }`}
        >
          {FOLDER_LABELS[folder]} <span className="opacity-70">{counts[folder] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
