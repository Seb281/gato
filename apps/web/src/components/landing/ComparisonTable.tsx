/**
 * Static marketing comparison table.
 *
 * A feature-by-feature contrast between Gato and the
 * tools it tends to get measured against: Google Translate (in-browser
 * translation), Anki (offline SRS), and Duolingo (gamified course).
 *
 * Intentionally a dumb component — zero props, zero data fetching. Rows
 * live in a local constant so copy tweaks are a one-file edit and the
 * row order is grouped by "translate → save → review → measure" which
 * mirrors the learner journey the landing page tells elsewhere.
 */

import { Check, X } from "lucide-react";

type Support = "yes" | "no" | "partial";

type Row = {
  feature: string;
  description: string;
  us: Support;
  googleTranslate: Support;
  anki: Support;
  duolingo: Support;
};

const ROWS: Row[] = [
  {
    feature: "In-page translation",
    description:
      "Select text on any webpage and get an instant translation.",
    us: "yes",
    googleTranslate: "yes",
    anki: "no",
    duolingo: "no",
  },
  {
    feature: "Context-aware AI",
    description:
      "Uses the surrounding paragraph and your profile to disambiguate.",
    us: "yes",
    googleTranslate: "no",
    anki: "no",
    duolingo: "no",
  },
  {
    feature: "One-click save to vocabulary",
    description: "Turn any translation into a reviewable flashcard.",
    us: "yes",
    googleTranslate: "no",
    anki: "partial",
    duolingo: "no",
  },
  {
    feature: "Spaced repetition (SM-2)",
    description:
      "Scientifically-backed review intervals that adapt to your recall.",
    us: "yes",
    googleTranslate: "no",
    anki: "yes",
    duolingo: "partial",
  },
  {
    feature: "Multiple quiz modes",
    description:
      "Flashcards, multiple choice, typing, contextual recall, sentence builder.",
    us: "yes",
    googleTranslate: "no",
    anki: "partial",
    duolingo: "yes",
  },
  {
    feature: "Your own content",
    description:
      "Build your vocabulary from real articles and conversations, not a fixed course.",
    us: "yes",
    googleTranslate: "no",
    anki: "yes",
    duolingo: "no",
  },
  {
    feature: "Bring your own LLM key",
    description:
      "Plug in Google, OpenAI, Anthropic, or Mistral. No lock-in.",
    us: "yes",
    googleTranslate: "no",
    anki: "no",
    duolingo: "no",
  },
  {
    feature: "Progress analytics",
    description:
      "Activity heatmaps, streaks, accuracy trends, mastery by state.",
    us: "yes",
    googleTranslate: "no",
    anki: "partial",
    duolingo: "yes",
  },
];

function Cell({ support }: { support: Support }) {
  if (support === "yes") {
    return (
      <div className="flex justify-center">
        <Check className="size-5 text-emerald-500" aria-label="Yes" />
      </div>
    );
  }
  if (support === "no") {
    return (
      <div className="flex justify-center">
        <X className="size-5 text-muted-foreground/50" aria-label="No" />
      </div>
    );
  }
  return (
    <div className="flex justify-center text-xs text-muted-foreground">
      Partial
    </div>
  );
}

export default function ComparisonTable() {
  return (
    <section className="py-20 md:py-24">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl">
            How Gato compares
          </h2>
          <p className="text-base text-stone-500 dark:text-stone-400 mt-3 max-w-lg mx-auto leading-relaxed">
            The in-page convenience of a translator with the long-term memory
            of a spaced-repetition app.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-4 font-semibold w-[38%]">
                  Feature
                </th>
                <th className="p-4 font-semibold text-center text-primary">
                  Gato
                </th>
                <th className="p-4 font-semibold text-center text-muted-foreground">
                  Google Translate
                </th>
                <th className="p-4 font-semibold text-center text-muted-foreground">
                  Anki
                </th>
                <th className="p-4 font-semibold text-center text-muted-foreground">
                  Duolingo
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  className={i % 2 === 0 ? "bg-background" : "bg-muted/10"}
                >
                  <td className="p-4 align-top">
                    <div className="font-medium">{row.feature}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {row.description}
                    </div>
                  </td>
                  <td className="p-4 align-middle">
                    <Cell support={row.us} />
                  </td>
                  <td className="p-4 align-middle">
                    <Cell support={row.googleTranslate} />
                  </td>
                  <td className="p-4 align-middle">
                    <Cell support={row.anki} />
                  </td>
                  <td className="p-4 align-middle">
                    <Cell support={row.duolingo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
