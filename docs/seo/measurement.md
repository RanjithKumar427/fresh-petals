# Measuring search and enquiries

## What exists

Nothing is recorded until the owner sets `PUBLIC_GA_MEASUREMENT_ID` (see `owner-checklist.md`). Before that, `src/components/Analytics.astro` only announces events on the page and makes no network request.

| Event | When | Parameters |
|---|---|---|
| `page_view` (GA4's own) | every page | page address without its query string |
| `view_item_list` | a collection or guide opens | `item_category` (`garlands`, `garlands/rose`, `guide/wedding-garlands`) |
| `view_item` | a product page opens | `item_id` (design code or product slug), `item_category` |
| `whatsapp_enquiry_click` | a direct WhatsApp enquiry link or button is tapped | `item_id`, `item_category`, `link_type` (`card`, `page`, `site`) |
| `basket_quote_request` | the basket is sent on WhatsApp | `item_id` (slugs), `item_category`, `item_count`, `request_type` (`price_request` or `order_request`) |

Every event also carries `page_path` and `landing_path` (the first page of the visit, path only; see "Application context" below). From the national-coverage release, an event also carries `destination_city` (a city slug such as `mumbai`) when the visitor has chosen a recipient city or is on a city page; city pages report `view_item_list` with `item_category` `city:<slug>`. The city is where the flowers are going, not where the visitor is. Never sent: names, phone numbers, addresses, recipient details, card messages or the WhatsApp text.

In GA4, once the property exists: register `landing_path`, `item_category`, `link_type`, `request_type` and `destination_city` as event-scoped custom dimensions, and mark `whatsapp_enquiry_click` and `basket_quote_request` as key events.

## Application context (from 21 October 2026)

`landing_path`, `ai_referrer` and `ai_attribution` come from the site's own application context (`src/scripts/inline/analytics.js`), kept in the browser tab's `sessionStorage` as `fp_context` with the time of the last activity. It is not GA4's session and changes no GA4 setting.

- **Activity:** a page load, a tap, a key press, a page shown again from the back/forward cache, or an event. Nothing runs on a timer.
- **Ends after 30 minutes without activity.** The next page then starts a new context: its landing path is that page, and it may label an allowlisted assistant from that page's own referrer (`ai_attribution` `referrer`) or exact `utm_source` (`campaign`).
- **A tab left open past 30 minutes:** the next tap or event starts a new context on that page with no assistant label, so the entry referrer or campaign of a page loaded hours earlier is never reported as a fresh referral.
- **Active internal navigation** keeps the landing path and label.
- **Earlier keys** (`fp_landing`, `fp_ai_ref`, `fp_ai_method`, which had no time) are continued only when the page was reached from another page of the site, then removed. A malformed or future-dated context is discarded. Without storage, the context lives in the page only.
- Still never read or sent: the referrer's path or query, the page's query string, customer details or message text. Google or direct traffic is never labelled as AI.

Before 21 October the label and landing path lasted for the whole browser-tab session, so `ai_referrer` events from that time can carry a label from a much earlier entry.

## Enquiries are not orders

A click on a WhatsApp button is counted when it is tapped. It does not show that a message was sent or that an order followed. Completed orders are recorded by hand in a file with one row per order:

```csv
date,landing_path,orders
2026-11-03,/categories/garlands/rose,1
```

Ask the customer how they found the page if you can; otherwise leave `landing_path` empty. Keep the file outside the repository: it is business data.

## The periodic review

Choose two periods of equal length, the previous one ending before the current one starts, and note the exact dates you exported. Check in Search Console that the last day of the current period has complete data before relying on it; this document assumes no fixed delay. Keep a 3- or 6-month export for context.

Exports to place in one folder:

| Folder or file | Where it comes from |
|---|---|
| `current/`, `previous/` | Search Console → Performance → Search type: Web → set the date range → Export → CSV. Unzip each. |
| `image-current/`, `image-previous/` | The same with Search type: Image |
| `context/` | The same for the last 3 or 6 months |
| `query-pages.csv` | Query-by-page rows (`query,page,clicks,impressions,position`) from the Search Console API or a Looker Studio table. The website export cannot produce this. |
| `events.csv` | GA4 → Explore → rows `landing_path`, `event_name`; value event count. Rename the columns to `landing_path,event_name,count`. |
| `referrals.csv` | GA4 → Traffic acquisition → session source; columns `source,sessions`, and `medium` if you add session medium (otherwise a browser referral and a tagged link cannot be told apart) |
| `orders.csv` | The hand-kept file above |

Then:

```powershell
node scripts/seo/report.mjs C:\path\to\exports --out C:\path\to\review.md --current-period 2026-11-01..2026-11-28 --previous-period 2026-10-04..2026-10-31
```

Add `--city <slug>` (repeatable) to look at particular cities; without it every serviceable city in `src/data/serviceCities.ts`, with its aliases (Bangalore, Gurgaon …), is used.

The report covers brand against non-brand queries, queries naming a service city, queries and landing pages with clicks, impressions, CTR and position, Web against Image search, devices, countries, queries shown with more than one page, enquiries and recorded orders by landing page, and visits from AI assistant hostnames. Anything not supplied is reported as not supplied, and a file missing a required column as not usable.

Reading it:

- **Periods:** without both `--current-period` and `--previous-period` the periods are "unknown" and no change (Δ) is computed; the same when the lengths differ or the periods overlap. A change from zero is shown as a number, a row absent from the previous export as "new row", and a missing previous export as "–".
- Rows under 30 impressions are marked: a triage heuristic, not a test.
- Totals and averages are over the rows supplied, not the whole property. Average position is weighted by impressions over the rows that have a valid position; rows without one are counted and left out, never treated as position 0.
- Query totals are lower than page totals because Search Console hides rare queries.
- **City rows** count city names typed in the query, not where the searcher was. A query naming two cities appears in both rows; the total counts it once.
- Two pages for one query is a candidate to review, not a finding: it matters only when the query-by-page rows show the less suitable page taking the impressions. Separate Queries and Pages exports cannot show which page answered which query.
- **AI assistants:** only exact hostnames count (`chatgpt.com`, `chat.openai.com`, `perplexity.ai`, `copilot.microsoft.com`, `gemini.google.com`, `claude.ai`, `meta.ai` and their listed variants). A lookalike or an `openai.com` page does not. Without a medium column the report says the provenance is unknown. Many assistant visits send no referrer, and no row shows that an assistant cited the site.
- A missing `events.csv` means no enquiry rows were read, not zero enquiries.
- For the first cycles after a release, expect new pages to have impressions before clicks.
- Choose at most three priorities, each tied to a row in the report.

## Five signals, reported separately

Search impressions, search clicks, AI visibility, WhatsApp clicks and confirmed orders come from different tools and count different things. Report each on its own line and never add or divide one by another across tools:

| Signal | Source | What it does not show |
|---|---|---|
| Impressions (Web, and Image separately) | Search Console → Performance | That a page ranks above a competitor or appears in an AI answer |
| Clicks | Search Console → Performance | Enquiries or orders |
| AI visibility | Search Console AI reports where the property offers them; `ai_referrer` sessions in GA4; sampled prompts (`assistant-benchmark.md`) | Assistants that send no referrer |
| WhatsApp clicks | GA4 `whatsapp_enquiry_click`, `basket_quote_request` | That a message was sent or received |
| Confirmed orders | The hand-kept orders file | Anything about search, by itself |

## Account checks outstanding (16 October 2026)

None of these was inspected for the image-discovery release; each is **unverified** until read in the account. Missing reports or sparse data are not by themselves a site defect.

| Check | Where | What to record |
|---|---|---|
| Sitemap processing | Search Console → Sitemaps | `sitemap.xml` and `sitemap-garlands.xml` read after the deployment date, status Success, discovered pages 221 and about 161; any image-related error |
| Representative URL inspections | URL Inspection | `/products/red-affair` (own photograph), `/products/jasmine-gajra` (representative photograph), `/products/closed-pink-lotus-garland-with-bud-stem-tassels` (FP-G106): indexing state, Google-selected canonical, last crawl |
| Image search | Performance → Search type: Image | Whether any data exists; keep it apart from Web |
| AI features inclusion and reports | Property settings and reports | Whether the property shows any AI inclusion setting or AI performance report, and its state; record "not offered" if absent |
| Other image or multimodal reports | Search Console report list | Name of any report that appears; none is assumed |
| GA4 ↔ Search Console link | GA4 Admin → Product links | Linked or not |
| Key events and custom dimensions | GA4 Admin → Events, Custom definitions | `whatsapp_enquiry_click` and `basket_quote_request` marked as key events; the seven dimensions registered |

## Baseline

### Pre-release figures, 13–18 October 2026 (historical)

GA4 figures for 13–18 October 2026, before the catalogue release of 19 October. They are a dated record, not current performance, and the WhatsApp figures are taps, not orders:

| Measure | 13–18 Oct 2026 |
|---|---|
| Google organic sessions / engaged sessions | 5 / 4 |
| Direct sessions / engaged sessions | 586 / 23 |
| WhatsApp enquiry clicks, all sources | 13 |
| WhatsApp enquiry clicks attributed to Google organic | 2 |

The five Google organic landing paths: `/`, `/locations/bengaluru`, `/categories/garlands/lotus`, `/categories/pooja-flowers` and `/categories/subscriptions`.

- Tracking began on 13 October 2026, so there is no earlier period to compare with, and no 28-day pre-tracking baseline exists.
- 19 October 2026 is the catalogue release transition: periods that span it mix two catalogues.
- 20 October 2026 is a past day, but whether its data is complete in GA4 and Search Console still has to be checked in the accounts.
- The application context changed on 21 October (above); `landing_path` and `ai_referrer` before and after it are not strictly comparable.
- No Search Console export was available for this release, so no query, page, indexing, ranking or AI-visibility figure is recorded here.

### Earlier state

As of 12 October 2026 the Search Console property exists but holds no data yet ("processing"), there is no analytics, and therefore there is no measured baseline for impressions, clicks, enquiries or orders. The technical baseline (titles, canonicals, indexing, structured data, images) is in `search-growth-2026-10.md`. The measured baseline is the first full 28 days of Search Console data.

## GA4 is live (13 October 2026)

- Property stream: "Fresh Petals website", `https://onlyfreshpetals.in/`, Measurement ID `G-V75FJQ06ZS`, Stream ID 16121182207.
- `PUBLIC_GA_MEASUREMENT_ID` is set in Vercel for **Production only**. Preview deployments and local builds have no ID, load no Google tag and send nothing.
- One tag, loaded once by `src/components/Analytics.astro`. No Tag Manager container and no second snippet: adding either would double-count.
- **Baseline date: 13 October 2026.** There is no analytics data before it. The first figures to trust are for the first complete week after it.

### Settings to make once in GA4 (Admin)

1. Custom definitions → create event-scoped custom dimensions for: `landing_path`, `item_category`, `link_type`, `request_type`, `destination_city`, `ai_referrer`, `ai_attribution`. Until registered they are collected but do not appear in reports.
2. Events → mark `whatsapp_enquiry_click` and `basket_quote_request` as key events. They are enquiries, not purchases; do not map them to `purchase` or give them a value.
3. Data retention → 14 months.
4. Leave Google signals and ads personalisation off (the site sends neither).

### Weekly review (first one: after the first complete week of data)

In Explore, a free-form table for the last complete week, with a page-path filter per group:

| Group | Page path filter |
|---|---|
| City pages | begins with `/locations/` |
| Products | begins with `/products/` |
| Guides | begins with `/guides` |

For each group record: sessions; session source / medium; `ai_referrer` sessions (assistant visits, labelled by hostname or allowlisted campaign only); `whatsapp_enquiry_click` and `basket_quote_request` counts; and click rate = enquiry events ÷ sessions for that group. Break enquiry events down by `item_id` (product slug or FP-G design code) and `destination_city`.

Read alongside Search Console (Performance → Pages and Queries, same week) for impressions and queries; the two tools count different things and are not added together. Under about 100 sessions in a group, treat a click rate as a count, not a rate, and make no change on it. A recommendation is written only from these figures; with no data yet, none is made.
