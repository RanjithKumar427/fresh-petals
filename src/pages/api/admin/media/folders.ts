import type { APIRoute } from "astro";
import { MediaService } from "../../../../server/services/MediaService";
import { json } from "../../../../server/http/json";

export const prerender = false;

export const GET: APIRoute = async () => {
  const counts = await MediaService.countByFolder();
  return json({ ok: true, data: counts });
};
