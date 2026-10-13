# Search-assistant benchmark: prompts and results template

A reusable way to sample whether search assistants mention or cite Fresh Petals for unbranded questions. It measures a sample on a day, nothing more. It is not an appearance rate, a ranking, or a forecast.

## Status

**Baseline: NOT RUN.** No independent, authorised assistant access was available when this was prepared (13 Oct 2026). The session that built the site has discussed Fresh Petals at length, so anything it asked an assistant would not be independent, and a web-search tool is not an assistant. No account, API access or privacy setting was changed or bought to get around that.

**About the prompt list.** The release brief referred to twenty prompts in an attachment. That attachment was not present on this machine, so the twenty prompts below were drafted from the site's own query-family maps (`national-coverage-2026-10.md`, `city-hubs-release-2-2026-10.md`). If the owner's list differs, replace this table with it and keep the numbering.

## How to run it

1. Use a fresh, temporary or guest conversation for every prompt, signed out where the product allows it, with memory and personalisation off. Do not mention Fresh Petals before or during the prompt.
2. Turn web search on where it is a setting, and record whether it was on.
3. Paste the prompt exactly. Do not follow up.
4. Record the first answer only, on the day, in the results table.
5. Run the whole list in one sitting per engine, so the rows are comparable. Repeat no more than monthly.

Known limits to write down each time: the assistant's location is usually the account's or the IP's, not the recipient city's; answers vary between runs; a signed-in account may be personalised; model versions change without notice.

## The twenty prompts (all unbranded)

| # | Family | Prompt |
|---|---|---|
| 1 | Bouquet choice | How do I choose between a rose bouquet, a lily bouquet and a mixed flower bouquet as a gift? |
| 2 | Bouquet choice | Should I send a wrapped bouquet or flowers in a vase to someone's office in India? |
| 3 | Bouquet choice | Which flowers are suitable for a parent's wedding anniversary in India? |
| 4 | Sending | How do I send flowers to someone in another city in India, and what details will the florist need? |
| 5 | Sending | I live abroad. How can I send a birthday bouquet to my mother in Kolkata? |
| 6 | Sending | Where can I order a bouquet online for delivery in Pune and confirm the price before paying? |
| 7 | City | Online florists that deliver bouquets in Bengaluru and confirm orders on WhatsApp |
| 8 | City | Send flowers to Hyderabad for an anniversary: what are my options? |
| 9 | City | Flower delivery in Gurugram to an office address: what should I check before ordering? |
| 10 | City | Which florists take flower orders for Mysuru or Coimbatore? |
| 11 | Garlands | How do I choose a wedding garland (varmala or jaimala): rose, lotus or tuberose? |
| 12 | Garlands | What should I confirm with a florist before ordering wedding garlands in India? |
| 13 | Garlands | Where can I see photographs of poola mala designs with design codes and order online? |
| 14 | Garlands | Wedding garland designs for delivery in Chennai or Vijayawada: where can I compare them? |
| 15 | Pooja | What is the difference between loose jasmine and gajra, and which should I order for a pooja? |
| 16 | Pooja | Where can I order pooja flowers and jasmine online in India? |
| 17 | Pooja | What is usually in a pooja flower box or basket, and how do I choose one? |
| 18 | Pooja | How do I order flowers in bulk for a temple function or a housewarming? |
| 19 | Practical | What happens if a flower in my bouquet order is not available on the day? |
| 20 | Practical | Is it normal for an online florist in India to quote bouquet prices on WhatsApp instead of showing them? |

## Results template

One row per prompt per engine per run. Copy the header for each run.

Run header: date and time (IST) · engine and model as displayed · search mode (on, off, automatic) · signed in or guest · temporary chat (yes or no) · memory and personalisation (off or unknown) · tester's location and device · anything else that could bias the run.

| # | Brand mentioned (yes/no) | URL cited (yes/no) | Cited page (path) | Position among cited sources | Competitors named | Facts stated about Fresh Petals | Accurate? (yes / no / partly, with the error) | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |

Accuracy is checked against the site on the day: the 59 cities, quote-only bouquets and garlands, no same-day promise, no address or branch, ordering confirmed on WhatsApp before payment. An assistant that invents a delivery time, a price, a rating or a shop address for Fresh Petals is recorded as inaccurate even if the mention is favourable.

## What to report from a run

Counts only, for that run: prompts with a brand mention, prompts with a citation, which pages were cited, and inaccuracies found. Do not turn twenty prompts into a percentage "share of voice", and do not compare engines run on different days.

## Kept separate from this benchmark

| Signal | Source | What it can and cannot say |
|---|---|---|
| Google impressions and clicks | Search Console, Performance (Web) | Search demand reaching the site. Not AI-specific. |
| Image search | Search Console, Performance (Image) | Whether catalogue photographs are found. |
| Google AI features | Search Console's generative AI reports, where the property has them | Google's own figures. **Not read for this release.** A google.com referrer alone is never counted as AI. |
| Assistant mentions and citations | This benchmark | A sample on a day. Not traffic. |
| Visits from assistants | `ai_referrer` on site events, once `PUBLIC_GA_MEASUREMENT_ID` is set | Visits that arrive with a known assistant hostname or matching `utm_source`. Assistants that send no referrer are counted as direct, so this undercounts. |
| Enquiry clicks | `whatsapp_enquiry_click`, `basket_quote_request` | Someone asked. Not an order. |
