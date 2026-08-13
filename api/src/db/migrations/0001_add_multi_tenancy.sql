CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Seed a fixed-id default business so V1's single-tenant data has somewhere to belong.
-- DEFAULT_BUSINESS_ID in .env mirrors this id — see src/middleware/tenant.ts. Existing
-- rows in every business-owned table are backfilled onto it below before business_id
-- is made NOT NULL.
INSERT INTO "businesses" ("id", "name") VALUES ('00000000-0000-0000-0000-000000000001', 'Acme Carpentry');
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "business_id" uuid;
--> statement-breakpoint
UPDATE "clients" SET "business_id" = '00000000-0000-0000-0000-000000000001' WHERE "business_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "business_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "business_id" uuid;
--> statement-breakpoint
UPDATE "projects" SET "business_id" = '00000000-0000-0000-0000-000000000001' WHERE "business_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "business_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "business_id" uuid;
--> statement-breakpoint
UPDATE "bids" SET "business_id" = '00000000-0000-0000-0000-000000000001' WHERE "business_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "bids" ALTER COLUMN "business_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "subcontractors" ADD COLUMN "business_id" uuid;
--> statement-breakpoint
UPDATE "subcontractors" SET "business_id" = '00000000-0000-0000-0000-000000000001' WHERE "business_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "subcontractors" ALTER COLUMN "business_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "subcontractors" ADD CONSTRAINT "subcontractors_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "business_id" uuid;
--> statement-breakpoint
UPDATE "attachments" SET "business_id" = '00000000-0000-0000-0000-000000000001' WHERE "business_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "business_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;