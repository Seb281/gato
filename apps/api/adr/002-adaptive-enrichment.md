# ADR-002: Adaptive Enrichment by Selection Length

**Date:** 2026-04-14
**Status:** Accepted

## Context

When a user selects text for translation, the selection can range from a single word to a full paragraph. Enrichment data — pronunciation, grammar rules, related words, commonness, fixed expressions — is valuable for individual words and short phrases, but irrelevant for longer text. Asking an LLM to find "related words" for a 20-word sentence wastes tokens, adds latency, and returns noise.

The enrichment prompt needs to adapt to what the user selected.

## Decision

Enrichment fields scale by word count, with a secondary axis for whether surrounding context was captured:

**Single word (1 token):**
- With context: phonetics, fixed expression detection, common usage, grammar, commonness, related words. The surrounding sentence is injected so the LLM can disambiguate meaning.
- Without context: phonetics, commonness, related words. No usage or grammar — without context, these would be generic.

**Short phrase (2-5 words):**
- With context: same fields as single word, but prompt frames the selection as a "phrase" or "snippet."
- Without context: phonetics, grammar, commonness, related words.

**Sentence or longer (6+ words):**
- Translation only. No enrichment fields requested.

This logic lives in `promptBuilder()` in `controllers/helpers.ts`, which builds the LLM prompt string with conditional field blocks. The parallel `enrichmentPromptBuilder()` follows the same word-count thresholds for the post-DeepL enrichment path.

## Consequences

**Benefits:**
- Shorter prompts for longer selections = faster responses and lower token cost.
- Users see only relevant enrichment — no confusing "commonness" rating on a full sentence.
- The two-axis design (length x context) means a word looked up in isolation gets useful but limited data, while the same word selected from a webpage gets richer, context-aware enrichment.

**Trade-offs:**
- All enrichment fields must be nullable across the full stack: API response types, shared package types (`@gato/shared`), and frontend consumers (extension + web). Every component rendering enrichment data must handle missing fields.
- The prompt builder has branching logic with multiple code paths (6 combinations of length x context). Changes to enrichment fields require updating multiple branches.
- The word-count thresholds (1, 2-5, 6+) are heuristics. A 5-word idiomatic expression arguably deserves full enrichment, while a 3-word sentence fragment might not. The thresholds work in practice but aren't linguistically precise.
