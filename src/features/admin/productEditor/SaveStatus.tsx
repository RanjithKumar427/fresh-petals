import { useEffect, useState } from "react";
import type { SaveStatus as Status } from "./useAutosave";

interface Props {
  status: Status;
  lastSavedAt: Date | null;
  error: string | null;
  onRetry: () => void;
}

function timeAgoLabel(date: Date): string {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

/** Always-visible save indicator in the editor top bar — Notion/Docs-style, never silent about save state. */
export default function SaveStatus({ status, lastSavedAt, error, onRetry }: Props) {
  // Ticks so "Saved just now" keeps advancing to "Saved 45s ago" etc.
  // without needing another edit to trigger a re-render.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (status !== "saved") return;
    const interval = setInterval(() => forceTick((n) => n + 1), 15_000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[#77706F]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9B6B78]" />
        Saving…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-2 text-[12px] text-[#7C243E]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#7C243E]" />
        {error || "Save failed"}
        <button
          type="button"
          onClick={onRetry}
          className="font-bold uppercase tracking-[0.1em] underline underline-offset-2 hover:text-[#111111]"
        >
          Retry
        </button>
      </span>
    );
  }

  if (status === "saved" && lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[#075838]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#075838]" />
        Saved {timeAgoLabel(lastSavedAt)}
      </span>
    );
  }

  return <span className="text-[12px] text-[#B8AEB3]">Unsaved changes</span>;
}
