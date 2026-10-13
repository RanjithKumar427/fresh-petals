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

## Baseline

As of 12 October 2026 the Search Console property exists but holds no data yet ("processing"), there is no analytics, and therefore there is no measured baseline for impressions, clicks, enquiries or orders. The technical baseline (titles, canonicals, indexing, structured data, images) is in `search-growth-2026-10.md`. The measured baseline is the first full 28 days of Search Console data.
