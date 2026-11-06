#!/usr/bin/env node
// Staging catalogue, media and enquiry lifecycle through the deployed admin and public pages.
//
//   node scripts/staging/catalogue-lifecycle.mjs --env=<staging env file> [--deploy] [--playwright=<playwright-core index.mjs>] [--out=<results.json>]
//
// With FP_STAGING_INQUIRY_TEST_KEY in this process's environment (the same value as the Worker
// secret of that name), it also tests enquiry persistence; without it that section is NOT RUN.
// The storefront is prebuilt: with --deploy the runner publishes through scripts/staging/publish.mjs
// (the script the GitHub workflow runs) after the admin changes, three builds in all plus a
// simulated failed build and a no-change check, and verifies the public pages after each.
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
const run = startRun({ envFile: args.env, deadlineMinutes: 75 });
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
const publicGet = (path) => w("GET", path, {}); // no cookies: what a visitor sees (static files)
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

  // ------------------------------------------------------------------ publishing: the storefront is prebuilt; a build publishes
  // The admin's save asks for a build (Publishing.ts). Here the same publish script the GitHub
  // workflow runs is started by this runner, so the build, its checks, the deploy and the result
  // are the real ones; only the trigger is local.
  const publishBuild = (label, extra = []) => {
    const t = Date.now();
    const d = spawnSync(process.execPath, ["scripts/staging/publish.mjs", `--env=${args.env}`, ...(args["db-port"] ? [`--db-port=${args["db-port"]}`] : []), ...extra], { cwd: ROOT, encoding: "utf8", env: { ...process.env, FP_STAGING_INQUIRY_TEST_KEY: "" }, maxBuffer: 64 * 1024 * 1024 });
    const out = `${d.stdout}${d.stderr}`;
    const result = (out.match(/RESULT (.*)/) ?? [])[1] ?? "";
    const seconds = Math.round((Date.now() - t) / 1000);
    log(`publish (${label}): exit ${d.status}; ${result}; ${seconds} s`);
    publications.push({ label, status: d.status, result, seconds });
    return { status: d.status, out, result, seconds };
  };
  const publications = [];
  const fileOf = (m) => m.j.data.path.split("/").pop();
  const pub = body(publish).publication;
  check("publishing", "the save reports how the change will be published (scheduled check when dispatch isn't connected)", !!pub && ["github", "scheduled"].includes(pub.method) && /website/.test(pub.message), pub ? `${pub.method}: ${scrub(pub.message)}` : "absent");
  const beforeDeploy = await publicGet(`/products/${slug}`);
  check("publishing", "before the next build the new product has no page", beforeDeploy.status === 404, String(beforeDeploy.status));

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

  // A garland made public through the admin, published in the same build as the product.
  const gSlug = `${SYNTHETIC_PREFIX}garland-${run_}`;
  const gName = `${SYNTHETIC_PREFIX}Garland ${run_}`;
  const code = `FP-G9${String(Number.parseInt(run_, 16) % 100000).padStart(5, "0")}`;
  const [{ id: gid }] = await q(`insert into products (slug, name, short_description, category_id, status, price_type) values ($1, $2, 'Synthetic staging test garland', 22, 'draft', 'quote') returning id`, [gSlug, gName]);
  made.garlandProductId = gid;
  await q(`insert into garland_details (product_id, design_code, selling_mode, photo_permission) values ($1, $2, 'enquiry', 'unconfirmed')`, [gid, code]);
  const gUrl = `/products/${gSlug}`;
  const g = body(await w("GET", `/api/admin/products/${gid}`, { jar: s, store: false })).data;
  const C = await upload("c", imgC);
  const gFields = (images, overrides = {}) => ({ name: gName, slug: gSlug, shortDescription: g.shortDescription, description: g.description, images, priceType: "quote", sellingPrice: null, compareAtPrice: null, costPrice: null, deliveryChargeOverride: null, categoryId: 22, occasionIds: g.occasionIds, moodIds: g.moodIds, flowerTypeIds: g.flowerTypeIds, whatsIncluded: g.whatsIncluded, careInstructions: g.careInstructions, status: "draft", featured: false, bestseller: false, newArrival: false, requiresWhatsappConfirmation: true, garland: { sellingMode: "enquiry", photoPermission: "granted", filters: ["lotus"] }, ...overrides });
  const gEdit = await w("PATCH", `/api/admin/products/${gid}`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify(gFields([{ mediaId: C.j.data.id, sortOrder: 0, isPrimary: true, altText: null }])), store: false });
  check("garland", "garland edit through the admin: photo, permission and the lotus filter saved", gEdit.status === 200 && (await q(`select count(*)::int n from product_garland_filters where product_id=$1`, [gid]))[0].n === 1, `${gEdit.status} ${scrub(body(gEdit).error ?? "")}`);
  const gPublish = await w("POST", `/api/admin/products/${gid}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "published" }), store: false });
  const gw = body(gPublish).website;
  check("garland", "publish accepted; the admin is told it appears with the next build, within the publishing bound", gPublish.status === 200 && gw?.listed === true && gw.refresh?.method === "publish" && gw.maxDelaySeconds === 1500, `${gPublish.status}; ${gw ? `${gw.refresh?.method} ${gw.maxDelaySeconds} s: ${scrub(gw.refresh?.message ?? "")}` : "absent"}`);
  const notYet = await publicGet(gUrl);
  const pending = body(await w("GET", `/api/admin/products/${gid}/website`, { jar: s, store: false }));
  check("garland", "before the build: no page yet, and the admin's website check says pending, not live", notYet.status === 404 && pending.data?.state === "pending", `${notYet.status}; ${pending.data?.state}`);

  if (args.deploy) {
    // Build 1: the additions.
    const b1 = publishBuild("additions: catalogue product and garland");
    check("publishing", "build 1 published (build, output checks, deploy, served)", b1.status === 0 && /^published/.test(b1.result), `${b1.result}; ${b1.seconds} s`);
    const report = b1.out.split("\n").filter((l) => l.includes("[catalogue]") && l.includes(slug));
    check("publishing", "the build no longer reports the admin-added product as NOT live", !report.some((l) => /NOT live/.test(l)), report.map((l) => scrub(l)).join(" | ").slice(0, 160));
    const page = await publicGet(`/products/${slug}`);
    const [{ cslug }] = await q(`select c.slug cslug from categories c where c.id=3`);
    const category = await publicGet(`/categories/${cslug}`);
    const sitemap = await publicGet("/sitemap.xml");
    check("publishing", "admin addition: the product page is live (static file) with its name and its uploaded photo through the resizer", page.status === 200 && page.text.includes(name) && page.text.includes(`/_image?href=`) && page.text.includes(fileOf(B)) && !page.headers.has("x-fp-source-revision"), `${page.status}`);
    check("publishing", "admin addition: listed on its category page and in sitemap.xml", category.text.includes(`/products/${slug}`) && sitemap.text.includes(`${CANONICAL}/products/${slug}<`), `/categories/${cslug} ${category.status}`);
    const live = await publicGet(gUrl);
    check("garland", "published garland is live (static file) with its name and photo, noindex on staging", live.status === 200 && live.text.includes(gName) && live.text.includes(fileOf(C)) && /noindex/.test(live.headers.get("x-robots-tag") ?? "") && !live.headers.has("x-fp-source-revision"), `${live.status}`);
    const sm = await publicGet("/sitemap-garlands.xml");
    check("garland", "sitemap-garlands.xml lists the page with its photo", sm.text.includes(`${CANONICAL}${gUrl}<`) && sm.text.includes(fileOf(C)), `${sm.status}`);
    const listing = await publicGet("/categories/garlands");
    const card = cardFor(listing.text, gSlug);
    check("filters", "the garland listing shows the card tagged with its lotus filter", listing.status === 200 && card !== null && card.split(" ").includes("lotus"), `filters "${card ?? "?"}"`);
    const checked = body(await w("GET", `/api/admin/products/${gid}/website`, { jar: s, store: false }));
    check("garland", "the admin's website check now finds the live page with the saved version", checked.data?.state === "live", `${checked.data?.state}`);

    // Filters in a real browser (optional).
    if (args.playwright) {
      const { chromium } = await import(pathToFileURL(args.playwright).href);
      const browser = await chromium.launch({ headless: true });
      try {
        const ctx = await browser.newContext();
        await ctx.route("**/*", (route) => { const u = route.request().url(); return u.startsWith(`${WORKER}/`) || u.startsWith(`${STAGING_ORIGIN}/`) || u.startsWith("data:") ? route.continue() : route.abort(); });
        const p = await ctx.newPage();
        await p.goto(`${WORKER}/categories/garlands`);
        const total = await p.locator("[data-garland-card]:visible").count();
        await p.click('[data-garland-filter="lotus"]');
        await sleep(500);
        const shown = await p.$$eval("[data-garland-card]", (els) => els.filter((e) => e.offsetParent !== null).map((e) => ({ filters: (e.getAttribute("data-garland-filters") ?? "").split(" ") })));
        const mineVisible = await p.$$eval("[data-garland-card]", (els, slug) => els.filter((e) => e.offsetParent !== null && (e.outerHTML.includes(`/products/${slug}"`) || (e.closest("a")?.getAttribute("href") ?? "").endsWith(slug))).length, gSlug);
        check("filters", "browser: the lotus chip shows only lotus garlands, including this one", shown.length > 0 && shown.length < total && shown.every((x) => x.filters.includes("lotus")) && mineVisible === 1, `${shown.length} of ${total} visible`);
        await p.goto(`${WORKER}/categories/bouquets?colour=red&utm_source=t`);
        await sleep(300);
        check("filters", "browser: an old ?colour= link lands on the fragment address and keeps other parameters", new URL(p.url()).hash.includes("colour=red") && new URL(p.url()).search.includes("utm_source=t"), new URL(p.url()).pathname);
      } finally { await browser.close().catch(() => {}); }
    }

    // A failed build leaves the previous release serving.
    const newName = `${gName} edited`;
    const rename = await w("PATCH", `/api/admin/products/${gid}`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify(gFields([{ mediaId: C.j.data.id, sortOrder: 0, isPrimary: true, altText: null }], { name: newName, status: "published" })), store: false });
    check("garland", "rename saved through the admin", rename.status === 200, String(rename.status));
    const failedBuild = publishBuild("simulated failed build", ["--simulate-build-failure"]);
    const still = await publicGet(gUrl);
    check("publishing", "a failed build deploys nothing: the previous release keeps serving (old name, page up)", failedBuild.status === 1 && /previous release still serving/.test(failedBuild.result) && still.status === 200 && still.text.includes(gName) && !still.text.includes(newName), `${failedBuild.result}`);

    // Repeated changes before one build: photo swap, product archive and delete.
    const D = await upload("d", imgD);
    const swap = await w("PATCH", `/api/admin/products/${gid}`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify(gFields([{ mediaId: D.j.data.id, sortOrder: 0, isPrimary: true, altText: null }], { name: newName, status: "published" })), store: false });
    const unpublish = await w("POST", `/api/admin/products/${productId}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "archived" }), store: false });
    const del = await w("DELETE", `/api/admin/products/${productId}`, { jar: s, headers: { origin: WORKER }, store: false });
    const left = (await q(`select (select count(*)::int from products where id=$1) p, (select count(*)::int from product_images where product_id=$1) i`, [productId]))[0];
    check("product", "archive then delete through the admin: product and its image links removed", swap.status === 200 && unpublish.status === 200 && del.status === 200 && left.p === 0 && left.i === 0, `${swap.status} ${unpublish.status} ${del.status}`);
    if (left.p === 0) made.products = made.products.filter((id) => id !== productId);
    const b2 = publishBuild("edits and removals (several saves, one build)");
    check("publishing", "build 2 published", b2.status === 0 && /^published/.test(b2.result), `${b2.result}; ${b2.seconds} s`);
    const swapped = await publicGet(gUrl);
    const sm2 = await publicGet("/sitemap-garlands.xml");
    check("garland", "after one build: the latest name and the new photo, not the old one, on the page and in the sitemap", swapped.text.includes(newName) && swapped.text.includes(fileOf(D)) && !swapped.text.includes(fileOf(C)) && sm2.text.includes(fileOf(D)) && !sm2.text.includes(fileOf(C)), `${swapped.status}`);
    const removed = await publicGet(`/products/${slug}`);
    const sitemap2 = await publicGet("/sitemap.xml");
    const category2 = await publicGet(`/categories/${cslug}`);
    check("publishing", "admin removal: the product page answers 404 (not on sale), gone from sitemap.xml and its category page", removed.status === 404 && /isn(?:'|&#39;)t on sale/.test(removed.text) && !sitemap2.text.includes(slug) && !category2.text.includes(`/products/${slug}`), `${removed.status}`);
    const again = publishBuild("nothing changed");
    check("publishing", "with nothing changed the publish check builds nothing", again.status === 0 && /up to date/.test(again.result), again.result);

    // Garland removal.
    const gArchive = await w("POST", `/api/admin/products/${gid}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "archived" }), store: false });
    const b3 = publishBuild("garland removal");
    const gone = await publicGet(gUrl);
    const sm3 = await publicGet("/sitemap-garlands.xml");
    const listing3 = await publicGet("/categories/garlands");
    check("garland", "archived and published: page 404, gone from sitemap-garlands.xml and the listing", gArchive.status === 200 && b3.status === 0 && gone.status === 404 && !sm3.text.includes(gSlug) && !listing3.text.includes(gSlug), `${gArchive.status} ${b3.result} ${gone.status}`);
  } else check("publishing", "builds (run with --deploy)", null);

  const removeC = await w("DELETE", `/api/admin/media/${C.j.data.id}`, { jar: s, headers: { origin: WORKER }, store: false });
  await sleep(2000);
  const cObject = await storageObject(C.j.data.path);
  if (removeC.status === 200 && cObject === 0) made.media = made.media.filter((m) => m.id !== C.j.data.id);
  check("media", "the replaced garland photo is deleted with its Storage object", removeC.status === 200 && cObject === 0, `${removeC.status}; objects left ${cObject}`);
  if (made.products.includes(productId)) {
    // Without --deploy the product is still there: remove it the same way.
    await w("POST", `/api/admin/products/${productId}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "archived" }), store: false });
    const delNow = await w("DELETE", `/api/admin/products/${productId}`, { jar: s, headers: { origin: WORKER }, store: false });
    if (delNow.status === 200) made.products = made.products.filter((id) => id !== productId);
  }
  const removeB = await w("DELETE", `/api/admin/media/${B.j.data.id}`, { jar: s, headers: { origin: WORKER }, store: false });
  await sleep(2000);
  const bObject = await storageObject(B.j.data.path);
  check("media", "the product's image, now unused, is deleted with its Storage object", removeB.status === 200 && bObject === 0, `${removeB.status}; objects left ${bObject}`);
  if (removeB.status === 200 && bObject === 0) made.media = made.media.filter((m) => m.id !== B.j.data.id);
  const gDelete = await w("DELETE", `/api/admin/products/${gid}`, { jar: s, headers: { origin: WORKER }, store: false });
  check("garland", "the admin refuses to delete a garland (permanent design code)", gDelete.status === 400 && (await q(`select count(*)::int n from products where id=$1`, [gid]))[0].n === 1, String(gDelete.status));
  run.publications = publications;

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
  const fails = run.finish({ out: args.out, extra: { revision: rev.served, publications: run.publications ?? [] } });
  process.exit(process.exitCode ?? (fails ? 1 : 0));
}
