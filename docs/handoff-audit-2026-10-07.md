# FreshPetals focused handoff audit — 7 October 2026

Completed locally against HEAD `6ee4aba` and the preserved Claude working tree. Repository instructions, current changes, occasion/garland docs and the supplied review evidence were read. No AGENTS.md or CLAUDE.md was found in the repository or checked parents. Earlier review logs are historical; the results below distinguish fresh local evidence from later production checks.

## Findings

| Finding | Status | Correction and actual evidence |
|---|---|---|
| Saved occasion URL broadens after its last bouquet is removed | **Fixed, locally verified** | Shared known-value parsing retains zero-result occasions independently of visible chips. Server HTML and browser use the same matcher/facet counts. Active selection, Clear and contextual assistance remain visible. Real admin removal followed by direct arrival, reload, Back, invalid-value and no-JavaScript checks at 360/390/1440px. |
| Bouquet list loses occasion/intent | **Fixed, locally verified** | Explicit context travels in product query parameters and each persisted basket item. Canonical tags are unchanged. Multiple selected occasions remain multiple; an unfiltered visit inherits nothing. Later product choices update context and survive reload. Mixed items merge only within equal context. Product/list/basket WhatsApp drafts were intercepted and checked at every viewport. |
| Editorial fallbacks restore removed assignments | **Fixed, locally verified** | Admin assignments are authoritative across the broader catalogue. Both storefront and checker use `occasionProductEligible`; checker looks for an actual occasion card and still detects discrepancies. Empty list, explicit removal, additions and restoration covered in source regressions and actual local admin API/page tests. Valid assigned older-catalogue products remain available. |
| Gift assignments enable ceremony shortcuts | **Fixed, locally verified** | Existing gift/garland type rules, supported Wedding/Engagement routes and all public-product gates determine ceremony availability. A gift assignment is insufficient. Explicit supported enquiry pages remain accurate. Synthetic public-design browser tests exclude gift bouquets; all 156 original drafts remain private. No new suitability migration. |
| 4–6-hour express wording conflicts with unconfirmed same-day availability | **Fixed wording; business decision unresolved** | Removed speed promises from shipping, request options, generated delivery timing and old persisted basket display/message text. FAQs, terms and WhatsApp describe arrangements agreed before acceptance. Existing fee, date, pincode and configuration gates are retained; no new fees/cut-offs. Owner must confirm the actual service before a timing promise can return. |
| Greeting/message inclusion and payment examples | **Fixed wording; business decisions unresolved** | Design-specific included features remain unchanged. Printed cards are quoted extras; message-note availability/charge is checked where absent from the catalogue. Unconfirmed UPI examples removed from homepage FAQ, FAQs, terms and refunds. No free card or response-time promise was introduced. |
| Bouquet price consistency | **Locally verified** | Eight launch list/product/quick-enquiry prices use the same build snapshot. A post-build database edit leaves deployed labels unchanged. Persisted item/add-on labels reconcile with accurate notices while retaining quantities and item context. Admin deployment-timing note remains. No money totals added. |
| Garland pricing and safeguards | **Locally verified** | Separate synthetic FP-G900 retains live price, option charge and confirmed-unit wording; no quantity multiplication. Saved enquiry URL is refused with no-store after unpublication. Existing database validation, admin middleware and publish/photo/sample gates remain. |
| Price loader blocks dev/check when database is unavailable | **Fixed, locally verified** | Astro check/sync uses production mode, so DEV alone was insufficient. The config hook records the actual command: only build captures prices. Dev starts during an outage, non-DB page responds 200, bouquet page fails explicitly, and the same process recovers when local DB access returns. Unavailable/invalid production pricing fails the build; no zero/stale fallback. |
| Type diagnostics | **Baseline verified; unresolved pre-existing failures** | Final isolated check retains the reproduced 20-error baseline: 15 SubscriptionConfigurator, 4 DiscoveryPostCard, 1 MobileBottomBar. No new errors. Check remains nonzero; it is not a clean check. Diagnostic comparison is in the evidence bundle. |

## Fresh local evidence and limits

- Source regression command: `node --test scripts/audit/regression.test.mjs` (15 tests).
- Existing garland importer fixtures: `node --test scripts/import-garlands.test.mjs scripts/import-garlands-full.test.mjs` (10 tests).
- Production-mode Astro build uses the dedicated local PostgreSQL fixture and succeeds. Browser log contains 22 passing scenario groups at 360, 390 and 1440px, including JavaScript disabled. No page exceptions or horizontal overflow on checked journeys. Screenshots scroll lazy images into view before capture.
- Failed refresh is exercised through a local 503 purge hook and the actual admin UI/checker. Header contract remains 120 seconds plus 60 seconds stale revalidation (180 seconds); the UI truthfully says saved, refresh failed, within 3 minutes/retry. Actual production CDN timing was **not measured**.
- Permission middleware verifies anonymous 401, first-factor 403 and full-admin access using an isolated resolveAccess boundary double. This does **not** verify Supabase sign-in or MFA.
- `startup.log` records outage/startup, explicit request failure, same-process recovery and rejected production build. On expected Astro build failures, this Windows Node runtime also printed a native UV_HANDLE_CLOSING cleanup assertion; successful builds and browser runs did not fail with it.
- All commands, fixture transport/auth doubles and ports are documented in [audit-regressions.md](audit-regressions.md). External browser requests were blocked; enquiry submissions intercepted. No writable test used the repository's production environment.

## Business facts and decisions

The hero is **Timeless Hug**, using its own catalogue image variants for both photo and lens. “What will arrive” is **Colourful Confession**, using its own image and CSS close-ups from that same file. Local source/manifest checks and browser screenshots confirm this linkage; photograph ownership and as-made specification verification remain owner decisions. Dimensions remain unrecorded, and stem ranges are labelled as listed details to confirm rather than measured facts. The existing Instagram link is retained.

| Launch bouquet | Message note in existing included features |
|---|---|
| Red Affair | Message note on request |
| Timeless Hug | Message note on request |
| Rose Promise | Not recorded — owner decision |
| Colourful Confession | Message note on request |
| Colour Pop Love | Message note on request |
| Sunshine Story | Not recorded — owner decision |
| Blush Lily Letter | Message note on request |
| Pink Lily Wish | Not recorded — owner decision |

Owner decisions required, without invented answers:

1. Whether same-day/express is offered; supported products/areas, actual lead time, order cut-off and how a slot is accepted.
2. Approved delivery fee rules, distance/time/handling extras, and whether any website estimate is approved.
3. Accepted payment methods, payment timing/deposit rules and refund methods/timing.
4. Message-note inclusion/availability/charge for Rose Promise, Sunshine Story and Pink Lily Wish; confirmation of the other five records; printed card variants, availability and price.
5. Cancellation/change cut-off by order type and how it is communicated before acceptance. Existing before-sourcing/preparation policy remains conditional.
6. Photo ownership/provenance; as-made bouquet stem ranges, dimensions, finish and substitutions; replacement of misleading legacy imagery outside the launch range.
7. A verified replacement Instagram account, if desired; the current link remains.
8. Confirmed occasion assignments and future per-product suitability needs; the present model supports this correction without a migration.
9. Garland photo permissions/own replacement photos, made samples, unit, length, flowers, thickness/finish, preparation time, substitutions, filters/alternate views, suitability, delivery and confirmed price. All 156 original drafts remain unapproved.

## Preservation and release boundaries

The original 688 tracked/non-ignored untracked files were copied and hashed before this audit. The original diff and baseline remain under ignored `data/codex-audit-2026-10-07/`. The final preservation comparison identifies only the explicitly audited files as changed; all other original files, including CSS/motion, catalogue/draft records, auth/middleware, publish validation and the architecture proposal, are preserved. No existing development server was stopped or restarted.

Audit output is ignored `data/focused-audit-2026-10-07/`. Temporary `scripts/_tmp-audit-prepare.mjs`, `_tmp-audit-checks.mjs`, `_tmp-focus-edit.mjs`, `_tmp-audit-docs.mjs` and other audit bookkeeping scripts are explicitly excluded. Meaningful regressions remain under `scripts/audit/`; no dependency, migration, production setting or photo was added. Release manifest and review evidence distinguish this pass from the historical Claude pass.

No production data/settings were changed, products published, photos uploaded, changes committed/staged/pushed or code deployed. Later deployed checks remain: real admin MFA/authorization; actual CDN purge/freshness and region; deployed bouquet snapshot and garland live prices; absence of draft media in public output; owner-approved business information. The owner-assisted production checklist remains unticked.
