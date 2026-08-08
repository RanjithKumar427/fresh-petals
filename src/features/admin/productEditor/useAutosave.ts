import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 1200;

/**
 * Debounced autosave for one piece of state. Every change to `data`
 * schedules a save; `saveNow` flushes immediately (used by the explicit
 * "Save Draft" button and before navigating away). The status/lastSavedAt
 * pair is exactly what SaveStatus.tsx renders as "Saving… / Saved just
 * now / Save failed — Retry".
 */
export function useAutosave<T>(
  data: T,
  save: (data: T) => Promise<{ ok: boolean; error?: string }>,
  /** The record's own updatedAt, so a freshly-opened existing product shows "Saved 2h ago" instead of an alarming "Unsaved changes" before anything's been touched. */
  initialSavedAt?: Date | null
) {
  const [status, setStatus] = useState<SaveStatus>(initialSavedAt ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(initialSavedAt ?? null);

  const dataRef = useRef(data);
  dataRef.current = data;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const inFlight = useRef(false);

  const runSave = useCallback(async () => {
    if (inFlight.current) return; // a save is already running; the next scheduled tick will pick up latest data
    inFlight.current = true;
    setStatus("saving");
    setError(null);

    try {
      const result = await save(dataRef.current);
      if (result.ok) {
        setStatus("saved");
        setLastSavedAt(new Date());
      } else {
        setStatus("error");
        setError(result.error || "Save failed.");
      }
    } catch {
      setStatus("error");
      setError("Save failed. Check your connection.");
    } finally {
      inFlight.current = false;
    }
  }, [save]);

  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    return runSave();
  }, [runSave]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setStatus((current) => (current === "saving" ? current : "idle"));
    if (timerRef.current) clearTimeout(timerRef.current);
    // Null the ref out the moment the timer actually fires — otherwise it
    // keeps holding a stale (already-fired) timeout id forever, which made
    // the beforeunload guard below think there was permanently-unsaved
    // work even right after a successful save.
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      runSave();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Warn before leaving the tab while a save is pending or has failed —
  // a clean "Saved just now" state never blocks navigation.
  useEffect(() => {
    const hasUnsavedWork = timerRef.current !== null || status === "saving" || status === "error";
    if (!hasUnsavedWork) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  return { status, error, lastSavedAt, saveNow };
}
