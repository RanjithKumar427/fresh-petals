import type { APIRoute } from "astro";
import { MediaService } from "../../../../server/services/MediaService";
import { MEDIA_FOLDERS, type MediaFolder } from "../../../../server/db/repositories/MediaRepository";
import { json } from "../../../../server/http/json";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const file = form.get("file");
  const folderRaw = String(form.get("folder") || "products");

  if (!(file instanceof File)) {
    return json({ ok: false, error: "No file provided." }, 400);
  }
  if (!MEDIA_FOLDERS.includes(folderRaw as MediaFolder)) {
    return json({ ok: false, error: "Invalid folder." }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const altTextRaw = form.get("altText");

  const result = await MediaService.upload({
    buffer,
    filename: file.name,
    mimeType: file.type,
    folder: folderRaw as MediaFolder,
    altText: altTextRaw ? String(altTextRaw) : null,
  });

  return json(result, result.ok ? 201 : 400);
};

export const GET: APIRoute = async ({ url }) => {
  const folder = url.searchParams.get("folder") as MediaFolder | null;
  const search = url.searchParams.get("search") ?? undefined;
  const unused = url.searchParams.get("unused") === "true";
  const media = await MediaService.list({ folder: folder ?? undefined, search, unused: unused || undefined });
  return json({ ok: true, data: media });
};
