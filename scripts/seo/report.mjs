// Search and enquiry review: the latest 28 complete days against the 28 days
// before, from files the owner exports (docs/seo/measurement.md lists the
// exact exports). Reads CSV only; nothing is fetched or sent.
//
//   node scripts/seo/report.mjs <folder> [--out report.md]
//
// <folder> may contain (every file is optional; missing ones are reported as
// "not supplied", never guessed):
//   current/   previous/   Search Console "Web" exports for each period
//                          (unzipped: Queries.csv, Pages.csv, Countries.csv, Devices.csv)
//   image-current/ image-previous/   the same, exported with Search type: Image
//   context/   a longer period (e.g. 3 or 6 months), for context only
//   query-pages.csv   query,page,clicks,impressions[,position]  (API or Looker Studio)
//   events.csv        landing_path,event_name,count             (GA4 exploration)
//   referrals.csv     source,sessions                           (GA4 traffic acquisition)
//   orders.csv        date,landing_path,orders                  (kept by hand)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error("Usage: node scripts/seo/report.mjs <folder> [--out report.md]");
  process.exit(1);
}
const outFlag = process.argv.indexOf("--out");
const out = outFlag > -1 ? process.argv[outFlag + 1] : null;

/** Below this many impressions a change is noise, not a trend. */
const MIN_IMPRESSIONS = 30;
const BRAND = /fresh\s*petals?|onlyfreshpetals|freshpetals/i;
const LOCAL = /bengaluru|bangalore|bengalooru|basavanagudi|chamarajpet|chamrajpet/i;
const COMMERCIAL = /flower|bouquet|garland|mala|varmala|jaimala|florist|rose|lotus|tuberose|jasmine|mallige|pooja|lily|lilies/i;
const AI_SOURCES = /chatgpt|openai|perplexity|copilot|gemini|bard|claude|you\.com|phind|deepseek|meta\.ai/i;

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((cells) => cells.some((value) => value.trim()));
}
const number = (value) => Number(String(value ?? "").replace(/[%,\s]/g, "")) || 0;

/** A Search Console table as [{key, clicks, impressions, position}], or null when the file is absent. */
function table(folder, file) {
  const full = path.join(dir, folder, file);
  if (!existsSync(full)) return null;
  const [head, ...rows] = parseCsv(readFileSync(full, "utf8").replace(/^﻿/, ""));
  const col = (name) => head.findIndex((title) => title.trim().toLowerCase().startsWith(name));
  const [clicks, impressions, position] = [col("clicks"), col("impressions"), col("position")];
  return rows.map((cells) => ({ key: cells[0], clicks: number(cells[clicks]), impressions: number(cells[impressions]), position: number(cells[position]) }));
}
function plain(file) {
  const full = path.join(dir, file);
  if (!existsSync(full)) return null;
  const [head, ...rows] = parseCsv(readFileSync(full, "utf8").replace(/^﻿/, ""));
  return rows.map((cells) => Object.fromEntries(head.map((title, index) => [title.trim().toLowerCase(), cells[index] ?? ""])));
}

const sum = (rows) => rows.reduce((total, row) => ({ clicks: total.clicks + row.clicks, impressions: total.impressions + row.impressions, weighted: total.weighted + row.position * row.impressions }), { clicks: 0, impressions: 0, weighted: 0 });
const ctr = (t) => (t.impressions ? `${((100 * t.clicks) / t.impressions).toFixed(1)}%` : "–");
const pos = (t) => (t.impressions ? (t.weighted / t.impressions).toFixed(1) : "–");
const delta = (now, before) => (before ? `${now - before >= 0 ? "+" : ""}${now - before}` : "new");
const lines = [];
const say = (text = "") => lines.push(text);
const missing = [];

function compare(title, current, previous, { filter = () => true, limit = 15 } = {}) {
  say(`### ${title}`);
  if (!current) { say("Not supplied.\n"); missing.push(title); return; }
  const before = new Map((previous ?? []).map((row) => [row.key, row]));
  const rows = current.filter((row) => filter(row.key)).sort((a, b) => b.impressions - a.impressions).slice(0, limit);
  if (!rows.length) { say("No rows.\n"); return; }
  say("| | Clicks | Δ | Impressions | Δ | CTR | Position | Note |");
  say("|---|---:|---:|---:|---:|---:|---:|---|");
  for (const row of rows) {
    const old = before.get(row.key);
    const note = row.impressions < MIN_IMPRESSIONS ? "too few impressions to judge" : "";
    say(`| ${row.key.replace(/\|/g, "/")} | ${row.clicks} | ${previous ? delta(row.clicks, old?.clicks) : "–"} | ${row.impressions} | ${previous ? delta(row.impressions, old?.impressions) : "–"} | ${ctr({ ...row })} | ${row.position.toFixed(1)} | ${note} |`);
  }
  say();
}

const [queries, queriesBefore] = [table("current", "Queries.csv"), table("previous", "Queries.csv")];
const [pages, pagesBefore] = [table("current", "Pages.csv"), table("previous", "Pages.csv")];

say("# Fresh Petals search and enquiry review");
say(`Generated ${new Date().toISOString().slice(0, 10)} from the exports in \`${dir}\`. Write the two 28-day periods here: current ______ , previous ______ .`);
say("Search Console data arrives about two days late and hides rare queries, so totals by query are lower than totals by page. Rows marked \"too few impressions\" are not evidence of a change.\n");

say("## Totals");
if (queries) {
  const segment = (rows, test) => sum(rows.filter((row) => test(row.key)));
  const parts = [
    ["All queries shown", () => true],
    ["Brand (Fresh Petals)", (q) => BRAND.test(q)],
    ["Non-brand", (q) => !BRAND.test(q)],
    ["Non-brand, Bengaluru/Bangalore + flower terms", (q) => !BRAND.test(q) && LOCAL.test(q) && COMMERCIAL.test(q)],
  ];
  say("| Segment | Clicks | Previous | Impressions | Previous | CTR | Avg position |");
  say("|---|---:|---:|---:|---:|---:|---:|");
  for (const [name, test] of parts) {
    const now = segment(queries, test), before = queriesBefore ? segment(queriesBefore, test) : null;
    say(`| ${name} | ${now.clicks} | ${before?.clicks ?? "–"} | ${now.impressions} | ${before?.impressions ?? "–"} | ${ctr(now)} | ${pos(now)} |`);
  }
  say();
} else { say("Search Console query export not supplied.\n"); missing.push("current/Queries.csv"); }

say("## Web search");
compare("Non-brand queries", queries, queriesBefore, { filter: (q) => !BRAND.test(q), limit: 25 });
compare("Bengaluru / Bangalore commercial queries", queries, queriesBefore, { filter: (q) => !BRAND.test(q) && LOCAL.test(q) && COMMERCIAL.test(q), limit: 25 });
compare("Landing pages", pages, pagesBefore, { limit: 25 });
compare("Devices", table("current", "Devices.csv"), table("previous", "Devices.csv"));
compare("Countries", table("current", "Countries.csv"), table("previous", "Countries.csv"), { limit: 8 });

say("## Image search");
compare("Image queries", table("image-current", "Queries.csv"), table("image-previous", "Queries.csv"));
compare("Image landing pages", table("image-current", "Pages.csv"), table("image-previous", "Pages.csv"));

say("## Longer period (context only)");
compare("Queries", table("context", "Queries.csv"), null, { limit: 15 });

say("## Queries answered by more than one page");
const queryPages = plain("query-pages.csv");
if (!queryPages) { say("Not supplied (`query-pages.csv`). Two pages appearing for one query is only a problem when it is shown here.\n"); missing.push("query-pages.csv"); }
else {
  const byQuery = new Map();
  for (const row of queryPages) byQuery.set(row.query, [...(byQuery.get(row.query) ?? []), { page: row.page, clicks: number(row.clicks), impressions: number(row.impressions), position: number(row.position) }]);
  const shared = [...byQuery].filter(([, list]) => list.filter((item) => item.impressions >= MIN_IMPRESSIONS).length > 1);
  if (!shared.length) say(`No query has two pages with at least ${MIN_IMPRESSIONS} impressions each.\n`);
  for (const [query, list] of shared.slice(0, 15)) {
    say(`- **${query}**`);
    for (const item of list.sort((a, b) => b.impressions - a.impressions)) say(`  - ${item.page}: ${item.impressions} impressions, ${item.clicks} clicks, position ${item.position.toFixed(1)}`);
  }
  if (shared.length) say("\nReview each: it matters only if the less suitable page is taking the impressions or neither ranks well.\n");
}

say("## Enquiries by landing page");
const events = plain("events.csv");
const orders = plain("orders.csv");
if (!events) { say("Not supplied (`events.csv`). Enquiry events need Google Analytics to be switched on first.\n"); missing.push("events.csv"); }
else {
  const byPage = new Map();
  const bump = (page, field, amount) => byPage.set(page, { ...(byPage.get(page) ?? { enquiries: 0, baskets: 0, orders: 0 }), [field]: (byPage.get(page)?.[field] ?? 0) + amount });
  for (const row of events) {
    if (row.event_name === "whatsapp_enquiry_click") bump(row.landing_path, "enquiries", number(row.count));
    if (row.event_name === "basket_quote_request") bump(row.landing_path, "baskets", number(row.count));
  }
  for (const row of orders ?? []) bump(row.landing_path || "(not recorded)", "orders", number(row.orders));
  say("| Landing page | WhatsApp enquiry clicks | Basket requests | Completed orders (recorded by hand) |");
  say("|---|---:|---:|---:|");
  for (const [page, row] of [...byPage].sort((a, b) => b[1].enquiries + b[1].baskets - (a[1].enquiries + a[1].baskets))) say(`| ${page} | ${row.enquiries} | ${row.baskets} | ${orders ? row.orders : "not supplied"} |`);
  say("\nAn enquiry click is a tap on a WhatsApp button, not a message sent or an order. Orders count only when recorded in `orders.csv`.\n");
}

say("## Visits referred by AI assistants");
const referrals = plain("referrals.csv");
if (!referrals) { say("Not supplied (`referrals.csv`).\n"); missing.push("referrals.csv"); }
else {
  const ai = referrals.filter((row) => AI_SOURCES.test(row.source ?? ""));
  if (!ai.length) say("None identifiable in this export. Many AI visits arrive without a referrer and cannot be seen.\n");
  for (const row of ai) say(`- ${row.source}: ${number(row.sessions)} sessions`);
  if (ai.length) say();
}

say("## Next priorities");
say("Write at most three, each tied to a row above. Leave blank if the data is too thin to support one.\n\n1. \n2. \n3. \n");
if (missing.length) say(`Not supplied this cycle: ${missing.join(", ")}.`);

const text = lines.join("\n");
if (out) { writeFileSync(out, text); console.log(`Report written to ${out}`); }
else console.log(text);
