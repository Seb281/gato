CREATE TABLE "ui_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"language" text NOT NULL,
	"version" text NOT NULL,
	"translations" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ui_translations_language_version_unique" UNIQUE("language","version")
);
