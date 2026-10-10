import { useEffect, useRef, useState } from "react";

/** What a save did to the live occasion pages (src/server/services/OccasionWebsite.ts). */
export type OccasionChange = {
  changed: string[];
  routes: string[];
  listed: boolean;
  refresh: { ok: boolean; message: string; error?: string } | null;
  maxDelaySeconds: number;
};

type PageCheck = { route: string; expected: "listed" | "absent"; seen: "listed" | "absent" | "error"; ok: boolean };

const POLL_MS = 5_000;
const label = (route: string) => route.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Under "Suitable occasions" after a save that changed them: "saved" is not
 * the same as "on the website". Polls the affected live occasion pages until
 * each lists (or no longer lists) this bouquet; reports a failed refresh with
 * a retry. Pages always catch up on their own within a few minutes.
 */
export default function OccasionWebsiteStatus({ productId, change }: { productId: number; change: OccasionChange }) {
  const [checks, setChecks] = useState<PageCheck[] | null>(null);
  const [polling, setPolling] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(change.refresh && !change.refresh.ok ? change.refresh.message : null);
  const [retrying, setRetrying] = useState(false);
  const run = useRef(0);

  const poll = (until: number) => {
    if (change.routes.length === 0) return;
    const id = ++run.current;
    setPolling(true);
    const tick = async () => {
      try {
        const response = await fetch(`/api/admin/products/${productId}/occasion-pages?routes=${change.routes.join(",")}`, { cache: "no-store" });
        const result = await response.json();
        if (id !== run.current) return;
        if (result.ok) setChecks(result.data.pages);
        if (result.ok && result.data.allOk) return setPolling(false);
      } catch {}
      if (id !== run.current) return;
      if (Date.now() < until) window.setTimeout(tick, POLL_MS);
      else setPolling(false);
    };
    tick();
  };

  useEffect(() => {
    setRefreshError(change.refresh && !change.refresh.ok ? change.refresh.message : null);
    setChecks(null);
    poll(Date.now() + (change.maxDelaySeconds + 30) * 1000);
    return () => {
      run.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [change]);

  const retry = async () => {
    setRetrying(true);
    setRefreshError(null);
    try {
      const response = await fetch("/api/admin/occasions/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ occasions: change.changed }),
      });
      const result = await response.json().catch(() => ({ ok: false, error: "The refresh request failed." }));
      if (!result.ok) setRefreshError(result.error || "The website refresh failed.");
    } catch {
      setRefreshError("The website refresh failed — check your connection.");
    } finally {
      setRetrying(false);
    }
    poll(Date.now() + (change.maxDelaySeconds + 30) * 1000);
  };

  if (!change.listed) {
    return (
      <p className="mt-2 text-[12px] text-[#77706F]" data-occasion-website="not-listed">
        Saved. No occasion page lists this product.
      </p>
    );
  }
  if (change.routes.length === 0) {
    return (
      <p className="mt-2 text-[12px] text-[#075838]" data-occasion-website="index-only">
        Saved. No occasion page lists this product for that occasion; occasion lists and counts update within moments.
      </p>
    );
  }

  const done = checks?.every((check) => check.ok) ?? false;
  const minutes = Math.ceil(change.maxDelaySeconds / 60);
  const tone = refreshError ? "error" : done ? "ok" : polling ? "info" : "warn";
  const colours = {
    ok: "bg-[#F3FAF6] text-[#075838]",
    info: "bg-[#F7F4F1] text-[#66565D]",
    warn: "bg-[#FFF7E8] text-[#7A5210]",
    error: "bg-[#FBEAEE] text-[#7C243E]",
  }[tone];
  const state = refreshError ? "refresh-failed" : done ? "live" : polling ? "updating" : "pending";

  return (
    <div className={`mt-2 rounded-lg px-3 py-2 text-[12px] ${colours}`} role="status" aria-live="polite" data-occasion-website={state}>
      {refreshError ? (
        <p>{refreshError}</p>
      ) : done ? (
        <p>On the website: {checks!.map((check) => `${label(check.route)} ${check.expected === "listed" ? "lists" : "no longer lists"} this bouquet`).join(" · ")}.</p>
      ) : polling ? (
        <p>Updating the occasion pages ({change.routes.map(label).join(", ")})… usually seconds, at most {minutes} minutes.</p>
      ) : (
        <p>The occasion pages haven't caught up yet. They update on their own within {minutes} minutes, or refresh now.</p>
      )}
      {(refreshError || (!done && !polling)) && (
        <button type="button" onClick={retry} disabled={retrying} data-occasion-retry className="mt-1 font-bold uppercase tracking-[0.1em] underline underline-offset-2 disabled:opacity-50">
          {retrying ? "Refreshing…" : "Refresh website"}
        </button>
      )}
    </div>
  );
}
