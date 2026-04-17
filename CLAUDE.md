# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

Turborepo monorepo with three apps and one shared package:

| Package       | Path               | Stack                                                                                      | Dev command                    |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------ | ------------------------------ |
| **API**       | `apps/api/`        | Fastify, Drizzle ORM, Supabase (Postgres), DeepL, AI SDK (Gemini/OpenAI/Anthropic/Mistral) | `pnpm dev:api`                 |
| **Extension** | `apps/extension/`  | WXT, Chrome MV3, React, TypeScript, Tailwind v4                                            | `pnpm dev:extension`           |
| **Web**       | `apps/web/`        | Next.js (App Router), React, Supabase Auth, shadcn/ui, Tailwind, Sonner toasts             | `pnpm dev:web`                 |
| **Shared**    | `packages/shared/` | TypeScript (no build step — raw TS consumed by all apps)                                   | —                              |

```bash
pnpm dev              # Start all apps via turbo
pnpm dev:api          # API only
pnpm dev:extension    # Extension only
pnpm dev:web          # Web dashboard only
pnpm build            # Build all apps
pnpm build:api        # API only
pnpm build:extension  # Extension only
pnpm build:web        # Web dashboard only

# DB (run from apps/api or with --filter api)
pnpm --filter api db:generate   # Drizzle migration from schema diff
pnpm --filter api db:migrate    # Apply migrations
pnpm --filter api db:studio     # Open Drizzle Studio
pnpm --filter api db:seed       # Seed DB

# Type-check / lint
pnpm --filter ./apps/extension compile   # tsc --noEmit (extension)
pnpm --filter web compile                                  # tsc --noEmit (web)
pnpm --filter web lint                                     # eslint (web)

# Tests
pnpm --filter api test                                     # Vitest (API unit tests)
pnpm --filter ./apps/extension test      # Vitest (extension tests)
pnpm --filter web test                                     # Vitest (web unit tests — pure utils)
pnpm --filter web test:e2e                                 # Playwright (web E2E)
```

Package manager is **pnpm** — never `npm` or `yarn`. The extension loads from `apps/extension/.output/chrome-mv3` as an unpacked extension after `pnpm build:extension`.

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs on push to `main` and on PRs. Steps: type-check all three apps → lint all three apps → unit tests (API + extension + web) → build extension → verify OpenAPI spec is up to date → run web E2E (Playwright). Mirrors quality gate commands below.

For extension internals (entry points, content script lifecycle, translation flows, storage keys, background message handler rules), see `apps/extension/CLAUDE.md` — treat it as authoritative for anything under `apps/extension/`.

## API Architecture (`apps/api/`)

The API is a layered Fastify app. Each layer has one job; dependencies flow inward only.

```
routes/        HTTP layer — Fastify route registration, request/reply, validation, auth gate
  ↓
controllers/   Orchestration — resolves models, composes services, shapes responses
  ↓
services/      External integrations (DeepL, translation orchestrator)
  ↓
data/          Domain queries (concepts, tags, review, users, stats) — the only place that touches `db`
  ↓
db/            Drizzle schema + client (`db/schema.ts`, `db/index.ts`)
```

**Adding a new endpoint:** register in `routes/`, delegate to a controller or a `data/*.ts` helper. Do not call Drizzle directly from a route handler — go through `data/`.

**Auth:** `middleware/supabaseAuth.ts` exposes `requireAuth`, `getAuthenticatedUserEmail`, `getAuthenticatedUserId`. Protected routes call `requireAuth` first; handlers then read the user via the helpers. Supabase validates the bearer token; the local `usersTable` row is looked up by `supabaseId`.

**Rate limiting:** `app.ts` registers `@fastify/rate-limit` — 100 requests per minute per IP. Applied globally to all routes.

**CORS:** `app.ts` allows any `chrome-extension://` origin plus the comma-separated `ALLOWED_ORIGINS` env var (dashboard URLs). When adding a new frontend, add its origin to `ALLOWED_ORIGINS`.

## Architecture Decision Records

ADRs live in `apps/api/adr/`. Read before proposing changes to these areas:

- `001-deepl-first-llm-fallback.md` — why DeepL translates and LLMs enrich
- `002-adaptive-enrichment.md` — why enrichment fields vary by selection length
- `003-sm2-state-machine.md` — why SM-2 and how states map to repetition counts

## Translation Pipeline

Translation is **DeepL-first, LLM-fallback**, implemented in `services/translationOrchestrator.ts`:

1. If DeepL is configured AND the target language resolves to a DeepL code, call DeepL. Return `{ provider: 'deepl' }` — enrichment is fetched separately via the `enrich` action.
2. Otherwise (or on DeepL failure), fall back to an LLM call that returns translation **and** all enrichment fields in one shot. Return `{ provider: 'llm' }`.

The LLM model is resolved per-request by `resolveModel` in `controllers/translationController.ts`. It supports **BYOK**: if the user has `customApiKey` + `preferredProvider` set (`google` / `openai` / `anthropic` / `mistral`), that provider is used; otherwise the app-level default (Gemini) is used. The default model IDs live in `config/models.ts` — update that file, not individual call sites, when changing defaults.

## Database Schema

Drizzle schema is the source of truth at `apps/api/src/db/schema.ts`. Key tables:

- `usersTable` — user accounts (linked to Supabase auth via `supabaseId`)
- `conceptsTable` — saved vocabulary with SM-2 spaced-repetition state
- `tagsTable`, `conceptTagsTable` — user-defined tags and join table
- `reviewScheduleTable`, `reviewSessionsTable`, `reviewEventsTable` — spaced-repetition scheduling and session tracking
- `dailyActivityTable` — per-day usage stats
- `dailySuggestionsTable` — word-of-the-day suggestions
- `uiTranslationsTable` — cached UI string translations
- `feedbackTable` — user feedback submissions

Workflow: edit `schema.ts` → `pnpm --filter api db:generate` → review SQL in `drizzle/` → `db:migrate`. Production uses **Supabase Postgres**, not Neon.

## Web App (`apps/web/`)

Next.js App Router. Dashboard is grouped under `src/app/dashboard/` with nested routes (`translate`, `vocabulary`, `review`, `progress`, `tags`, `settings`, `import-export`, `feedback`). Auth is Supabase via `@supabase/ssr`. Top-level `proxy.ts` forwards API calls so the browser talks to the Next.js origin (avoids third-party cookie issues with the extension auth bridge).

## Deployment

Production environments (live):

- **Web dashboard:** Vercel — <https://gato.giupana.com>
- **API:** Railway
- **DB + Auth:** Supabase (Postgres)
- **Error tracking:** Sentry (extension)
- **Extension:** Chrome Web Store — <https://chromewebstore.google.com/detail/gato-%E2%80%94-translate-learn-in/nbljhkoabjlchochcncpnjjbpfakdndd>

Deployment configs are managed in the respective platform dashboards (no `vercel.json` / `railway.toml` checked in). When adding a new origin, remember to update `ALLOWED_ORIGINS` on Railway so CORS lets it through.

## Error Handling Patterns

Each app follows a consistent error handling strategy. When adding new routes, handlers, or components, follow these patterns.

### API (`apps/api/`)

**Global handler:** Fastify's `setErrorHandler` in `app.ts` catches unhandled throws and returns a structured `{ error: "..." }` response. This is the safety net, not the primary strategy.

**Route handlers:** Every route handler must wrap its body in `try/catch`:

- Log with `request.log.error(error, 'Description')` (pino structured logging, NOT `console.error`)
- Return a descriptive 500: `reply.status(500).send({ error: 'Failed to <action>' })`
- Keep input validation (`400` responses) OUTSIDE the try/catch so validation errors aren't swallowed

```typescript
// Good
async function handler(
  request: FastifyRequest<{ Body: T }>,
  reply: FastifyReply,
) {
  const { field } = request.body
  if (!field) return reply.status(400).send({ error: 'Missing field' })

  try {
    const result = await doWork(field)
    return reply.status(200).send(result)
  } catch (error) {
    request.log.error(error, 'Failed to do work')
    return reply.status(500).send({ error: 'Failed to do work' })
  }
}
```

### Extension (`apps/extension/`)

See `apps/extension/CLAUDE.md` for the background message handler pattern (`.catch()` + `sendResponse`).

### Web (`apps/web/`)

**Error boundary:** `apps/web/src/app/dashboard/error.tsx` catches unhandled React errors in the dashboard. If adding new top-level route groups, add an `error.tsx` there too.

**Component-level errors:** Use `toast.error("User-facing message")` from Sonner (already mounted in `layout.tsx` as `<Toaster richColors closeButton />`). Every `catch` block in a component that makes an API call should show a toast:

```typescript
try {
  const res = await fetch(...)
  if (!res.ok) throw new Error()
  // handle success
} catch (error) {
  console.error("Failed to do thing:", error)
  toast.error("Failed to do thing.")
}
```

**Deduplication:** For auto-save or debounced operations, pass `{ id: "unique-id" }` to `toast.error()` to prevent duplicate toasts stacking up.

## i18n Strings

UI strings live in a single source of truth: `packages/shared/src/i18n/strings.ts` (exported from `@gato/shared`). All three apps import from there — no mirrored files.

When adding/removing/renaming i18n keys: edit the shared file. Bump `STRINGS_VERSION` to invalidate cached translations in the extension and web app.

## PBR Checklist

### Verification

- **Quality gate:** `pnpm --filter api build && pnpm --filter ./apps/extension compile && pnpm --filter web compile && pnpm --filter api lint && pnpm --filter ./apps/extension lint && pnpm --filter web lint && pnpm --filter api test && pnpm --filter ./apps/extension test && pnpm --filter web test`
- **Build:** `pnpm build`
- **Extension zip:** `pnpm --filter ./apps/extension zip` — verify output is self-contained (no external workspace refs in manifest or bundle)

### Pre-Review Items

- Imports follow module/package boundaries (shared → app, never app → app)
- Error paths handled (no silent failures)
- Types match across layers (API response ↔ shared types ↔ FE consumers)
- No hardcoded user-facing strings (use i18n keys)
- Translation types match across layers (API response ↔ `@gato/shared` types ↔ FE consumers)

### Cross-Phase Integration

- Schema changes → `pnpm --filter api db:generate` → review SQL → `db:migrate`
- New API endpoints → update CORS if new origin needed
- i18n key changes → edit `packages/shared/src/i18n/strings.ts`, bump `STRINGS_VERSION`

### Commit Conventions

- Short subject line, imperative mood
