export type UploadedMedia = {
  id: number;
  url: string;
  filename: string;
  sizeBytes: number;
};

/**
 * XHR rather than fetch() specifically because it's the one that exposes
 * real upload-progress events (fetch's request-body streaming isn't
 * consistently available across browsers yet) — everything else in the
 * admin uses plain fetch.
 */
export function uploadFile(
  file: File,
  folder: string,
  onProgress: (percent: number) => void
): Promise<UploadedMedia> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && result.ok) {
          resolve(result.data);
        } else {
          reject(new Error(result.error || "Upload failed."));
        }
      } catch {
        reject(new Error("Upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));

    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    xhr.send(form);
  });
}
