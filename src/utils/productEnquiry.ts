// The one gate in front of every product WhatsApp enquiry (cards, product
// pages, related products, guides, city pages, saved items, the basket).
//
// A product enquiry needs a recipient city the customer chose
// (src/utils/destination.ts): never a default, never the city of the page.
// Without one, the enquiry does not open: the nearest Recipient city
// selector on the page is marked invalid, explained and focused; where the
// page has no selector, a small city step (RecipientCityStep.astro) asks
// first and then continues the same enquiry. While the page is about a
// different city than the one chosen, the customer settles that first.
//
// Links opt in with data-product-enquiry (links to /garland-enquiry and
// WhatsApp drafts that link to a product page are caught too) and are checked when activated
// (click, keyboard, middle click), before any other listener, so a blocked
// enquiry never reaches the analytics listener. Their server-rendered href
// never opens WhatsApp without a city: it leads to the product page or to
// /garland-enquiry, which asks for the city itself. On activation the href
// becomes the WhatsApp draft with the city line written once
// (src/utils/recipientCityLine.ts):
//   data-enquiry-text="…"   a draft built by the page, without a city line
//   href="/garland-enquiry?…"   the live garland check; the city is added as ?city=
// Scripted enquiries (the product page buttons, the basket) call
// requireRecipientCity() / productEnquiryHref() directly.
import { whatsappLink } from "../config/storefront";
import { CITY_PARAM } from "../data/serviceCities";
import { DESTINATION_UPDATED_EVENT, browsingCity, cityName, getDestination } from "./destination";
import { withRecipientCity } from "./recipientCityLine";

export const CITY_REQUIRED_MESSAGE = "Choose the recipient city to send this enquiry.";
const CONFLICT_MESSAGE = "This page is about a different city from the one you chose. Choose where the order is going.";

// The page is about one city and another was chosen: until the customer
// answers (keeps their city, switches, or picks again), enquiries wait.
let conflictSettled = false;
export function settleCityConflict(): void {
  conflictSettled = true;
}
export function cityConflict(): boolean {
  const browsing = browsingCity();
  const chosen = getDestination();
  return !conflictSettled && Boolean(browsing && chosen && browsing !== chosen);
}

/** The chosen recipient city (slug), or null when an enquiry must not open yet. */
export function enquiryCity(): string | null {
  return cityConflict() ? null : getDestination();
}

const visible = (element: Element) => (element as HTMLElement).getClientRects().length > 0 && !element.closest("[hidden], dialog:not([open])");

/** The selector to point at: in the same enquiry panel if there is one, else the first one on screen. */
function selectorFor(origin: Element | null | undefined): HTMLElement | null {
  const scope = origin?.closest("[data-enquiry-scope]");
  const inScope = scope ? [...scope.querySelectorAll<HTMLElement>("[data-destination-control]")].find(visible) : undefined;
  if (inScope) return inScope;
  return [...document.querySelectorAll<HTMLElement>("[data-destination-control]")].find((control) => visible(control) && !control.closest("[data-city-step]")) ?? null;
}

/** Marks a selector invalid with a spoken, visible message, and focuses what answers it. */
export function flagSelector(control: HTMLElement, message: string): void {
  const select = control.querySelector<HTMLSelectElement>("[data-destination-select]");
  const error = control.querySelector<HTMLElement>("[data-destination-error]");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  control.classList.add("is-invalid");
  if (select) {
    select.setAttribute("aria-invalid", "true");
    if (error?.id && !(select.getAttribute("aria-describedby") ?? "").split(" ").includes(error.id)) {
      select.setAttribute("aria-describedby", `${error.id} ${select.getAttribute("aria-describedby") ?? ""}`.trim());
    }
  }
  const ask = control.querySelector<HTMLElement>("[data-destination-conflict]:not([hidden]) button");
  const target = ask ?? select;
  control.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  target?.focus({ preventScroll: true });
}

function clearFlags(): void {
  document.querySelectorAll<HTMLElement>("[data-destination-control].is-invalid").forEach((control) => {
    control.classList.remove("is-invalid");
    control.querySelector("[data-destination-select]")?.removeAttribute("aria-invalid");
    const error = control.querySelector<HTMLElement>("[data-destination-error]");
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }
  });
}

type Resume = () => void;
let resumeAfterStep: Resume | null = null;

/** Opens the city step (pages without a selector of their own). */
function openCityStep(resume: Resume | null): boolean {
  const dialog = document.querySelector<HTMLDialogElement>("[data-city-step]");
  if (!dialog || typeof dialog.showModal !== "function") return false;
  resumeAfterStep = resume;
  if (!dialog.open) dialog.showModal();
  const control = dialog.querySelector<HTMLElement>("[data-destination-control]");
  if (control) flagSelector(control, cityConflict() ? CONFLICT_MESSAGE : CITY_REQUIRED_MESSAGE);
  return true;
}

/**
 * The chosen city's slug, or null after asking for one. `resume` runs once
 * a city is chosen in the city step (not after an on-page selector: the
 * customer sends the enquiry again from where they were).
 */
export function requireRecipientCity(origin?: Element | null, resume?: Resume): string | null {
  const city = enquiryCity();
  if (city) return city;
  const message = cityConflict() ? CONFLICT_MESSAGE : CITY_REQUIRED_MESSAGE;
  const control = selectorFor(origin);
  if (control) flagSelector(control, message);
  else if (!openCityStep(resume ?? null)) window.alert?.(message);
  return null;
}

/** A WhatsApp link for a draft, with the chosen city's line written once. */
export function productEnquiryHref(draft: string, city: string): string {
  return whatsappLink(withRecipientCity(draft, cityName(city) ?? city));
}

/** The address an enquiry link opens for this city. */
function linkFor(link: HTMLAnchorElement, city: string): string {
  if (link.dataset.enquiryText !== undefined) return productEnquiryHref(link.dataset.enquiryText, city);
  const url = new URL(link.href, location.href);
  if (url.origin === location.origin) {
    url.searchParams.set(CITY_PARAM, city);
    return url.pathname + url.search;
  }
  if (/^(wa\.me|api\.whatsapp\.com)$/.test(url.hostname)) return productEnquiryHref(url.searchParams.get("text") ?? "", city);
  return link.href;
}

/**
 * Whether a link is a product enquiry. Besides links that say so, any link
 * to the garland check and any WhatsApp draft that links to a product page
 * counts, so a component added later cannot skip the city by accident.
 */
export function isProductEnquiryLink(link: HTMLAnchorElement): boolean {
  if (link.matches("[data-product-enquiry], [data-garland-quote], [data-whatsapp-order-link]")) return true;
  let url: URL;
  try {
    url = new URL(link.href, location.href);
  } catch {
    return false;
  }
  if (url.origin === location.origin) return /^\/garland-enquiry\/?$/.test(url.pathname);
  return /^(wa\.me|api\.whatsapp\.com)$/.test(url.hostname) && /\/products\//.test(url.searchParams.get("text") ?? "");
}

function onActivate(event: MouseEvent): void {
  if (event.type === "auxclick" && event.button !== 1) return;
  const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
  if (!link || !isProductEnquiryLink(link)) return;
  const city = enquiryCity();
  if (!city) {
    // Stops here: no WhatsApp, no navigation, and no other listener (analytics included) sees it.
    event.preventDefault();
    event.stopImmediatePropagation();
    requireRecipientCity(link, () => link.click());
    return;
  }
  link.href = linkFor(link, city);
  // The fallback href stays on this site; WhatsApp opens in a new tab, as before.
  if (link.target !== "_blank") {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
}

if (typeof window !== "undefined" && !(window as Window & { __fpProductEnquiry?: boolean }).__fpProductEnquiry) {
  (window as Window & { __fpProductEnquiry?: boolean }).__fpProductEnquiry = true;
  window.addEventListener("click", onActivate, true);
  window.addEventListener("auxclick", onActivate, true);

  // A choice made: the error goes, and a city step that was waiting continues the enquiry.
  window.addEventListener(DESTINATION_UPDATED_EVENT, () => {
    if (!getDestination()) return;
    settleCityConflict();
    clearFlags();
  });

  // For the basket's script (an inline script, not a module).
  (window as Window & { fpProductEnquiry?: unknown }).fpProductEnquiry = { requireRecipientCity, productEnquiryHref, enquiryCity };

  document.addEventListener("fresh-petals-city-step-continue", () => {
    const resume = resumeAfterStep;
    resumeAfterStep = null;
    resume?.();
  });
  document.addEventListener("fresh-petals-city-step-cancel", () => {
    resumeAfterStep = null;
  });
}
