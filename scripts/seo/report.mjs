// Search and enquiry review, from files the owner exports
// (docs/seo/measurement.md lists the exact exports). Reads CSV only; nothing
// is fetched or sent.
//
//   node scripts/seo/report.mjs <folder> [--out report.md]
//        [--current-period 2026-10-13..2026-10-20] [--previous-period 2026-10-05..2026-10-12]
//        [--city bengaluru --city hyderabad]
//
// <folder> may contain (every file is optional; a missing one is reported as
// "not supplied", which means not read in this input, never zero activity):
//   current/   previous/   Search Console "Web" exports for each period
//                          (unzipped: Queries.csv, Pages.csv, Countries.csv, Devices.csv)
//   image-current/ image-previous/   the same, exported with Search type: Image
//   context/   a longer period (e.g. 3 or 6 months), for context only
//   query-pages.csv   query,page,clicks,impressions[,position]  (API or Looker Studio)
//   events.csv        landing_path,event_name,count             (GA4 exploration)
//   referrals.csv     source,sessions[,medium]                  (GA4 traffic acquisition)
//   orders.csv        date,landing_path,orders                  (kept by hand)
//
// Periods are whatever the owner states with --current-period and
// --previous-period; without them they are reported as unknown. Changes (Δ)
// are shown only for two stated periods of equal length, the previous one
// ending before the current one starts.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sourceLoader } from "../audit/source-loader.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** A triage heuristic: below this many impressions a row is too thin to read a change from. */
export const MIN_IMPRESSIONS = 30;
const BRAND = /fresh\s*petals?|onlyfreshpetals|freshpetals/i;
const COMMERCIAL = /flower|bouquet|garland|mala|varmala|jaimala|florist|rose|lotus|tuberose|jasmine|mallige|pooja|lily|lilies/i;

/**
 * Assistant sources, by exact normalised hostname (the GA4 session source).
 * A hostname that merely contains one of these words ("chatgpt-coupon.example")
 * is not one, and an OpenAI corporate site (openai.com) is not ChatGPT.
 */
export const AI_SOURCES = {
  "chatgpt.com": "ChatGPT",
  "chat.openai.com": "ChatGPT",
  "search.chatgpt.com": "ChatGPT",
  "perplexity.ai": "Perplexity",
  "www.perplexity.ai": "Perplexity",
  "copilot.microsoft.com": "Microsoft Copilot",
  "gemini.google.com": "Gemini",
  "claude.ai": "Claude",
  "meta.ai": "Meta AI",
  "www.meta.ai": "Meta AI",
};

/** "chatgpt.com", "https://chatgpt.com/", "ChatGPT.com " → "chatgpt.com"; anything with a path or space inside is left as it is. */
const normaliseHost = (value) => String(value ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

/**
 * An exported source (and medium, when the export has one) as an assistant
 * referral, or null. GA4 gives a tagged link (utm_source=chatgpt.com) and a
 * browser referral the same source, so without a medium the provenance is
 * unknown. A "session source / medium" value is split.
 */
export function classifySource(source, medium) {
  let [host, inlineMedium] = String(source ?? "").split(" / ");
  const label = AI_SOURCES[normaliseHost(host)];
  if (!label) return null;
  const how = medium ?? inlineMedium;
  const provenance = how === undefined || how === null || String(how).trim() === "" ? "unknown: source only" : /^referral$/i.test(String(how).trim()) ? "browser referral" : `tagged link (medium "${String(how).trim()}")`;
  return { assistant: label, host: normaliseHost(host), provenance };
}

export function parseCsv(text) {
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

/** A count cell: a whole number ≥ 0 ("1,234" allowed), or null when blank or invalid. */
const count = (value) => {
  const text = String(value ?? "").replace(/[,\s]/g, "");
  return /^\d+$/.test(text) ? Number(text) : null;
};
/** A Search Console position: a number ≥ 1, or null when blank or invalid (never 0). */
const position = (value) => {
  const text = String(value ?? "").replace(/[,\s]/g, "");
  const n = text === "" ? NaN : Number(text);
  return Number.isFinite(n) && n >= 1 ? n : null;
};

/** "2026-10-13..2026-10-20" → { start, end, days }, or null. */
export function parsePeriod(value) {
  const match = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const [start, end] = [Date.parse(`${match[1]}T00:00:00Z`), Date.parse(`${match[2]}T00:00:00Z`)];
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return { start: match[1], end: match[2], days: Math.round((end - start) / 86400000) + 1 };
}

/** Whether two stated periods can be compared, and why not. */
export function comparablePeriods(current, previous) {
  if (!current || !previous) return { comparable: false, reason: "the reporting periods were not both stated (--current-period, --previous-period)" };
  if (current.days !== previous.days) return { comparable: false, reason: `the periods differ in length (${current.days} and ${previous.days} days)` };
  if (previous.end >= current.start) return { comparable: false, reason: "the previous period does not end before the current one starts" };
  return { comparable: true, reason: "" };
}

/** Service cities with their names and aliases, from the shared registry (src/data/serviceCities.ts). */
export function serviceCities() {
  const { SERVICE_CITIES } = sourceLoader({ root: ROOT })("src/data/serviceCities.ts");
  return Array.from(SERVICE_CITIES, (city) => ({ slug: city.slug, name: city.name, serviceable: city.serviceable, names: [...new Set([city.name, city.slug.replace(/-/g, " "), ...city.aliases].map((name) => name.toLowerCase()))] }));
}
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const namesIn = (city) => new RegExp(`(^|[^a-z])(${city.names.map(escape).join("|")})([^a-z]|$)`, "i");

export function buildReport({ dir, now = new Date(), currentPeriod = null, previousPeriod = null, cities = null } = {}) {
  const lines = [];
  const say = (text = "") => lines.push(text);
  const missing = [];
  const unusable = [];

  /** A Search Console table, or null when absent; { error } when a required column is missing. */
  function table(folder, file) {
    const full = path.join(dir, folder, file);
    if (!existsSync(full)) return null;
    const [head = [], ...cells] = parseCsv(readFileSync(full, "utf8").replace(/^﻿/, ""));
    const col = (name) => head.findIndex((title) => title.trim().toLowerCase().startsWith(name));
    const [clicks, impressions, pos] = [col("clicks"), col("impressions"), col("position")];
    const absent = [["clicks", clicks], ["impressions", impressions]].filter(([, index]) => index < 0).map(([name]) => name);
    if (!head.length || absent.length) return { file: `${folder}/${file}`, error: `missing column${absent.length === 1 ? "" : "s"}: ${absent.join(", ") || "header"}` };
    const rows = [];
    let invalid = 0;
    for (const row of cells) {
      const parsed = { key: (row[0] ?? "").trim(), clicks: count(row[clicks]), impressions: count(row[impressions]), position: pos < 0 ? null : position(row[pos]) };
      if (!parsed.key || parsed.clicks === null || parsed.impressions === null) invalid += 1;
      else rows.push(parsed);
    }
    return { file: `${folder}/${file}`, rows, invalid, hasPosition: pos >= 0 };
  }
  function plain(file, required) {
    const full = path.join(dir, file);
    if (!existsSync(full)) return null;
    const [head = [], ...cells] = parseCsv(readFileSync(full, "utf8").replace(/^﻿/, ""));
    const titles = head.map((title) => title.trim().toLowerCase());
    const absent = required.filter((name) => !titles.includes(name));
    if (absent.length) return { file, error: `missing column${absent.length === 1 ? "" : "s"}: ${absent.join(", ")}` };
    return { file, rows: cells.map((row) => Object.fromEntries(titles.map((title, index) => [title, row[index] ?? ""]))) };
  }
  const usable = (result, label) => {
    if (!result) { missing.push(label); return null; }
    if (result.error) { unusable.push(`${result.file} (${result.error})`); return null; }
    return result;
  };

  // Totals over the supplied rows. Position is impression-weighted over the rows that have one, with that denominator.
  const sum = (rows) => rows.reduce((total, row) => ({
    clicks: total.clicks + row.clicks,
    impressions: total.impressions + row.impressions,
    weighted: total.weighted + (row.position ?? 0) * row.impressions,
    positioned: total.positioned + (row.position === null ? 0 : row.impressions),
    unpositioned: total.unpositioned + (row.position === null ? 1 : 0),
  }), { clicks: 0, impressions: 0, weighted: 0, positioned: 0, unpositioned: 0 });
  const ctr = (t) => (t.impressions ? `${((100 * t.clicks) / t.impressions).toFixed(1)}%` : "–");
  const pos = (t) => (t.positioned ? (t.weighted / t.positioned).toFixed(1) : "–");

  const periods = comparablePeriods(currentPeriod, previousPeriod);
  /** Zero, a missing previous export and a row first seen now are three different things. */
  const delta = (value, previousTable, old) => {
    if (!previousTable || !periods.comparable) return "–";
    if (old === undefined) return "new row";
    const change = value - old;
    return `${change >= 0 ? "+" : ""}${change}`;
  };

  function compare(title, current, previous, { filter = () => true, limit = 15 } = {}) {
    say(`### ${title}`);
    if (!current) { say("Not supplied.\n"); return; }
    const before = previous ? new Map(previous.rows.map((row) => [row.key, row])) : null;
    const rows = current.rows.filter((row) => filter(row.key)).sort((a, b) => b.impressions - a.impressions).slice(0, limit);
    if (!rows.length) { say("No rows in this input.\n"); return; }
    say("| | Clicks | Δ | Impressions | Δ | CTR | Position | Note |");
    say("|---|---:|---:|---:|---:|---:|---:|---|");
    for (const row of rows) {
      const old = before?.get(row.key);
      const note = row.impressions < MIN_IMPRESSIONS ? `under ${MIN_IMPRESSIONS} impressions: triage only` : "";
      say(`| ${row.key.replace(/\|/g, "/")} | ${row.clicks} | ${delta(row.clicks, before, old?.clicks)} | ${row.impressions} | ${delta(row.impressions, before, old?.impressions)} | ${ctr(row)} | ${row.position === null ? "not given" : row.position.toFixed(1)} | ${note} |`);
    }
    if (current.invalid) say(`\n${current.invalid} row(s) in ${current.file} had no key or an invalid clicks/impressions value and were left out.`);
    say();
  }

  const selected = (() => {
    const all = serviceCities();
    if (cities?.length) return cities.map((slug) => all.find((city) => city.slug === slug) ?? { slug, name: slug, names: [slug.replace(/-/g, " ")] });
    return all.filter((city) => city.serviceable);
  })();
  const cityTests = selected.map((city) => ({ city, test: namesIn(city) }));
  const namesAnySelected = (q) => cityTests.some(({ test }) => test.test(q));

  const queries = usable(table("current", "Queries.csv"), "current/Queries.csv");
  const queriesBefore = usable(table("previous", "Queries.csv"), "previous/Queries.csv");
  const pages = usable(table("current", "Pages.csv"), "current/Pages.csv");
  const pagesBefore = usable(table("previous", "Pages.csv"), "previous/Pages.csv");

  const describe = (period) => (period ? `${period.start} to ${period.end} (${period.days} days)` : "unknown (not stated)");
  say("# Fresh Petals search and enquiry review");
  say(`Generated ${now.toISOString().slice(0, 10)} from the exports in \`${dir}\`.`);
  say(`- Current period: ${describe(currentPeriod)}.`);
  say(`- Previous period: ${describe(previousPeriod)}.`);
  say(periods.comparable ? "- Changes (Δ) compare the two stated periods." : `- **Not compared:** changes (Δ) are not shown because ${periods.reason}.`);
  say("- Search Console hides rare queries, so totals by query are lower than totals by page. Every total below is over the rows supplied, not the whole property.");
  say(`- Rows under ${MIN_IMPRESSIONS} impressions are marked; that is a triage heuristic, not a test of significance.\n`);

  say("## Totals over the supplied query rows");
  if (queries) {
    const segment = (table, test) => sum(table.rows.filter((row) => test(row.key)));
    const parts = [
      ["All queries supplied", () => true],
      ["Brand (Fresh Petals)", (q) => BRAND.test(q)],
      ["Non-brand", (q) => !BRAND.test(q)],
    ];
    say("| Segment | Clicks | Previous | Impressions | Previous | CTR | Avg position (impression-weighted) |");
    say("|---|---:|---:|---:|---:|---:|---:|");
    for (const [name, test] of parts) {
      const current = segment(queries, test), before = queriesBefore && periods.comparable ? segment(queriesBefore, test) : null;
      say(`| ${name} | ${current.clicks} | ${before?.clicks ?? "–"} | ${current.impressions} | ${before?.impressions ?? "–"} | ${ctr(current)} | ${pos(current)} |`);
    }
    const all = segment(queries, () => true);
    if (!queries.hasPosition) say("\nThe query export has no position column; no position is reported.");
    else if (all.unpositioned) say(`\n${all.unpositioned} row(s) had no valid position and are left out of the average (its denominator is the ${all.positioned} impressions with one).`);
    if (queries.invalid) say(`\n${queries.invalid} row(s) had no query or an invalid clicks/impressions value and were left out.`);
    say();
  } else say("Search Console query export not supplied or not usable.\n");

  say("## Web search");
  compare("Non-brand queries", queries, queriesBefore, { filter: (q) => !BRAND.test(q), limit: 25 });

  say("## City names in query text");
  say(`City names (with their registry aliases) that appear in the query text: ${selected.map((city) => city.name).join(", ")}. This is what people typed, not where they were searching from. A query naming two cities is in both city rows and counted once in the total.\n`);
  if (queries) {
    const commercial = (q) => !BRAND.test(q) && COMMERCIAL.test(q);
    const rows = cityTests.map(({ city, test }) => ({ city, total: sum(queries.rows.filter((row) => commercial(row.key) && test.test(row.key))) })).filter(({ total }) => total.impressions > 0 || total.clicks > 0);
    say("| City named in the query (non-brand, flower terms) | Clicks | Impressions | CTR |");
    say("|---|---:|---:|---:|");
    for (const { city, total } of rows) say(`| ${city.name} | ${total.clicks} | ${total.impressions} | ${ctr(total)} |`);
    const union = sum(queries.rows.filter((row) => commercial(row.key) && namesAnySelected(row.key)));
    say(`| **Any of these cities (each query once)** | ${union.clicks} | ${union.impressions} | ${ctr(union)} |`);
    say();
    compare("Queries naming a selected city", queries, queriesBefore, { filter: (q) => commercial(q) && namesAnySelected(q), limit: 25 });
  } else say("Not supplied.\n");

  compare("Landing pages", pages, pagesBefore, { limit: 25 });
  compare("Devices", usable(table("current", "Devices.csv"), "current/Devices.csv"), usable(table("previous", "Devices.csv"), "previous/Devices.csv"));
  compare("Countries", usable(table("current", "Countries.csv"), "current/Countries.csv"), usable(table("previous", "Countries.csv"), "previous/Countries.csv"), { limit: 8 });

  say("## Image search");
  compare("Image queries", usable(table("image-current", "Queries.csv"), "image-current/Queries.csv"), usable(table("image-previous", "Queries.csv"), "image-previous/Queries.csv"));
  compare("Image landing pages", usable(table("image-current", "Pages.csv"), "image-current/Pages.csv"), usable(table("image-previous", "Pages.csv"), "image-previous/Pages.csv"));

  say("## Longer period (context only)");
  compare("Queries", usable(table("context", "Queries.csv"), "context/Queries.csv"), null, { limit: 15 });

  say("## Queries shown with more than one page");
  const queryPages = usable(plain("query-pages.csv", ["query", "page", "clicks", "impressions"]), "query-pages.csv");
  if (!queryPages) say("Not supplied or not usable (`query-pages.csv`). Separate Queries and Pages exports cannot show which page answered which query.\n");
  else {
    const byQuery = new Map();
    for (const row of queryPages.rows) {
      const impressions = count(row.impressions);
      if (!row.query || !row.page || impressions === null) continue;
      byQuery.set(row.query, [...(byQuery.get(row.query) ?? []), { page: row.page, clicks: count(row.clicks) ?? 0, impressions, position: position(row.position) }]);
    }
    const shared = [...byQuery].filter(([, list]) => list.filter((item) => item.impressions >= MIN_IMPRESSIONS).length > 1);
    if (!shared.length) say(`No query has two pages with at least ${MIN_IMPRESSIONS} impressions each.\n`);
    for (const [query, list] of shared.slice(0, 15)) {
      say(`- **${query}**`);
      for (const item of list.sort((a, b) => b.impressions - a.impressions)) say(`  - ${item.page}: ${item.impressions} impressions, ${item.clicks} clicks, position ${item.position === null ? "not given" : item.position.toFixed(1)}`);
    }
    if (shared.length) say("\nEach is a candidate to review, not a finding: two pages for one query matter only if the less suitable page takes the impressions or neither ranks well.\n");
  }

  say("## Enquiries by landing page");
  const events = usable(plain("events.csv", ["landing_path", "event_name", "count"]), "events.csv");
  const orders = usable(plain("orders.csv", ["date", "landing_path", "orders"]), "orders.csv");
  if (!events) say("Not supplied or not usable (`events.csv`): no enquiry rows were read. That is not a count of zero.\n");
  else {
    const byPage = new Map();
    const bump = (page, field, amount) => byPage.set(page, { ...(byPage.get(page) ?? { enquiries: 0, baskets: 0, orders: 0 }), [field]: (byPage.get(page)?.[field] ?? 0) + amount });
    let invalid = 0;
    for (const row of events.rows) {
      const value = count(row.count);
      if (value === null) { invalid += 1; continue; }
      if (row.event_name === "whatsapp_enquiry_click") bump(row.landing_path || "(not set)", "enquiries", value);
      if (row.event_name === "basket_quote_request") bump(row.landing_path || "(not set)", "baskets", value);
    }
    for (const row of orders?.rows ?? []) bump(row.landing_path || "(not recorded)", "orders", count(row.orders) ?? 0);
    if (!byPage.size) say("No enquiry or basket rows in this input.\n");
    else {
      say("| Landing page | WhatsApp enquiry clicks | Basket requests | Completed orders (recorded by hand) |");
      say("|---|---:|---:|---:|");
      for (const [page, row] of [...byPage].sort((a, b) => b[1].enquiries + b[1].baskets - (a[1].enquiries + a[1].baskets))) say(`| ${page} | ${row.enquiries} | ${row.baskets} | ${orders ? row.orders : "not supplied"} |`);
    }
    if (invalid) say(`\n${invalid} event row(s) had an invalid count and were left out.`);
    say("\nAn enquiry click is a tap on a WhatsApp button, not a message sent or an order. Orders count only when recorded in `orders.csv`; a page missing here was not observed in this input.\n");
  }

  say("## Visits from AI assistants (by referring source)");
  const referrals = usable(plain("referrals.csv", ["source", "sessions"]), "referrals.csv");
  if (!referrals) say("Not supplied or not usable (`referrals.csv`).\n");
  else {
    const hasMedium = referrals.rows.length > 0 && Object.prototype.hasOwnProperty.call(referrals.rows[0], "medium");
    const ai = referrals.rows.map((row) => ({ row, match: classifySource(row.source, hasMedium ? row.medium : undefined) })).filter(({ match }) => match);
    if (!ai.length) say("None of the supplied sources is a listed assistant hostname. Many assistant visits send no referrer and cannot be seen this way.\n");
    else {
      say("| Source | Assistant | How it arrived | Sessions |");
      say("|---|---|---|---:|");
      for (const { row, match } of ai) say(`| ${match.host} | ${match.assistant} | ${match.provenance} | ${count(row.sessions) ?? "invalid"} |`);
      say(`\nOnly exact hostnames count (${Object.keys(AI_SOURCES).join(", ")}).${hasMedium ? "" : " The export has no medium column, so a browser referral and a tagged link look the same."} None of these rows shows that an assistant cited or recommended the site.\n`);
    }
  }

  say("## Next priorities");
  say("Write at most three, each tied to a row above. Leave blank if the data is too thin to support one.\n\n1. \n2. \n3. \n");
  if (missing.length) say(`Not supplied this cycle: ${missing.join(", ")}.`);
  if (unusable.length) say(`Supplied but not usable: ${unusable.join("; ")}.`);
  return lines.join("\n");
}

export function parseArgs(argv) {
  const value = (flag) => { const index = argv.indexOf(flag); return index > -1 ? argv[index + 1] : null; };
  const cities = argv.flatMap((arg, index) => (arg === "--city" && argv[index + 1] ? [argv[index + 1].toLowerCase()] : []));
  const raw = { current: value("--current-period"), previous: value("--previous-period") };
  return {
    dir: argv[0] && !argv[0].startsWith("--") ? argv[0] : null,
    out: value("--out"),
    cities: cities.length ? cities : null,
    currentPeriod: parsePeriod(raw.current),
    previousPeriod: parsePeriod(raw.previous),
    badPeriods: Object.entries(raw).filter(([, text]) => text && !parsePeriod(text)).map(([name, text]) => `--${name}-period ${text}`),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir || !existsSync(args.dir) || args.badPeriods.length) {
    if (args.badPeriods.length) console.error(`Not a period (use YYYY-MM-DD..YYYY-MM-DD): ${args.badPeriods.join(", ")}`);
    console.error("Usage: node scripts/seo/report.mjs <folder> [--out report.md] [--current-period YYYY-MM-DD..YYYY-MM-DD] [--previous-period YYYY-MM-DD..YYYY-MM-DD] [--city <slug> ...]");
    process.exit(1);
  }
  const text = buildReport(args);
  if (args.out) { writeFileSync(args.out, text); console.log(`Report written to ${args.out}`); }
  else console.log(text);
}
