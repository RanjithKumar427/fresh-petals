// Public-site checks against the deployed staging Worker, GET only, no credentials:
// every sitemap URL (status, canonical, noindex, no analytics, title, description,
// structured data), redirects, 404s, WhatsApp links and the garland enquiry
// redirect, image delivery, robots.txt and security headers.
//
//   node scripts/staging/public-site.mjs [--out=<results.json>] [--require=<commit>]
//   node scripts/staging/public-site.mjs --production     (after cutover: https://onlyfreshpetals.in,
//        expects indexable pages and the analytics tag instead of noindex and no analytics)
import { writeFileSync } from "node:fs";
import { AUTH_ORIGIN } from "./deploy-lib.mjs";
import { parseArgs } from "./test-lib.mjs";

const args = parseArgs();
const PRODUCTION = !!args.production;
const WORKER = PRODUCTION ? "https://onlyfreshpetals.in" : AUTH_ORIGIN;
const CANONICAL = "https://onlyfreshpetals.in";
const WHATSAPP = "https://wa.me/919652012274";
const results = [];
const check = (area, name, ok, evidence = "") => {
  results.push({ area, name, status: ok ? "PASS" : "FAIL", evidence: String(evidence).slice(0, 400) });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${name}${evidence ? ` | ${String(evidence).slice(0, 200)}` : ""}`);
  return ok;
};
const get = async (path, init = {}) => {
  if (!path.startsWith("/")) throw new Error("path only");
  const r = await fetch(WORKER + path, { redirect: "manual", headers: { "user-agent": "fp-staging-public-site" }, signal: AbortSignal.timeout(30000), ...init });
  const type = r.headers.get("content-type") ?? "";
  const text = /text|xml|json|javascript/.test(type) ? await r.text() : (await r.arrayBuffer(), "");
  return { status: r.status, headers: r.headers, text, type, location: r.headers.get("location") ?? "" };
};
const stateText = (await get(`/_publish/state.json`)).text;
const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&#39;", "'").replaceAll("&quot;", '"');
const attr = (html, re) => decode(re.exec(html)?.[1] ?? "");

// Pages are static files now; the deployed build records its revision in /_publish/state.json.
const rev = (() => { try { return JSON.parse(stateText).revision ?? ""; } catch { return ""; } })();
console.log(`served revision ${rev || "(none)"}`);
if (args.require && !rev.startsWith(String(args.require).slice(0, 7))) { console.log(`STOP: served revision is not ${args.require}`); process.exit(2); }

// --- Sitemaps and every listed page ---
const robots = await get("/robots.txt");
const maps = [...robots.text.matchAll(/^Sitemap: (\S+)$/gm)].map((m) => m[1]);
check("seo", "robots.txt lists three sitemaps on the production domain", maps.length === 3 && maps.every((u) => u.startsWith(`${CANONICAL}/`)), maps.join(" "));
for (const rule of ["Disallow: /admin", "Disallow: /api", "Disallow: /categories/*?", "Disallow: /occasions/*?", "Disallow: /locations/*/shop?", "Disallow: /garland-enquiry"]) {
  if (!robots.text.includes(rule)) check("seo", `robots.txt has ${rule}`, false);
}
const pages = new Map();
const images = new Set();
for (const map of maps) {
  const xml = (await get(new URL(map).pathname)).text;
  for (const block of xml.split("<url>").slice(1)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1];
    if (loc) pages.set(loc, new URL(map).pathname);
    for (const m of block.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)) images.add(decode(m[1]));
  }
}
check("seo", "sitemaps list pages, all on the production domain", pages.size > 150 && [...pages.keys()].every((u) => u.startsWith(`${CANONICAL}/`)), `${pages.size} pages, ${images.size} images`);

const failures = { status: [], canonical: [], noindex: [], analytics: [], title: [], description: [], jsonld: [] };
let staticPages = 0, workerPages = 0;
const sample = { staticProduct: null, garland: null, city: null };
const urls = [...pages.keys()];
for (let i = 0; i < urls.length; i += 6) {
  await Promise.all(urls.slice(i, i + 6).map(async (loc) => {
    const path = new URL(loc).pathname;
    const r = await get(path);
    if (r.status !== 200) { failures.status.push(`${path} ${r.status}`); return; }
    if (r.headers.has("x-fp-edge-cache") || r.headers.has("x-fp-source-revision")) workerPages++; else staticPages++;
    const canonical = attr(r.text, /<link rel="canonical" href="([^"]+)"/);
    if (canonical !== loc) failures.canonical.push(`${path} → ${canonical || "none"}`);
    const robotsHeader = r.headers.get("x-robots-tag") ?? "";
    const robotsMeta = attr(r.text, /<meta name="robots" content="([^"]+)"/);
    if (!/noindex/.test(robotsHeader) && !/noindex/.test(robotsMeta)) failures.noindex.push(path);
    if (/G-[A-Z0-9]{6,}|googletagmanager\.com\/gtag|clarity\.ms/.test(r.text)) failures.analytics.push(path);
    if (!attr(r.text, /<title>([^<]+)<\/title>/).trim()) failures.title.push(path);
    if (!attr(r.text, /<meta name="description" content="([^"]+)"/).trim()) failures.description.push(path);
    for (const m of r.text.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch { failures.jsonld.push(path); } }
    if (!sample.staticProduct && /^\/products\//.test(path) && !r.headers.has("x-fp-edge-cache") && /wa\.me/.test(r.text)) sample.staticProduct = { path, html: r.text };
    if (!sample.garland && /^\/products\//.test(path) && /data-garland-version=/.test(r.text)) sample.garland = { path, html: r.text };
    if (!sample.city && /^\/locations\/[a-z-]+$/.test(path)) sample.city = { path, html: r.text };
  }));
}
check("seo", "every sitemap page answers 200", !failures.status.length, failures.status.slice(0, 5).join("; ") || `${urls.length} pages (${staticPages} static files, ${workerPages} rendered by the Worker)`);
check("static", "every sitemap page is a static file (no Worker run: no revision or edge-cache header)", workerPages === 0 && staticPages === urls.length - failures.status.length, `${staticPages} static, ${workerPages} via the Worker`);
check("seo", "every sitemap page's canonical is its own production URL", !failures.canonical.length, failures.canonical.slice(0, 5).join("; "));
// failures.noindex lists pages WITHOUT noindex; failures.analytics lists pages WITH the tag.
const okPages = urls.length - failures.status.length;
if (PRODUCTION) {
  check("production", "every sitemap page is indexable (no noindex header or meta)", failures.noindex.length === okPages, `${okPages - failures.noindex.length} noindexed`);
  check("production", "every sitemap page carries the analytics tag", failures.analytics.length === okPages, `${okPages - failures.analytics.length} without it`);
} else {
  check("staging", "every sitemap page is noindex on staging (header or meta)", !failures.noindex.length, failures.noindex.slice(0, 5).join("; "));
  check("staging", "no analytics ID or tag script on any page", !failures.analytics.length, failures.analytics.slice(0, 5).join("; "));
}
check("seo", "every page has a title and a meta description", !failures.title.length && !failures.description.length, [...failures.title, ...failures.description].slice(0, 5).join("; "));
check("seo", "every JSON-LD block parses", !failures.jsonld.length, failures.jsonld.slice(0, 5).join("; "));

// --- Redirects and 404s ---
const redirect = async (name, path, status, to) => {
  const r = await get(path);
  check("redirects", name, r.status === status && (typeof to === "string" ? r.location === to : to.test(r.location)), `${path} → ${r.status} ${r.location}`);
};
await redirect("/studio → bouquets (301)", "/studio", 301, "/categories/bouquets");
await redirect("/studio/<anything> → bouquets (301)", "/studio/old/page", 301, "/categories/bouquets");
await redirect("trailing slash → canonical form", "/faqs/", 307, /\/faqs$/);
// Old filter links and invented query strings get the same static file (no Worker run); the filter
// script moves a selection to the fragment address (checked in a browser by catalogue-lifecycle.mjs).
for (const path of ["/categories/bouquets?colour=red&utm_source=x", "/occasions/birthday?budget=under-1500", "/categories/garlands?x=zz", "/locations/hyderabad/shop?page=999&collection=nope", "/?ref_zz=1"]) {
  const r = await get(path);
  const canonical = attr(r.text, /<link rel="canonical" href="([^"]+)"/);
  check("static", `${path}: the page's own static file, canonical to its path, no Worker run`, r.status === 200 && !r.headers.has("x-fp-source-revision") && canonical === `${CANONICAL}${new URL(path, WORKER).pathname}`, `${r.status} ${canonical}`);
}
await redirect("city alias → canonical city (301)", "/locations/bangalore", 301, "/locations/bengaluru");
await redirect("city shop alias → canonical (301)", "/locations/bangalore/shop", 301, "/locations/bengaluru/shop");
for (const [path, copy] of [["/no-such-page-check", "This page isn't available"], ["/products/zz-no-such-product", "This garland design isn't on sale"], ["/products/jasmine-malli", "This product isn't on sale"], ["/locations/atlantis", "This page isn't available"], ["/occasions/no-such-occasion", "This page isn't available"], ["/categories/garlands/no-such-flower", "This page isn't available"]]) {
  const r = await get(path);
  check("404", `${path} answers 404, noindex, with the right page`, r.status === 404 && (/noindex/.test(r.headers.get("x-robots-tag") ?? "") || /noindex/.test(r.text)) && r.text.includes(copy), `${r.status}`);
}

// --- WhatsApp ---
const waLinks = (html) => [...html.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map((m) => decode(m[1]));
if (sample.staticProduct) {
  const links = waLinks(sample.staticProduct.html);
  const name = attr(sample.staticProduct.html, /<h1[^>]*>([^<]+)</).trim();
  const text = links.map((l) => new URL(l).searchParams.get("text") ?? "");
  check("whatsapp", "static product page: WhatsApp links go to the shop's number with the product named", links.length > 0 && links.every((l) => l.startsWith(`${WHATSAPP}?`)) && text.some((t) => name && t.includes(name)), `${sample.staticProduct.path}: ${links.length} link(s); "${text[0]?.slice(0, 90)}"`);
  check("whatsapp", "static product page: the draft carries the product's production URL", text.some((t) => t.includes(`${CANONICAL}${sample.staticProduct.path}`)), text[0]?.slice(0, 160));
} else check("whatsapp", "a static product page with WhatsApp links was found", false);
if (sample.garland) {
  const enquiry = [...sample.garland.html.matchAll(/href="(\/garland-enquiry\?[^"]+)"/g)].map((m) => decode(m[1]))[0];
  const code = enquiry ? new URL(enquiry, WORKER).searchParams.get("code") : null;
  check("whatsapp", "garland page: Enquire links to /garland-enquiry with its design code", !!enquiry && /^FP-G\d{3,}$/.test(code ?? ""), `${sample.garland.path}: ${enquiry}`);
  if (enquiry) {
    const r = await get(enquiry);
    const text = r.location.startsWith(WHATSAPP) ? new URL(r.location).searchParams.get("text") ?? "" : "";
    check("whatsapp", "garland enquiry: redirect (302) to the shop's WhatsApp, draft names the design code and page, no-store", r.status === 302 && text.includes(code) && text.includes(`${CANONICAL}${sample.garland.path}`) && /no-store/.test(r.headers.get("cache-control") ?? ""), `${r.status}; "${text.slice(0, 120)}"`);
    const q = await get(`/garland-enquiry?code=${code}&qty=3&city=bengaluru`);
    const t2 = q.location.startsWith(WHATSAPP) ? new URL(q.location).searchParams.get("text") ?? "" : "";
    check("whatsapp", "garland enquiry: quantity and delivery city are carried into the draft", /3/.test(t2) && /Bengaluru/.test(t2), t2.slice(0, 160));
  }
  const missing = await get("/garland-enquiry?code=FP-G99999");
  check("whatsapp", "garland enquiry for an unknown code: back to the garland list with a notice, never WhatsApp", missing.status === 303 && missing.location === "/categories/garlands?unavailable=FP-G99999", `${missing.status} ${missing.location}`);
  const notice = await get("/categories/garlands?unavailable=FP-G99999");
  check("whatsapp", "the garland list carries the unavailable-design notice, filled in the browser from ?unavailable=", notice.status === 200 && /data-garland-unavailable-notice hidden/.test(notice.text) && /data-garland-unavailable-code/.test(notice.text), `${notice.status}`);
} else check("whatsapp", "a public garland page was found", false);
if (sample.city) {
  const links = waLinks(sample.city.html);
  const city = attr(sample.city.html, /<h1[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, " ");
  check("whatsapp", "city page: WhatsApp links go to the shop's number", links.length > 0 && links.every((l) => l.startsWith(`${WHATSAPP}`)), `${sample.city.path}: ${links.length} link(s)`);
  check("whatsapp", "city page: drafts name the delivery city", links.some((l) => { const t = new URL(l).searchParams.get("text") ?? ""; const n = sample.city.path.split("/").pop(); return t.toLowerCase().includes(n.replace(/-/g, " ")); }), city.trim().slice(0, 60));
}

// --- Images ---
const garlandImage = sample.garland ? attr(sample.garland.html, /(\/_image\?href=[^"\s,]+)/) : "";
if (garlandImage) {
  const r = await get(garlandImage);
  check("images", "stored garland photo is delivered resized as WebP", r.status === 200 && /image\/webp/.test(r.type), `${r.status} ${r.type}`);
  const odd = garlandImage.replace(/([?&])w=\d+/, "$1w=333");
  const refused = await get(odd);
  check("images", "a width outside the four allowed is refused", refused.status >= 400, `${refused.status}`);
} else check("images", "a stored garland photo was found on a garland page", false);
const other = await get("/_image?href=https%3A%2F%2Fexample.com%2Fa.jpg&w=480&q=75&f=webp");
check("images", "the image endpoint refuses other hosts", other.status === 404, `${other.status}`);
const staticImages = [...images].filter((u) => u.startsWith(`${CANONICAL}/`) && !u.includes("/_image")).slice(0, 25);
const imageStatus = await Promise.all(staticImages.map(async (u) => (await get(new URL(u).pathname)).status));
check("images", "sitemap images on the site's own domain are served (sample of 25)", imageStatus.every((s) => s === 200), JSON.stringify(imageStatus.filter((s) => s !== 200)));

// --- Headers ---
for (const [kind, path] of [["static", "/faqs"], ["rendered", "/"]]) {
  const r = await get(path);
  const csp = r.headers.get("content-security-policy") ?? attr(r.text, /<meta http-equiv="content-security-policy" content="([^"]+)"/i);
  check("headers", `${kind} page: CSP, HSTS, nosniff and framing refused`, /script-src/.test(csp) && /max-age=\d+/.test(r.headers.get("strict-transport-security") ?? "") && r.headers.get("x-content-type-options") === "nosniff" && (r.headers.get("x-frame-options") === "DENY" || /frame-ancestors 'none'/.test(csp)), `${path}`);
}
const admin = await get("/admin/login");
check("headers", "admin login: noindex and not cacheable", /noindex/.test(admin.headers.get("x-robots-tag") ?? "") && /no-store|private/.test(admin.headers.get("cache-control") ?? ""), `${admin.status} ${admin.headers.get("cache-control")}`);

const failed = results.filter((r) => r.status === "FAIL").length;
console.log(`SUMMARY ${results.length - failed} PASS, ${failed} FAIL on ${rev}`);
if (args.out) writeFileSync(args.out, JSON.stringify({ worker: WORKER, revision: rev, at: new Date().toISOString(), results }, null, 2));
process.exit(failed ? 1 : 0);
