import type { APIRoute } from "astro";
import { findGarlandByCode } from "../data/garlands";
import { formatGarlandPrice, optionValues } from "../data/garlandRules";
import { whatsappLink } from "../config/storefront";
import { garlandEnquiryText } from "../utils/garlandEnquiry";
import { OCCASION_JOURNEYS } from "../data/occasionJourneys";

// The live enquiry check behind every garland "Enquire / Ask for a quote on
// WhatsApp" button. Never cached: it reads the database at the moment of the
// enquiry, so an unpublished garland can't be enquired about even from a page
// a cache is still holding. The WhatsApp message is built here from the saved
// details (title, listed price, sold unit), using only option choices that
// exist for the design. No price is multiplied into a total.
export const prerender = false;

const NO_STORE = { "cache-control": "no-store", "x-robots-tag": "noindex" };

export const GET: APIRoute = async ({ url, site, redirect }) => {
  const code = (url.searchParams.get("code") ?? "").trim().toUpperCase();
  const garland = /^FP-G\d{3,}$/.test(code) ? await findGarlandByCode(code) : null;

  if (!garland) {
    const back = new URL("/categories/garlands", url);
    if (code) back.searchParams.set("unavailable", code);
    return new Response(null, { status: 303, headers: { ...NO_STORE, location: back.pathname + back.search } });
  }

  const design = garland.garland;
  const quantity = Math.min(500, Math.max(1, Math.floor(Number(url.searchParams.get("qty"))) || 1));
  const known = new Map<string, { option: string; value: ReturnType<typeof optionValues>[number] }>(
    design.options.flatMap((option) => optionValues(option).map((value) => [`${option.label}::${value.label}`, { option: option.label, value }] as const))
  );
  const chosen = url.searchParams
    .getAll("opt")
    .map((raw) => known.get(raw))
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    .map(({ option, value }) => `${option}: ${value.label}${value.extraCharge ? ` (+₹${value.extraCharge.toLocaleString("en-IN")})` : ""}`);

  const pageUrl = new URL(`/products/${garland.slug}`, site ?? url).toString();
  // Occasion and intent from the page the shopper came from — only known
  // values are used; anything else is ignored.
  const journey = OCCASION_JOURNEYS[url.searchParams.get("occ") ?? ""];
  const intent = url.searchParams.get("for");
  const purpose = intent === "ceremony" || intent === "gift" ? (journey?.intents?.[intent] ?? (intent === "gift" ? "A gift" : "The ceremony")) : null;
  const text = garlandEnquiryText({
    code: design.code,
    title: design.title,
    price: formatGarlandPrice(design),
    unit: design.soldUnit,
    quantity,
    options: [...new Set(chosen)],
    url: pageUrl,
    occasion: journey?.label ?? null,
    purpose,
  });
  const response = redirect(whatsappLink(text), 302);
  for (const [k, v] of Object.entries(NO_STORE)) response.headers.set(k, v);
  return response;
};
