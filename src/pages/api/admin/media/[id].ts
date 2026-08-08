import type { APIRoute } from "astro";
import { MediaService } from "../../../../server/services/MediaService";
import { json } from "../../../../server/http/json";

export const prerender = false;

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const result = MediaService.remove(id);
  return json(result, result.ok ? 200 : 400);
};
