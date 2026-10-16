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

Every event also carries `page_path` and `landing_path` (the first page of the visit, path only). From the national-coverage release, an event also carries `destination_city` (a city slug such as `mumbai`) when the visitor has chosen a recipient city or is on a city page; city pages report `view_item_list` with `item_category` `city:<slug>`. The city is where the flowers are going, not where the visitor is. Never sent: names, phone numbers, addresses, recipient details, card messages or the WhatsApp text.

In GA4, once the property exists: register `landing_path`, `item_category`, `link_type`, `request_type` and `destination_city` as event-scoped custom dimensions, and mark `whatsapp_enquiry_click` and `basket_quote_request` as key events.

## Enquiries are not orders

A click on a WhatsApp button is counted when it is tapped. It does not show that a message was sent or that an order followed. Completed orders are recorded by hand in a file with one row per order:

```csv
date,landing_path,orders
2026-11-03,/categories/garlands/rose,1
```

Ask the customer how they found the page if you can; otherwise leave `landing_path` empty. Keep the file outside the repository: it is business data.

## The 28-day review

Compare the latest 28 complete days with the 28 days before, and keep a 3- or 6-month export for context. Search Console data is about two days behind, so end the period three days ago.

Exports to place in one folder:

| Folder or file | Where it comes from |
|---|---|
| `current/`, `previous/` | Search Console → Performance → Search type: Web → set the date range → Export → CSV. Unzip each. |
| `image-current/`, `image-previous/` | The same with Search type: Image |
| `context/` | The same for the last 3 or 6 months |
| `query-pages.csv` | Query-by-page rows (`query,page,clicks,impressions,position`) from the Search Console API or a Looker Studio table. The website export cannot produce this. |
| `events.csv` | GA4 → Explore → rows `landing_path`, `event_name`; value event count. Rename the columns to `landing_path,event_name,count`. |
| `referrals.csv` | GA4 → Traffic acquisition → session source; columns `source,sessions` |
| `orders.csv` | The hand-kept file above |

Then:

```powershell
node scripts/seo/report.mjs C:\path\to\exports --out C:\path\to\review.md
```

The report covers brand against non-brand queries, Bengaluru and Bangalore commercial queries, queries and landing pages with clicks, impressions, CTR and position, Web against Image search, devices, countries, queries answered by more than one page, enquiries and recorded orders by landing page, and visits referred by AI assistants. Anything not supplied is reported as not supplied.

Reading it:

- Rows under 30 impressions are marked and are not evidence of a change.
- Query totals are lower than page totals because Search Console hides rare queries.
- Two pages showing for one query is a problem only when the query-by-page rows show the less suitable page taking the impressions.
- AI assistant visits are only those that send a referrer; many do not.
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
