-- Commerce Foundation Phase 3, Milestone 2 — Delivery Details.
--
-- Purely additive: four nullable text columns on the existing `inquiries`
-- table, no drops, no renames, no NOT NULL, no default requiring a
-- rewrite. Postgres adds a nullable column without a table rewrite, so
-- this is safe and instant regardless of existing row count. Existing
-- rows get NULL for all four columns automatically — the API layer
-- (inquiryInputSchema) is what makes them required for *new*
-- submissions; the database itself stays permissive so historical rows
-- never need to be (and never are) rewritten.
--
-- Hand-authored rather than `drizzle-kit generate`, same as 0005/0006:
-- this environment has no TTY for drizzle-kit's interactive new-table/
-- column resolver (see the Milestone 5 report), and the drizzle/meta
-- snapshot chain was already stale before this migration for the same
-- reason. `drizzle-orm`'s migrate() (what `db:migrate` actually runs)
-- only reads the journal + these SQL files, not the snapshot chain, so
-- this doesn't affect correctness — it's a pre-existing tooling gap,
-- not something this migration introduces.
ALTER TABLE "inquiries" ADD COLUMN "recipient_name" text;
ALTER TABLE "inquiries" ADD COLUMN "recipient_phone" text;
ALTER TABLE "inquiries" ADD COLUMN "delivery_landmark" text;
ALTER TABLE "inquiries" ADD COLUMN "occasion" text;
