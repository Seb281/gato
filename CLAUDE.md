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
pnpm dev              # Start all apps
pnpm dev:api          # API only
pnpm dev:extension    # Extension only
pnpm build            # Build all apps
```

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
