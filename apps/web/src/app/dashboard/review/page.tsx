"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  ListChecks,
  Keyboard,
  FileText,
  Loader2,
  GraduationCap,
  PartyPopper,
} from "lucide-react";
import Link from "next/link";

const MODES = [
  {
    value: "flashcard",
    label: "Flashcards",
    icon: BookOpen,
    description:
      "Classic card flip. See the word, recall the translation, then rate your confidence.",
  },
  {
    value: "multiple-choice",
    label: "Multiple Choice",
    icon: ListChecks,
    description:
      "Pick the correct translation from four options. Great for recognition practice.",
  },
  {
    value: "type-answer",
    label: "Type Answer",
    icon: Keyboard,
    description:
      "Type the translation from memory. Tests active recall and spelling.",
  },
  {
    value: "contextual-recall",
    label: "Context Recall",
    icon: FileText,
    description:
      "See the original sentence with the word removed. Fill in the blank from memory.",
  },
] as const;

export default function ReviewPage() {
  const supabase = createClient();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [dueCount, setDueCount] = useState<number | null>(null);
  const [totalConcepts, setTotalConcepts] = useState<number | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>("flashcard");
  const [selectedCount, setSelectedCount] = useState("10");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchReviewData() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${session.access_token}` };

        const [dueRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/review/due?countOnly=true`, { headers }),
          fetch(`${API_URL}/stats/overview`, { headers }),
        ]);

        if (dueRes.ok) {
          const data = await dueRes.json();
          setDueCount(data.dueCount);
        } else {
          setError(true);
        }

        if (statsRes.ok) {
          const data = await statsRes.json();
          setTotalConcepts(data.totalConcepts ?? 0);
        }
      } catch (err) {
        console.error("Failed to fetch review data:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchReviewData();
  }, [supabase, API_URL]);

  function handleStart() {
    const params = new URLSearchParams({
      mode: selectedMode,
      count: selectedCount,
    });
    router.push(`/dashboard/review/session?${params}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review</h1>
        <p className="text-muted-foreground">
          Choose a study mode and start practicing.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Something went wrong loading data. Check your connection and try refreshing.
        </div>
      )}

      {/* Due count card or empty state */}
      {!loading && totalConcepts !== null && totalConcepts === 0 ? (
        <div className="text-center py-12 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted">
              <BookOpen className="size-8 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-lg font-medium">No vocabulary yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Save some words to start reviewing. Use the extension to translate and save new vocabulary.
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-secondary">
              {dueCount === 0 ? (
                <PartyPopper className="size-6 text-muted-foreground" />
              ) : (
                <GraduationCap className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              {loading ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : dueCount === 0 ? (
                <>
                  <p className="font-semibold">All caught up!</p>
                  <p className="text-sm text-muted-foreground">
                    No items are due, but you can still practice. Pick a mode below.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">
                    {dueCount} {dueCount === 1 ? "item" : "items"} due for review
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Start a session to practice your vocabulary.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mode selector */}
      {(totalConcepts === null || totalConcepts > 0) && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {MODES.map((mode) => (
            <Card
              key={mode.value}
              className={`cursor-pointer transition-all ${
                selectedMode === mode.value
                  ? "bg-primary/10 ring-1 ring-primary/50"
                  : "hover:bg-card/80"
              }`}
              onClick={() => setSelectedMode(mode.value)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <mode.icon className="size-5 text-muted-foreground" />
                  {mode.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {mode.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Count & start */}
      {(totalConcepts === null || totalConcepts > 0) && (
        <div className="flex items-center gap-3 justify-end">
          <span className="text-sm text-muted-foreground">Items:</span>
          <Select value={selectedCount} onValueChange={setSelectedCount}>
            <SelectTrigger id="review-count" className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="15">15</SelectItem>
              <SelectItem value="20">20</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleStart} size="lg">
            Start Review
          </Button>
        </div>
      )}
    </div>
  );
}
