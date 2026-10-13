# Release 3: discovery in Google and search assistants, 13 October 2026

Makes the site easier for search engines and search assistants to understand and to quote accurately: one consistent set of business facts, four buying guides with a directory, and honest measurement. It is a local commit and preview: not pushed, merged or deployed.

Nothing in this release can guarantee a first-place result or a recommendation in Google, ChatGPT or any other assistant, and nothing here claims one.

Base: `origin/main` at `4ad6312`. Companion documents: `assistant-benchmark.md` (prompts and results template) and `release-3-evidence-and-content-briefs.md` (owner queue, six social briefs, review workflow).

## Official guidance read (13 Oct 2026)

| Source | What it says | What it meant here |
|---|---|---|
| OpenAI, crawler documentation (https://developers.openai.com/api/docs/bots) | `OAI-SearchBot` is for search results in ChatGPT; `GPTBot` is for model training; `ChatGPT-User` fetches a page when a user asks. Each is controlled separately in robots.txt and each publishes its IP ranges. | The site's robots.txt allows every crawler on public pages, which includes `OAI-SearchBot`. No rule was added or removed. The training preference (GPTBot allowed, as before) was not changed; it is the owner's choice. |
| Google, guidance on AI features in Search (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) | AI Overviews and AI Mode use the same ranking and quality systems as Search. Pages must be indexed and eligible for a snippet. No special markup or file is needed; `llms.txt` is ignored; structured data is optional. Write original content for users and do not mass-produce pages. Measure in Search Console's generative AI reports. | No `llms.txt` and no "AI" markup was added. The work went into original guides with real products and into consistent facts. |

## Discovery check: before and after

| Item | Before | After |
|---|---|---|
| robots.txt | `Allow: /`, `Disallow: /admin`, `Disallow: /api`, three sitemaps | Unchanged |
| Simulated crawler requests to a live page (`OAI-SearchBot`, `GPTBot`, `ChatGPT-User`, `Googlebot`, `PerplexityBot` user agents) | All 200 | Not re-tested; nothing that affects it changed |
| Public pages indexable, self-canonical, server-rendered | Yes | Yes |
| Business facts in markup | Typed separately on the homepage only; no logo; alternate name "Fresh Petals Bengaluru" | One profile (`src/data/businessProfile.ts`) used by the homepage, About, Contact and every guide; logo is the FP mark; alternate name "FreshPetals" |
| Guides | One (wedding garlands) | Four, plus `/guides` |
| Stale comment calling the FP favicon "Astro's default mark" | Present | Removed |

**Limits.** A 200 for a request that only carries a crawler's user-agent string does not prove the real crawler can reach the site: real crawlers come from their own published IP ranges, and a firewall can treat those differently. No server or firewall logs were read and no hosting setting was opened in this work, so genuine crawler access is **not verified**. Nothing in the repository blocks any crawler. To verify: look for requests from `OAI-SearchBot` in Vercel's logs, or check Vercel's firewall and bot settings.

**Search Console.** The generative AI inclusion status and AI performance reports were **not read** in this work, and no property setting was changed. Follow-up for the owner: open the property's settings and reports and note what is available.

## Business facts

`src/data/businessProfile.ts` holds: the name Fresh Petals and the spelling FreshPetals; the canonical site; the WhatsApp number (from `src/config/storefront.ts`); the Instagram account; the FP mark (`/apple-touch-icon.png`); the 59 service cities (from the registry); and how ordering works. The Organization keeps its existing id (`…/#organization`) and the WebSite its id (`…/#website`). Guides name it as author and publisher by reference; no page types the node by hand.

Not stated anywhere, because none is verified: a founding date, registrations, credentials, an address, branches, hours, ratings or delivery times. It is an Organization, not a LocalBusiness.

**Origin: removed, not replaced.** An earlier About page said the shop began with deliveries in Chamarajpet and Basavanagudi, Bengaluru, while the Instagram handle (`freshpetals.hyderabad`) and the published feedback are labelled Hyderabad. The owner has not confirmed either account, so the origin sentences were removed from About (three places) and nothing was written in their place. The old alternate name "Fresh Petals Bengaluru" was dropped from markup for the same reason. About now says the 59 cities are cities delivered to, not shops or branches. If the owner confirms the history, one sentence can be added back.

Existing feedback keeps its Hyderabad labels and is not presented as verified completed-order reviews.

## Guides

| Guide | Built from | Notes |
|---|---|---|
| `/guides/choosing-a-flower-bouquet` | The eight launch bouquets by group, their recorded flowers and wrapping, the admin's birthday and anniversary assignments | Rendered on request with the occasion cache tags. A table of presentation per design; one design is in a glass vase. |
| `/guides/jasmine-pooja-flowers-and-gajra` | Eight pooja catalogue records at their published prices | The two "Pooja Flower Box" products side by side. Shared photographs are labelled on each card and listed. No variety, origin or pack size. |
| `/guides/sending-flowers-to-another-city` | The city registry (fifteen published pages, by region) and one bouquet per group | Recipient city, design, receiving details, how the city changes, what is confirmed before payment. |
| `/guides/choosing-wedding-garlands` (improved in place) | Public garland designs, as before | New section on choosing by design code, with real codes and their photograph descriptions; states that a description is not a specification and a browsing group is not the flowers used. Now under Guides in its breadcrumb, with a modified date. |
| `/guides` | The guide registry | Directory of the four. |

Every example is a catalogue product with its own photograph, linked to its page. If a product leaves the catalogue or a garland is unpublished it drops out, and the guidance stays. No hero or campaign image is used; no page describes a completed delivery. No stem counts, sizes, vase life in days, preparation times or origin claims. No sentence is addressed to an assistant, visible or hidden.

Integration: the footer's guide group lists all four and the directory; the bouquet and pooja collections link their guide; bouquet, lily and pooja product pages link the matching guide; each city-page section links the guide for what it shows, and the ordering block links the sending guide.

## Indexing

| Sitemap | Before | After |
|---|---|---|
| `sitemap.xml` | 173 | 177: adds `/guides` and the three new guides, each with an authored `lastmod` |
| `sitemap-garlands.xml` | 161 | 161 (already lists the wedding garland guide) |
| `sitemap-occasions.xml` | 11 | 11 |
| Unique across all three | 345 | 349 |

## Measurement

- `Analytics.astro` is reused. No Google Analytics ID exists in the project's environment, so **nothing is collected yet**: `PUBLIC_GA_MEASUREMENT_ID` is pending owner configuration. No provider or account was created.
- New, once an ID exists: events carry `ai_referrer` (`chatgpt`, `perplexity`, `copilot`, `gemini`, `claude`) when the visit's referring hostname, or a `utm_source` equal to one of those hostnames, is a known assistant. Only the label is kept: no referrer path, query, prompt or message. A visit with no referrer stays direct. A google.com referrer is Google Search and is never counted as Google's AI features.
- Guide pages report `view_item_list` with `guide/...` categories.
- The twenty-prompt benchmark is in `assistant-benchmark.md`. **Baseline: NOT RUN** (no independent assistant access). The brief's attached prompt list was not found on this machine, so the twenty prompts were drafted from the site's query-family maps; replace them if the owner's list differs.
- Google impressions, image search, Google's AI reports, sampled assistant mentions, referral visits and enquiry clicks are kept as separate signals; the table is in the benchmark document.

## Verification, 13 Oct 2026 (local preview of the production build)

The preview read the production database; inquiry and admin routes were refused by the scratch preview server and aborted in the browser. That guard is not in the repository or the build. WhatsApp was never opened.

| Check | Result |
|---|---|
| Production build | PASS |
| Regression suite | PASS, 37 of 37 (34 existing, 3 new: business profile, guides, assistant referrals) |
| Type check | 20 errors, all in three files this release does not touch (`SubscriptionConfigurator.astro` 15, `DiscoveryPostCard.astro` 4, `MobileBottomBar.astro` 1): the same errors as the base. No new error. |
| Release 3 checks (guides, schema, business facts, links, sitemaps, referral labels) at 375, 390, 768 and 1440 px | PASS, 81 of 81 |
| Existing city, basket, quote-only and garland checks, rerun on this build | PASS, 345 of 345 (three checks that compare with the live site were skipped; the sitemap comparison is covered by the Release 3 checks) |

Covered by the Release 3 checks: five guide URLs with unique titles, one H1, self-canonicals with and without query parameters, breadcrumbs, catalogue social images; one Organization node with the shared id on every guide and identical facts on the homepage, About and Contact; Article markup with dates and no person, rating or offer; all eight bouquets as quote-only cards with no amount; pooja products showing the same price as their own pages and Event Garlands still quote-only; the two pooja boxes told apart; shared photographs labelled; the fifteen city pages linked from the sending guide; every internal link in the guides resolving; footer, collection, product and city-section links to the guides; `sitemap.xml` keeping every live entry and adding only the four guide URLs; robots.txt unchanged; no `llms.txt`; a ChatGPT referrer labelled by hostname with nothing else kept, and direct and Google visits not labelled; a city page to guide to product draft naming the recipient city; no overflow or broken images.

Screenshots read by eye: the bouquet guide on desktop, the jasmine and pooja guide on mobile (before and after a fix), and the sending guide on mobile. Two issues were found there and fixed: the two-box comparison was a table that cut off its last column on phones (now two stacked cards), and the city links in the sending guide were not styled as links. The garland guide, the directory and the remaining desktop and mobile views were checked by script only.

## Final review before publication

- **Quote wording.** Every product example in the guides has an action: quote-only products (bouquets, lilies, garlands, Event Garlands) say "Request a quote" and draft a message naming the product and its page with no amount; publicly priced pooja products say "Order on WhatsApp" and state the price shown. The garland guide's coded designs each have "Request a quote for FP-G…" through the live enquiry check. Catalogue prices and the quote-only rule are unchanged.
- **Attribution.** `ai_referrer` is now sent with `ai_attribution`: `referrer` when the browser named a recognised assistant host, `campaign` when the link carried an allowlisted `utm_source` (for example `chatgpt.com`). Recognised hosts: chatgpt.com, chat.openai.com, search.chatgpt.com, perplexity.ai, copilot.microsoft.com, gemini.google.com, claude.ai, meta.ai. Ordinary Google visits are never labelled.
- **WhatsApp clicks** report the page path and the product slug or design code, and nothing about the customer. A click is an enquiry, not an order.
- **`PUBLIC_GA_MEASUREMENT_ID` is not set** in `.env.local` or in the Vercel production environment, so nothing is collected. This is the one missing input for measurement.
- **Screenshots read by eye:** the directory (mobile), the bouquet guide (desktop and mobile), the jasmine and pooja guide (desktop and mobile), the sending guide (mobile) and the garland guide (mobile). The directory, garland guide and sending guide on desktop were checked by script only.
- **Checks on the final build:** regression suite 37 of 37; Release 3 checks 88 of 88; type check 20 errors in the same three untouched files, none new.

## Handoff

When publication is approved: fast-forward `main` to this branch, push `main` alone, wait for the Production deployment, then push the branch. Check the five guide URLs, the footer, `/sitemap.xml` (177), the homepage's structured data and one captured draft. Afterwards, for the owner: request indexing for `/guides` and the three new guides; set `PUBLIC_GA_MEASUREMENT_ID` if analytics is wanted; run the benchmark from a fresh guest session; read Search Console's AI reports; and work through the evidence queue, starting with the jasmine and gajra photographs.
