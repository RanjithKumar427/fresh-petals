#!/usr/bin/env node
// /garland-enquiry on the deployed staging Worker: what one enquiry costs in database work, and (with
// --functional) its behaviour end to end, including freshness after an admin save. GET/HEAD to the
// staging Worker only, with redirects disabled: the WhatsApp Location is read, never opened.
//
//   node scripts/staging/garland-enquiry.mjs --env=<staging env file> --label=<before|after> [--n=20]
//        [--code=FP-G001] [--functional --require=<commit>] [--out=<results.json>]
//
// Cost, measured in the database itself: pg_stat_statements calls and rows for every statement that
// touches the garland tables, as deltas over a quiet control window and then over N sequential
// enquiries of the same existing published design, each of equal length. Byte totals come from
// Cloudflare's Hyperdrive analytics for the two windows printed here (read separately; analytics lag).
//
// --functional signs in as a synthetic admin and uses one synthetic garland (fp-staging-test- prefix),
// inserted as a hidden draft as scripts/seed-garlands.mjs would, then edited, published and archived
// only through the admin. Everything it makes is removed in `finally`, and every pre-existing row,
// Storage object and Auth user must match its digest afterwards.
import { createRequire } from "node:module";
import {
  WORKER, FORM, JSON_HEADERS, SYNTHETIC_PREFIX, form, sleep, tag, scrub, parseArgs, startRun, servedRevision,
  freshCode, snapshot, compareSnapshots, syntheticIdentities, enrolFactor, jarClient,
} from "./test-lib.mjs";

const args = parseArgs();
const N = Math.max(5, Math.min(50, Number(args.n ?? 20)));
const CODE = String(args.code ?? "FP-G001");
const label = String(args.label ?? "sample");
const run = startRun({ envFile: args.env, minFreeMb: 300, deadlineMinutes: 20 });
const { log, check, due, guarded, q, w, service, sdkFor } = run;
const body = (r) => { try { return JSON.parse(r.text); } catch { return {}; } };
const iso = (ms) => new Date(ms).toISOString();
const wa = (r) => { try { return new URL(r.location).searchParams.get("text") ?? ""; } catch { return ""; } };
const enquiry = (query, method = "GET") => w(method, `/garland-enquiry${query}`, {});

// ------------------------------------------------------------------ database cost per enquiry
const GARLAND_TABLES = /(garland_details|product_options|product_images|product_garland_filters|product_occasions)/;
async function statements() {
  const rows = await q(`select queryid::text id, calls::bigint::text calls, rows::bigint::text rws, left(regexp_replace(query, '\\s+', ' ', 'g'), 400) query
    from pg_stat_statements where query ~* $1 and query !~* 'pg_stat_statements'`, [GARLAND_TABLES.source]);
  return new Map(rows.map((r) => [r.id, { calls: Number(r.calls), rows: Number(r.rws), query: r.query }]));
}
function delta(a, b) {
  const out = [];
  for (const [id, s] of b) {
    const p = a.get(id) ?? { calls: 0, rows: 0 };
    if (s.calls > p.calls) out.push({ calls: s.calls - p.calls, rows: s.rows - p.rows, query: s.query.replace(/"/g, "").slice(0, 220) });
  }
  return out.sort((x, y) => y.calls - x.calls);
}
const sum = (list, k) => list.reduce((n, x) => n + x[k], 0);

const served = (await guarded(`${WORKER}/admin/login`)).headers.get("x-fp-source-revision") ?? "";
log("served revision", served.slice(0, 12), "label", label);

// Parity probes, recorded in both phases: HEAD, path spellings, refusals.
const probes = {};
for (const [name, query, method] of [["head", `?code=${CODE}`, "HEAD"], ["slash", `/?code=${CODE}`], ["upper", `?code=${CODE.toLowerCase()}`], ["malformed", "?code=abc"], ["empty", ""], ["unknown", "?code=FP-G99999999"]]) {
  const r = name === "slash" ? await w(method ?? "GET", `/garland-enquiry${query}`, {}) : await enquiry(query, method);
  probes[name] = { status: r.status, location: r.location.startsWith("https://wa.me/") ? "wa.me" : r.location, cache: r.cache, robots: r.headers.get("x-robots-tag"), edge: r.headers.get("x-fp-edge-cache") };
}
const upper = await w("GET", `/Garland-Enquiry?code=${CODE}`, {});
probes.mixedCasePath = { status: upper.status, location: upper.location.startsWith("https://wa.me/") ? "wa.me" : upper.location };
log("probes", JSON.stringify(probes));

// Control window (no requests) then the sample, equal lengths.
const s0 = await statements();
const c0 = Date.now();
const sampleTarget = N * 400;
await sleep(sampleTarget);
const c1 = Date.now();
const s1 = await statements();
const t0 = Date.now();
const revisions = new Set();
let redirects = 0;
for (let i = 0; i < N; i++) {
  const r = await enquiry(`?code=${CODE}&qty=2&t=${i}`);
  revisions.add(r.headers.get("x-fp-source-revision"));
  if (r.status === 302 && r.location.startsWith("https://wa.me/")) redirects++;
}
const t1 = Date.now();
if (t1 - t0 < c1 - c0) await sleep(c1 - c0 - (t1 - t0));
const t2 = Date.now();
const s2 = await statements();
const control = delta(s0, s1);
const sample = delta(s1, s2);
const cost = {
  label, served, code: CODE, n: N,
  windows: { control: [iso(c0), iso(c1)], sample: [iso(t0), iso(t2)] },
  control: { statements: sum(control, "calls"), rows: sum(control, "rows"), detail: control },
  sample: { statements: sum(sample, "calls"), rows: sum(sample, "rows"), detail: sample },
  perEnquiry: { statements: (sum(sample, "calls") - sum(control, "calls")) / N, rows: (sum(sample, "rows") - sum(control, "rows")) / N },
  redirects, revisions: [...revisions],
};
check("cost", `${N} enquiries for ${CODE} all redirected to WhatsApp, all served by one revision`, redirects === N && revisions.size === 1 && [...revisions][0] === served, `${redirects}/${N}; ${[...revisions].map((r) => String(r).slice(0, 7))}`);
log(`control ${cost.windows.control.join(" → ")}: ${cost.control.statements} statements, ${cost.control.rows} rows`);
log(`sample  ${cost.windows.sample.join(" → ")}: ${cost.sample.statements} statements, ${cost.sample.rows} rows`);
for (const d of sample) log(`   ${String(d.calls).padStart(4)} calls ${String(d.rows).padStart(6)} rows  ${d.query.slice(0, 150)}`);
log(`per enquiry (sample minus control, / ${N}): ${cost.perEnquiry.statements} statements, ${cost.perEnquiry.rows} rows`);

// ------------------------------------------------------------------ behaviour, freshness, visibility (after the fix)
const made = { garlandProductId: null, media: [] };
const functional = {};
if (args.functional) {
  const required = String(args.require ?? "");
  const rev = await servedRevision(guarded, required);
  if (!/^[0-9a-f]{40}$/.test(required) || !rev.ok) { check("run", "served staging revision contains the fix", false, `${rev.served.slice(0, 7)} vs ${required.slice(0, 7)}`); }
  else {
    const before = await snapshot(q);
    const ids = syntheticIdentities({ q, service, check, log });
    const sharp = createRequire(import.meta.url)("sharp");
    const run_ = tag();
    const revisionOk = (r) => r.headers.get("x-fp-source-revision") === rev.served;
    try {
      const admin = await ids.create({ approved: true, label: "enquiry" });
      await enrolFactor({ sdk: jarClient(sdkFor).sdk, user: admin, due });
      const s = new Map();
      await sleep(2500);
      const login = await w("POST", "/api/admin/auth/login", { jar: s, headers: FORM, body: form({ email: admin.email, password: admin.password }) });
      const mfa = await w("POST", "/admin/mfa", { jar: s, headers: FORM, body: form({ action: "verify", code: await freshCode(admin.secret, due) }) });
      if (login.to !== "/admin/mfa" || mfa.to !== "/admin/dashboard") throw new Error(`admin sign-in failed: ${login.status} ${login.to}; ${mfa.status} ${mfa.to}`);
      check("setup", "synthetic admin signed in at aal2 through the deployed pages", true);

      const slug = `${SYNTHETIC_PREFIX}enquiry-${run_}`;
      const name = `${SYNTHETIC_PREFIX}Enquiry check ${run_}`;
      const code = `FP-G9${String(Number.parseInt(run_, 16) % 100000).padStart(5, "0")}`;
      const [{ id: gid }] = await q(`insert into products (slug, name, short_description, category_id, status, price_type) values ($1, $2, 'Synthetic staging test garland (enquiry)', 22, 'draft', 'quote') returning id`, [slug, name]);
      made.garlandProductId = gid;
      await q(`insert into garland_details (product_id, design_code, selling_mode, photo_permission) values ($1, $2, 'enquiry', 'unconfirmed')`, [gid, code]);
      const refusedFor = `/categories/garlands?unavailable=${code}`;
      const draft = await enquiry(`?code=${code}`);
      check("visibility", "hidden draft (no photo, no permission): refused", draft.status === 303 && draft.location === refusedFor, `${draft.status} ${draft.location}`);

      const fd = new FormData();
      fd.set("file", new Blob([await sharp({ create: { width: 900, height: 900, channels: 3, background: { r: 30, g: 120, b: 90 } } }).png().toBuffer()], { type: "image/png" }), `${SYNTHETIC_PREFIX}enquiry-${run_}.png`);
      fd.set("folder", "products");
      fd.set("altText", `${SYNTHETIC_PREFIX}enquiry`);
      const up = body(await w("POST", "/api/admin/media", { jar: s, headers: { origin: WORKER }, body: fd, store: false }));
      if (!up.ok) throw new Error("upload failed");
      made.media.push({ id: up.data.id, path: up.data.path });
      const g = body(await w("GET", `/api/admin/products/${gid}`, { jar: s, store: false })).data;
      const fields = (over = {}) => ({ name, slug, shortDescription: g.shortDescription, description: g.description, images: [{ mediaId: up.data.id, sortOrder: 0, isPrimary: true, altText: null }], priceType: "fixed", sellingPrice: 4500, compareAtPrice: null, costPrice: null, deliveryChargeOverride: null, categoryId: 22, occasionIds: g.occasionIds, moodIds: g.moodIds, flowerTypeIds: g.flowerTypeIds, whatsIncluded: g.whatsIncluded, careInstructions: g.careInstructions, status: "draft", featured: false, bestseller: false, newArrival: false, requiresWhatsappConfirmation: true, options: [{ optionName: "Finish", valueLabel: "Pearl tassels", extraCharge: 300, sortOrder: 0 }, { optionName: "Finish", valueLabel: "Plain", extraCharge: null, sortOrder: 1 }, { optionName: "Length", valueLabel: "5 ft", extraCharge: null, sortOrder: 2 }], garland: { soldUnit: "pair", sellingMode: "enquiry", photoPermission: "granted", filters: ["rose"] }, ...over });
      const edit = await w("PATCH", `/api/admin/products/${gid}`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify(fields()), store: false });
      check("save", "editor save (photo, permission, pair, three option choices with an extra charge, a price) accepted", edit.status === 200, `${edit.status} ${scrub(body(edit).error ?? "")}`);
      const stillDraft = await enquiry(`?code=${code}`);
      check("visibility", "approved but still a draft: refused", stillDraft.status === 303 && stillDraft.location === refusedFor, `${stillDraft.status}`);

      const tPub = Date.now();
      const pub = await w("POST", `/api/admin/products/${gid}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "published" }), store: false });
      const link = `?code=${code.toLowerCase()}%20&qty=900&opt=Finish::Pearl%20tassels&opt=Finish::Pearl%20tassels&opt=Finish::Diamonds&opt=Length::5%20ft&occ=wedding&for=gift&city=mumbai&utm_source=x`;
      const live = await enquiry(link);
      const secs = (t) => ((Date.now() - t) / 1000).toFixed(1);
      functional.publishedAfterSeconds = secs(tPub);
      const text = wa(live);
      check("fresh", "published through the admin: the enquiry redirects to WhatsApp at once, no rebuild", pub.status === 200 && live.status === 302 && live.location.startsWith("https://wa.me/") && revisionOk(live), `${pub.status} → ${live.status} ${functional.publishedAfterSeconds}s after the save`);
      check("message", "design code and admin title; link to the product page", text.includes(`Design: ${code} — ${name}`) && new RegExp(`Link: https://[^\\s]+/products/${slug}\\n`).test(text), scrub(text.split("\n").slice(1, 3).join(" | ")));
      check("message", "only existing choices, once each; unknown choice dropped", /\nOptions: Finish: Pearl tassels; Length: 5 ft\n/.test(text) && !/Diamonds/.test(text));
      check("message", "quantity capped at 500 with the sold unit; quote-only (no amount, no extra charge)", /\nQuantity: 500 pairs\n/.test(text) && !/₹|4500|\b300\b/.test(text));
      check("message", "recognised city, occasion and purpose", /Recipient city: Mumbai/.test(text) && /\nOccasion: Wedding/.test(text) && /\nFor: /.test(text));
      check("headers", "no-store, noindex, not from the shared cache", live.cache === "no-store" && /noindex/.test(live.headers.get("x-robots-tag") ?? "") && !live.headers.get("x-fp-edge-cache"), `${live.cache}; ${live.headers.get("x-robots-tag")}; edge ${live.headers.get("x-fp-edge-cache")}`);
      const low = wa(await enquiry(`?code=${code}&qty=-3`));
      const junk = wa(await enquiry(`?code=${code}&qty=abc&city=atlantis&occ=nope&for=other&opt=Finish`));
      check("message", "quantity floor 1; unknown city, occasion, purpose and malformed option ignored", /\nQuantity: 1 pair\n/.test(low) && /\nQuantity: 1 pair\n/.test(junk) && !/Recipient city|Occasion:|For:|Options:/.test(junk));
      const head = await enquiry(`?code=${code}`, "HEAD");
      functional.head = head.status;
      check("method", "HEAD answers as before (see the parity probes)", head.status === probes.head.status, `${head.status}`);

      const tArch = Date.now();
      const arch = await w("POST", `/api/admin/products/${gid}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "archived" }), store: false });
      const gone = await enquiry(link);
      functional.refusedAfterSeconds = secs(tArch);
      check("fresh", "archived through the admin: the same link is refused at once, no rebuild", arch.status === 200 && gone.status === 303 && gone.location === refusedFor && revisionOk(gone) && gone.cache === "no-store", `${arch.status} → ${gone.status} ${gone.location} ${functional.refusedAfterSeconds}s after the save`);
      const back = await w("POST", `/api/admin/products/${gid}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "published" }), store: false });
      const again = await enquiry(`?code=${code}`);
      // The editor refuses withdrawing photo permission while published (ProductService: "Unpublish
      // first"), so the design stays public; moving it back to draft hides it.
      const withdraw = await w("PATCH", `/api/admin/products/${gid}`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify(fields({ status: "published", garland: { soldUnit: "pair", sellingMode: "enquiry", photoPermission: "refused", filters: ["rose"] } })), store: false });
      const kept = await enquiry(`?code=${code}`);
      const toDraft = await w("POST", `/api/admin/products/${gid}/status`, { jar: s, headers: JSON_HEADERS, body: JSON.stringify({ status: "draft" }), store: false });
      const drafted = await enquiry(`?code=${code}`);
      check("fresh", "republished → redirects; refused permission edit leaves it public; moved to draft → refused at once", back.status === 200 && again.status === 302 && withdraw.status === 400 && kept.status === 302 && toDraft.status === 200 && drafted.status === 303 && drafted.location === refusedFor && revisionOk(drafted), `${again.status}; withdraw ${withdraw.status} → ${kept.status}; draft ${toDraft.status} → ${drafted.status}`);
      // A stored record always wins: a bundled code with a published record redirects with the admin's title.
      const bundled = await enquiry(`?code=${CODE}`);
      const [rec] = await q(`select p.name from garland_details gd join products p on p.id=gd.product_id where gd.design_code=$1`, [CODE]);
      check("visibility", `bundled design ${CODE} uses its stored record (database over catalogue)`, bundled.status === 302 && wa(bundled).includes(`Design: ${CODE} — ${rec?.name}`), `${bundled.status}`);
    } catch (error) {
      check("run", "completed", false, scrub(String(error?.message ?? error)).slice(0, 200));
    } finally {
      if (made.garlandProductId) await q(`delete from products where id=$1 and slug like $2`, [made.garlandProductId, `${SYNTHETIC_PREFIX}%`]);
      for (const m of made.media) {
        const [row] = await q(`select filename from media where id=$1`, [m.id]);
        if (row && !row.filename.includes(SYNTHETIC_PREFIX.replace(/-$/, ""))) { log("STOP: refusing to delete an unexpected media row"); continue; }
        await q(`delete from media where id=$1`, [m.id]);
        if (m.path) { const { error } = await service.storage.from("media").remove([m.path]); if (error) log("storage remove refused"); }
      }
      const left = (await q(`select (select count(*)::int from products where slug like $1) products, (select count(*)::int from media where filename like $2) media, (select count(*)::int from storage.objects where bucket_id='media' and name = any($3::text[])) objects, (select count(*)::int from garland_details g where not exists (select 1 from products p where p.id=g.product_id)) orphans, (select count(*)::int from product_options o where not exists (select 1 from products p where p.id=o.product_id)) options`, [`${SYNTHETIC_PREFIX}%`, `%fp-staging-test%`, made.media.map((m) => m.path)]))[0];
      check("cleanup", "no synthetic product, garland, option, image or Storage object left", Object.values(left).every((n) => n === 0), JSON.stringify(left));
      await ids.cleanup();
      compareSnapshots(check, before, await snapshot(q), { sequencesMayAdvance: true });
    }
  }
}

const fails = run.finish({ out: args.out, extra: { probes, cost, functional } });
process.exit(fails ? 1 : 0);
