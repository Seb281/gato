# Gato

[![CI](https://github.com/Seb281/gato/actions/workflows/ci.yml/badge.svg)](https://github.com/Seb281/gato/actions/workflows/ci.yml)

A Chrome extension for learning languages in context. Translate text on any webpage with LLM-powered, context-aware translations — then build lasting vocabulary through enrichment data, saved concepts, and spaced repetition review.

## Why

Built while improving my Spanish. I wanted to read El País and other target-language content without breaking flow for a dictionary lookup — and get explanations (grammar, related words, context-aware meaning) that a plain translator can't offer but LLMs are genuinely good at.

## Try It

- **Chrome Web Store** — install the live extension: <https://chromewebstore.google.com/detail/gato-%E2%80%94-translate-learn-in/nbljhkoabjlchochcncpnjjbpfakdndd>
- **Web dashboard** — review vocabulary, track progress, manage settings: <https://gato.giupana.com>

## Architecture

```mermaid
graph LR
    EXT[Chrome Extension] <-->|translate / enrich / sync| API[API — Fastify]
    WEB[Web Dashboard] -->|proxy| NJP[Next.js Server]
    NJP -->|forward| API
    API <-->|translate| DEEPL[DeepL]
    API <-->|enrich / fallback translate| LLM[LLM Providers<br>Gemini · OpenAI · Anthropic · Mistral]
    API <-->|auth + data| SUPA[Supabase<br>Auth · Postgres]
```

## How It Works

**DeepL for translation, LLMs for enrichment.** Translations go through DeepL for speed and accuracy, with LLMs as a fallback for unsupported languages. Enrichment data (pronunciation, grammar, related words, usage examples) is always LLM-generated — it's what LLMs are genuinely good at.

**Context changes meaning.** When you select text, the extension captures the surrounding sentences and passes them to the translation and enrichment pipeline. "Bank" in a finance article translates differently than "bank" near a river — context disambiguation happens automatically.

**Adaptive enrichment.** A single word gets full enrichment (phonetic, grammar, related words). A short phrase gets grammar and related words. A full sentence just gets translated — no unnecessary overhead.

**Personal context shapes results.** Users can set context like "I'm a medical student learning Portuguese." This is injected into enrichment prompts, so explanations and examples become relevant to the user's domain.

**Available in any language.** The entire UI is translatable into 30+ languages. Strings are translated via DeepL (with LLM fallback), cached in the database, and versioned — so updates propagate without redeploying the extension.

**Spaced repetition built in.** Saved concepts are reviewed using the SM-2 algorithm with automatic state transitions (learning → familiar → mastered). Failed items resurface in minutes, not days.

**Bring your own API key.** Ships with a free default (Gemini), but users can plug in their own OpenAI, Anthropic, Mistral, or Google key for a preferred provider.

## Features

- Multiple translation flows: in-page popup, context menu, sidepanel
- Per-site activation — enable on specific sites, works instantly without refresh
- Source language auto-detection
- Theme support (light/dark/system)
- Auth sync between extension and web dashboard

## Tech Stack

| App | Stack |
|-----|-------|
| `apps/extension` | React, TypeScript, WXT, Tailwind CSS, Radix UI |
| `apps/api` | Fastify, Drizzle ORM, PostgreSQL, Vercel AI SDK |
| `apps/web` | Next.js, Tailwind CSS, Radix UI |

**Infrastructure:** Supabase (auth + DB), Railway (API), Vercel (dashboard), Sentry (error tracking)

**LLM providers:** Google Gemini (default), OpenAI, Anthropic, Mistral — bring your own API key.

## Architecture Decisions

Design rationale is documented in [`apps/api/adr/`](apps/api/adr/).

## Engineering Practices

- **Layered API** — routes → controllers → services → data → db. Dependencies flow inward; Drizzle only touched in `data/`.
- **Typed API contract** — OpenAPI spec generated from Zod schemas, checked into the repo, CI verifies it stays in sync.
- **CI gates every PR** — type-check, lint, unit tests (API + extension + web), Playwright E2E (web), extension build, OpenAPI drift check.
- **ADRs** — decisions with real tradeoffs (DeepL-first vs LLM-first, adaptive enrichment, SM-2 state machine) are written down, not just committed.
- **i18n with versioned cache** — UI strings live in `packages/shared`, translated via DeepL, cached in Postgres, versioned so updates propagate without redeploys.
- **Spaced repetition as a state machine** — SM-2 with explicit `learning → familiar → mastered` transitions, tracked per-concept with review events.
- **Automated dep updates** — Dependabot grouped minor/patch PRs, CI green-or-no-merge.

## Development

```bash
pnpm install
pnpm dev          # Start all apps
```

### Extension

```bash
pnpm dev:extension
pnpm build:extension
```

Load `.output/chrome-mv3` as an unpacked extension in `chrome://extensions`.

### API

```bash
pnpm dev:api
```

Requires environment variables — see `apps/api/.env.default`.
