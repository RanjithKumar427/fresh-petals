import { useCallback, useRef, useState } from "react";
import type { Media, MediaFolder } from "./types";

export type UploadItem = {
  id: string;
  file: File;
  folder: MediaFolder;
  progress: number;
  status: "uploading" | "done" | "error" | "canceled";
  error?: string;
  media?: Media;
};

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

function startUpload(
  file: File,
  folder: MediaFolder,
  onProgress: (percent: number) => void
): { xhr: XMLHttpRequest; promise: Promise<Media> } {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/admin/media");

  const promise = new Promise<Media>((resolve, reject) => {
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && result.ok) resolve(result.data);
        else reject(new Error(result.error || "Upload failed."));
      } catch {
        reject(new Error("Upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.onabort = () => reject(new Error("__cancelled__"));

    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    xhr.send(form);
  });

  return { xhr, promise };
}

/**
 * Manages a queue of concurrent uploads with real per-file progress, cancel
 * (aborts the in-flight XHR) and retry (re-runs the same file). Used by
 * both the upload modal and the standalone /admin/media/upload page.
 */
export function useMediaUpload(onUploaded: (media: Media) => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const xhrRefs = useRef<Map<string, XMLHttpRequest>>(new Map());

  const runUpload = useCallback(
    (id: string, file: File, folder: MediaFolder) => {
      const { xhr, promise } = startUpload(file, folder, (progress) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, progress } : item)));
      });
      xhrRefs.current.set(id, xhr);

      promise
        .then((media) => {
          setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "done", media } : item)));
          onUploaded(media);
        })
        .catch((error: Error) => {
          if (error.message === "__cancelled__") {
            setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "canceled" } : item)));
          } else {
            setItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, status: "error", error: error.message } : item))
            );
          }
        })
        .finally(() => xhrRefs.current.delete(id));
    },
    [onUploaded]
  );

  const addFiles = useCallback(
    (files: FileList | File[], folder: MediaFolder) => {
      const list = Array.from(files);

      for (const file of list) {
        const id = `${file.name}-${Date.now()}-${Math.random()}`;

        if (!file.type.startsWith("image/")) {
          setItems((prev) => [...prev, { id, file, folder, progress: 0, status: "error", error: "Not an image file." }]);
          continue;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setItems((prev) => [...prev, { id, file, folder, progress: 0, status: "error", error: "Larger than 8MB." }]);
          continue;
        }

        setItems((prev) => [...prev, { id, file, folder, progress: 0, status: "uploading" }]);
        runUpload(id, file, folder);
      }
    },
    [runUpload]
  );

  const cancel = useCallback((id: string) => {
    xhrRefs.current.get(id)?.abort();
  }, []);

  const retry = useCallback(
    (id: string) => {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "uploading", progress: 0, error: undefined } : item)));
      const item = items.find((entry) => entry.id === id);
      if (item) runUpload(id, item.file, item.folder);
    },
    [items, runUpload]
  );

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((item) => item.status === "uploading"));
  }, []);

  return { items, addFiles, cancel, retry, dismiss, clearFinished };
}
