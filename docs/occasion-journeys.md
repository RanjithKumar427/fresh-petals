# Occasion-led shopping, landing journeys and WhatsApp ordering

Local work, October 2026, built on the release `a6ce916` (production deployment `dpl_FddGE5iYUoiKXr6HL5EmU6QWBdxP`). Nothing here is committed or deployed.

## What changed

| Area | Change | Files |
|---|---|---|
| Journey rules | One source for occasions, palettes, gift/ceremony intent, eligibility, filters derived from catalogue facts | `src/data/occasionJourneys.ts` |
| Occasion landing pages | Compact coloured heading with the site's CSS-depth photo stage; first products inside the first phone screen; budget and colour filters (only when they divide the list); "For the ceremony / Send a gift" choice on ceremony occasions; honest WhatsApp empty states; calm condolence page; "Needed today? Ask on WhatsApp" (asked, never promised); search-landing copy and FAQs follow the products. Every occasion page is rendered on request | `src/components/occasion/OccasionPage.astro`, `src/data/occasionPages.ts`, `src/pages/occasions/[slug].astro`, `src/components/occasion/OccasionHeader.astro`, `OccasionCard.astro`, `ShopFilters.astro` |
| Live occasion assignments | Admin occasion assignments reach every occasion page, the homepage deck, `/occasions`, the bouquet list's filters and the occasion sitemap without a deployment, in the first HTML (no script needed) — see "Occasion assignments on the website" below | `src/pages/occasions/[slug].astro`, `src/pages/index.astro`, `src/pages/categories/bouquets.astro`, `src/components/category/CategoryPage.astro`, `src/pages/sitemap-occasions.xml.ts`, `src/server/services/OccasionMembership.ts`, `OccasionWebsite.ts`, `GarlandWebsite.ts` (shared purge), `src/pages/api/admin/occasions/refresh.ts`, `src/pages/api/admin/products/[id]/occasion-pages.ts`, `src/pages/api/admin/products/[id].ts`, `src/features/admin/productEditor/OccasionWebsiteStatus.tsx` |
| All occasions | `/occasions` (rendered on request, cached): the ten buying needs, each to a populated page or a WhatsApp enquiry that already says what it's for; budget, search and "needed today" shortcuts. Occasion pages are listed by the live occasion sitemap, not `sitemap.xml` | `src/pages/occasions/index.astro`, `src/pages/sitemap.xml.ts`, `src/pages/robots.txt.ts` |
| Homepage | First-screen buying shortcuts shown only when their destination has public products (today: "Send a bouquet", "Help me choose"); search/custom-orders line; the occasion deck shows **only occasions with eligible public bouquets** (same curved CSS 3D deck and interactions); bouquet types and "Under ₹1,500" moved to pills under "See all bouquets" in the bouquet section. The homepage is rendered on request (CDN-cached) so the deck and shortcuts follow the admin | `src/components/atelier/HeroAtelier.astro`, `OccasionCarousel.astro` (replaced `OccasionDeck.astro` on 10 Oct 2026; see docs/occasion-carousel.md), `BouquetEdit.astro`, `src/data/atelierHome.ts`, `src/pages/index.astro` |
| Bouquets | Occasion, budget and colour filters on `/categories/bouquets` (shareable: `?occasion=…&budget=under-1500&colour=pink`); the add-on/delivery note is part of the page's price sentence; bouquet-type links are one scrollable row on phones; rendered on request, so occasion chips and counts come from the database in the HTML. Other category pages are still prebuilt from the same template | `src/pages/categories/bouquets.astro`, `src/components/category/CategoryPage.astro`, `src/pages/categories/[slug].astro` |
| Ordering | Explicit occasion selections and intent travel in product URLs and on each basket item. Multiple selected occasions remain multiple; unfiltered visits inherit nothing. Canonical tags stay unchanged. Subsequent product choices persist through reload; the cart's optional order occasion stays separate from item contexts | `src/utils/journey.ts`, `src/utils/cart.ts`, `ProductOptions.astro`, `ProductCard.astro`, `cart.astro` |
| Search | `/search?q=…` fills the box (shareable; design codes for public garlands) | `src/pages/search.astro` |
| Admin | "Suitable occasions" with an honest note (garlands; launch bouquets; other catalogue products — all live) and a website status after saving; import-default garland occasions flagged for review; read-only "Shown to customers as" (gift/ceremony, from product type); "Image missing" state instead of broken thumbnails everywhere admin shows media | `src/features/admin/productEditor/sections/ClassificationSection.tsx`, `src/features/admin/shared/AdminImage.tsx` (+5 users) |
| Layout | `html.js` class set in the head so script-only controls are laid out from the first paint (no layout shift) | `src/layouts/BaseLayout.astro` |

No migration, no new dependency, no analytics. The site has no analytics trackers (privacy page says so) — none were added; a WhatsApp click is an enquiry attempt, not a sale, and no message content is collected.

## Shopping structure (research-informed, October 2026)

**Sources.** The research brief named in the task was not present in the repository or the conversation; these decisions follow the findings as summarised in the task instructions. International studies and forum accounts were used as hypotheses, not as FreshPetals customer research; no statistic or quotation appears in the storefront, and no conversion gain is claimed — automated tests show the pages work, not that they sell more. A WhatsApp opening is an enquiry attempt; the site has no analytics and none was added.

| Customer question | Evidence (as hypothesis) | Decision | Where |
|---|---|---|---|
| Which flowers suit my purpose? | Choice overload → guide, don't hide | Hero links Birthday · Anniversary · More occasions; the occasion carousel leads with them; "Help me choose" → `/occasions`; assisted choice "Tell us the occasion and your budget". Every bouquet stays listed; filters only hide options no bouquet carries | `HeroAtelier`, `OccasionCarousel`, `FinalInvite`, `ShopFilters` |
| What will arrive? | Substitution complaints; photography of complete arrangements | "What will arrive" shows a real launch bouquet's own photograph (linked), two close-ups of that file, and its catalogue specification (flowers, stem count, wrap); substitutions are agreed before payment (refund/terms pages). Hero and closing photographs are now public bouquets' own photographs, linked; editorial photographs of flowers not sold left the homepage. Size is shown as "not listed yet" — not estimated | `InsideBouquet`, product page facts list |
| What does the price cover? | Cost surprises drive abandonment → say it early | "Starting price" wording on the homepage, bouquet list and product page; a price-basis block beside the buying actions (starting vs set price, add-ons and delivery separate, confirmed before payment); the filter is named **Bouquet price** and the shortcut "Bouquets under ₹1,500" — the displayed price, not an order total; one published price on every surface and in baskets | `BouquetEdit`, `CategoryPage`, `products/[slug]`, `ProductPricing` |
| Can delivery be arranged for my date and area? | Delivery uncertainty → early, accurate | Hero coverage line names the two verified areas (no citywide claim); one availability helper by the bouquets ("Need flowers for a particular date? Check availability"); FAQs on dates (no same-day promise) and charges | `HeroAtelier`, `BouquetEdit`, `HomeFaq` |
| Can I trust this business? | Fabricated proof backfires | Verified contact and policies in the footer; focused FAQs restating the policy pages; no reviews, ratings, order counts or "bestseller" labels (none approved) | `SiteFooter`, `HomeFaq` |
| What happens when I press this button? | Predictable controls | Literal labels — Browse bouquets, View bouquet, Add to basket, Enquire on WhatsApp, Send basket on WhatsApp; "How ordering works" says opening WhatsApp is not an order and when payment happens | cards, product page, cart, `OrderJourney` |
| Can I return to my selection? | Returning and exact-design buyers | Search by name or code from the hero and header; saved items; basket persists (and is brought up to date); shareable filter URLs, Back restores them | header, `/search`, `/saved`, cart |
| Buyer ≠ recipient | Gifting research | Cart keeps "Your name (sender)" and recipient apart, and the WhatsApp draft has CUSTOMER and RECIPIENT sections | `cart.astro` |
| Messaging familiarity | WhatsApp is familiar, but an opening isn't a purchase | WhatsApp help appears twice on the homepage (availability helper, assisted choice), not in every section | homepage |
| Speed and navigation | Immediate content, restrained motion | Server-rendered sections; the detail section no longer pins or hides its close-ups; entrance effects never hide headings or copy (a small settle only); reduced motion and no-JS show everything; deck arrows beside swipe | `global.css`, `InsideBouquet` |

### Homepage order

1. **Announcement bar — omitted.** No confirmed operational notice or approved promotion exists; nothing rotating, no urgency.
2. Header — bouquets, occasions, search (in the menu below 375 px), saved, basket; no account needed.
3. Hero — CSS depth kept; an identifiable public bouquet (Timeless Hug) whose photograph and caption (name, published price, "View bouquet") link to its page; Browse bouquets · Help me choose; Birthday · Anniversary · More occasions; coverage line; "Search by name or code" · "Custom orders".
4. Bouquets — the 8 launch bouquets with complete photographs and published prices; "Bouquets under ₹1,500 (n)" beside the heading; the availability helper; type links under "See all bouquets".
5. The curved 3D occasion deck (Birthday and Anniversary first) and "View all occasions".
6. What will arrive (above).
7. How ordering works — choose → enquire on WhatsApp → we confirm availability, delivery and the complete price → you accept, then pay (nothing paid on the website).
8. Focused FAQs — coverage, dates, delivery charge, unavailable flowers, greeting messages, cancellation, problems, payment (answers restate `/shipping`, `/refunds`, `/terms`, `/faqs`).
9. Assisted choice — "Tell us the occasion and your budget" (WhatsApp message with Occasion, Budget, optional date and area).
10. Footer — verified WhatsApp number, policies, shop links.

### One published price

Bouquet prices reach the website with a deployment (the established model). A build reads the database once into a snapshot (`src/content.config.ts`, collection `publishedPrices`), and every catalogue surface reads it through `loadAuthoritativePrices()`: prebuilt product pages, saved items, the cart, add-on prices on the product page, and the pages rendered on request (homepage, bouquet list, occasion pages, `/occasions`). Before this, the on-request pages read the database live while product pages and baskets kept the deployed price, so the two could disagree after an admin edit. Now:

- An admin price edit is saved at once; the editor says the website shows it **from the next deployment, on every page and in baskets at the same time** (`PricingSection`).
- A basket saved earlier is brought up to the published prices (items and add-ons) when `/cart` opens, the customer is told what changed, and the WhatsApp draft carries the published price.
- Hard-coded prices were removed: the vase add-on price on the product page and in the bouquet-list note now come from the snapshot.
- Live garland designs keep their own live pricing and validation (`loadAuthoritativePrices({ fresh: true })`); no garland is in basket mode, and no garland money total is computed. In development the database is read directly.

### Decisions needed (owner)

- **Photographs:** confirm the bouquet photographs show arrangements as made (their provenance is not recorded); add one photograph with a scale reference, or record dimensions — size is shown as "not listed yet". The catalogue entry "Under ₹1499 Gifts" still uses the former hero photograph (tulips not in the range).
- **Same-day/express delivery:** the unconfirmed 4–6-hour wording was removed from policy pages, delivery request options and generated WhatsApp timing. Availability and arrangements are agreed before order acceptance. The owner must confirm offered services, areas, lead times and cut-offs before a speed promise is published.
- **Delivery charges and payment:** no new fee schedule or payment method was invented. Owner decisions: approved fee rules, accepted methods, payment timing and refund methods. Unconfirmed UPI examples were removed from FAQs, terms and refunds.
- **Greeting messages:** 5 of the 8 launch bouquets list "Message note on request"; confirm whether the other 3 include one, and the printed card's price (currently "Add-on item", quoted).
- **Cancellation:** the policy says "before sourcing or preparation begins"; a concrete cut-off (e.g. hours before delivery) would make the FAQ answer firmer.
- **Customer evidence:** none approved; the homepage shows none. An announcement bar needs a confirmed notice or approved promotion.
- **Instagram:** the footer links `freshpetals.hyderabad` (name to be decided).
- **Header menu occasions** are decided at build time (see "Still static").

## Shared journeys (from the 100 scenarios)

| | Journey | Where |
|---|---|---|
| J1 | Exact design: search or link → canonical product → order | header search, `/search?q=`, `/products/<slug>` |
| J2 | Occasion gift: occasion list → filter → product → WhatsApp / cart | `/occasions/birthday`, `/occasions/anniversary`, `/categories/bouquets?occasion=…` |
| J3 | Budget: starting prices under ₹1,500, add-ons and delivery confirmed in chat | `?budget=under-1500` on occasion pages and bouquets; deck card |
| J4 | Urgent: availability question, never a promise | "Needed today? Ask on WhatsApp" |
| J5 | Ceremony: choose ceremony or gift → live public garlands, otherwise WhatsApp with the intent | `/occasions/wedding`, `/housewarming`, `/mom-to-be`; engagement once eligible |
| J6 | Condolence: still page → "Check availability on WhatsApp" | `/occasions/sympathy` |
| J7 | Several items: cart lists each item's price and quantity plus the delivery fee as before (item count only — no money total); garland quantities in the confirmed unit, never priced × quantity | cart, garland page |
| J8 | Low confidence: plain server-rendered pages, WhatsApp help two taps away | "Help me choose" → `/occasions`; "Not sure? Ask us on WhatsApp" |
| J9 | Keyboard / assistive tech: labelled chips and switch (`aria-pressed`, group names), visible focus, products without JS | everywhere |

## Eligibility (what may be promoted)

- **Public range** = the launch range in `src/data/launchCatalogue.ts` (8 bouquets) plus live public garlands. Homepage shortcuts, the occasion deck and `/occasions` promote nothing else.
- **Which occasions a product belongs to comes from the database** (`product_occasions`, edited in the admin), not from `productCatalog.ts`, on every occasion page and listing. There is no catalogue fallback: an occasion the owner removes stays removed, and a product with every occasion cleared is listed on no occasion page. The earlier handoff reported matching assignments for all 89 catalogue products. This audit did not query production; isolated removal tests reproduced an editorial-fallback discrepancy and now verify the corrected resolver.
- An occasion is promoted only when it has eligible products (`journeyEligible`): today **Birthday (8)** and **Anniversary (5)**. Wedding, Engagement, Housewarming & Pooja and Baby shower appear on the homepage, in `/occasions` and in the sitemap automatically once a launch bouquet is assigned to them (or once garlands are promoted for Wedding/Engagement). Until then their pages say so and offer WhatsApp; empty pages are `noindex`.
- **Homepage deck = occasions only**, ordered Birthday, Anniversary, Wedding, Engagement, Housewarming, Condolence, Love & proposal, Thank you, Congratulations, Just because, Apology, Get well, Baby shower; a card is shown only when the occasion has eligible public bouquets. Today: Birthday, Anniversary, Love & proposal, Thank you, Congratulations, Just because, Apology (7). Launch occasions link to their pages (`/occasions/<slug>`); the others (Love & proposal, Thank you, Congratulations, Just because, Apology, Get well) to `/categories/bouquets?occasion=<slug>`, which lists exactly the launch bouquets the card counts, from the same assignments. Bouquet types and the budget link are not deck cards any more; they sit once, as pills under "See all bouquets".
- "Choose garlands" requires promotion **and actual public designs**. "Flowers for a ceremony" additionally requires public designs suitable for Wedding or Engagement under the existing model. A gift assignment never enables it. The 156 original garlands remain drafts; explicit ceremony enquiry pages remain available.
- Draft garlands never appear: pages, search, counts, sitemap, fragments and the enquiry check all use the existing public-garland rules (verified: none in any public output).
- The older occasion pages (thank-you, romantic, sympathy, congratulations, just-because, i-am-sorry, get-well-soon, new-mom, pooja) keep every catalogue product with a valid database assignment. Editorial extras no longer override removals or empty assignments. The storefront and admin checker share `occasionProductEligible`; the checker identifies actual occasion cards and still reports genuine mismatches.

## Occasion assignments on the website

Canonical product pages, URLs, prices, permissions and the bouquet order are unchanged.

### Inventory (where occasions are linked, and what the destination reads)

| Linked from | Occasions | Destination | Assignments read |
|---|---|---|---|
| Homepage deck | occasions with eligible launch bouquets (today 7) | launch occasions → `/occasions/<slug>`; Love & proposal, Thank you, Congratulations, Just because, Apology (Get well, Condolence when eligible) → `/categories/bouquets?occasion=<slug>` | database, at request (homepage rendered on request) |
| Homepage hero shortcuts | "Send a bouquet", "Help me choose" (ceremony shortcut once eligible) | `/categories/bouquets`, `/occasions` | database, at request |
| `/occasions` | ten buying needs | launch occasion pages, bouquet list filters, or a WhatsApp enquiry | database, at request |
| Header / footer "Shop by Occasion" | launch occasions with launch bouquets **at build time** (today Birthday, Anniversary) | `/occasions/birthday`, `/occasions/anniversary` | destinations: database, at request; the menu list itself: catalogue tags at build (see "Still static") |
| Bouquet list occasion filter | known occasions; selected zero-product values retained | the same page, filtered | database, at request |
| Older occasion pages | `/saved`, search engines, the occasion sitemap | `/occasions/<slug>` | database, at request |

### How a change reaches the website

| Surface | Rendering | Cache tag |
|---|---|---|
| Every `/occasions/<slug>` page (15) | on request (`src/pages/occasions/[slug].astro`) | `occasion:<slug>` |
| Homepage, `/categories/bouquets`, `/occasions`, `/sitemap-occasions.xml` | on request | `occasion-index` |

All of these send `Cache-Control: public, max-age=0, s-maxage=120, stale-while-revalidate=60` — the same documented freshness limit as the garland pages: a purge takes effect at once, and if one fails nothing is served stale for more than 3 minutes. (A one-day stale window was tried in the previous pass to hide production cache-miss latency and was reverted: freshness limits are not stretched to improve measurements.) The cost: a cache miss in production renders in `iad1` against the Seoul database (~1.1–1.4 s, measured on uncached garland pages on 6 Oct 2026, where the prebuilt pages answered in ~0.2 s), and quiet pages will often miss — see the owner checklist, step 8, and the region move under "Account settings".

Saving a product in the admin (`PATCH /api/admin/products/:id`) compares its occasions before and after; when they differ it purges `occasion-index` plus the page tag of **every occasion removed or added** (old and new memberships; Pooja also purges Housewarming), in batches of 16 (`refreshWebsite` in `GarlandWebsite.ts`, shared with garlands). Unaffected occasion pages keep their copy. Which pages are affected depends on the product: a launch bouquet appears on every occasion page it is assigned to; another catalogue product only on the older pages (the launch occasion pages list the launch range alone); a product outside the catalogue on none (saved, nothing purged). If a purge fails, the page catches up on its own within 3 minutes (the editor says so and offers **Refresh website**).

Editor ("Suitable occasions"): launch bouquets say the occasion pages, the bouquet list's filter and the homepage cards follow these choices with no deployment; other catalogue products say the occasion pages that list them follow (and that they are not on the homepage or bouquet list). After a save, a status line reads "Updating the website…", then **"On the website: Housewarming lists this bouquet."** only once the page (checked through the CDN by `GET /api/admin/products/:id/occasion-pages`) actually lists — or no longer lists — it. If the purge failed: "The website refresh failed…" with a **Refresh website** button (`POST /api/admin/occasions/refresh`).

The browser-side re-check of the first version (`/fragments/occasions.json`) is removed: the HTML is current, so it was a redundant request on every homepage and bouquet-list view.

### Still static (not changed by admin occasion edits)

- **Header and footer "Shop by Occasion" list** — which launch occasions appear is decided at build time from catalogue tags (today identical to the database). Every link goes to a page rendered on request, so the destination is never stale; but an occasion that gains its first launch bouquet joins the menu only at the next deployment, and one that loses all of them stays in the menu, leading to its honest empty state. The menu is part of every prebuilt page, so making it live would mean rendering every page on request — not done.
- Product page occasion wording and the related-products overlap.
- Search keywords for occasions; occasion labels on discovery/saved cards.
- `/occasions/engagement` and `/occasions/mom-to-be` answer as `noindex` pages with a WhatsApp prompt while they have no bouquets (engagement used to be a 404).
- Prices are **not** live for bouquets, by design: see "One published price" below — every page and basket switches at the next deployment.

### Candidate assignments for owner review (not applied)

Suggestions only, from product facts (flowers, colours, wording); the catalogue's "ideal for" text names none of these occasions, so each needs the owner's judgement. Nothing was assigned.

| Unserved occasion | Candidates | Note |
|---|---|---|
| Wedding / Engagement (gift for the couple) | Pink Lily Wish, Blush Lily Letter, Rose Promise | |
| Housewarming | Sunshine Story, Colourful Confession, Colour Pop Love | bright mixed flowers |
| Baby shower / New baby | Timeless Hug, Pink Lily Wish | lilies are strongly scented — confirm for a new mother |
| Get well | Sunshine Story, Colour Pop Love | |
| Condolence | none | no all-white/subdued launch bouquet; keep WhatsApp |

## Ordering: what is and isn't calculated

"Nothing totalled" in the first version meant **no money total**, and that is still the case — this change neither adds nor removes a calculation. What the cart does, unchanged: it counts items (sum of quantities, `getCartCount` in `src/utils/cart.ts`) and looks up the delivery fee for the pincode, date and slot (shown as "₹…" or "To be confirmed"). The summary and the WhatsApp message list each item's price label and quantity and the delivery fee as its own line, and say the final price is confirmed on WhatsApp before payment; no line total or grand total is computed. Garland enquiries never multiply the listed price by the quantity — the quantity is sent in the confirmed unit and the price is confirmed by the florist (verified in the journeys suite).

## 3D identity: retained and adapted

Inspected first: the live homepage's depth is **CSS 3D** — `HeroAtelier` (perspective stage, three photo planes, entry turn, scroll tilt, fine-pointer parallax) and `OccasionDeck` (curved `preserve-3d` carousel with drag/swipe/keys). The WebGL stage (`AtelierStage.astro`, `src/features/atelier/scene/*`, `three`) is **not mounted** anywhere on the live site; it and its dependency are left untouched.

| Component | Status |
|---|---|
| Hero stage | Unchanged composition, motion and fallbacks; only the buttons became buying shortcuts (same footprint at 360 px) |
| Occasion deck | Same 3D deck and interactions (drag, swipe with vertical scroll kept, arrows, buttons, focus follows); panels re-ordered occasion-first; `id="occasions"` |
| Occasion header (new) | Same technique, smaller: back plane in the occasion colour, contact shadow, arched photograph; entry turn and fine-pointer parallax with motion allowed; **condolence: still**, layered depth only |
| Cards | Ordinary cards: 4 px hover lift (none with reduced motion) |

Palettes: Birthday butter yellow, Anniversary dusty pink, Wedding ivory/saffron, Engagement pale sage, Housewarming & Pooja light terracotta, Condolence quiet cream (`OCCASION_JOURNEYS[*].palette`).

Updated no-JavaScript behaviour: URL selections filter the rendered HTML and counts; filter/switch/Clear links work through navigation. A known empty occasion remains selected; unknown values remain unselected. The selected ceremony/gift section is shown, with public ceremony designs rendered in HTML too. Earlier visual fallback checks covered reduced motion (no entry turn, no transitions, depth still rendered); slow network with images failing (heading, names, prices and navigation usable from the HTML); deck without JS is a plain grid of links. There is no canvas, so there is no canvas failure mode.

## Not resolved (needs owner decisions)

- **Photographs**: no garland photograph is approved for publication (156 × photo permission "unconfirmed"; no own photos uploaded). Occasion headers use existing site photos only (wedding doorway, pooja set-up, jasmine, gift box) — editorial, not presented as products.
- **Occasion assignments**: launch-bouquet occasions now come from the database (see above); the candidates table lists suggestions for the unserved occasions — the owner decides. All 156 garlands carry the import default (Wedding + Engagement) — flagged in the editor for review. No ceremony products exist yet for Haldi/Mehendi, baby shower/naming, housewarming/pooja or engagement; those journeys end in a WhatsApp enquiry.
- **Bouquet limitation (narrowed)**: occasions are live; bouquet names, copy, photos and publication are still prebuilt (prices from the database at build time). Making the rest live would be a separate change — no CMS rewrite was attempted.
- **Get-well**: no launch bouquet is assigned get-well; the need is answered with apology bouquets plus a WhatsApp prompt.
- **Gift/ceremony per product**: derived from product type (bouquet = gift, garland = ceremony). A per-product override would need a column (proposed below, not created).

## Owner-assisted production checklist (admin and cache)

Production sign-in and authenticated cache invalidation are **not verified** — they need the owner. Local tests are not production verification. Do not tick photo permission or sample verification just to test.

1. Sign in at `https://onlyfreshpetals.in/admin/login`, complete two-step verification (first time: enrol an authenticator on `/admin/mfa`). If enrolment fails, check Supabase → Authentication → Multi-Factor → TOTP enabled.
2. Open any garland (e.g. FP-G001). The **Website** bar must say **"Not on the website — draft — publish to show it"**. Save a harmless edit and confirm the bar still says "Not on the website" (drafts never trigger a refresh).
3. Only when a design is **genuinely approved** (photo permission granted, a made sample verified, a stored photo) and you have decided to publish it: Publish. Note the time. The bar should go "Updating the website…" → "Visible on the website with the saved details." — "Visible" is shown only after the live page reports the saved version, not merely because the purge succeeded. Record how long it took.
4. Change its price or length, save, and watch the bar again; then open the product page in a private window and confirm the new value. If the bar shows "The website refresh failed…", press **Refresh website**; the change also appears on its own within 3 minutes.
5. Unpublish. The enquiry link must refuse at once (`/garland-enquiry?code=…` returns to the garlands page). The page shows "This page isn't available" within seconds (≤ 3 minutes if the refresh failed).
6. Optional: someone can watch the response headers from outside while you work (`x-vercel-cache`, `age`).
7. **Occasion assignments (not verified in production).** Open a launch bouquet (e.g. Red Affair), remove one occasion it has (e.g. Love & proposal) and save — this hides it from that occasion for a minute or two. The status line should go "Updating the website…" → "On the website: Romantic no longer lists this bouquet." In a private window check `/occasions/romantic`, `/categories/bouquets?occasion=romantic` (chip count one lower) and the homepage deck. Add the occasion back, save, and confirm all three again ("… lists this bouquet"). Note the times.
8. **Cache behaviour (not measured in production).** For `/`, `/categories/bouquets`, `/occasions/birthday` and `/occasions/romantic`, record `x-vercel-cache` and time to first byte for a few requests spread over an hour (HIT/STALE should answer like the old static pages, ~0.2 s; a MISS ~1.1–1.4 s). Many MISSes on quiet pages would point to CDN eviction; the region move below is the next lever.

**First-request speed after release (not measured in production).** The homepage, the bouquet list and the occasion pages used to be static files (0.20–0.26 s to first byte); they are now rendered on request and cached at the CDN for 2 minutes (+1 minute stale; above). Cached answers should be as fast as before; the first request after a save, and on a quiet page most requests, run the function in `iad1` against the Seoul database, about 1.1–1.4 s, with an occasional 5 s cold start. Local measurements cannot show this (step 8).

## Account settings (recommendations — nothing changed)

**Supabase public sign-ups.** Production reports `disable_signup: false`. The code never calls `signUp`; Supabase Auth is used only by the admin (password sign-in, TOTP, password reset), customers never register (ordering is by WhatsApp), and admins are added by invitation. To close it: Supabase dashboard → project `hjhmetomcaskrrwkgrbp` → **Authentication → Sign In / Providers → turn off "Allow new users to sign up"** → Save. Then confirm: the owner can still sign in and pass TOTP; "Forgot password" still sends a reset email; inviting a user still works (Authentication → Users → Invite). This does not replace the existing protections, which stay as they are: the `admin_users` allow-list, mandatory TOTP, API authorisation in `src/middleware.ts`, and RLS. Rollback: turn the toggle back on.

**Vercel plan.** The team is on **Hobby**, which Vercel's fair-use guidelines restrict to non-commercial use ("advertising the sale of a product" is commercial). Recommendation: **Pro** — $20/month platform fee including one deploying seat and $20 of usage credit; Flat Rate CDN includes 1 million CDN requests and 1 TB transfer a month; usage beyond the credit is billed on demand (spend alerts default at $200). Pro also allows rolling back to any earlier production deployment (Hobby: only the previous one) and up to 5 function regions. Prices exclude GST. Check vercel.com/pricing on the day; nothing was purchased or started.

**Function region.** Verified: functions run in `iad1` (Washington, D.C.) — response header `x-vercel-id: bom1::iad1` — while the database pooler is `aws-0-ap-northeast-2` (Seoul). Vercel's region list maps Seoul to `icn1` (`ap-northeast-2`). Baseline measured 6 October 2026 (read-only, cache-busting query strings, from India):

| Request | Time to first byte |
|---|---|
| Uncached `/categories/garlands` | 1.16–1.37 s (one 5.5 s cold start) |
| Uncached `/fragments/garlands?for=search` | 1.12–1.43 s (one 5.2 s cold start) |
| `/garland-enquiry` (always uncached) | 1.14–1.35 s |
| Static `/occasions/birthday` | 0.20–0.26 s |

Option (Hobby allows one region): Project → Settings → Functions → Function Regions → `icn1`, then redeploy (the setting applies to new deployments). Measure the same four requests again (10 samples each) and compare medians; keep it only if uncached responses improve. Rollback: set the region back to `iad1` and redeploy, or Instant Rollback to the previous deployment. No improvement is promised: the database round trips should shorten, but the edge→function hop from India changes too, so measure.

## Missing admin thumbnails (data repair, not done)

Two image files were removed on purpose (privacy / trademark, commit `8e19241`); three production media records still point at them:

| media id | url | used by |
|---|---|---|
| 64 | `/images/addon-chocolates.jpg` | `chocolates-addon` |
| 66 | `/images/addon-card.jpg` | `premium-card-addon` |
| 79 | `/images/addon-card.jpg` | `flower-food-sachets` |

The admin now shows "Image missing" for them. Repair (owner decision, in the admin): upload an approved replacement photo for each product and set it as primary, then delete the orphaned media records in Media. Do not restore the removed files.

## Rollout plan (when approved — not done)

No migration, no new dependency, no new environment variable (the price snapshot uses the build's existing `DATABASE_URL`) (the purge uses the existing Vercel cache API path already used for garlands; `SITE_CHECK_ORIGIN` is optional and only overrides where the editor checks pages). Order:

1. Review the diff; run `npm run build` against a local/isolated database and the test suites listed below.
2. Commit on `main` (or a branch + PR); pushing `main` triggers the Vercel production build from GitHub. Remember the Hobby limit: **any new production deployment replaces the one Instant Rollback can return to.** Note the current production deployment id before pushing (today `dpl_FddGE5iYUoiKXr6HL5EmU6QWBdxP`). A local commit or a preview deployment does not change the rollback target; a production deployment does. The unpushed docs commit `6ee4aba` would go out with it.
3. After it is live: open `/`, `/occasions`, `/occasions/birthday?budget=under-1500`, `/occasions/romantic`, `/occasions/wedding?for=gift`, `/occasions/sympathy`, `/categories/bouquets?occasion=thank-you`; check `x-vercel-cache` on `/`, `/categories/bouquets` and `/occasions/birthday` (MISS, then HIT), `/sitemap.xml` + `/sitemap-occasions.xml` (no drafts, no empty occasions), `robots.txt` (both sitemaps), the garland routes, and one quick-order WhatsApp draft (don't send).
4. Owner: the admin checklist above, including steps 7 and 8.

**Release contents** (nothing committed): the unpushed docs commit `6ee4aba` plus exactly the 60 working-tree files in the release manifest — grouped as occasion data and pages (15), homepage and bouquet list (8), ordering journey (10), admin occasion status (7), admin "Image missing" (6), shopping structure (7), one published price (5) and documentation (2). The manifest, with each file's purpose and a path list for `git add --pathspec-from-file`, is kept with the review evidence and was checked to equal the working tree's changes. **Excluded:** `docs/architecture/commerce-core-roadmap.md` (untracked proposal), the review evidence, backups, `.env*` files, test scripts; no photograph or other file under `public/` is changed. No file is deleted relative to production.

## Rollback

- **Application** (preferred; keeps all catalogue/admin data): Vercel → Deployments → Instant Rollback to the previous production deployment (on Hobby only the immediately previous one; after more deployments, `git revert` the change on `main` and push). Undo with "Undo Rollback" / `vercel promote`.
- **No database rollback is needed**: no schema change. Occasion edits saved in the admin after release are ordinary `product_occasions` rows that the previous version simply ignores for bouquets (it reads catalogue tags); they stay in place. Never restore the production database to undo a UI change.
- Database backups (`C:\Users\…\Backups\fresh-petals-prod-db-*`, owner's machine) stay private and outside the repository. Uploaded image objects are not in database backups — protect them separately (download the `media` bucket after uploads; see `docs/garlands.md` → "Protecting images").

## Proposed later (not created)

- **Migration 0012 (optional):** `products.purpose` (`gift` | `ceremony` | `both`, nullable = by type) so the owner can mark e.g. a bouquet as ceremony-suitable. Additive; only if the derived rule proves insufficient.
- Making the rest of bouquet metadata live (names, photos, publication), mirroring the garland system; and the remaining static surfaces listed above (header menu, product-page wording, search keywords).

## Verification

Isolated stack only (local Postgres, local auth gateway, CDN emulator in front of a production build). Enquiry writes and outbound requests intercepted in every browser test; nothing sent. Final production build (`astro build`, Vercel adapter) of the final working tree, 7 Oct 2026: 174 prebuilt pages; its static output is byte-identical to the build the suites ran on, and the price and structure suites were re-run on it.

| Suite | Result |
|---|---|
| Shopping structure (new): homepage order; no announcement bar; hero actions in the first 390×844 screen; Birthday · Anniversary · More occasions links; coverage wording; hero bouquet linked with its price; search bypass; budget shortcut by the heading; one availability helper; literal card actions; deck order; "What will arrive" links; ordering steps; FAQ coverage and keyboard; assisted-choice message; WhatsApp invitations not repeated; footer; 44 px hit areas; reduced motion; no JavaScript; bouquet-list actions and price-filter meaning; product price basis stated once; direct enquiry; search by name | 26/26 |
| Price path (new): one published price on homepage card, bouquet list, occasion page and product page; hero bouquet price; a database price edit changes no page (cache flushed) until the next deployment; database restored; an outdated basket (item and add-on) brought up to the published price with a notice, left alone afterwards; WhatsApp draft with published prices and separate sender/recipient; enquiry write intercepted; admin price note | 10/10 |
| Occasion journeys (incl. cart and garland WhatsApp content, no money totals) | 36/36 |
| Occasion assignments (mutations; restored exactly) | 34/34 |
| Garland occasions (mutations; drafts private, enquiry refusal after unpublish) | 17/17 |
| Garland live-update API / browser (purge failure, retry, "Visible" accuracy, unpublish) | 37/37, 12/12 |
| Home / journey (incl. `/studio` → bouquets redirect) / interactions / options / quote-cart / nav | 41/41, 15/15, 9/9, 4/4, 5/5, 10/10 |
| Launch static / menu links | 25/25, all resolve |
| Every occasion page lists the release build's products | 15/15 (Engagement: was 404, now `noindex`) |
| Type check (`astro check`, final tree, no database needed) | **20 errors = the existing baseline** (15 SubscriptionConfigurator, 4 DiscoveryPostCard, 1 MobileBottomBar); **0 new errors, 0 warnings** |

Test expectations updated only for intended changes: action labels (Browse bouquets, Add to basket, Send basket on WhatsApp), the "Bouquet price" filter name, the merged price note, the hero/closing photographs (public bouquets' own, linked), the section order (FAQs added) and the detail section (no longer pinned; close-ups always visible).

**Not exercised in production:** admin sign-in, saving an occasion or a price, the production purge, production cache behaviour and latency — owner checklist steps 7–8.

### Mobile loading

Release `a6ce916` vs this change, both production builds behind the local CDN emulator with Brotli (as Vercel serves text), measured in the same session. 390×844 touch, DPR 3, CPU 4× slower, 150 ms RTT / 1.6 Mbps, browser cache disabled; **7 runs, medians**; CDN cache **hit** (local miss in brackets). Local time to first byte (curl, 11 runs): 2–3 ms hit, 7–9 ms local miss (local function and database). **Production misses (~1.1–1.4 s) are not measured**, and with the 2 + 1 minute freshness limit they will be common on quiet pages.

| Page | FCP ms | LCP ms | LCP element | CLS | First product photo: downloaded ms @ position |
|---|---|---|---|---|---|
| `/` | 2548 → 2440 (2396) | 2600 → 2456 (2604) | non-product hero photo → **Timeless Hug's own photo (linked)** | 0 → 0 | 3482 @ 1058 px → **961 @ 205 px (first screen)** |
| `/occasions/birthday` | 1404 → 1620 (1576) | 1404 → 1672 (1608) | text → **first bouquet photo** | 0.003 → 0.001 | 3118 @ 913 px → **702 @ 387 px (first screen)** |
| `/occasions/anniversary` | 1432 → 1580 (1548) | 1432 → 1616 (1580) | text → **first bouquet photo** | 0.004 → 0.028 | 3132 @ 954 px → **712 @ 393 px (first screen)** |
| `/categories/bouquets` | 1752 → 1656 (1572) | 1752 → 1656 (1572) | intro text | 0.017 → 0.017 | 2734 @ 895 px → 2632 @ 1001 px |
| `/occasions/wedding` | 1204 → 1300 (1224) | 1204 → 1300 (1224) | text | 0.002 → 0 | – |
| `/products/red-affair` | 1856 → 1740 (1668) | 1888 → 1772 (1700) | product photo | 0 → 0 | first screen both |

Reading it: the homepage, bouquet list and product page are no slower; the homepage's largest paint is now the identifiable bouquet a shopper can tap. Birthday and Anniversary paint ~150–220 ms later but show their first bouquet in the first screen ~2.4 s sooner (the first card's photo is the one image fetched with high priority; the other cards stay lazy). Wedding +96 ms: the occasion template (heading stage, ceremony/gift switch). The bouquet list's first photo is 106 px lower than the release (occasion chips; already compacted). Anniversary's 0.028 shift is the heading rewrapping when its web font arrives; preloading the font removed it but cost ~170 ms on every occasion page, so it was not kept. Earlier measurements in this document's history (uncompressed, other sessions) are superseded.

Raw data (per-run JSON, Chrome traces, screening runs), before/after screenshots (360/390/1440 for every homepage section, occasion pages, bouquet list, product buying area, no-JS) and the release manifest are kept outside the repository, in the local review folder named in the hand-over.

## 100 scenarios

Design hypotheses, not research. Journey codes as above; difficulty L/M/H. Contexts: **K** knows the exact design · **U** unsure · **B** strict budget · **T** urgent · **P** planning ahead · **R** ordering remotely · **M** several items · **C** colour/ceremony requirement · **S** slow phone / low confidence · **A** keyboard / assistive technology.

| Need \ Context | K | U | B | T | P | R | M | C | S | A |
|---|---|---|---|---|---|---|---|---|---|---|
| Birthday | J1 · L | J2 · M | J3 · L | J4 · M | J2 · L | J2 · M | J7 · M | J2 · L | J8 · L | J9 · L |
| Anniversary / love / proposal | J1 · L | J2 · M | J3 · L | J4 · M | J2 · L | J2 · M | J7 · M | J2 · L | J8 · L | J9 · L |
| Congratulations / thanks / farewell | J1 · L | J2 · M | J3 · L | J4 · M | J2 · L | J2 · M | J7 · M | J2 · L | J8 · L | J9 · L |
| Get-well / apology | J1 · L | J2 · M | J3 · L | J4 · M | J2 · L | J2 · M | J7 · M | J2 · L | J8 · L | J9 · L |
| Condolence | J1 · M | J6 · M | J6 · H | J4 · H | J6 · L | J6 · M | J7 · H | J6 · H | J8 · L | J9 · M |
| Wedding ceremony | J1 · M | J5 · H | J5 · H | J4 · H | J5 · L | J5 · M | J7 · H | J5 · H | J8 · L | J9 · M |
| Engagement / reception | J1 · M | J5 · H | J5 · H | J4 · H | J5 · L | J5 · M | J7 · H | J5 · H | J8 · L | J9 · M |
| Haldi / Mehendi | J1 · M | J5 · H | J5 · H | J4 · H | J5 · L | J5 · M | J7 · H | J5 · H | J8 · L | J9 · M |
| Baby shower / new baby / naming | J1 · M | J5 · H | J5 · H | J4 · H | J5 · L | J5 · M | J7 · H | J5 · H | J8 · L | J9 · M |
| Housewarming / pooja | J1 · M | J5 · H | J5 · H | J4 · H | J5 · L | J5 · M | J7 · H | J5 · H | J8 · L | J9 · M |

#### Birthday

| | Likely search → landing | First question | Difficulty | Shortest practical path |
|---|---|---|---|---|
| K Knows the exact design | “"<design name>" or product link” → `canonical /products/<slug> (or /search?q=)` | Is this the one, and what's the price? | Low | Product → Order on WhatsApp (2 taps) (J1) |
| U Unsure what to choose | “birthday flowers bangalore” → `/occasions/birthday` | Which bouquet suits them, and what does it cost? | Med | Occasion list → product → WhatsApp / cart (J2) |
| B Strict budget | “birthday flowers bangalore under 1500” → `/occasions/birthday?budget=under-1500` | What fits my budget, and what adds to it? | Low | Budget chip → product (starting price + add-on note) → WhatsApp (J3) |
| T Needs it urgently | “birthday flowers bangalore today” → `/occasions/birthday` | Can it arrive today? | Med | 'Needed today? Ask on WhatsApp' (availability asked, never promised) (J4) |
| P Planning ahead | “birthday flowers bangalore” → `/occasions/birthday` | Can I choose now for a later date? | Low | Product → cart (date field) → WhatsApp (J2) |
| R Ordering remotely | “send birthday flowers bangalore” → `/occasions/birthday` | Do you deliver to their area? | Med | Service-area line on page → area in the WhatsApp message (confirmed in chat) (J2) |
| M Multiple items / quantities | “birthday flowers bangalore” → `/occasions/birthday` | Can I order several? | Med | Add each to cart → one WhatsApp request (quantities listed, no invented totals) (J7) |
| C Specific colour / ceremony requirement | “birthday flowers bangalore pink” → `/occasions/birthday?colour=pink` | Is there one in this colour? | Low | Colour chip (from recorded flowers) → product → WhatsApp (J2) |
| S Slow phone / low digital confidence | “birthday flowers bangalore” → `/occasions/birthday` | Can someone just help me? | Low | Server-rendered page; 'Not sure? Ask us on WhatsApp' / Help me choose → WhatsApp (2 taps) (J8) |
| A Keyboard / assistive technology | “birthday flowers bangalore” → `/occasions/birthday` | Which bouquet suits them, and what does it cost? | Low | Labelled chips/switch (aria-pressed), visible focus, no JS needed to see products (J9) |

#### Anniversary / love / proposal

| | Likely search → landing | First question | Difficulty | Shortest practical path |
|---|---|---|---|---|
| K Knows the exact design | “"<design name>" or product link” → `canonical /products/<slug> (or /search?q=)` | Is this the one, and what's the price? | Low | Product → Order on WhatsApp (2 taps) (J1) |
| U Unsure what to choose | “anniversary roses bangalore” → `/occasions/anniversary` | Roses or lilies, in which colour? | Med | Occasion list → product → WhatsApp / cart (J2) |
| B Strict budget | “anniversary roses bangalore under 1500” → `/occasions/anniversary?budget=under-1500` | What fits my budget, and what adds to it? | Low | Budget chip → product (starting price + add-on note) → WhatsApp (J3) |
| T Needs it urgently | “anniversary roses bangalore today” → `/occasions/anniversary` | Can it arrive today? | Med | 'Needed today? Ask on WhatsApp' (availability asked, never promised) (J4) |
| P Planning ahead | “anniversary roses bangalore” → `/occasions/anniversary` | Can I choose now for a later date? | Low | Product → cart (date field) → WhatsApp (J2) |
| R Ordering remotely | “send anniversary roses bangalore” → `/occasions/anniversary` | Do you deliver to their area? | Med | Service-area line on page → area in the WhatsApp message (confirmed in chat) (J2) |
| M Multiple items / quantities | “anniversary roses bangalore” → `/occasions/anniversary` | Can I order several? | Med | Add each to cart → one WhatsApp request (quantities listed, no invented totals) (J7) |
| C Specific colour / ceremony requirement | “anniversary roses bangalore pink” → `/occasions/anniversary?colour=pink` | Is there one in this colour? | Low | Colour chip (from recorded flowers) → product → WhatsApp (J2) |
| S Slow phone / low digital confidence | “anniversary roses bangalore” → `/occasions/anniversary` | Can someone just help me? | Low | Server-rendered page; 'Not sure? Ask us on WhatsApp' / Help me choose → WhatsApp (2 taps) (J8) |
| A Keyboard / assistive technology | “anniversary roses bangalore” → `/occasions/anniversary` | Roses or lilies, in which colour? | Low | Labelled chips/switch (aria-pressed), visible focus, no JS needed to see products (J9) |

#### Congratulations / thanks / farewell

| | Likely search → landing | First question | Difficulty | Shortest practical path |
|---|---|---|---|---|
| K Knows the exact design | “"<design name>" or product link” → `canonical /products/<slug> (or /search?q=)` | Is this the one, and what's the price? | Low | Product → Order on WhatsApp (2 taps) (J1) |
| U Unsure what to choose | “congratulations bouquet bangalore” → `/categories/bouquets?occasion=congratulations,thank-you` | Something bright that says well done? | Med | Occasion list → product → WhatsApp / cart (J2) |
| B Strict budget | “congratulations bouquet bangalore under 1500” → `/categories/bouquets?occasion=congratulations,thank-you&budget=under-1500` | What fits my budget, and what adds to it? | Low | Budget chip → product (starting price + add-on note) → WhatsApp (J3) |
| T Needs it urgently | “congratulations bouquet bangalore today” → `/categories/bouquets?occasion=congratulations,thank-you` | Can it arrive today? | Med | 'Needed today? Ask on WhatsApp' (availability asked, never promised) (J4) |
| P Planning ahead | “congratulations bouquet bangalore” → `/categories/bouquets?occasion=congratulations,thank-you` | Can I choose now for a later date? | Low | Product → cart (date field) → WhatsApp (J2) |
| R Ordering remotely | “send congratulations bouquet bangalore” → `/categories/bouquets?occasion=congratulations,thank-you` | Do you deliver to their area? | Med | Service-area line on page → area in the WhatsApp message (confirmed in chat) (J2) |
| M Multiple items / quantities | “congratulations bouquet bangalore” → `/categories/bouquets?occasion=congratulations,thank-you` | Can I order several? | Med | Add each to cart → one WhatsApp request (quantities listed, no invented totals) (J7) |
| C Specific colour / ceremony requirement | “congratulations bouquet bangalore pink” → `/categories/bouquets?occasion=congratulations,thank-you&colour=pink` | Is there one in this colour? | Low | Colour chip (from recorded flowers) → product → WhatsApp (J2) |
| S Slow phone / low digital confidence | “congratulations bouquet bangalore” → `/categories/bouquets?occasion=congratulations,thank-you` | Can someone just help me? | Low | Server-rendered page; 'Not sure? Ask us on WhatsApp' / Help me choose → WhatsApp (2 taps) (J8) |
| A Keyboard / assistive technology | “congratulations bouquet bangalore” → `/categories/bouquets?occasion=congratulations,thank-you` | Something bright that says well done? | Low | Labelled chips/switch (aria-pressed), visible focus, no JS needed to see products (J9) |

#### Get-well / apology

| | Likely search → landing | First question | Difficulty | Shortest practical path |
|---|---|---|---|---|
| K Knows the exact design | “"<design name>" or product link” → `canonical /products/<slug> (or /search?q=)` | Is this the one, and what's the price? | Low | Product → Order on WhatsApp (2 taps) (J1) |
| U Unsure what to choose | “sorry flowers bangalore” → `/categories/bouquets?occasion=i-am-sorry` | Something gentle — get-well isn't listed, so ask? | Med | Occasion list → product → WhatsApp / cart (J2) |
| B Strict budget | “sorry flowers bangalore under 1500” → `/categories/bouquets?occasion=i-am-sorry&budget=under-1500` | What fits my budget, and what adds to it? | Low | Budget chip → product (starting price + add-on note) → WhatsApp (J3) |
| T Needs it urgently | “sorry flowers bangalore today” → `/categories/bouquets?occasion=i-am-sorry` | Can it arrive today? | Med | 'Needed today? Ask on WhatsApp' (availability asked, never promised) (J4) |
| P Planning ahead | “sorry flowers bangalore” → `/categories/bouquets?occasion=i-am-sorry` | Can I choose now for a later date? | Low | Product → cart (date field) → WhatsApp (J2) |
| R Ordering remotely | “send sorry flowers bangalore” → `/categories/bouquets?occasion=i-am-sorry` | Do you deliver to their area? | Med | Service-area line on page → area in the WhatsApp message (confirmed in chat) (J2) |
| M Multiple items / quantities | “sorry flowers bangalore” → `/categories/bouquets?occasion=i-am-sorry` | Can I order several? | Med | Add each to cart → one WhatsApp request (quantities listed, no invented totals) (J7) |
| C Specific colour / ceremony requirement | “sorry flowers bangalore pink” → `/categories/bouquets?occasion=i-am-sorry&colour=pink` | Is there one in this colour? | Low | Colour chip (from recorded flowers) → product → WhatsApp (J2) |
| S Slow phone / low digital confidence | “sorry flowers bangalore” → `/categories/bouquets?occasion=i-am-sorry` | Can someone just help me? | Low | Server-rendered page; 'Not sure? Ask us on WhatsApp' / Help me choose → WhatsApp (2 taps) (J8) |
| A Keyboard / assistive technology | “sorry flowers bangalore” → `/categories/bouquets?occasion=i-am-sorry` | Something gentle — get-well isn't listed, so ask? | Low | Labelled chips/switch (aria-pressed), visible focus, no JS needed to see products (J9) |

#### Condolence

| | Likely search → landing | First question | Difficulty | Shortest practical path |
|---|---|---|---|---|
| K Knows the exact design | “design code (e.g. FP-G012)” → `/search?q=<code> — drafts are not public, so no result` | Is this design available? | Med | Search finds nothing → Ask on WhatsApp with the code (garlands appear once published) (J1) |
| U Unsure what to choose | “condolence flowers bangalore” → `/occasions/sympathy` | Can quiet flowers reach them in time? | Med | Condolence page → Check availability on WhatsApp (J6) |
| B Strict budget | “condolence flowers bangalore price” → `/occasions/sympathy` | What would it cost? | High | WhatsApp enquiry with 'Budget (optional)' line — quoted, never estimated (J6) |
| T Needs it urgently | “condolence flowers bangalore urgent” → `/occasions/sympathy` | Can anything be done today? | High | Check availability on WhatsApp ('Needed by') (J4) |
| P Planning ahead | “condolence flowers bangalore” → `/occasions/sympathy` | Can I choose now for a later date? | Low | WhatsApp enquiry with 'Date (optional)' (J6) |
| R Ordering remotely | “send condolence flowers bangalore” → `/occasions/sympathy` | Do you deliver to their area? | Med | Service-area line on page → area in the WhatsApp message (confirmed in chat) (J6) |
| M Multiple items / quantities | “condolence flowers bangalore bulk” → `/occasions/sympathy` | How many, and what would that cost? | High | WhatsApp enquiry; garland quantities stated in the confirmed unit, never totalled (J7) |
| C Specific colour / ceremony requirement | “condolence flowers bangalore” → `/occasions/sympathy` | Can you match the ritual's colours and flowers? | High | Calm page → WhatsApp (J6) |
| S Slow phone / low digital confidence | “condolence flowers bangalore” → `/occasions/sympathy` | Can someone just help me? | Low | Server-rendered page; 'Not sure? Ask us on WhatsApp' / Help me choose → WhatsApp (2 taps) (J8) |
| A Keyboard / assistive technology | “condolence flowers bangalore” → `/occasions/sympathy` | Can quiet flowers reach them in time? | Med | Labelled chips/switch (aria-pressed), visible focus, no JS needed to see products (J9) |

#### Wedding ceremony

| | Likely search → landing | First question | Difficulty | Shortest practical path |
|---|---|---|---|---|
| K Knows the exact design | “design code (e.g. FP-G012)” → `/search?q=<code> — drafts are not public, so no result` | Is this design available? | Med | Search finds nothing → Ask on WhatsApp with the code (garlands appear once published) (J1) |
| U Unsure what to choose | “wedding garlands bangalore” → `/occasions/wedding?for=ceremony` | Ceremony flowers or a gift for the couple? | High | Choose ceremony / gift → WhatsApp enquiry carrying the intent (J5) |
| B Strict budget | “wedding garlands bangalore price” → `/occasions/wedding?for=ceremony` | What would it cost? | High | WhatsApp enquiry with 'Budget (optional)' line — quoted, never estimated (J5) |
| T Needs it urgently | “wedding garlands bangalore urgent” → `/occasions/wedding?for=ceremony` | Can anything be done today? | High | WhatsApp enquiry; no delivery promise on the site (J4) |
| P Planning ahead | “wedding garlands bangalore” → `/occasions/wedding?for=ceremony` | Can I choose now for a later date? | Low | WhatsApp enquiry with 'Date (optional)' (J5) |
| R Ordering remotely | “send wedding garlands bangalore” → `/occasions/wedding?for=ceremony` | Do you deliver to their area? | Med | Service-area line on page → area in the WhatsApp message (confirmed in chat) (J5) |
| M Multiple items / quantities | “wedding garlands bangalore bulk” → `/occasions/wedding?for=ceremony` | How many, and what would that cost? | High | WhatsApp enquiry; garland quantities stated in the confirmed unit, never totalled (J7) |
| C Specific colour / ceremony requirement | “wedding garlands bangalore” → `/occasions/wedding?for=ceremony` | Can you match the ritual's colours and flowers? | High | For the ceremony → WhatsApp with requirements (J5) |
| S Slow phone / low digital confidence | “wedding garlands bangalore” → `/occasions/wedding?for=ceremony` | Can someone just help me? | Low | Server-rendered page; 'Not sure? Ask us on WhatsApp' / Help me choose → WhatsApp (2 taps) (J8) |
| A Keyboard / assistive technology | “wedding garlands bangalore” → `/occasions/wedding?for=ceremony` | Ceremony flowers or a gift for the couple? | Med | Labelled chips/switch (aria-pressed), visible focus, no JS needed to see products (J9) |

#### Engagement / reception

| | Likely search → landing | First question | Difficulty | Shortest practical path |
|---|---|---|---|---|
| K Knows the exact design | “design code (e.g. FP-G012)” → `/search?q=<code> — drafts are not public, so no result` | Is this design available? | Med | Search finds nothing → Ask on WhatsApp with the code (garlands appear once published) (J1) |
| U Unsure what to choose | “engagement flowers bangalore” → `/occasions → Ask (engagement page appears when eligible)` | For the ceremony or a gift? | High | Choose ceremony / gift → WhatsApp enquiry carrying the intent (J5) |
| B Strict budget | “engagement flowers bangalore price” → `/occasions → Ask (engagement page appears when eligible)` | What would it cost? | High | WhatsApp enquiry with 'Budget (optional)' line — quoted, never estimated (J5) |
| T Needs it urgently | “engagement flowers bangalore urgent” → `/occasions → Ask (engagement page appears when eligible)` | Can anything be done today? | High | WhatsApp enquiry; no delivery promise on the site (J4) |
| P Planning ahead | “engagement flowers bangalore” → `/occasions → Ask (engagement page appears when eligible)` | Can I choose now for a later date? | Low | WhatsApp enquiry with 'Date (optional)' (J5) |
| R Ordering remotely | “send engagement flowers bangalore” → `/occasions → Ask (engagement page appears when eligible)` | Do you deliver to their area? | Med | Service-area line on page → area in the WhatsApp message (confirmed in chat) (J5) |
| M Multiple items / quantities | “engagement flowers bangalore bulk” → `/occasions → Ask (engagement page appears when eligible)` | How many, and what would that cost? | High | WhatsApp enquiry; garland quantities stated in the confirmed unit, never totalled (J7) |
| C Specific colour / ceremony requirement | “engagement flowers bangalore” → `/occasions → Ask (engagement page appears when eligible)` | Can you match the ritual's colours and flowers? | High | For the ceremony → WhatsApp with requirements (J5) |
| S Slow phone / low digital confidence | “engagement flowers bangalore” → `/occasions → Ask (engagement page appears when eligible)` | Can someone just help me? | Low | Server-rendered page; 'Not sure? Ask us on WhatsApp' / Help me choose → WhatsApp (2 taps) (J8) |
| A Keyboard / assistive technology | “engagement flowers bangalore” → `/occasions → Ask (engagement page appears when eligible)` | For the ceremony or a gift? | Med | Labelled chips/switch (aria-pressed), visible focus, no JS needed to see products (J9) |

#### Haldi / Mehendi

| | Likely search → landing | First question | Difficulty | Shortest practical path |
|---|---|---|---|---|
| K Knows the exact design | “design code (e.g. FP-G012)” → `/search?q=<code> — drafts are not public, so no result` | Is this design available? | Med | Search finds nothing → Ask on WhatsApp with the code (garlands appear once published) (J1) |
| U Unsure what to choose | “haldi decoration flowers bangalore” → `/occasions → Ask (wedding ceremony section when garlands are public)` | Marigold and garlands for the ritual — what's possible? | High | Choose ceremony / gift → WhatsApp enquiry carrying the intent (J5) |
| B Strict budget | “haldi decoration flowers bangalore price” → `/occasions → Ask (wedding ceremony section when garlands are public)` | What would it cost? | High | WhatsApp enquiry with 'Budget (optional)' line — quoted, never estimated (J5) |
| T Needs it urgently | “haldi decoration flowers bangalore urgent” → `/occasions → Ask (wedding ceremony section when garlands are public)` | Can anything be done today? | High | WhatsApp enquiry; no delivery promise on the site (J4) |
| P Planning ahead | “haldi decoration flowers bangalore” → `/occasions → Ask (wedding ceremony section when garlands are public)` | Can I choose now for a later date? | Low | WhatsApp enquiry with 'Date (optional)' (J5) |
| R Ordering remotely | “send haldi decoration flowers bangalore” → `/occasions → Ask (wedding ceremony section when garlands are public)` | Do you deliver to their area? | Med | Service-area line on page → area in the WhatsApp message (confirmed in chat) (J5) |
| M Multiple items / quantities | “haldi decoration flowers bangalore bulk” → `/occasions → Ask (wedding ceremony section when garlands are public)` | How many, and what would that cost? | High | WhatsApp enquiry; garland quantities stated in the confirmed unit, never totalled (J7) |
| C Specific colour / ceremony requirement | “haldi decoration flowers bangalore” → `/occasions → Ask (wedding ceremony section when garlands are public)` | Can you match the ritual's colours and flowers? | High | For the ceremony → WhatsApp with requirements (J5) |
| S Slow phone / low digital confidence | “haldi decoration flowers bangalore” → `/occasions → Ask (wedding ceremony section when garlands are public)` | Can someone just help me? | Low | Server-rendered page; 'Not sure? Ask us on WhatsApp' / Help me choose → WhatsApp (2 taps) (J8) |
| A Keyboard / assistive technology | “haldi decoration flowers bangalore” → `/occasions → Ask (wedding ceremony section when garlands are public)` | Marigold and garlands for the ritual — what's possible? | Med | Labelled chips/switch (aria-pressed), visible focus, no JS needed to see products (J9) |

#### Baby shower / new baby / naming

| | Likely search → landing | First question | Difficulty | Shortest practical path |
|---|---|---|---|---|
| K Knows the exact design | “design code (e.g. FP-G012)” → `/search?q=<code> — drafts are not public, so no result` | Is this design available? | Med | Search finds nothing → Ask on WhatsApp with the code (garlands appear once published) (J1) |
| U Unsure what to choose | “seemantham flowers bangalore” → `/occasions → Ask (/occasions/mom-to-be empty state)` | For the ceremony or a gift for the family? | High | Choose ceremony / gift → WhatsApp enquiry carrying the intent (J5) |
| B Strict budget | “seemantham flowers bangalore price” → `/occasions → Ask (/occasions/mom-to-be empty state)` | What would it cost? | High | WhatsApp enquiry with 'Budget (optional)' line — quoted, never estimated (J5) |
| T Needs it urgently | “seemantham flowers bangalore urgent” → `/occasions → Ask (/occasions/mom-to-be empty state)` | Can anything be done today? | High | WhatsApp enquiry; no delivery promise on the site (J4) |
| P Planning ahead | “seemantham flowers bangalore” → `/occasions → Ask (/occasions/mom-to-be empty state)` | Can I choose now for a later date? | Low | WhatsApp enquiry with 'Date (optional)' (J5) |
| R Ordering remotely | “send seemantham flowers bangalore” → `/occasions → Ask (/occasions/mom-to-be empty state)` | Do you deliver to their area? | Med | Service-area line on page → area in the WhatsApp message (confirmed in chat) (J5) |
| M Multiple items / quantities | “seemantham flowers bangalore bulk” → `/occasions → Ask (/occasions/mom-to-be empty state)` | How many, and what would that cost? | High | WhatsApp enquiry; garland quantities stated in the confirmed unit, never totalled (J7) |
| C Specific colour / ceremony requirement | “seemantham flowers bangalore” → `/occasions → Ask (/occasions/mom-to-be empty state)` | Can you match the ritual's colours and flowers? | High | For the ceremony → WhatsApp with requirements (J5) |
| S Slow phone / low digital confidence | “seemantham flowers bangalore” → `/occasions → Ask (/occasions/mom-to-be empty state)` | Can someone just help me? | Low | Server-rendered page; 'Not sure? Ask us on WhatsApp' / Help me choose → WhatsApp (2 taps) (J8) |
| A Keyboard / assistive technology | “seemantham flowers bangalore” → `/occasions → Ask (/occasions/mom-to-be empty state)` | For the ceremony or a gift for the family? | Med | Labelled chips/switch (aria-pressed), visible focus, no JS needed to see products (J9) |

#### Housewarming / pooja

| | Likely search → landing | First question | Difficulty | Shortest practical path |
|---|---|---|---|---|
| K Knows the exact design | “design code (e.g. FP-G012)” → `/search?q=<code> — drafts are not public, so no result` | Is this design available? | Med | Search finds nothing → Ask on WhatsApp with the code (garlands appear once published) (J1) |
| U Unsure what to choose | “housewarming flowers bangalore” → `/occasions/housewarming` | Home and pooja flowers, or a housewarming gift? | High | Choose ceremony / gift → WhatsApp enquiry carrying the intent (J5) |
| B Strict budget | “housewarming flowers bangalore price” → `/occasions/housewarming` | What would it cost? | High | WhatsApp enquiry with 'Budget (optional)' line — quoted, never estimated (J5) |
| T Needs it urgently | “housewarming flowers bangalore urgent” → `/occasions/housewarming` | Can anything be done today? | High | WhatsApp enquiry; no delivery promise on the site (J4) |
| P Planning ahead | “housewarming flowers bangalore” → `/occasions/housewarming` | Can I choose now for a later date? | Low | WhatsApp enquiry with 'Date (optional)' (J5) |
| R Ordering remotely | “send housewarming flowers bangalore” → `/occasions/housewarming` | Do you deliver to their area? | Med | Service-area line on page → area in the WhatsApp message (confirmed in chat) (J5) |
| M Multiple items / quantities | “housewarming flowers bangalore bulk” → `/occasions/housewarming` | How many, and what would that cost? | High | WhatsApp enquiry; garland quantities stated in the confirmed unit, never totalled (J7) |
| C Specific colour / ceremony requirement | “housewarming flowers bangalore” → `/occasions/housewarming` | Can you match the ritual's colours and flowers? | High | For the ceremony → WhatsApp with requirements (J5) |
| S Slow phone / low digital confidence | “housewarming flowers bangalore” → `/occasions/housewarming` | Can someone just help me? | Low | Server-rendered page; 'Not sure? Ask us on WhatsApp' / Help me choose → WhatsApp (2 taps) (J8) |
| A Keyboard / assistive technology | “housewarming flowers bangalore” → `/occasions/housewarming` | Home and pooja flowers, or a housewarming gift? | Med | Labelled chips/switch (aria-pressed), visible focus, no JS needed to see products (J9) |



## Focused audit completion — 7 October 2026

The four takeover findings are corrected. Reproducible fixture regressions, browser coverage at 360/390/1440px, development startup/outage recovery, price and business-information evidence are recorded in [handoff-audit-2026-10-07.md](handoff-audit-2026-10-07.md). Commands and isolation boundaries are in [audit-regressions.md](audit-regressions.md). The historical performance/results above remain historical; they are not new production checks.

A build captures validated prices; dev, sync and type checking skip the snapshot loader even when a database URL is configured. Development product requests still require database access and fail explicitly when unavailable; retry recovers. Production builds never substitute zero or stale catalogue prices. Wedding/Engagement HTML carries the `garlands` cache tag as well as its occasion tag so existing garland saves invalidate those ceremony listings. No suitability migration was needed.
