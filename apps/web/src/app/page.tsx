import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  BookmarkPlus,
  Brain,
  Cpu,
  GraduationCap,
  Languages,
  ListChecks,
  MousePointer,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-8">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-primary/10">
              <Languages className="size-12 text-primary" />
            </div>
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Context-Aware Translator
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Translate text on any webpage, save words to your vocabulary, and
            master them with spaced repetition.
          </p>

          <div className="flex justify-center gap-4 flex-wrap">
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

      {/* How it works */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-6">
              <div className="p-3 rounded-full bg-primary/10 mx-auto mb-4 w-fit">
                <MousePointer className="size-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Select &amp; Translate
              </h3>
              <p className="text-sm text-muted-foreground">
                Select any text on a webpage. Right-click or use the floating
                button to get an AI-powered, context-aware translation.
              </p>
            </Card>

            <Card className="text-center p-6">
              <div className="p-3 rounded-full bg-primary/10 mx-auto mb-4 w-fit">
                <BookmarkPlus className="size-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Save &amp; Organize</h3>
              <p className="text-sm text-muted-foreground">
                Save translations to your personal vocabulary. Tag and organize
                words by topic.
              </p>
            </Card>

            <Card className="text-center p-6">
              <div className="p-3 rounded-full bg-primary/10 mx-auto mb-4 w-fit">
                <GraduationCap className="size-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Review &amp; Master
              </h3>
              <p className="text-sm text-muted-foreground">
                Review with spaced repetition. Flashcards, multiple choice, and
                typing exercises adapt to your learning pace.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex gap-4">
              <div className="p-3 rounded-full bg-primary/10 h-fit">
                <Brain className="size-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  Context-Aware AI
                </h3>
                <p className="text-sm text-muted-foreground">
                  Translations that understand the surrounding text and your
                  personal learning context.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-3 rounded-full bg-primary/10 h-fit">
                <Timer className="size-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  Spaced Repetition
                </h3>
                <p className="text-sm text-muted-foreground">
                  SM-2 algorithm schedules reviews at optimal intervals for
                  long-term retention.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-3 rounded-full bg-primary/10 h-fit">
                <ListChecks className="size-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  Multiple Quiz Modes
                </h3>
                <p className="text-sm text-muted-foreground">
                  Flashcards, multiple choice, type-the-answer, and contextual
                  recall.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-3 rounded-full bg-primary/10 h-fit">
                <BarChart3 className="size-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  Progress Tracking
                </h3>
                <p className="text-sm text-muted-foreground">
                  Activity heatmaps, accuracy trends, streaks, and mastery
                  tracking.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-3 rounded-full bg-primary/10 h-fit">
                <Cpu className="size-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  Multi-Provider AI
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose between Google Gemini, OpenAI, Anthropic, or Mistral.
                  Bring your own API key.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-3 rounded-full bg-primary/10 h-fit">
                <ArrowUpDown className="size-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  Import &amp; Export
                </h3>
                <p className="text-sm text-muted-foreground">
                  Export to Anki, CSV, or JSON. Import from other tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-secondary rounded-2xl p-12 text-center space-y-6">
            <h2 className="text-3xl font-bold">Start Learning Today</h2>
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
          </div>
        </div>
      </section>
    </div>
  );
}
