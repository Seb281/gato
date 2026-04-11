# Feature Implementation Guide

General conventions for any multi-stage feature work in this repo. Specific feature plans live in `docs/plans/<feature>.md` (local scratch, gitignored — one plan per feature).

---

## Non-Negotiable Constraints

These apply to **every** feature implementation. Violating them breaks the production extension or the published dashboard.

1. **API response shapes are append-only.** Existing routes used by the extension must never remove, rename, or narrow the type of a field. Add new routes or add new optional fields; extensions read only what they know.
2. **Extension-consumed routes** (treat as contracts): `POST /translate`, `POST /enrich`, `POST /saved-concepts`, `PATCH /saved-concepts/:id`, `DELETE /saved-concepts/:id`, `GET /saved-concepts`, `GET /review/due`, `GET /stats`, `GET /i18n/strings`. Check `apps/extension/src/entrypoints/background/` before modifying any of these.
3. **i18n keys are append-only.** Add new keys to all three files (`apps/api/src/routes/i18n-strings.ts`, `apps/extension/src/lib/i18n/strings.ts`, `apps/web/src/lib/i18n/strings.ts`). Never rename or remove existing keys. Bump `STRINGS_VERSION` in the extension file **only** if an extension-visible string changed; web-only key additions do not require a version bump.
4. **`conceptsTable` and other extension-used tables are append-only.** New columns are fine (nullable with default, or notNull with a safe default). Renaming, dropping, or type-narrowing is forbidden.
5. **Drizzle migrations must be reversible and non-destructive.** Each DB change is generated via `pnpm --filter api db:generate`, reviewed as SQL, applied to a branch DB (not prod), and noted with a rollback approach in the commit message.
6. **`pnpm build` must stay green across all three apps** at every commit on a feature branch, including the extension. The extension builds against API types — breaking the API type surface breaks the extension even if you never touched extension code.
7. **No commits on `main` for implementation work.** Feature work happens on a branch, usually in a worktree under `.worktrees/<branch-name>/`.

## Verification Commands

Run these at the end of every task, before the spec/code-quality review loop:

```bash
# Type-check / build all apps (must stay green)
pnpm build

# Targeted builds
pnpm --filter api build                                 # tsc
pnpm --filter web lint
pnpm --filter web build
pnpm --filter context-aware-translator-extension build  # extension must still build
pnpm --filter context-aware-translator-extension compile

# DB (after schema.ts edits)
pnpm --filter api db:generate                           # generate migration
pnpm --filter api db:migrate                            # apply to local/branch DB
pnpm --filter api db:studio                             # inspect DB

# Dev servers (manual smoke test)
pnpm dev:api
pnpm dev:web
pnpm dev:extension
```

**Package manager is always `pnpm`.** Never `npm` or `yarn`.

## Before Planning Any Feature

1. **Audit what already exists.** This codebase is more built-out than it looks. Verify before assuming something is missing:
   - Read the relevant `apps/api/src/data/*.ts` files directly
   - Read the relevant `apps/api/src/routes/*.ts` files directly
   - Read the relevant `apps/web/src/components/dashboard/*.tsx` files directly
   - Don't rely only on narrow grep patterns — a single wrong glob can hide a fully-implemented feature
2. **Check `apps/extension/CLAUDE.md`.** It's authoritative for extension architecture and message handling.
3. **Check `CLAUDE.md`** at repo root for error handling patterns and i18n sync rules.

## Planning a Feature

1. Write the specific plan to `docs/plans/<feature-name>.md`. It is gitignored — treat it as local scratch, not a deliverable.
2. Structure the plan in **stages** (usually 3–5). Each stage must be:
   - Independently shippable (you can merge to `main` after this stage without waiting for later ones)
   - Testable on its own (verification commands + manual smoke test)
   - Scoped to ~1 day of focused work
3. Each stage contains **tasks**. Each task is one logical change:
   - Exact file paths to create or modify
   - Concrete subtasks as checkboxes
   - Commit message template
4. Stage ordering: low risk → high risk, quick wins first, schema changes before the code that depends on them.
5. Each stage declares **exit criteria**: what "done" means before moving to the next stage.

### Minimal plan template

````markdown
# <Feature Name> Plan

> Executed via subagent-driven-development. See `feature-implementation.md` for general constraints.

**Goal:** <one sentence>

**Scope fence:** <which apps, what's explicitly out-of-scope>

## Stage N — <Theme>

**Goal:** <stage-level outcome>

**Subagent brief:** "Implement Stage N of `docs/plans/<feature>.md`. <scope reminders>. Run `pnpm build` at the end."

### N.A — <Task name>

**Files:**
- Create: `exact/path.ts`
- Modify: `exact/other/path.ts`

**Tasks:**
- [ ] Concrete subtask with enough detail to execute
- [ ] Next concrete subtask
- [ ] `pnpm build` green
- [ ] Manual test of <specific flow>

**Commit:** `feat(scope): short message`

**Stage N exit criteria:**
- `pnpm build` green across all three apps
- Extension still functional end-to-end
- <feature-specific checks>
````

## Branching & Worktrees

- One feature branch = one worktree at `.worktrees/<branch-name>/`
- Create with `git worktree add .worktrees/<name> -b <branch> main` (always base on `main`)
- Run all implementation commands inside the worktree
- Remove when merged: `git worktree remove .worktrees/<name>`

## Subagent Dispatch Protocol

Use `superpowers:subagent-driven-development` — one implementer per task, followed by two-stage review (spec compliance, then code quality).

Each implementer brief must include:

1. **Working directory**: absolute path to the worktree
2. **Scope fence**: which apps they may touch, which they may not
3. **Full task text**: copy the task section verbatim from the specific plan — do not make the subagent read the plan file
4. **Codebase context**: key files, existing patterns, the shape of data they'll be extending
5. **Non-negotiables**: the relevant subset of constraints from this file
6. **Verification commands**: what "done" looks like
7. **Commit protocol**: message format + that they commit on completion

After the implementer returns:
- Dispatch spec compliance reviewer first
- Only if spec-compliant, dispatch code quality reviewer
- If either finds issues, the implementer fixes and the reviewer re-reviews
- Mark the task complete in the session task list only when both are ✅

## Commit Message Conventions

Match the existing style in `git log`:

- `feat(scope): short imperative summary`
- `fix(scope): short imperative summary`
- `chore(scope): short imperative summary`
- `docs(scope): short imperative summary`

Scopes in use: `api`, `web`, `extension`, `tutor`, `i18n`, `vocab`, `review`, `progress`. Add new scopes sparingly.

Body is optional but include one short paragraph when the "why" isn't obvious from the subject. Always end with:

```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## When a Stage Lands

1. Verify `pnpm build` green
2. Smoke test the relevant flow in the browser / loaded extension
3. Merge the branch into `main` (or open a PR if that's the workflow for this feature)
4. Update the specific plan file's status section
5. Begin the next stage (new worktree, or continue on the same branch)

## Out-of-Scope Rules

Some items are globally out of scope for the current phase of the project unless explicitly re-opened:

- Tutor feature work — parked on `feat/tutor-stage1`
- Extension UI changes — the extension runtime is frozen for UX remediation work; only API-compatible changes allowed
- DB provider migration — staying on Supabase Postgres

Check this list at the start of any new plan.
