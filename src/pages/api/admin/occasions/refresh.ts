import type { APIRoute } from "astro";
import { json } from "../../../../server/http/json";
import { refreshOccasionPages } from "../../../../server/services/OccasionWebsite";
import { OCCASION_PAGES } from "../../../../data/occasionPages";

export const prerender = false;

const KNOWN = new Set([...OCCASION_PAGES.map((page) => page.slug), "pooja"]);

/** "Refresh website" after an occasion change: retries the purge for those occasions (or all occasion pages). */
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const occasions = Array.isArray(body?.occasions) ? body.occasions.filter((slug: unknown): slug is string => typeof slug === "string" && KNOWN.has(slug)) : null;
  const data = await refreshOccasionPages(occasions);
  return json({ ok: data.ok, data, ...(data.ok ? {} : { error: data.message }) }, data.ok ? 200 : 502);
};
