-- Delivery Capability Engine, part 2: persist the authoritative delivery
-- result on the inquiry that used it. Purely additive (one new enum type,
-- three new nullable columns) — existing rows get NULL for all three,
-- same backward-compatibility posture as 0007_inquiry_recipient_details.sql.
CREATE TYPE "public"."delivery_method" AS ENUM('MORNING', 'AFTERNOON', 'EVENING', 'EXPRESS');--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "delivery_method" "delivery_method";--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "delivery_promise" text;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "delivery_fee" integer;
