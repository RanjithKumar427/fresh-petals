-- RLS for `delivery_zones`, same posture as categories/occasions/media
-- (0001_enable_rls.sql): RLS enabled, unconditional public SELECT, no
-- anon/authenticated write policy (absence of a write policy denies that
-- command outright). This is not a new exposure — the exact same data
-- (all ten pincodes, fees and availability flags) already ships in every
-- storefront page's public JS bundle today via serviceAreas.ts's
-- define:vars usage in cart.astro/DeliveryChecker.astro/ProductOptions.astro,
-- so a public-read policy here is strictly equivalent to the status quo,
-- not a new privacy or security decision.
--
-- Writes (adding/editing a zone) are a service-role/postgres-role-only
-- operation for now: there is no admin UI for this table in this
-- milestone (see the Delivery Capability report's Admin section for why),
-- so there is nothing for an `authenticated` write policy to serve yet.
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "public_read_delivery_zones" ON delivery_zones
  FOR SELECT TO anon, authenticated USING (true);
