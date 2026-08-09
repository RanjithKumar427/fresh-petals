CREATE TYPE "public"."inquiry_status" AS ENUM('new', 'contacted', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"products" text NOT NULL,
	"delivery_date" text,
	"status" "inquiry_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_inquiries_status" ON "inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inquiries_created_at" ON "inquiries" USING btree ("created_at");
