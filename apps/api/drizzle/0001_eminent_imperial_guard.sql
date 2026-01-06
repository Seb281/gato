ALTER TABLE "users" ADD COLUMN "custom_api_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_provider" text DEFAULT 'google';