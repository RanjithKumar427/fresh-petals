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

Ask customers after a completed order, with the direct review link from the Business Profile. Do not offer a discount for a review, do not write them yourself, and do not copy reviews between the profile and the website. The website's `/reviews` page carries earlier feedback labelled with Hyderabad areas; leave those labels as they are and add Bengaluru feedback as it arrives, with the customer's permission.

## 6. Local references

Worth asking for a mention or link, one conversation at a time:

- Wedding planners, mandap decorators and photographers you have supplied.
- Venues and function halls in and around Chamarajpet and Basavanagudi.
- Temples and community associations you supply regularly.
- Local business directories where a florist listing is free (keep the name, phone and areas identical to the website).

Never buy links or pay for listings that promise rankings.

## 7. Vercel housekeeping

- Redirect `fresh-petals-brown.vercel.app` to `onlyfreshpetals.in` in the project's domain settings.
- Image optimisation is now used for garland photographs. Check Usage → Image Optimization after a month; the catalogue needs roughly 500 resized images.

## Decisions still open

- Is `instagram.com/freshpetals.hyderabad` still the account to link? If there is a Bengaluru account, tell us.
- For each garland: single or pair, length, exact flowers, preparation time. Each one recorded in the admin replaces a "To be confirmed" on the design page.
- **Own photographs for 39 catalogue products** that now show a labelled representative picture (pooja flowers and baskets, flower boxes, baskets, add-ons, vases, offers, subscriptions, hampers, flowers by stem, toran, event garlands). A photograph saved under a file name containing the product's slug (as the bouquet photographs are) and used by no other product joins the image sitemap and loses the label by itself. List: `src/data/productPhotos.ts`; reasons: `image-discovery-2026-10-16.md`.
- **Mandarin Lily Glow, Luxe Lily Bloom, Stargazer Affair:** wrapped, as their records say, or in a vase or box, as their photographs show?
- **Chocolates, Flower Food Sachets, Pet Friendly Flowerbox** have no photograph at all.
