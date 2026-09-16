ALTER TABLE "businesses" ADD COLUMN "keycloak_provisioned_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "keycloak_user_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_keycloak_user_id_unique" UNIQUE("keycloak_user_id");