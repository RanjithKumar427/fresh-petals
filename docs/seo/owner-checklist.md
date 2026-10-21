# Owner checklist: Google, Bing and local presence

Steps that need the owner's accounts or decisions. Nothing here is done automatically, and nothing should be published until the listed inputs are real.

## 1. Google Search Console (about 15 minutes)

1. Done: a verified Domain property for `onlyfreshpetals.in` exists. (The `PUBLIC_GOOGLE_SITE_VERIFICATION` setting is only needed if a URL-prefix property is ever added.)
2. Done: all three sitemaps were submitted on 12 Oct 2026; `sitemap.xml` was resubmitted on 14 Oct and read at 221 URLs, and a stray `/locations/bengaluru` sitemap entry was removed (`discovery-baseline-2026-10-14.md`).
3. Done 14 Oct 2026: indexing requested for `/locations/bengaluru`, `/categories/all-flowers`, `/categories/garlands`, `/categories/garlands/lotus` and `/locations/hyderabad`, and a recrawl of `/categories/pooja-flowers`. Requests only queue a crawl.
4. **Still to check** after each release: the list under "Account checks outstanding" in `measurement.md`. After the image-discovery release, both changed sitemaps should show a later read date; nothing needs resubmitting.

Reports showed "processing" until 13–14 Oct 2026; only one day of performance data had been read by 14 Oct.

## 2. Bing Webmaster Tools (about 10 minutes)

1. Go to bing.com/webmasters and sign in with a Microsoft account (the browser was not signed in on 12 Oct 2026). Choose **Import from Google Search Console**; it copies the verified property and its sitemaps, so do step 1 first.
2. Without the import: add the site, choose the meta-tag method, put the `content` value in Vercel as `PUBLIC_BING_SITE_VERIFICATION` and redeploy. Then submit the three sitemaps.
3. IndexNow needs no account. After a release, run `node scripts/seo/indexnow.mjs` to see what would be sent and add `--submit` to send it. Bing's IndexNow report then shows the submissions.

## 3. Google Analytics

Done 13 Oct 2026: property, web stream and `PUBLIC_GA_MEASUREMENT_ID` (Production only). Still unverified: the custom dimensions, the two key events, data retention, and a link to Search Console. See `measurement.md`.

## 4. Google Business Profile

Eligible only if customers are served in person: either at a staffed address, or by delivering to them (a service-area business). Decide which, then:

| Input needed | Why |
|---|---|
| Legal or trading name exactly as customers know it ("Fresh Petals") | Must match the website and any signage |
| Either a street address customers can visit, or confirmation that you deliver only (address hidden) | Sets storefront versus service-area |
| Service areas: Chamarajpet and Basavanagudi today | Add others only after you deliver there |
| Phone number customers should call (the WhatsApp number is +91 96520 12274) | Must be answered |
| Opening hours you actually keep | Shown on the profile |
| Category: Florist | Primary category |
| Your own photographs of bouquets and garlands | Not supplier or stock images |

Google verifies by video, phone or post. Do not create a profile for an address you do not operate from. Once these inputs exist, tell us: the same details can then be added to the website as Florist structured data and an address line, which are deliberately absent today.

## 5. Reviews

Ask customers after a completed order, with the direct review link from the Business Profile. Do not offer a discount for a review, do not write them yourself, and do not copy reviews between the profile and the website. The website's `/reviews` page carries nine earlier feedback notes labelled with Hyderabad areas (May 2026). Since 21 October 2026 the four attributed to an enquiry are labelled "Enquiry", the others "Feedback", and none is presented as a verified or completed order: the repository holds no order record, consent note or source conversation for any of them. Their text, dates and areas are unchanged. Add Bengaluru feedback as it arrives, with the customer's permission.

## 6. Local references

Worth asking for a mention or link, one conversation at a time:

- Wedding planners, mandap decorators and photographers you have supplied.
- Venues and function halls in and around Chamarajpet and Basavanagudi.
- Temples and community associations you supply regularly.
- Local business directories where a florist listing is free (keep the name, phone and areas identical to the website).

Never buy links or pay for listings that promise rankings.

## 7. Vercel housekeeping

- Redirect the exact default host `fresh-petals-brown.vercel.app` to `onlyfreshpetals.in` in the project's domain settings. A separate release/account action; do not redirect preview deployments in general.
- IndexNow receipts already recorded (`search-growth-2026-10.md`) are history; a new submission is a separate step after a release.
- Image optimisation is now used for garland photographs. Check Usage → Image Optimization after a month; the catalogue needs roughly 500 resized images.

## Decisions still open

- Is `instagram.com/freshpetals.hyderabad` still the account to link? If there is a Bengaluru account, tell us.
- For each garland: single or pair, length, exact flowers, preparation time. Each one recorded in the admin replaces a "To be confirmed" on the design page.
- **Photographs of 12 products now shown with the "no image yet" placeholder** (their old picture showed something else): gift flower box, premium basket, dried flower bunch, dried flower vase set, mini succulent, plant and flower hamper, premium decor vase, florist cutter, room mist, flower and chocolate hamper, bridal flower accessories, lilies by stem.
- **Photographs of 25 products shown with a labelled representative picture** (pooja flowers and baskets, flower boxes, baskets, offers, subscriptions, cards, candles, table decor, clear glass vase, toran, gajra, housewarming hamper, event garlands, roses by stem).
- For either list, a new photograph is described as the product, and listed in the image sitemap, only after someone looks at it and records it in `src/data/productPhotos.ts`; a matching file name is not enough. Reasons: `image-discovery-2026-10-16.md`.
- **Mandarin Lily Glow, Luxe Lily Bloom, Stargazer Affair:** wrapped, as their records say, or in a vase or box, as their photographs show? Until you say, their pages show both and ask on WhatsApp; the records are unchanged.
- **Chocolates, Flower Food Sachets, Pet Friendly Flowerbox** have no photograph at all.
- **Sweet Petal Hour** records a "Vase-style arrangement". Is a vase included? Until you say, it is not listed as a vase arrangement, titled one or counted as wrapped; its page is unchanged.

### Inputs for the 21 October 2026 corrections

Only facts that are missing; nothing below is assumed in the meantime.

| Input | Where it is used | Until it is supplied |
|---|---|---|
| The three lily presentations above, and Sweet Petal Hour's vase | Collections, titles, the All Flowers groups | Listed under "Presentation confirmed on WhatsApp" |
| Photographs for the placeholder and representative lists above | Product pages, social previews, image sitemap | Placeholder or labelled representative picture |
| For each `/reviews` note: an order or enquiry reference, and the customer's consent to publish | `/reviews` | Labelled "Feedback" or "Enquiry"; not called verified |
| Evidence for "Bestselling" (request or sales counts for each design) | `/categories/bestselling-bouquets` | Named "Selected Bouquets", described as a selection, not a ranking |
| Garland pilots FP-G001, FP-G034, FP-G106, FP-G035, FP-G086, FP-G085: sold as single or pair, length, flowers used, thickness, finish, preparation time, substitutions, in the existing admin fields | Garland pages and the wedding garland guide | "Confirmed on WhatsApp". FP-G106's photograph shows two garlands; that is not recorded as a pair until its "sold as" field says so. The two designs already recorded as pairs keep that |
| City coverage | Delivery pages | The owner-confirmed list in `src/data/serviceCities.ts`. A delivery city is not a branch or a pickup address |
