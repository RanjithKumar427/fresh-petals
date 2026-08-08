import type { APIRoute } from "astro";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOADS_ROOT } from "../../server/db/paths.mjs";

export const prerender = false;

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// Serves everything under the project-root /uploads folder. Deliberately a
// plain streaming endpoint rather than relying on Astro's static-file
// pipeline: files land here at runtime (after the build already ran), and
// public/ is only copied into dist/client at build time — this route reads
// from disk on every request instead, so uploads work identically in dev,
// preview and any production host regardless of adapter.
export const GET: APIRoute = async ({ params }) => {
  const requested = params.path ?? "";

  // Reject any attempt to escape UPLOADS_ROOT via ../ segments before
  // touching the filesystem.
  const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(UPLOADS_ROOT, normalized);
  if (!fullPath.startsWith(UPLOADS_ROOT)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const file = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    return new Response(file, {
      headers: {
        "content-type": CONTENT_TYPE_BY_EXT[ext] || "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};
