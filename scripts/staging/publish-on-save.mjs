#!/usr/bin/env node
// Publish on save, end to end on staging: an admin save through the deployed Worker sends
// repository_dispatch, GitHub runs .github/workflows/staging-publish.yml by itself, the build is
// deployed, and the editor's website check turns Live only once the deployed page carries the save.
// Then the same for removal (archive through the admin).
//
//   node scripts/staging/publish-on-save.mjs --env=<staging env file> [--out=<results.json>] [--minutes=25]
//
// This runner never starts a build or a workflow: it signs in as a synthetic admin, saves through the
// admin API (the editor's own calls), and only watches GitHub (gh CLI, read-only) and the website.
// Needs the Worker secret FP_PUBLISH_GITHUB_TOKEN on fresh-petals-staging.
//
// Everything it creates carries the fp-staging-test- prefix and is removed in `finally`: one
// synthetic approved admin and its test-only factor, one uploaded image and its Storage object, and
// one synthetic garland. The garland row is inserted as a hidden draft (as scripts/seed-garlands.mjs
// would; the admin cannot create garlands) and is then edited, published and archived only through
// the admin. Afterwards every pre-existing row, Storage object and Auth user must match its digest.
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import {
  WORKER, FORM, JSON_HEADERS, SYNTHETIC_PREFIX, form, sleep, tag, scrub, parseArgs, startRun, servedRevision,
  freshCode, snapshot, compareSnapshots, syntheticIdentities, enrolFactor, jarClient,
} from "./test-lib.mjs";

const sharp = createRequire(import.meta.url)("sharp");
const args = parseArgs();
const WATCH_MS = Number(args.minutes ?? 25) * 60000;
const run = startRun({ envFile: args.env, minFreeMb: 300, deadlineMinutes: 2 * Number(args.minutes ?? 25) + 15 });
const { log, check, due, guarded, service, sdkFor } = run;
// This PC's DNS has dropped for a minute or more during watches (7 and 9 Nov), killing the run before
// its cleanup. Retried here: database connections that failed to open (nothing was sent) and website
// reads. Writes through the admin are never repeated.
const CONNECT_FAILURE = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH/;
const NETWORK_FAILURE = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|socket hang up|aborted|timeout/i;
const failureText = (e) => `${e?.message ?? e} ${e?.code ?? ""} ${e?.cause?.code ?? ""} ${e?.cause?.message ?? ""}`;
async function retrying(fn, isTransient, label) {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); } catch (error) {
      if (attempt >= 12 || !isTransient(failureText(error))) throw error;
      log(`network unavailable (${label}); retry ${attempt} in 15 s`);
      await sleep(15000);
    }
  }
}
const q = (sql, params) => retrying(() => run.q(sql, params), (t) => CONNECT_FAILURE.test(t), "database");
const w = (method, route, opts) => (method === "GET" ? retrying(() => run.w(method, route, opts), (t) => NETWORK_FAILURE.test(t), "website") : run.w(method, route, opts));
const REPO = "RanjithKumar427/fresh-petals";
const CANONICAL = "https://onlyfreshpetals.in";
const body = (r) => { try { return JSON.parse(r.text); } catch { return {}; } };
const publicGet = (path) => w("GET", path, {});
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

// GitHub, read-only: runs of a workflow created at or after `since`.
function runsSince(workflow, since) {
  const r = spawnSync("gh", ["api", `repos/${REPO}/actions/workflows/${workflow}/runs?per_page=20&created=>=${iso(since - 5000)}`, "--jq",
    ".workflow_runs[] | [.id, .event, .status, (.conclusion // \"\"), .head_sha, .created_at, .updated_at, .html_url] | @tsv"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.trim().split("\n").filter(Boolean).map((l) => { const [id, event, status, conclusion, sha, created, updated, url] = l.split("\t"); return { id, event, status, conclusion, sha, created, updated, url }; });
}
const servedState = async () => { try { return JSON.parse((await publicGet(`/_publish/state.json?t=${Date.now()}`)).text); } catch { return null; } };

const rev = await servedRevision(guarded, "88ae20d389fc77f23659d422e0c964d580953b24"); // requested/pending wording and the publish-state cache
if (!rev.ok) { console.log("STOP: the served staging revision predates 88ae20d; nothing was created"); process.exit(2); }
const mainHead = spawnSync("git", ["rev-parse", "origin/main"], { encoding: "utf8" }).stdout.trim();
log("served", rev.served.slice(0, 7), "origin/main", mainHead.slice(0, 7));
const before = await snapshot(q);
const ids = syntheticIdentities({ q, service, check, log });
const run_ = tag();
const made = { garlandProductId: null, media: [] };
const timings = {};
let s;

// Waits until `done(sample)` while recording what the editor's check and GitHub show.
async function watch(label, since, done, runsFrom = since) {
  const timeline = [];
  const served0 = (await servedState())?.builtAt ?? null;
  let servedChangedAt = null, firstDone = null, runs = [];
  while (Date.now() - since < WATCH_MS) {
    let state, checkRes;
    try { [state, checkRes] = await Promise.all([servedState(), w("GET", `/api/admin/products/${made.garlandProductId}/website`, { jar: s, store: false })]); }
    catch (error) { log(`[${label}] sample missed: ${failureText(error).slice(0, 80)}`); await sleep(10000); continue; }
    const website = body(checkRes).data ?? null;
    if (!servedChangedAt && state?.builtAt && state.builtAt !== served0) servedChangedAt = Date.now();
    runs = runsSince("staging-publish.yml", runsFrom) ?? runs;
    const sample = { t: Math.round((Date.now() - since) / 1000), editor: website?.state ?? `http ${checkRes.status}`, served: state?.revision?.slice(0, 7) ?? "?", builtAt: state?.builtAt ?? null, runs: runs.map((r) => `${r.id}:${r.event}:${r.status}${r.conclusion ? "/" + r.conclusion : ""}`).join(",") };
    if (!timeline.length || timeline.at(-1).editor !== sample.editor || timeline.at(-1).runs !== sample.runs || timeline.at(-1).builtAt !== sample.builtAt) { timeline.push(sample); log(`[${label}] +${sample.t}s editor=${sample.editor} served=${sample.served} built=${sample.builtAt} runs=${sample.runs || "none yet"}`); }
    if (done(website)) { firstDone = Date.now(); break; }
    await sleep(10000);
  }
  return { timeline, servedChangedAt, firstDone, runs, seconds: firstDone ? Math.round((firstDone - since) / 1000) : null };
}

try {
  // ------------------------------------------------------------------ synthetic admin, signed in through the deployed pages (aal2)
  const admin = await ids.create({ approved: true, label: "publish" });
  await enrolFactor({ sdk: jarClient(sdkFor).sdk, user: admin, due });
  s = new Map();
  await sleep(2500);
  const login = await w("POST", "/api/admin/auth/login", { jar: s, headers: FORM, body: form({ email: admin.email, password: admin.password }) });
  const mfa = await w("POST", "/admin/mfa", { jar: s, headers: FORM, body: form({ action: "verify", code: await freshCode(admin.secret, due) }) });
  const ready = await w("GET", "/api/admin/products", { jar: s, store: false });
  if (login.to !== "/admin/mfa" || mfa.to !== "/admin/dashboard" || ready.status !== 200) throw new Error(`admin sign-in failed: ${login.status} ${login.to}; ${mfa.status} ${mfa.to}; ${ready.status}`);
  check("setup", "synthetic admin signed in at aal2 through the deployed pages", true);

  // The save path keeps its protections: no session, and a cross-site write, are refused before any dispatch.
  const anon = await w("POST", "/api/admin/products/1/status", { headers: JSON_HEADERS, body: JSON.stringify({ status: "published" }), store: false });
  const cross = await w("POST", "/api/admin/products/1/status", { jar: s, headers: { ...JSON_HEADERS, origin: "https://example.com" }, body: JSON.stringify({ status: "published" }), store: false });
  check("guard", "a status write without a session is refused", anon.status === 401 || anon.status === 403 || anon.status === 302, String(anon.status));
  check("guard", "a cross-site status write with the admin's cookies is refused (CSRF)", cross.status === 403, String(cross.status));

  // ------------------------------------------------------------------ the fixture: hidden draft garland + an uploaded photo
  const gSlug = `${SYNTHETIC_PREFIX}autopublish-${run_}`;
  const gName = `${SYNTHETIC_PREFIX}Auto-publish check ${run_}`;
  const code = `FP-G9${String(Number.parseInt(run_, 16) % 100000).padStart(5, "0")}`;
  const [{ id: gid }] = await q(`insert into products (slug, name, short_description, category_id, status, price_type) values ($1, $2, 'Synthetic staging test garland (publish on save)', 22, 'draft', 'quote') returning id`, [gSlug, gName]);
  made.garlandProductId = gid;
  await q(`insert into garland_details (product_id, design_code, selling_mode, photo_permission) values ($1, $2, 'enquiry', 'unconfirmed')`, [gid, code]);
  const fd = new FormData();
  fd.set("file", new Blob([await sharp({ create: { width: 900, height: 900, channels: 3, background: { r: 120, g: 30, b: 90 } } }).png().toBuffer()], { type: "image/png" }), `${SYNTHETIC_PREFIX}autopublish-${run_}.png`);
  fd.set("folder", "products");
  fd.set("altText", `${SYNTHETIC_PREFIX}autopublish`);
  const up = body(await w("POST", "/api/admin/media", { jar: s, headers: { origin: WORKER }, body: fd, store: false }));
  if (!up.ok) throw new Error("upload failed");
  made.media.push({ id: up.data.id, path: up.data.path });
  const g = body(await w("GET", `/api/admin/products/${gid}`, { jar: s, store: false })).data;
  const fields = { name: gName, slug: gSlug, shortDescription: g.shortDescription, description: g.description, images: [{ mediaId: up.data.id, sortOrder: 0, isPrimary: true, altText: null }], priceType: "quote", sellingPrice: null, compareAtPrice: null, costPrice: null, deliveryChargeOverride: null, categoryId: 22, occasionIds: g.occasionIds, moodIds: g.moodIds, flowerTypeIds: g.flowerTypeIds, whatsIncluded: g.whatsIncluded, careInstructions: g.careInstructions, status: "draft", featured: false, bestseller: false, newArrival: false, requiresWhatsappConfirmation: true, garland: { sellingMode: "enquiry", photoPermission: "granted", filters: ["lotus"] } };
  const tEdit = Date.now();
  const edit = await w("PATCH", `/api/admin/products/${gid}`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify(fields), store: false });
  check("save", "editor save (photo, permission, lotus filter) accepted", edit.status === 200, `${edit.status} ${scrub(body(edit).error ?? "")}`);
  log("draft save publication:", JSON.stringify(body(edit).publication ?? body(edit).website?.refresh ?? null).slice(0, 200));

  // ------------------------------------------------------------------ publish through the admin: the save requests the build
  const tSave = Date.now();
  timings.publishSavedAt = iso(tSave);
  const pub = await w("POST", `/api/admin/products/${gid}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "published" }), store: false });
  const refresh = body(pub).website?.refresh;
  check("save", "publish save: the Worker sent the dispatch and says publishing was requested (no deadline)", pub.status === 200 && refresh?.ok === true && refresh.method === "publish" && /^Publishing requested\./.test(refresh.message) && body(pub).website?.maxDelaySeconds === null, `${pub.status}; ${refresh ? `${refresh.ok} ${refresh.method}: ${scrub(refresh.message)}` : "absent"}`);
  const pending = body(await w("GET", `/api/admin/products/${gid}/website`, { jar: s, store: false })).data;
  const notYet = await publicGet(`/products/${gSlug}`);
  check("editor", "right after the save: no page yet and the editor's check says pending", notYet.status === 404 && pending?.state === "pending", `${notYet.status}; ${pending?.state}`);

  const up1 = await watch("publish", tSave, (d) => d?.state === "live", tEdit);
  timings.publish = up1;
  const dispatchRuns = up1.runs.filter((r) => r.event === "repository_dispatch");
  check("github", "GitHub started Staging publish by itself from the save (repository_dispatch; no manual dispatch was sent)", dispatchRuns.some((r) => new Date(r.created).getTime() >= tSave - 5000), up1.runs.map((r) => `${r.event} ${r.url}`).join(" ; ") || "no run");
  const prodRuns = runsSince("production-publish.yml", tSave) ?? [];
  check("github", "no production workflow was triggered by the staging save", prodRuns.length === 0, `${prodRuns.length} production run(s)`);
  check("github", "the dispatched runs built origin/main", dispatchRuns.every((r) => r.sha === mainHead), dispatchRuns.map((r) => r.sha.slice(0, 7)).join(","));
  check("editor", "the editor's check turned Live only after the new build was served", up1.firstDone !== null && up1.servedChangedAt !== null && up1.firstDone >= up1.servedChangedAt && up1.timeline.filter((x) => x.editor === "live").length === 1, `live at ${up1.seconds ?? "never"} s; served build changed at ${up1.servedChangedAt ? Math.round((up1.servedChangedAt - tSave) / 1000) : "never"} s`);
  check("timing", "save to confirmed publication (editor Live)", up1.seconds !== null, `${up1.seconds ?? "not within the watch"} s`);
  const state = await servedState();
  check("deploy", "the deployed build is origin/main, built from the staging database", state?.revision === mainHead && (await publicGet("/api/publish/state")).text.includes(state.fingerprint) === true, `${state?.revision?.slice(0, 7)}; fingerprint ${state?.fingerprint?.slice(0, 12)}`);
  const page = await publicGet(`/products/${gSlug}`);
  check("site", "the garland page is live with its name and its static photo, noindex on staging", page.status === 200 && page.text.includes(gName) && /\/photos\/[0-9a-f]+-\d+\.webp/.test(page.text) && /noindex/.test(page.headers.get("x-robots-tag") ?? ""), `${page.status}`);
  const sm = await publicGet("/sitemap-garlands.xml");
  const list = await publicGet("/categories/garlands");
  check("site", "listed in sitemap-garlands.xml and on the garland list", sm.text.includes(`${CANONICAL}/products/${gSlug}<`) && list.text.includes(`href="/products/${gSlug}"`), `${sm.status} ${list.status}`);

  // ------------------------------------------------------------------ removal through the admin: archive (garlands are never deleted)
  const tArchive = Date.now();
  timings.archiveSavedAt = iso(tArchive);
  const arch = await w("POST", `/api/admin/products/${gid}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "archived" }), store: false });
  const aRefresh = body(arch).website?.refresh;
  check("save", "archive save: dispatch sent, publishing requested", arch.status === 200 && aRefresh?.ok === true && /^Publishing requested\./.test(aRefresh.message), `${arch.status}; ${aRefresh ? scrub(aRefresh.message) : "absent"}`);
  const still = body(await w("GET", `/api/admin/products/${gid}/website`, { jar: s, store: false })).data;
  check("editor", "right after archiving: the page is still deployed and the check says pending, not hidden", still?.state === "pending", still?.state);
  const down = await watch("removal", tArchive, (d) => d?.state === "hidden");
  timings.removal = down;
  check("github", "GitHub started Staging publish by itself for the removal", down.runs.some((r) => r.event === "repository_dispatch" && new Date(r.created).getTime() >= tArchive - 5000), down.runs.map((r) => `${r.event} ${r.url}`).join(" ; ") || "no run");
  check("editor", "the check turned Hidden only after the new build was served", down.firstDone !== null && down.servedChangedAt !== null && down.firstDone >= down.servedChangedAt, `hidden at ${down.seconds ?? "never"} s`);
  check("timing", "archive save to confirmed removal (editor Hidden)", down.seconds !== null, `${down.seconds ?? "not within the watch"} s`);
  const gone = await publicGet(`/products/${gSlug}`);
  const sm2 = await publicGet("/sitemap-garlands.xml");
  const list2 = await publicGet("/categories/garlands");
  check("site", "after removal: page 404, gone from sitemap-garlands.xml and the garland list", gone.status === 404 && !sm2.text.includes(`/products/${gSlug}<`) && !list2.text.includes(`href="/products/${gSlug}"`), `${gone.status}`);
} catch (error) {
  check("run", "completed", false, scrub(String(error?.message ?? error)).slice(0, 200));
} finally {
  // Cleanup: only what this run made, each identified by id and the synthetic prefix.
  if (made.garlandProductId) await q(`delete from products where id=$1 and slug like $2`, [made.garlandProductId, `${SYNTHETIC_PREFIX}%`]);
  for (const m of made.media) {
    const [row] = await q(`select filename from media where id=$1`, [m.id]);
    if (row && !row.filename.includes(SYNTHETIC_PREFIX.replace(/-$/, ""))) { log("STOP: refusing to delete an unexpected media row"); continue; }
    await q(`delete from media where id=$1`, [m.id]);
    if (m.path) { const { error } = await service.storage.from("media").remove([m.path]); if (error) log("storage remove refused"); }
  }
  const leftovers = (await q(`select (select count(*)::int from products where slug like $1) products, (select count(*)::int from media where filename like $2) media, (select count(*)::int from storage.objects where bucket_id='media' and name = any($3::text[])) objects, (select count(*)::int from garland_details g where not exists (select 1 from products p where p.id=g.product_id)) orphans`, [`${SYNTHETIC_PREFIX}%`, `%fp-staging-test%`, made.media.map((m) => m.path)]))[0];
  check("cleanup", "no synthetic product, garland, image or Storage object left", Object.values(leftovers).every((n) => n === 0), JSON.stringify(leftovers));
  await ids.cleanup();
  compareSnapshots(check, before, await snapshot(q), { sequencesMayAdvance: true });
  const strip = (x) => x && { seconds: x.seconds, servedChangedAfter: x.servedChangedAt ? Math.round((x.servedChangedAt - Date.parse(x === timings.publish ? timings.publishSavedAt : timings.archiveSavedAt)) / 1000) : null, runs: x.runs, timeline: x.timeline };
  const fails = run.finish({ out: args.out, extra: { served: rev.served, mainHead, timings: { publishSavedAt: timings.publishSavedAt, archiveSavedAt: timings.archiveSavedAt, publish: strip(timings.publish), removal: strip(timings.removal) } } });
  process.exit(process.exitCode ?? (fails ? 1 : 0));
}
