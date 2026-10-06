import { useCallback, useEffect, useRef, useState } from "react";

/** What a save did to the website (see src/server/services/GarlandWebsite.ts). */
export type WebsiteChange = {
  listed: boolean;
  wasListed: boolean;
  reason: string | null;
  path: string;
  version: string;
  refresh: { ok: boolean; method: string; at: string; error?: string; message: string } | null;
  maxDelaySeconds: number;
};

type WebsiteCheck = {
  state: "live" | "hidden" | "pending" | "error";
  expected: "listed" | "hidden";
  path: string;
  checkedAt: string;
  message: string;
};

const POLL_MS = 5_000;

interface Props {
  productId: number;
  /** The latest save / status change's effect on the website; a new object starts a new check. */
  change: WebsiteChange | null;
}

/**
 * Garland editor only: "Saved" (the top bar) means the database has the
 * change; this bar says whether visitors can see it yet. After a save that
 * affects the website it checks the live page every few seconds until the
 * saved version (or, after unpublishing, its removal) is what the website
 * shows, and offers "Refresh website" if the automatic refresh failed or the
 * cache is taking longer than expected.
 */
export default function WebsiteStatus({ productId, change }: Props) {
  const [check, setCheck] = useState<WebsiteCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef(0);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const poll = useCallback(
    (until: number) => {
      stop();
      const id = ++run.current;
      setDeadline(until);
      const tick = async () => {
        setChecking(true);
        try {
          const response = await fetch(`/api/admin/products/${productId}/website`, { cache: "no-store" });
          const result = await response.json();
          if (id !== run.current) return;
          if (result.ok) setCheck(result.data as WebsiteCheck);
          const done = result.ok && (result.data.state === "live" || result.data.state === "hidden");
          if (!done && Date.now() < until) timer.current = setTimeout(tick, POLL_MS);
          else setDeadline(null);
        } catch {
          if (id === run.current && Date.now() < until) timer.current = setTimeout(tick, POLL_MS);
        } finally {
          if (id === run.current) setChecking(false);
        }
      };
      tick();
    },
    [productId]
  );

  // On opening the editor: one check of what the website shows now.
  useEffect(() => {
    poll(Date.now());
    return stop;
  }, [poll]);

  // After each save / publish / unpublish that the website can show.
  useEffect(() => {
    if (!change) return;
    setRefreshError(change.refresh && !change.refresh.ok ? change.refresh.message : null);
    if (change.refresh) poll(Date.now() + (change.maxDelaySeconds + 30) * 1000);
    else setCheck(null);
  }, [change, poll]);

  const retry = async () => {
    setRetrying(true);
    setRefreshError(null);
    try {
      const response = await fetch("/api/admin/garlands/refresh", { method: "POST" });
      const result = await response.json().catch(() => ({ ok: false, error: "The refresh request failed." }));
      if (!result.ok) setRefreshError(result.error || "The website refresh failed.");
    } catch {
      setRefreshError("The website refresh failed — check your connection.");
    } finally {
      setRetrying(false);
    }
    poll(Date.now() + ((change?.maxDelaySeconds ?? 180) + 30) * 1000);
  };

  const waiting = deadline !== null;
  const minutes = Math.ceil((change?.maxDelaySeconds ?? 180) / 60);

  let tone: "ok" | "info" | "warn" | "error" = "info";
  let text: string;
  if (refreshError) {
    tone = "error";
    text = refreshError;
  } else if (change && !change.refresh) {
    text = `Not on the website — ${change.reason ?? "not public"}. Saved changes appear there once it's published.`;
  } else if (check?.state === "live") {
    tone = "ok";
    text = check.message;
  } else if (check?.state === "hidden") {
    tone = change ? "ok" : "info";
    text = check.message;
  } else if (waiting) {
    text = `Updating the website… usually a few seconds, at most ${minutes} minutes.`;
  } else if (check?.state === "pending") {
    tone = "warn";
    text = check.message;
  } else if (check?.state === "error") {
    tone = "warn";
    text = check.message;
  } else {
    text = checking ? "Checking the website…" : "Website status unknown.";
  }

  const colours = {
    ok: "border-[#CFE6D8] bg-[#F3FAF6] text-[#075838]",
    info: "border-[#EEE5E8] bg-white text-[#66565D]",
    warn: "border-[#F1DFB8] bg-[#FFF7E8] text-[#7A5210]",
    error: "border-[#F2C9D4] bg-[#FBEAEE] text-[#7C243E]",
  }[tone];
  const showRetry = refreshError !== null || (!waiting && (check?.state === "pending" || check?.state === "error"));

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-[12px] md:px-6 ${colours}`}
      role="status"
      aria-live="polite"
      data-website-status={refreshError ? "refresh-failed" : (check?.state ?? (change && !change.refresh ? "not-public" : waiting ? "updating" : "unknown"))}
    >
      <span className="font-bold uppercase tracking-[0.1em]">Website</span>
      <span>{text}</span>
      {check?.path && (check.state === "live" || check.state === "pending") && (
        <a href={check.path} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          View page ↗
        </a>
      )}
      {showRetry && (
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          data-website-retry
          className="font-bold uppercase tracking-[0.1em] underline underline-offset-2 hover:text-[#111111] disabled:opacity-50"
        >
          {retrying ? "Refreshing…" : "Refresh website"}
        </button>
      )}
    </div>
  );
}
