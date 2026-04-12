import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ComparisonTable from "@/components/landing/ComparisonTable";

const STEPS = [
  {
    number: 1,
    title: "Select & Translate",
    description:
      "Highlight any word or phrase on a webpage. Get a context-aware translation instantly.",
  },
  {
    number: 2,
    title: "Save & Organize",
    description:
      "Save translations to your vocabulary. Tag and organize words by topic.",
  },
  {
    number: 3,
    title: "Review & Master",
    description:
      "Spaced repetition adapts to your pace. Flashcards, quizzes, and typing exercises.",
  },
];

const FEATURES = [
  {
    emoji: "🧠",
    title: "Context-Aware AI",
    description:
      "Translations that understand the surrounding text and your personal learning context.",
  },
  {
    emoji: "⏱",
    title: "Spaced Repetition",
    description:
      "SM-2 algorithm schedules reviews at optimal intervals for long-term retention.",
  },
  {
    emoji: "📝",
    title: "Multiple Quiz Modes",
    description:
      "Flashcards, multiple choice, type-the-answer, contextual recall, and sentence builder.",
  },
  {
    emoji: "📊",
    title: "Progress Tracking",
    description:
      "Activity heatmaps, accuracy trends, streaks, and mastery tracking.",
  },
  {
    emoji: "🔌",
    title: "Multi-Provider AI",
    description:
      "Google Gemini, OpenAI, Anthropic, or Mistral. Bring your own API key.",
  },
  {
    emoji: "↕️",
    title: "Import & Export",
    description: "Export to Anki, CSV, or JSON. Import from other tools.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="bg-background text-foreground">
      {/* Nav */}
      <nav className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold text-sm text-foreground"
        >
          <Image
            src="/cat-icon.png"
            alt="Gato"
            width={24}
            height={24}
            className="hue-rotate-[30deg] saturate-[1.1]"
          />
          Gato
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="#features"
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            Features
          </Link>
          <Link
            href="#compare"
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            Compare
          </Link>
          {user ? (
            <Link href="/dashboard">
              <Button size="sm">Get Started</Button>
            </Link>
          ) : (
            <Link href="/sign-in">
              <Button size="sm">Get Started</Button>
            </Link>
          )}
        </div>
      </nav>

      {/* Hero — Option A: Giant wordmark, tiny cat accent */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="relative inline-block">
            <h1 className="font-display text-[112px] sm:text-[128px] leading-none tracking-[-2px]">
              Gato
            </h1>
            <Image
              src="/cat-icon.png"
              alt=""
              width={36}
              height={36}
              className="absolute bottom-3 -right-12 hue-rotate-[30deg] saturate-[1.1]"
              aria-hidden="true"
            />
          </div>
          <p className="text-lg text-stone-500 dark:text-stone-400 max-w-[480px] mx-auto mt-5 leading-[1.6]">
            Learn languages from the web. Translate text on any page, build your
            vocabulary, and master words with spaced repetition.
          </p>
          <div className="flex justify-center gap-3 mt-8">
            <a
              href="https://chromewebstore.google.com/detail/nbljhkoabjlchochcncpnjjbpfakdndd"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" className="gap-2">
                Install Extension
                <ArrowRight className="size-4" />
              </Button>
            </a>
            {user ? (
              <Link href="/dashboard">
                <Button size="lg" variant="outline">
                  Open Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/sign-in">
                <Button size="lg" variant="outline">
                  Open Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="h-px bg-border" />
      </div>

      {/* How it works */}
      <section className="py-20 md:py-24">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-4xl">How it works</h2>
            <p className="text-base text-stone-500 dark:text-stone-400 mt-3 leading-relaxed">
              From reading to fluency in three steps
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((step) => (
              <div key={step.number} className="text-center">
                <div className="w-11 h-11 rounded-full bg-accent text-accent-foreground font-bold text-lg flex items-center justify-center mx-auto mb-5">
                  {step.number}
                </div>
                <h3 className="text-[17px] font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="h-px bg-border" />
      </div>

      {/* Features */}
      <section id="features" className="py-20 md:py-24">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-4xl">Features</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex gap-4 p-6 rounded-xl border border-border/60 bg-card"
              >
                <div className="w-10 h-10 rounded-[10px] bg-accent flex items-center justify-center shrink-0 text-lg">
                  {feature.emoji}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="h-px bg-border" />
      </div>

      {/* Comparison table */}
      <div id="compare">
        <ComparisonTable />
      </div>

      {/* CTA */}
      <section className="py-20 md:py-24">
        <div className="max-w-5xl mx-auto px-4">
          <div className="relative overflow-hidden bg-primary rounded-2xl px-8 py-16 md:py-20 text-center">
            {/* Subtle circle decoration */}
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/[0.06]" />
            <h2 className="font-display text-4xl text-primary-foreground relative">
              Start learning today
            </h2>
            <p className="text-primary-foreground/80 mt-3 relative">
              Free and open source. Install the extension and start building
              your vocabulary.
            </p>
            <div className="flex justify-center gap-3 mt-8 relative">
              <a
                href="https://chromewebstore.google.com/detail/nbljhkoabjlchochcncpnjjbpfakdndd"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  className="gap-2 bg-white text-primary hover:bg-white/90"
                >
                  Install Extension
                  <ArrowRight className="size-4" />
                </Button>
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-primary-foreground bg-transparent hover:bg-white/10"
                >
                  View on GitHub
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-semibold text-sm text-foreground mb-3"
        >
          <Image
            src="/cat-icon.png"
            alt="Gato"
            width={20}
            height={20}
            className="hue-rotate-[30deg] saturate-[1.1]"
          />
          Gato
        </Link>
        <div className="mt-2">
          <Link
            href="/privacy-policy"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
