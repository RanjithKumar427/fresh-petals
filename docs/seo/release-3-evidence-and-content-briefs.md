# Release 3: evidence queue, social briefs and review workflow

Drafts for the owner. Nothing here has been posted, sent or set up, and no account, partnership or link was created. Catalogue photographs are already approved for the website; this does not reopen that.

## 1. Evidence queue (in priority order)

What the site cannot say today because it has not been confirmed. Each item, once supplied, replaces a "confirmed on WhatsApp" line with a fact.

| # | Needed | For | Why it is first |
|---|---|---|---|
| 1 | Separate photographs of loose jasmine and of a finished gajra | Jasmine / Malli, Jasmine Gajra | They share one picture (`/images/jasmine.jpg`), on a page whose whole point is telling the two apart. |
| 2 | Photographs of each pooja pack | Daily Pooja Flowers, Pooja Basket, Temple Bulk Flowers, Event Garlands share `/images/cat-pooja.jpg`; the flowerbox "Pooja Flower Box" also uses the jasmine picture | Five products show a picture of something else. The guide labels them as shared. |
| 3 | Confirmed contents and size of the eight bouquets: stem counts or a size name, and the wrapping as sold | Red Affair, Timeless Hug, Rose Promise, Colourful Confession, Colour Pop Love, Sunshine Story, Blush Lily Letter, Pink Lily Wish | These lead the homepage, every city page and the bouquet guide. Only flowers and wrapping are recorded now. |
| 4 | Confirmed specifications for the garlands shown first: single or pair as sold, length, the flowers actually used | FP-G001, FP-G002, FP-G003, FP-G014, FP-G015, FP-G016, FP-G008 and the others that open the collections and city pages | Today a design has a photograph, a code and a browsing group. Nothing else is verified. |
| 5 | A distinct name for one of the two "Pooja Flower Box" products | `pooja-flower-box` (market price) and `pooja-flowerbox` (starting price) | Two products with one name. The site tells them apart by price only. |
| 6 | Better originals for low-resolution garland photographs | To be listed by the owner from the admin; not audited in this release | Small originals limit how large a design can be shown and how it appears in image search. |
| 7 | One genuine completed-order story | Any order whose customer agrees | See the workflow in section 3. Nothing on the site is presented as a completed delivery today. |
| 8 | Which account of the business's history is right | About page says it began in Bengaluru; the Instagram handle and the published feedback are labelled Hyderabad | Left as it is on the site. Needs one sentence from the owner before either is changed. |
| 9 | Pack sizes or units for pooja products, and whether every product is offered in all 59 cities | Pooja collection, city pages | Carried over from earlier releases. |

## 2. Six social-content briefs

Each uses photographs already on the website and points at one page. Copy is a proposal; prices and delivery times are deliberately absent because bouquets and garlands are quoted, and no delivery time is promised. Asset paths are relative to `public/`, or a design code for garlands (the photograph is on that design's page).

### Brief 1: Roses, lilies or mixed
- **Format:** three-frame carousel.
- **Assets:** `/images/bouquets/bouquet-red-affair-01.webp`, `/images/lilies/lily-blush-lily-letter-01.webp`, `/images/bouquets/bouquet-colourful-confession-01.webp`.
- **Storyboard:** 1. "One colour, one message" over Red Affair. 2. "Fewer, larger flowers that keep opening" over Blush Lily Letter. 3. "No single flower in charge: the safe choice when you are unsure" over Colourful Confession.
- **Caption:** "Three kinds of bouquet, three different gifts. Which one suits the person you are sending to? The guide compares all eight of ours."
- **Destination:** `https://onlyfreshpetals.in/guides/choosing-a-flower-bouquet`

### Brief 2: Wrapped, or in a vase
- **Format:** two-frame comparison.
- **Assets:** `/images/bouquets/bouquet-timeless-hug-01.webp` (soft white wrapping), `/images/bouquets/bouquet-colour-pop-love-01.webp` (glass vase).
- **Storyboard:** 1. "Handed over, then it needs a vase." 2. "Ready for a desk or a table."
- **Caption:** "Sending to an office? Think about where the flowers will stand. One of our designs arrives in a vase; a vase can be added to the others."
- **Destination:** `https://onlyfreshpetals.in/guides/choosing-a-flower-bouquet#presentation`

### Brief 3: Rose, lotus or tuberose garlands
- **Format:** three-frame carousel.
- **Assets:** designs FP-G001 (rose group), FP-G014 (lotus group), FP-G008 (tuberose group).
- **Storyboard:** one design per frame with its code in the corner and one line each: "Strongest colour", "Built around the lotus", "The pale one".
- **Caption:** "Start with the main flower, then the finish at the top and the ends. Every design has a code to quote. Length, single or pair, and the price are confirmed for your date."
- **Destination:** `https://onlyfreshpetals.in/guides/choosing-wedding-garlands`
- **Do not say:** which flowers are inside a garland. The groups are how photographs are sorted.

### Brief 4: Choosing by design code
- **Format:** short reel, screen recording of the garland collection.
- **Assets:** the live listing at `/categories/garlands`; designs FP-G002 and FP-G003 opened in turn.
- **Storyboard:** 1. Scroll the collection. 2. Tap a design; the code is on the photograph. 3. Text: "Send us the code, the date, and one or a pair." 4. End on the enquiry button (do not send).
- **Caption:** "Found one you like? Its code tells us exactly which photograph you mean."
- **Destination:** `https://onlyfreshpetals.in/categories/garlands`

### Brief 5: Loose jasmine or gajra
- **Format:** two-frame comparison. **Blocked on evidence item 1:** both products currently share one photograph of loose jasmine. Do not post a gajra frame using it.
- **Assets:** `/images/jasmine.jpg` for the loose frame; a new gajra photograph is required for the second.
- **Storyboard:** 1. "Loose: to offer, or to string yourself." 2. "Gajra: already strung, ready to wear."
- **Caption:** "The same flower in two forms. Tell us which, and how much or how long."
- **Destination:** `https://onlyfreshpetals.in/guides/jasmine-pooja-flowers-and-gajra`
- **Do not say:** a variety, an origin, a weight or a length.

### Brief 6: Sending to another city
- **Format:** four-frame text carousel on brand colours, with one bouquet photograph.
- **Assets:** `/images/bouquets/bouquet-rose-promise-01.webp`.
- **Storyboard:** 1. "They are in another city? Start with the recipient city." 2. "Choose the design." 3. "Give a name, a phone number and a landmark." 4. "We confirm availability, price and delivery details on WhatsApp before you pay."
- **Caption:** "We take orders for 59 cities across India. Here is how an order for someone else works, step by step."
- **Destination:** `https://onlyfreshpetals.in/guides/sending-flowers-to-another-city`
- **Do not say:** same-day, a delivery time, or "everywhere".

## 3. Genuine reviews and partner credits: a short workflow

**Reviews (only from completed orders).**
1. After a delivery is confirmed received, the owner asks the customer on WhatsApp whether they would share a line about the flowers and whether it may be published. Ask once; no incentive.
2. Record four things: the order date, the product, the recipient city, and the customer's written consent, including how they want to be named (first name, initials or not at all) and whether their photograph may be used.
3. Publish the customer's words as written, shortened only by cutting. Label it with the product and the city of that order. Remove names, phone numbers and addresses of anyone else.
4. An enquiry, a compliment before delivery, or a message about a quote is not a review and is not published as one.
5. Existing feedback on `/reviews` keeps its Hyderabad labels. It is not relabelled to other cities.
6. Ratings markup is added only when there is a count of real, published reviews to state. None is added now.

**Partner credits (only relationships that exist).**
1. List the businesses Fresh Petals actually works with on an order: a photographer, a planner, a venue, a decorator.
2. Where one of them publishes photographs from an event that used Fresh Petals flowers, ask for a credit with a link to the relevant page (the garland collection or a city page), and offer the same in return on a completed-order story.
3. A credit names what was supplied and when. No listing in directories that sell placement, no paid links, no exchanged links between unrelated sites.
4. Taking orders for a city is not a branch there. No local address, landline or "store" is claimed for any city.
