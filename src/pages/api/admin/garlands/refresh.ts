import type { APIRoute } from "astro";
import { json } from "../../../../server/http/json";
import { refreshGarlandPages } from "../../../../server/services/GarlandWebsite";

export const prerender = false;

/** "Refresh website" in the garland editor: retries clearing the cached garland pages. */
export const POST: APIRoute = async () => {
  const data = await refreshGarlandPages();
  return json({ ok: data.ok, data, ...(data.ok ? {} : { error: data.message }) }, data.ok ? 200 : 502);
};
