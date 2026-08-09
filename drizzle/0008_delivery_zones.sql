-- Delivery Capability Engine, part 1: promote src/data/serviceAreas.ts (a
-- static, compile-time TypeScript array shipped into every page's public
-- JS bundle today) into a real Postgres table. This is the concrete,
-- unavoidable consequence of the milestone's own mandated architecture
-- (Customer UI -> Delivery API -> Delivery Service -> Delivery Repository
-- -> Drizzle -> PostgreSQL) — there is no existing delivery/zone/pincode
-- table anywhere in the schema to reuse; this is not a speculative table
-- added "in case it's needed".
--
-- Row shape is a faithful port of ServiceArea from serviceAreas.ts, not a
-- redesign — same five business fields, same meaning. Seeded from that
-- exact file in a separate, idempotent step (scripts/seed-delivery-zones.mjs),
-- not hardcoded into this migration, so the migration itself stays pure
-- schema and the seed can be re-run safely.
--
-- No separate index on `pincode`: the UNIQUE constraint below already
-- creates one (Postgres always backs a UNIQUE constraint with a unique
-- btree index), and every real lookup in this milestone is by exact
-- pincode — a second, explicit index on the same column would be a
-- redundant duplicate, not a performance improvement.
CREATE TABLE "delivery_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"pincode" text NOT NULL,
	"area" text NOT NULL,
	"city" text NOT NULL,
	"delivery_fee" integer NOT NULL,
	"same_day_available" boolean DEFAULT false NOT NULL,
	"morning_delivery_available" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_zones_pincode_unique" UNIQUE("pincode")
);
