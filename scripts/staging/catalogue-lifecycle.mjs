#!/usr/bin/env node
// Staging catalogue, media and enquiry lifecycle through the deployed admin and public pages.
//
//   node scripts/staging/catalogue-lifecycle.mjs --env=<staging env file> [--deploy] [--playwright=<playwright-core index.mjs>] [--out=<results.json>]
//
// With FP_STAGING_INQUIRY_TEST_KEY in this process's environment (the same value as the Worker
// secret of that name), it also tests enquiry persistence; without it that section is NOT RUN.
// --deploy runs scripts/staging/deploy-worker.mjs --apply mid-run, so the catalogue snapshot (which
// decides what catalogue products are public) is taken while the synthetic product is published.
//
// Everything it creates carries the fp-staging-test- prefix and is removed in `finally`:
//   one synthetic approved admin and its test-only factor; one dashboard-created catalogue product;
//   one synthetic garland (inserted as scripts/seed-garlands.mjs would, because the admin cannot
//   create garlands); four uploaded images and their Storage objects; one enquiry.
// Afterwards every pre-existing row, Storage object and Auth user must match its digest.
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { STAGING_ORIGIN } from "./guard.mjs";
import {
  ROOT, WORKER, FORM, JSON_HEADERS, SYNTHETIC_PREFIX, form, sleep, tag, scrub, parseArgs, startRun, servedRevision,
  freshCode, snapshot, compareSnapshots, syntheticIdentities, enrolFactor, jarClient,
} from "./test-lib.mjs";

const sharp = createRequire(import.meta.url)("sharp");
const args = parseArgs();
const run = startRun({ envFile: args.env, deadlineMinutes: 40 });
const { log, check, due, guarded, q, service, w, sdkFor } = run;
const REQUIRED = args.require || "dc20dc91d3c529a5238ec0f234d60c37e85fa7ca"; // the controlled enquiry gate
const INQUIRY_KEY = process.env.FP_STAGING_INQUIRY_TEST_KEY ?? "";
const CANONICAL = "https://onlyfreshpetals.in";

const rev = await servedRevision(guarded, REQUIRED);
if (!rev.ok) { console.log(`STOP: the served revision does not contain ${REQUIRED.slice(0, 7)}; nothing was created`); process.exit(2); }
log("deployed revision", rev.served.slice(0, 7));
const before = await snapshot(q);
log("baseline", JSON.stringify({ tables: Object.keys(before.tables).length, objects: before.storage.n, auth: before.auth }));

const ids = syntheticIdentities({ q, service, check, log });
const run_ = tag();
const made = { products: [], media: [], inquiries: [], garlandProductId: null };
const uploadedPaths = [];
const body = (r) => { try { return JSON.parse(r.text); } catch { return {}; } };
const storageObject = async (path) => (await q(`select count(*)::int n from storage.objects where bucket_id='media' and name=$1`, [path]))[0].n;
const image = (r, g, b) => sharp({ create: { width: 900, height: 900, channels: 3, background: { r, g, b } } }).png().toBuffer();

let s; // the admin's signed-in jar
async function upload(label, buffer, mime = "image/png", name = `${SYNTHETIC_PREFIX}${label}-${run_}.png`) {
  const fd = new FormData();
  fd.set("file", new Blob([buffer], { type: mime }), name);
  fd.set("folder", "products");
  fd.set("altText", `${SYNTHETIC_PREFIX}${label}`);
  const r = await w("POST", "/api/admin/media", { jar: s, headers: { origin: WORKER }, body: fd, store: false });
  const j = body(r);
  if (j.ok && j.data?.id) { made.media.push({ id: j.data.id, path: j.data.path }); uploadedPaths.push(j.data.path); }
  return { r, j };
}
const publicGet = (path) => w("GET", path, {}); // no cookies: what a visitor sees
// A new query string is its own edge-cache key, so this is what the Worker renders right now.
const fresh = (path) => publicGet(`${path}${path.includes("?") ? "&" : "?"}fp_fresh=${tag()}`);
// workers.dev has no zone to purge, so the cached public URL changes only when its s-maxage (120 s) runs out.
const CACHE_BOUND_MS = 150000;
async function eventually(path, test) {
  const start = Date.now();
  for (;;) {
    const r = await publicGet(path);
    if (test(r)) return { ok: true, seconds: Math.round((Date.now() - start) / 1000), cache: r.headers.get("x-fp-edge-cache") ?? "" };
    if (Date.now() - start > CACHE_BOUND_MS) return { ok: false, seconds: Math.round((Date.now() - start) / 1000), cache: r.headers.get("x-fp-edge-cache") ?? "" };
    await sleep(10000);
  }
}
const cardFor = (html, slug) => { const i = html.indexOf(`href="/products/${slug}"`); if (i < 0) return null; const open = html.lastIndexOf('data-garland-filters="', i); return open < 0 ? null : html.slice(open + 22, html.indexOf('"', open + 22)); };

try {
  // ------------------------------------------------------------------ admin session through the deployed pages
  const admin = await ids.create({ approved: true, label: "catalogue" });
  await enrolFactor({ sdk: jarClient(sdkFor).sdk, user: admin, due });
  s = new Map();
  await sleep(2500);
  const login = await w("POST", "/api/admin/auth/login", { jar: s, headers: FORM, body: form({ email: admin.email, password: admin.password }) });
  const mfa = await w("POST", "/admin/mfa", { jar: s, headers: FORM, body: form({ action: "verify", code: await freshCode(admin.secret, due) }) });
  const ready = await w("GET", "/api/admin/products", { jar: s, store: false });
  if (login.to !== "/admin/mfa" || mfa.to !== "/admin/dashboard" || ready.status !== 200) throw new Error(`admin sign-in failed: ${login.status} ${login.to}; ${mfa.status} ${mfa.to}; ${ready.status}`);
  check("setup", "synthetic admin signed in through the deployed pages at aal2", true);

  // ------------------------------------------------------------------ uploads: validation, storage and public URL
  const imgA = await image(200, 40, 80), imgB = await image(40, 120, 200), imgC = await image(230, 180, 40), imgD = await image(60, 160, 90);
  const notImage = await w("POST", "/api/admin/media", { jar: s, headers: { origin: WORKER }, body: (() => { const fd = new FormData(); fd.set("file", new Blob([Buffer.from("<svg onload=alert(1)>")], { type: "image/png" }), `${SYNTHETIC_PREFIX}x.png`); fd.set("folder", "products"); return fd; })(), store: false });
  check("media", "upload of a file that is not an image is refused, nothing stored", notImage.status === 400 && !body(notImage).ok, `${notImage.status} ${scrub(body(notImage).error ?? "")}`);
  const A = await upload("a", imgA);
  const aOk = A.r.status === 201 && A.j.ok && !!A.j.data.path && (await storageObject(A.j.data.path)) === 1;
  check("media", "image upload: 201, media row, Storage object present", aOk, `${A.r.status} ${A.j.ok ? `${A.j.data.width}x${A.j.data.height} ${A.j.data.mimeType}` : scrub(A.j.error ?? A.r.text.slice(0, 120))}`);
  if (!aOk) throw new Error("upload failed; stopping before product work");
  const aUrl = new URL(A.j.data.url);
  const aPublic = aUrl.origin === STAGING_ORIGIN ? await guarded(aUrl.href) : null;
  check("media", "uploaded image is served from staging Storage as an image", !!aPublic && aPublic.status === 200 && /^image\//.test(aPublic.headers.get("content-type") ?? ""), `${aUrl.origin === STAGING_ORIGIN ? "staging" : "other"} origin; ${aPublic?.status} ${aPublic?.headers.get("content-type")}`);

  // ------------------------------------------------------------------ catalogue product: create, edit, replace image, publish
  const created = await w("POST", "/admin/products/new", { jar: s, headers: FORM, body: "" });
  const productId = Number((created.location.match(/\/admin\/products\/edit\/(\d+)/) ?? [])[1]);
  if (productId) made.products.push(productId);
  const [draft] = productId ? await q(`select name, status::text status, slug from products where id=$1`, [productId]) : [];
  check("product", "'Create draft product' makes a hidden draft and opens its editor", created.status === 303 && !!draft && draft.status === "draft" && draft.name === "Untitled Product", `${created.status} ${created.to.replace(/\d+$/, "<id>")}`);
  if (!draft) throw new Error("draft not created");
  const editor = await w("GET", `/admin/products/edit/${productId}`, { jar: s, store: false });
  check("product", "editor page renders for the draft", editor.status === 200 && editor.text.includes("Untitled Product"), String(editor.status));
  const blocked = await w("POST", `/api/admin/products/${productId}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "published" }), store: false });
  check("product", "publishing an incomplete draft is refused with the reasons", blocked.status === 400 && /name|image|belongs/i.test(body(blocked).error ?? ""), `${blocked.status}`);

  const slug = `${SYNTHETIC_PREFIX}product-${run_}`;
  const name = `${SYNTHETIC_PREFIX}Catalogue ${run_}`;
  const fields = (images, overrides = {}) => ({ name, slug, shortDescription: "Synthetic staging test product", description: null, images, priceType: "fixed", sellingPrice: 1999, compareAtPrice: null, costPrice: null, deliveryChargeOverride: null, categoryId: 3, occasionIds: [], moodIds: [], flowerTypeIds: [], whatsIncluded: [], careInstructions: [], status: "draft", featured: false, bestseller: false, newArrival: false, requiresWhatsappConfirmation: true, ...overrides });
  const edit = await w("PATCH", `/api/admin/products/${productId}`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify(fields([{ mediaId: A.j.data.id, sortOrder: 0, isPrimary: true, altText: null }])), store: false });
  const [afterEdit] = await q(`select p.name, p.slug, p.selling_price, p.category_id, (select string_agg(media_id::text, ',') from product_images where product_id=p.id) imgs from products p where p.id=$1`, [productId]);
  check("product", "edit saves name, slug, price, category and image", edit.status === 200 && afterEdit.name === name && afterEdit.slug === slug && afterEdit.selling_price === 1999 && afterEdit.category_id === 3 && afterEdit.imgs === String(A.j.data.id), `${edit.status}`);
  const B = await upload("b", imgB);
  const replace = await w("PATCH", `/api/admin/products/${productId}`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify(fields([{ mediaId: B.j.data.id, sortOrder: 0, isPrimary: true, altText: null }])), store: false });
  const [afterReplace] = await q(`select (select string_agg(media_id::text, ',') from product_images where product_id=$1) imgs`, [productId]);
  check("product", "image replacement: the product now uses only the new image", replace.status === 200 && afterReplace.imgs === String(B.j.data.id), `${replace.status}`);
  const usage = body(await w("GET", `/api/admin/media/${A.j.data.id}`, { jar: s, store: false })).data?.usage;
  const removeA = await w("DELETE", `/api/admin/media/${A.j.data.id}`, { jar: s, headers: { origin: WORKER }, store: false });
  await sleep(2000);
  const aGone = (await q(`select count(*)::int n from media where id=$1`, [A.j.data.id]))[0].n === 0;
  const aObject = await storageObject(A.j.data.path);
  check("media", "the replaced image, no longer used, is deleted: media row removed", removeA.status === 200 && aGone, `${removeA.status}; usage before ${JSON.stringify(usage ?? null)}`);
  check("media", "deleting an image also removes its Storage object", aObject === 0, `objects left ${aObject}`);
  if (aObject === 0 && aGone) made.media = made.media.filter((m) => m.id !== A.j.data.id);
  const inUse = await w("DELETE", `/api/admin/media/${B.j.data.id}`, { jar: s, headers: { origin: WORKER }, store: false });
  check("media", "an image in use cannot be deleted", inUse.status === 400 && (await storageObject(B.j.data.path)) === 1, String(inUse.status));

  const publish = await w("POST", `/api/admin/products/${productId}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "published" }), store: false });
  const listed = body(await w("GET", `/api/admin/products?search=${encodeURIComponent(run_)}`, { jar: s, store: false })).data ?? [];
  check("product", "publish accepted; the admin list shows it published", publish.status === 200 && listed.some((p) => p.id === productId && p.status === "published"), `${publish.status}; ${listed.length} listed`);

  // ------------------------------------------------------------------ catalogue publishing: the deployment snapshot
  const beforeDeploy = await publicGet(`/products/${slug}`);
  check("publishing", "before a deployment the new product has no public page", beforeDeploy.status === 404, String(beforeDeploy.status));
  if (args.deploy) {
    log("deploying staging so the catalogue snapshot includes the published synthetic product");
    const d = spawnSync(process.execPath, ["scripts/staging/deploy-worker.mjs", `--env=${args.env}`, "--apply"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, FP_STAGING_INQUIRY_TEST_KEY: "" } });
    const out = `${d.stdout}${d.stderr}`;
    const report = out.split("\n").filter((l) => l.includes("[catalogue]"));
    const mentions = report.filter((l) => l.includes(slug));
    check("publishing", "deployment succeeded", d.status === 0 && /PASS +deployed/.test(out), `exit ${d.status}`);
    check("publishing", "the build's catalogue report names the dashboard-only product as published but NOT live", mentions.some((l) => /NOT live/.test(l)), mentions.map((l) => scrub(l.replace(/^.*\[catalogue\]\s*/, "")).slice(0, 160)).join(" | ") || `no report line names it (${report.length} report lines)`);
    for (let i = 0; i < 24; i++) { if ((await servedRevision(guarded, REQUIRED)).ok) break; await sleep(5000); }
    const page = await publicGet(`/products/${slug}`);
    const sitemap = await publicGet("/sitemap.xml");
    const search = await publicGet("/search");
    check("publishing", "after the deployment: still no public page, not in sitemap.xml or search", page.status === 404 && sitemap.status === 200 && !sitemap.text.includes(slug) && !search.text.includes(slug), `page ${page.status}; sitemap ${sitemap.status}`);
  } else check("publishing", "deployment snapshot (run with --deploy)", null);

  // Archived catalogue records in the restored data are excluded from every public list (read only).
  const archived = (await q(`select p.slug from products p left join garland_details g on g.product_id=p.id where g.product_id is null and p.status='archived' order by 1`)).map((r) => r.slug);
  const sitemapNow = (await publicGet("/sitemap.xml")).text;
  const archivedPages = [];
  for (const a of archived) archivedPages.push((await publicGet(`/products/${a}`)).status);
  check("publishing", `restored archived catalogue products (${archived.length}): 404 and absent from sitemap.xml`, archived.length > 0 && archivedPages.every((x) => x === 404) && archived.every((a) => !sitemapNow.includes(`/products/${a}<`)), archivedPages.join(","));
  const publishedSample = (await q(`select p.slug from products p left join garland_details g on g.product_id=p.id where g.product_id is null and p.status='published' order by p.id limit 3`)).map((r) => r.slug);
  const samplePages = [];
  for (const p of publishedSample) samplePages.push((await publicGet(`/products/${p}`)).status);
  check("publishing", "restored published catalogue products: 200 and listed in sitemap.xml", samplePages.every((x) => x === 200) && publishedSample.every((p) => sitemapNow.includes(`${CANONICAL}/products/${p}<`)), samplePages.join(","));

  // Removal through the admin.
  const unpublish = await w("POST", `/api/admin/products/${productId}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "archived" }), store: false });
  const del = await w("DELETE", `/api/admin/products/${productId}`, { jar: s, headers: { origin: WORKER }, store: false });
  const left = (await q(`select (select count(*)::int from products where id=$1) p, (select count(*)::int from product_images where product_id=$1) i`, [productId]))[0];
  check("product", "archive then delete through the admin: product and its image links removed", unpublish.status === 200 && del.status === 200 && left.p === 0 && left.i === 0, `${unpublish.status} ${del.status}`);
  if (left.p === 0) made.products = made.products.filter((id) => id !== productId);
  const removeB = await w("DELETE", `/api/admin/media/${B.j.data.id}`, { jar: s, headers: { origin: WORKER }, store: false });
  await sleep(2000);
  const bObject = await storageObject(B.j.data.path);
  check("media", "its image, now unused, is deleted with its Storage object", removeB.status === 200 && bObject === 0, `${removeB.status}; objects left ${bObject}`);
  if (removeB.status === 200 && bObject === 0) made.media = made.media.filter((m) => m.id !== B.j.data.id);

  // ------------------------------------------------------------------ garland: live publishing, edits, image replacement, filters, sitemap
  const gSlug = `${SYNTHETIC_PREFIX}garland-${run_}`;
  const gName = `${SYNTHETIC_PREFIX}Garland ${run_}`;
  const code = `FP-G9${String(Number.parseInt(run_, 16) % 100000).padStart(5, "0")}`;
  const [{ id: gid }] = await q(`insert into products (slug, name, short_description, category_id, status, price_type) values ($1, $2, 'Synthetic staging test garland', 22, 'draft', 'quote') returning id`, [gSlug, gName]);
  made.garlandProductId = gid;
  await q(`insert into garland_details (product_id, design_code, selling_mode, photo_permission) values ($1, $2, 'enquiry', 'unconfirmed')`, [gid, code]);
  const gUrl = `/products/${gSlug}`;
  const draftPage = await publicGet(gUrl);
  const smDraft = await publicGet("/sitemap-garlands.xml");
  check("garland", "draft garland: no public page and not in sitemap-garlands.xml", draftPage.status === 404 && smDraft.status === 200 && !smDraft.text.includes(gSlug), `${draftPage.status}`);
  const g = body(await w("GET", `/api/admin/products/${gid}`, { jar: s, store: false })).data;
  const C = await upload("c", imgC);
  const gFields = (images, overrides = {}) => ({ name: gName, slug: gSlug, shortDescription: g.shortDescription, description: g.description, images, priceType: "quote", sellingPrice: null, compareAtPrice: null, costPrice: null, deliveryChargeOverride: null, categoryId: 22, occasionIds: g.occasionIds, moodIds: g.moodIds, flowerTypeIds: g.flowerTypeIds, whatsIncluded: g.whatsIncluded, careInstructions: g.careInstructions, status: "draft", featured: false, bestseller: false, newArrival: false, requiresWhatsappConfirmation: true, garland: { sellingMode: "enquiry", photoPermission: "granted", filters: ["lotus"] }, ...overrides });
  const gEdit = await w("PATCH", `/api/admin/products/${gid}`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify(gFields([{ mediaId: C.j.data.id, sortOrder: 0, isPrimary: true, altText: null }])), store: false });
  check("garland", "garland edit through the admin: photo, permission and the lotus filter saved", gEdit.status === 200 && (await q(`select count(*)::int n from product_garland_filters where product_id=$1`, [gid]))[0].n === 1, `${gEdit.status} ${scrub(body(gEdit).error ?? "")}`);
  const gPublish = await w("POST", `/api/admin/products/${gid}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "published" }), store: false });
  const gw = body(gPublish).website;
  check("garland", "publish accepted and the website refresh reported", gPublish.status === 200 && !!gw, `${gPublish.status}; website ${gw ? JSON.stringify({ ok: gw.ok ?? gw.refreshed ?? null }) : "absent"}`);
  const fileOf = (m) => m.j.data.path.split("/").pop();
  const liveNow = await fresh(gUrl);
  check("garland", "published garland renders at once (fresh render) with its name and photo, noindex on staging", liveNow.status === 200 && liveNow.text.includes(gName) && liveNow.text.includes(fileOf(C)) && /noindex/.test(liveNow.headers.get("x-robots-tag") ?? ""), `${liveNow.status}`);
  const smNow = await fresh("/sitemap-garlands.xml");
  check("garland", "sitemap-garlands.xml (fresh render) lists the page with its photo", smNow.text.includes(`${CANONICAL}${gUrl}<`) && smNow.text.includes(fileOf(C)), `${smNow.status}`);
  const listing = await fresh("/categories/garlands");
  const card = cardFor(listing.text, gSlug);
  check("filters", "garland listing (fresh render) shows the card tagged with its lotus filter", listing.status === 200 && card !== null && card.split(" ").includes("lotus"), `${listing.status}; filters "${card ?? "?"}"`);
  const livePublic = await eventually(gUrl, (r) => r.status === 200 && r.text.includes(gName));
  const smPublic = await eventually("/sitemap-garlands.xml", (r) => r.text.includes(`${CANONICAL}${gUrl}<`));
  check("garland", "the cached public page and sitemap (cached while it was a draft) update within s-maxage", livePublic.ok && smPublic.ok, `page after ${livePublic.seconds} s (${livePublic.cache}); sitemap after ${smPublic.seconds} s (${smPublic.cache})`);
  const check_ = await w("GET", `/api/admin/products/${gid}/website`, { jar: s, store: false });
  check("garland", "admin 'check on website' finds the live page", check_.status === 200 && body(check_).ok, `${check_.status}`);

  // Edit and image replacement show at once.
  const newName = `${gName} edited`;
  const rename = await w("PATCH", `/api/admin/products/${gid}`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify(gFields([{ mediaId: C.j.data.id, sortOrder: 0, isPrimary: true, altText: null }], { name: newName, status: "published" })), store: false });
  const renamed = await fresh(gUrl);
  check("garland", "edited name renders at once (fresh render)", rename.status === 200 && renamed.text.includes(newName), `${rename.status} ${renamed.status}`);
  const D = await upload("d", imgD);
  const swap = await w("PATCH", `/api/admin/products/${gid}`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify(gFields([{ mediaId: D.j.data.id, sortOrder: 0, isPrimary: true, altText: null }], { name: newName, status: "published" })), store: false });
  const swapped = await fresh(gUrl);
  const sm2 = await fresh("/sitemap-garlands.xml");
  check("garland", "replaced photo (fresh render): page and sitemap show the new image and not the old one", swap.status === 200 && swapped.text.includes(fileOf(D)) && !swapped.text.includes(fileOf(C)) && sm2.text.includes(fileOf(D)) && !sm2.text.includes(fileOf(C)), `${swap.status}`);
  const swapPublic = await eventually(gUrl, (r) => r.status === 200 && r.text.includes(newName) && r.text.includes(fileOf(D)) && !r.text.includes(fileOf(C)));
  check("garland", "the cached public page shows the edited name and new photo within s-maxage", swapPublic.ok, `after ${swapPublic.seconds} s (${swapPublic.cache})`);
  const removeC = await w("DELETE", `/api/admin/media/${C.j.data.id}`, { jar: s, headers: { origin: WORKER }, store: false });
  await sleep(2000);
  const cObject = await storageObject(C.j.data.path);
  if (removeC.status === 200 && cObject === 0) made.media = made.media.filter((m) => m.id !== C.j.data.id);
  check("media", "the replaced garland photo is deleted with its Storage object", removeC.status === 200 && cObject === 0, `${removeC.status}; objects left ${cObject}`);

  // Filters in a real browser (optional).
  if (args.playwright) {
    const { chromium } = await import(pathToFileURL(args.playwright).href);
    const browser = await chromium.launch({ headless: true });
    try {
      const ctx = await browser.newContext();
      await ctx.route("**/*", (route) => { const u = route.request().url(); return u.startsWith(`${WORKER}/`) || u.startsWith(`${STAGING_ORIGIN}/`) || u.startsWith("data:") ? route.continue() : route.abort(); });
      const p = await ctx.newPage();
      await p.goto(`${WORKER}/categories/garlands?fp_fresh=${tag()}`);
      const total = await p.locator("[data-garland-card]:visible").count();
      await p.click('[data-garland-filter="lotus"]');
      await sleep(500);
      const shown = await p.$$eval("[data-garland-card]", (els) => els.filter((e) => e.offsetParent !== null).map((e) => ({ filters: (e.getAttribute("data-garland-filters") ?? "").split(" "), mine: e.outerHTML.includes(location.pathname) || false, html: e.innerHTML.length })));
      const mineVisible = await p.$$eval("[data-garland-card]", (els, slug) => els.filter((e) => e.offsetParent !== null && (e.outerHTML.includes(`/products/${slug}"`) || (e.closest("a")?.getAttribute("href") ?? "").endsWith(slug))).length, gSlug);
      check("filters", "browser: the lotus chip shows only lotus garlands, including this one", shown.length > 0 && shown.length < total && shown.every((x) => x.filters.includes("lotus")) && mineVisible === 1, `${shown.length} of ${total} visible`);
      await p.goto(`${WORKER}/categories/bouquets?colour=red&utm_source=t`);
      check("filters", "browser: an old ?colour= link lands on the fragment address and keeps other parameters", new URL(p.url()).hash.includes("colour=red") && new URL(p.url()).search.includes("utm_source=t"), new URL(p.url()).pathname);
    } finally { await browser.close().catch(() => {}); }
  } else {
    const old = await publicGet("/categories/bouquets?colour=red&utm_source=t");
    check("filters", "an old ?colour= filter link redirects to the fragment address", old.status === 301 && /#colour=red/.test(old.location) && /utm_source=t/.test(old.location), `${old.status}`);
  }

  // Unpublish and removal.
  const gArchive = await w("POST", `/api/admin/products/${gid}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "archived" }), store: false });
  const gone = await fresh(gUrl);
  const sm3 = await fresh("/sitemap-garlands.xml");
  const listing2 = await fresh("/categories/garlands");
  check("garland", "archived (fresh render): page 404, gone from sitemap-garlands.xml and the listing", gArchive.status === 200 && gone.status === 404 && !sm3.text.includes(gSlug) && !listing2.text.includes(gSlug), `${gArchive.status} ${gone.status}`);
  const gonePublic = await eventually(gUrl, (r) => r.status === 404);
  const smGone = await eventually("/sitemap-garlands.xml", (r) => !r.text.includes(gSlug));
  check("garland", "the cached public page and sitemap drop it within s-maxage", gonePublic.ok && smGone.ok, `page after ${gonePublic.seconds} s; sitemap after ${smGone.seconds} s`);
  const gDelete = await w("DELETE", `/api/admin/products/${gid}`, { jar: s, headers: { origin: WORKER }, store: false });
  check("garland", "the admin refuses to delete a garland (permanent design code)", gDelete.status === 400 && (await q(`select count(*)::int n from products where id=$1`, [gid]))[0].n === 1, String(gDelete.status));

  // ------------------------------------------------------------------ enquiry persistence, under the controlled gate
  const marker = `${SYNTHETIC_PREFIX}enquiry-${run_}`;
  const enquiry = { customerName: marker, phone: "+91 60000 00000", products: `${marker} x1`, deliveryDate: "2026-12-01", recipientName: marker, recipientPhone: "06000000000", deliveryLandmark: "Synthetic test, not a delivery", occasion: "test", deliveryMethod: "MORNING", deliveryPromise: null, deliveryFee: 0 };
  const visitor = await w("POST", "/api/inquiries", { headers: JSON_HEADERS, body: JSON.stringify(enquiry) });
  const forged = await w("POST", "/api/inquiries", { headers: { ...JSON_HEADERS, "x-fp-staging-inquiry-test": "x".repeat(40) }, body: JSON.stringify(enquiry) });
  check("enquiry", "visitors are still refused: no key 403, wrong key 403, nothing stored", visitor.status === 403 && forged.status === 403 && (await q(`select count(*)::int n from inquiries where customer_name=$1`, [marker]))[0].n === 0, `${visitor.status} ${forged.status}`);
  if (INQUIRY_KEY.length >= 32) {
    const keyed = { ...JSON_HEADERS, "x-fp-staging-inquiry-test": INQUIRY_KEY };
    const bad = await w("POST", "/api/inquiries", { headers: keyed, body: JSON.stringify({ ...enquiry, recipientPhone: "123" }) });
    check("enquiry", "an invalid enquiry is refused with field errors and not stored", bad.status === 400 && !!body(bad).fieldErrors && (await q(`select count(*)::int n from inquiries where customer_name=$1`, [marker]))[0].n === 0, String(bad.status));
    const good = await w("POST", "/api/inquiries", { headers: keyed, body: JSON.stringify(enquiry) });
    const rows = await q(`select id, recipient_phone, status::text status, delivery_method::text dm, products from inquiries where customer_name=$1`, [marker]);
    rows.forEach((r) => made.inquiries.push(r.id));
    check("enquiry", "a valid enquiry is stored once, normalised, and acknowledged without echoing it", good.status === 201 && JSON.stringify(body(good)) === '{"ok":true}' && rows.length === 1 && rows[0].recipient_phone === "6000000000" && rows[0].status === "new" && rows[0].dm === "MORNING", `${good.status}; rows ${rows.length}`);
    if (rows.length === 1) {
      const inbox = body(await w("GET", "/api/admin/inquiries", { jar: s, store: false })).data ?? [];
      const page = await w("GET", "/admin/inquiries", { jar: s, store: false });
      check("enquiry", "the admin list and inquiries page show it", inbox.some((i) => i.id === rows[0].id) && page.status === 200 && page.text.includes(marker), `${inbox.length} in list; page ${page.status}`);
      const status = await w("POST", `/api/admin/inquiries/${rows[0].id}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "contacted" }), store: false });
      const [after] = await q(`select status::text status from inquiries where id=$1`, [rows[0].id]);
      check("enquiry", "status change from the admin persists", status.status === 200 && after.status === "contacted", String(status.status));
    }
  } else check("enquiry", "keyed enquiry persistence (FP_STAGING_INQUIRY_TEST_KEY not provided)", null);

  await w("POST", "/api/admin/auth/logout", { jar: s, headers: FORM, body: "" });
} catch (e) {
  check("run", "run completed without an error", false, scrub(e.message));
} finally {
  // Cleanup: only what this run made, each identified by id and the synthetic prefix.
  for (const id of made.inquiries) await q(`delete from inquiries where id=$1 and customer_name like $2`, [id, `${SYNTHETIC_PREFIX}%`]);
  if (made.garlandProductId) await q(`delete from products where id=$1 and slug like $2`, [made.garlandProductId, `${SYNTHETIC_PREFIX}%`]);
  for (const id of made.products) await q(`delete from products where id=$1 and slug like any(array[$2, 'untitled-product%'])`, [id, `${SYNTHETIC_PREFIX}%`]);
  for (const m of made.media) {
    const [row] = await q(`select filename from media where id=$1`, [m.id]);
    if (row && !row.filename.includes(SYNTHETIC_PREFIX.replace(/-$/, ""))) { log("STOP: refusing to delete an unexpected media row"); continue; }
    await q(`delete from media where id=$1`, [m.id]);
    if (m.path) { const { error } = await service.storage.from("media").remove([m.path]); if (error) log("storage remove refused"); }
  }
  const leftovers = (await q(`select (select count(*)::int from products where slug like $1) products, (select count(*)::int from media where filename like $2) media, (select count(*)::int from storage.objects where bucket_id='media' and name = any($3::text[])) objects, (select count(*)::int from inquiries where customer_name like $1) inquiries, (select count(*)::int from garland_details g where not exists (select 1 from products p where p.id=g.product_id)) orphans`, [`${SYNTHETIC_PREFIX}%`, `%fp-staging-test%`, uploadedPaths]))[0];
  check("cleanup", "no synthetic product, garland, image, Storage object or enquiry left", Object.values(leftovers).every((n) => n === 0), JSON.stringify(leftovers));
  await ids.cleanup();
  compareSnapshots(check, before, await snapshot(q), { sequencesMayAdvance: true });
  const fails = run.finish({ out: args.out, extra: { revision: rev.served } });
  process.exit(process.exitCode ?? (fails ? 1 : 0));
}
