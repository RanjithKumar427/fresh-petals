# Homepage occasion carousel

Replaces the homepage occasion deck with an occasion carousel in the same
position (`src/pages/index.astro`, after the bouquet edit). Integrated on
10 Oct 2026 with the admin-driven occasion work from
`transfer/freshpetals-local-2026-10-10` (`5bc2cc8`).

## Where things live

- `src/data/occasionJourneys.ts` — `CAROUSEL_OCCASIONS` (owner order, labels,
  featured photo), `carouselOccasions(membership)`, and the shared
  storefront/admin rule `occasionProductEligible` / `occasionPageProducts`.
- `src/server/services/OccasionMembership.ts` — the admin's assignments
  (`product_occasions`), read fresh on each request.
- `src/data/atelierHome.ts` — `getOccasionCarousel(membership)`: card title,
  link, count, photo and crop focus.
- `src/components/atelier/OccasionCarousel.astro` — markup, script, styles.

## Rules

- **Membership**: the admin's "Suitable occasions" are authoritative. A
  cleared assignment is never refilled from catalogue tags.
- **Eligibility and count**: a card's products are exactly
  `occasionPageProducts()` for its occasion page, so "N designs" always equals
  what `/occasions/<slug>` lists. Launch occasions list assigned launch
  bouquets (Housewarming also counts pooja-assigned ones). Condolence
  (`sympathy`) lists assigned public bouquets (Bouquets/Lilies) only, never
  add-ons or other product types (`BOUQUET_ONLY_ROUTES`). The admin's
  live-page check uses the same rule, so it expects an assigned add-on to be
  absent.
- **Order**: Birthday, Anniversary, Wedding, Engagement, Housewarming & Pooja,
  Condolence; occasions with nothing eligible are left out, never padded.
- **Dataset sizes**: 0 — no section; 1 — one linked card; 2 — a balanced
  static pair; 3+ — the carousel.
- **Refresh**: the homepage and occasion pages are rendered on request and
  CDN-cached (120s + 60s stale). Saving a product whose occasions changed
  purges `occasion-index` (the homepage) and `occasion:<slug>` for each
  occasion added or removed (`OccasionWebsite.ts`); "Refresh website" in the
  admin retries it. A failed purge is reported as failed.
- **Prices**: unchanged rules from the transfer — the published price
  snapshot taken at build time (`content.config.ts`, `ProductPricing.ts`).

## Behaviour (3+ occasions)

- One continuous position value drives every card, so looping is seamless
  without duplicate cards. Cards fade out before they wrap sides.
- 800ms transitions; autoplay every 4.5s.
- Previous/next, a position indicator (dots and "01 / 06"), and pause/play.
- Swipe, mouse drag and arrow keys. A drag never follows a link. A plain
  click on a visible card opens that card's occasion page.
- Autoplay pauses on mouse hover, keyboard focus, a pressed pointer, a hidden
  tab and an off-screen section, and resumes when that ends. Pause stays
  paused until Play.
- Desktop (1024px and up): centre 100%, neighbours 80%, outer cards 65%, with
  dimming. Below 1024px: centre card and neighbours; on phones the neighbours
  only peek and show no caption.
- Accessibility: there is one keyboard stop for the cards (the centre one)
  plus three buttons. Hidden cards are `inert`. Focus is visible. User moves
  are announced through a polite live region. Reduced motion, no JavaScript,
  and 1–2 occasions all show the server-rendered static layout with no
  autoplay.

## Previewing all six occasions

```sh
npm run preview:occasions   # astro dev; open http://localhost:4321/
```

The admin's assignments are read from `DATABASE_URL` as usual (read-only)
and adjusted in memory for this dev server only: nothing is written to the
database or files, and `astro build` with this config is refused.
`FP_OCCASION_FIXTURE="route=slug,slug;route="` sets another adjustment (e.g.
`"birthday=;anniversary=;sympathy="` for the empty state). `FP_LOCAL_PG=1`
uses a plain local Postgres, such as the transfer's audit fixture
(`scripts/audit/local-fixture.mjs prepare`).

## Verification (10 Oct 2026, combined branch)

Local only, on the transfer's isolated fixture (`freshpetals_audit` on
loopback, `scripts/audit/local-fixture.mjs`); no production database, CDN or
deployment.

- `astro build` of the combined tree: passes.
- `node --test scripts/audit/regression.test.mjs`: 17/17. The transfer's
  deck/ring tests were replaced by carousel tests for the integrated rules
  (order, occasion-page links, counts = page list, add-on exclusion, admin
  removals, photos).
- `scripts/audit/browser.mjs` (the transfer's browser audit): all 23 checks
  pass at 360/390/1440px, including snapshot prices and the refresh-failure
  contract.
- Integration checks through the real admin API on the served build: card
  counts equal page lists; an add-on assigned to Condolence is excluded from
  page, card and checker; assigning a bouquet adds it to page and card and
  purges `occasion-index` + `occasion:sympathy`; removing every assignment
  removes the card and empties the page; cache headers and the manual
  refresh endpoint behave as specified; the carousel enhances with no
  overflow, arrows move, Alt+Arrow is ignored.
- `astro check`: the existing 20 errors in `DiscoveryPostCard`,
  `MobileBottomBar` and `SubscriptionConfigurator`; none new.
- Not verified: Safari/WebKit, real devices, the production database or CDN.
