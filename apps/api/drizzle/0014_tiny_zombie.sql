CREATE TABLE "daily_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"word" text NOT NULL,
	"translation" text NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"rationale" text,
	"example_sentence" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_suggestions_user_id_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "daily_suggestions" ADD CONSTRAINT "daily_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;