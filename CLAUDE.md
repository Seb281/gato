# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

Turborepo monorepo with three apps:

| App | Path | Stack | Dev command |
|---|---|---|---|
| **API** | `apps/api/` | Fastify, Drizzle ORM, Supabase (Postgres), DeepL, AI SDK (Gemini/OpenAI/Anthropic/Mistral) | `pnpm dev:api` |
| **Extension** | `apps/extension/` | WXT, Chrome MV3, React, TypeScript, Tailwind v4 | `pnpm dev:extension` |
| **Web** | `apps/web/` | Next.js (App Router), React, Supabase Auth, shadcn/ui, Tailwind, Sonner toasts | `pnpm dev:web` (not yet wired) |

```bash
pnpm dev              # Start all apps via turbo
pnpm dev:api          # API only
pnpm dev:extension    # Extension only
pnpm build            # Build all apps

# DB (run from apps/api or with --filter api)
pnpm --filter api db:generate   # Drizzle migration from schema diff
pnpm --filter api db:migrate    # Apply migrations
pnpm --filter api db:studio     # Open Drizzle Studio
pnpm --filter api db:seed       # Seed DB

# Type-check / lint
pnpm --filter context-aware-translator-extension compile   # tsc --noEmit (extension)
pnpm --filter web lint                                     # eslint (web)
```

Package manager is **pnpm** — never `npm` or `yarn`. The extension loads from `apps/extension/.output/chrome-mv3` as an unpacked extension after `pnpm build:extension`.

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

**CORS:** `app.ts` allows any `chrome-extension://` origin plus the comma-separated `ALLOWED_ORIGINS` env var (dashboard URLs). When adding a new frontend, add its origin to `ALLOWED_ORIGINS`.

## Translation Pipeline

Translation is **DeepL-first, LLM-fallback**, implemented in `services/translationOrchestrator.ts`:

1. If DeepL is configured AND the target language resolves to a DeepL code, call DeepL. Return `{ provider: 'deepl' }` — enrichment is fetched separately via the `enrich` action.
2. Otherwise (or on DeepL failure), fall back to an LLM call that returns translation **and** all enrichment fields in one shot. Return `{ provider: 'llm' }`.

The LLM model is resolved per-request by `resolveModel` in `controllers/translationController.ts`. It supports **BYOK**: if the user has `customApiKey` + `preferredProvider` set (`google` / `openai` / `anthropic` / `mistral`), that provider is used; otherwise the app-level default (Gemini) is used. The default model IDs live in `config/models.ts` — update that file, not individual call sites, when changing defaults.

## Database Schema

Drizzle schema is the source of truth at `apps/api/src/db/schema.ts`. Key tables: `usersTable`, `conceptsTable` (saved vocab with SM-2 state), `tagsTable`, plus review/stats/feedback tables. Workflow: edit `schema.ts` → `pnpm --filter api db:generate` → review SQL in `drizzle/` → `db:migrate`. Production uses **Supabase Postgres**, not Neon.

## Web App (`apps/web/`)

Next.js App Router. Dashboard is grouped under `src/app/dashboard/` with nested routes (`translate`, `vocabulary`, `review`, `progress`, `tags`, `settings`, `import-export`, `feedback`). Auth is Supabase via `@supabase/ssr`. Top-level `proxy.ts` forwards API calls so the browser talks to the Next.js origin (avoids third-party cookie issues with the extension auth bridge).

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
async function handler(request: FastifyRequest<{ Body: T }>, reply: FastifyReply) {
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

## i18n String Sync

UI strings are defined in three places that must stay in sync:

1. `apps/api/src/routes/i18n-strings.ts` — source of truth for translatable keys
2. `apps/extension/src/lib/i18n/strings.ts` — extension's English defaults + `STRINGS_VERSION`
3. `apps/web/src/lib/i18n/strings.ts` — web app's English defaults

When adding/removing/renaming i18n keys: update all three files. Bump `STRINGS_VERSION` in the extension strings file to invalidate cached translations.
