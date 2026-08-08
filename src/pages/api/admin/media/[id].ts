import type { APIRoute } from "astro";
import { MediaService } from "../../../../server/services/MediaService";
import { MEDIA_FOLDERS, type MediaFolder } from "../../../../server/db/repositories/MediaRepository";
import { json } from "../../../../server/http/json";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const media = await MediaService.get(id);
  if (!media) return json({ ok: false, error: "File not found." }, 404);

  const usage = await MediaService.getUsage(id);
  return json({ ok: true, data: { ...media, usage } });
};

/** Powers rename, alt-text edit and move (folder change) from the detail panel — one field per request. */
export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const body = await request.json().catch(() => ({}));

  if (typeof body.filename === "string") {
    const result = await MediaService.rename(id, body.filename);
    return json(result, result.ok ? 200 : 400);
  }
  if ("altText" in body) {
    const result = await MediaService.updateAltText(id, body.altText || null);
    return json(result, result.ok ? 200 : 400);
  }
  if (typeof body.folder === "string") {
    if (!MEDIA_FOLDERS.includes(body.folder as MediaFolder)) {
      return json({ ok: false, error: "Invalid folder." }, 400);
    }
    const result = await MediaService.move(id, body.folder as MediaFolder);
    return json(result, result.ok ? 200 : 400);
  }

  return json({ ok: false, error: "Nothing to update." }, 400);
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const result = await MediaService.remove(id);
  return json(result, result.ok ? 200 : 400);
};
