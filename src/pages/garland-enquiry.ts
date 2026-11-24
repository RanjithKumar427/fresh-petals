import type { APIRoute } from "astro";
import { findGarlandForEnquiry } from "../data/garlands";
import { optionValues } from "../data/garlandRules";
import { whatsappLink } from "../config/storefront";
import { GARLAND_ENQUIRY_PATH, garlandEnquiryText } from "../utils/garlandEnquiry";
import { OCCASION_JOURNEYS } from "../data/occasionJourneys";
import { CITY_PARAM, citiesByRegion, cityName, normalizeCity } from "../data/serviceCities";

// The live enquiry check behind every garland "Enquire / Ask for a quote on
// WhatsApp" button. Never cached: it reads the database at the moment of the
// enquiry, so an unpublished garland can't be enquired about even from a page
// a cache is still holding. The WhatsApp message is built here from the saved
// details (title, sold unit), using only option choices that exist for the
// design. Garlands are quote-only: the message carries no amount.
//
// A product enquiry needs a recipient city the customer chose
// (src/utils/productEnquiry.ts). With scripts, the page's link already
// carries it; a request without a known city (no scripts, an old or copied
// link) gets a small page asking for it, never a WhatsApp draft without one
// and never a city picked for the customer.
export const prerender = false;

const NO_STORE = { "cache-control": "no-store", "x-robots-tag": "noindex" };

export const GET: APIRoute = async ({ url, site, redirect }) => {
  const code = (url.searchParams.get("code") ?? "").trim().toUpperCase();
  // Reads only the requested design (src/data/garlands.ts findGarlandForEnquiry).
  const design = /^FP-G\d{3,}$/.test(code) ? await findGarlandForEnquiry(code) : null;

  if (!design) {
    const back = new URL("/categories/garlands", url);
    if (code) back.searchParams.set("unavailable", code);
    return new Response(null, { status: 303, headers: { ...NO_STORE, location: back.pathname + back.search } });
  }

  const quantity = Math.min(500, Math.max(1, Math.floor(Number(url.searchParams.get("qty"))) || 1));
  const known = new Map<string, { option: string; value: ReturnType<typeof optionValues>[number] }>(
    design.options.flatMap((option) => optionValues(option).map((value) => [`${option.label}::${value.label}`, { option: option.label, value }] as const))
  );
  const chosen = url.searchParams
    .getAll("opt")
    .map((raw) => known.get(raw))
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    .map(({ option, value }) => `${option}: ${value.label}`);

  const city = normalizeCity(url.searchParams.get(CITY_PARAM));
  if (!city) return cityStep(url, design, url.searchParams.has(CITY_PARAM));

  const pageUrl = new URL(`/products/${design.slug}`, site ?? url).toString();
  // Occasion and intent from the page the shopper came from — only known
  // values are used; anything else is ignored.
  const journey = OCCASION_JOURNEYS[url.searchParams.get("occ") ?? ""];
  const intent = url.searchParams.get("for");
  const purpose = intent === "ceremony" || intent === "gift" ? (journey?.intents?.[intent] ?? (intent === "gift" ? "A gift" : "The ceremony")) : null;
  const text = garlandEnquiryText({
    code: design.code,
    title: design.title,
    unit: design.soldUnit,
    quantity,
    options: [...new Set(chosen)],
    url: pageUrl,
    occasion: journey?.label ?? null,
    purpose,
    // The chosen city, from the registry: named once.
    city: cityName(city),
  });
  const response = redirect(whatsappLink(text), 302);
  for (const [k, v] of Object.entries(NO_STORE)) response.headers.set(k, v);
  return response;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * The city step: a plain form (no scripts) that sends the same request back
 * with the chosen city. Every other answer the customer gave is kept as it
 * was. Nothing is preselected; an unknown city is reported.
 */
function cityStep(url: URL, design: { code: string; title: string; slug: string }, invalid: boolean): Response {
  const kept = [...url.searchParams].filter(([name]) => name !== CITY_PARAM);
  const hidden = kept.map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`).join("");
  const options = citiesByRegion()
    .map((region) => `<optgroup label="${escapeHtml(region.label)}">${region.cities.map((city) => `<option value="${city.slug}">${escapeHtml(city.name)}</option>`).join("")}</optgroup>`)
    .join("");
  const error = invalid ? `<p id="city-error" class="error" role="alert">That city is not one we deliver to. Choose the recipient city from the list.</p>` : "";
  const html = `<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Choose the recipient city | Fresh Petals</title>
<style>body{margin:0;font:16px/1.6 system-ui,sans-serif;color:#1c251f;background:#faf6ef}main{max-width:28rem;margin:0 auto;padding:2rem 1.25rem}h1{font:400 1.75rem/1.2 Georgia,serif;margin:0 0 .5rem}label{display:block;margin-top:1.25rem;font-size:.75rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#8a3f56}select{width:100%;min-height:48px;margin-top:.4rem;border:1px solid #cfc8bb;border-radius:999px;background:#fff;padding:.5rem 1rem;font-size:1rem}select[aria-invalid=true]{border-color:#8a3f56}button{margin-top:1.25rem;min-height:48px;width:100%;border:0;border-radius:999px;background:#8a3f56;color:#fff;font-weight:700;font-size:.9rem;cursor:pointer}.error{margin:.5rem 0 0;font-weight:600;color:#6f2f43}a{color:#1c251f}</style>
</head><body><main>
<h1>Where are the flowers going?</h1>
<p>Choose the recipient city for your enquiry about <strong>${escapeHtml(design.code)} — ${escapeHtml(design.title)}</strong>. We add it to your WhatsApp message and confirm availability and delivery for that city.</p>
<form method="get" action="${GARLAND_ENQUIRY_PATH}">${hidden}
<label for="city">Recipient city</label>
<select id="city" name="${CITY_PARAM}" required${invalid ? ' aria-invalid="true" aria-describedby="city-error"' : ""}><option value="">Choose a city</option>${options}</select>
${error}
<button type="submit">Continue to WhatsApp</button>
</form>
<p><a href="/products/${escapeHtml(design.slug)}">Back to the design</a></p>
</main></body></html>`;
  return new Response(html, { status: invalid ? 400 : 200, headers: { ...NO_STORE, "content-type": "text/html; charset=utf-8" } });
}
