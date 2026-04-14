# ADR-003: SM-2 Algorithm with State Machine Transitions

**Date:** 2026-04-14
**Status:** Accepted

## Context

Gato saves translated vocabulary as "concepts" that users review over time. Effective vocabulary retention requires spaced repetition — surfacing items at increasing intervals based on recall success.

The main algorithm options considered:

- **Leitner boxes:** Simple (5 fixed boxes), but rigid intervals with no adaptation to individual item difficulty.
- **SM-2:** The algorithm behind Anki. Well-understood, battle-tested across millions of users, with clear mathematical properties. Uses an ease factor that adapts per item.
- **FSRS (Free Spaced Repetition Scheduler):** Newer, statistically optimized for long-term retention. More parameters, more complex, and requires training data to reach its potential — data a new app doesn't have.

## Decision

Use SM-2 with three user-facing states derived from the algorithm's repetition count:

| Repetitions | State      |
|-------------|------------|
| 0-2         | Learning   |
| 3-5         | Familiar   |
| 6+          | Mastered   |

The SM-2 parameters — `easeFactor`, `interval`, and `repetitions` — are stored on each concept and are the source of truth. The `conceptState` label is derived from `repetitions` at computation time, not stored independently.

Key implementation details:
- **Failed items** (quality < 3) reset `repetitions` to 0 and schedule re-review in 10 minutes, not days. This matches the language learning pattern where a forgotten word should be retried immediately.
- **Ease factor** adapts per item (minimum 1.3) — difficult words get shorter intervals even as the user progresses.
- **Quality ratings** map from user-friendly labels: again (1), hard (3), good (4), easy (5).

The implementation is a pure function in `utils/sm2.ts` with no dependencies.

## Consequences

**Benefits:**
- Pure function = highly testable. The algorithm has 40+ unit tests covering grade boundaries, ease factor clamping, interval progression, reset behavior, and state transitions.
- State labels are a UX layer, not a data concern. Changing the thresholds (e.g., making "mastered" require 8+ reps) requires no migration — just update the derivation logic.
- SM-2 is simple enough to explain in a code review or interview. The math fits in one screenful.

**Trade-offs:**
- SM-2 is less optimal than FSRS for long-term retention curves. FSRS adjusts based on forgetting probability; SM-2 uses a simpler geometric progression. For a language learning tool (vs. medical board exam prep), the difference is negligible in practice.
- The quality-to-label mapping (again/hard/good/easy → 1/3/4/5) skips quality scores 0 and 2. This is intentional — four buttons is the sweet spot for mobile UX, and scores 0 and 2 are rarely distinguishable in practice.
- State thresholds based on repetition count (not interval length) mean a user who reviews daily could hit "mastered" faster than one who reviews weekly, even though the weekly reviewer might have stronger retention. Repetition count is a reasonable proxy but not a perfect measure of knowledge.
