"use client";

/**
 * Sentence-builder quiz component.
 *
 * The user is shown a native-language prompt and a shuffled pool of tiles
 * (the correct target-language words + a handful of distractors). They
 * click tiles to append them to their answer, click an answer tile to
 * send it back to the pool, and hit Submit to validate against the server.
 *
 * Validation is stateless on the client — the server side holds the
 * canonical `correctOrdering` in an in-memory cache keyed by `challenge.id`.
 * After a validate round-trip the component reveals the correct answer
 * inline, then calls `onAnswer` with a rating so the existing session
 * accounting (streaks, stats, review_events) picks it up for free.
 *
 * Click-to-append only (no drag-and-drop) — the plan explicitly marks DnD
 * as later work, and a simple click model gets us keyboard and touch
 * interaction without extra libraries.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, RotateCcw } from "lucide-react";
import type { Question } from "@/hooks/useReviewSession";

type SentenceBuilderQuizProps = {
  question: Question;
  onAnswer: (quality: string, correct: boolean) => void;
};

type ValidationState =
  | { status: "idle" }
  | { status: "submitting" }
  | {
      status: "done";
      correct: boolean;
      correctOrdering: string[];
    };

export default function SentenceBuilderQuiz({
  question,
  onAnswer,
}: SentenceBuilderQuizProps) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const supabase = useMemo(() => createClient(), []);
  const challenge = question.challenge;

  // `order` holds the indices of tiles the user has picked, in selection
  // order. Storing indices rather than strings lets us handle duplicate
  // tiles cleanly (two different tiles with the same text stay distinct).
  const [order, setOrder] = useState<number[]>([]);
  const [validation, setValidation] = useState<ValidationState>({
    status: "idle",
  });

  if (!challenge) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-10 text-center text-muted-foreground">
          Challenge unavailable.
        </CardContent>
      </Card>
    );
  }

  const pool = challenge.tiles;
  const usedSet = new Set(order);

  function appendTile(index: number) {
    if (validation.status !== "idle") return;
    if (usedSet.has(index)) return;
    setOrder((prev) => [...prev, index]);
  }

  function removeAt(position: number) {
    if (validation.status !== "idle") return;
    setOrder((prev) => prev.filter((_, i) => i !== position));
  }

  function resetOrder() {
    if (validation.status !== "idle") return;
    setOrder([]);
  }

  async function handleSubmit() {
    if (!challenge || validation.status !== "idle") return;
    if (order.length === 0) return;

    setValidation({ status: "submitting" });
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not signed in.");
        setValidation({ status: "idle" });
        return;
      }

      const ordering = order.map((i) => pool[i]!);
      const res = await fetch(
        `${API_URL}/review/sentence-builder/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ challengeId: challenge.id, ordering }),
        }
      );

      if (res.status === 410) {
        // Cache miss — challenge expired. Skip to the next item with an
        // "again" rating so the user's time isn't wasted re-entering it.
        toast.error("This challenge expired — moving on.");
        onAnswer("again", false);
        return;
      }

      if (!res.ok) {
        toast.error("Could not validate answer.");
        setValidation({ status: "idle" });
        return;
      }

      const data = (await res.json()) as {
        correct: boolean;
        correctOrdering: string[];
      };
      setValidation({
        status: "done",
        correct: data.correct,
        correctOrdering: data.correctOrdering,
      });
    } catch (error) {
      console.error("Sentence validation failed:", error);
      toast.error("Could not validate answer.");
      setValidation({ status: "idle" });
    }
  }

  function handleContinue(quality: "again" | "hard" | "good" | "easy") {
    const correct = validation.status === "done" && validation.correct;
    onAnswer(quality, correct);
    setOrder([]);
    setValidation({ status: "idle" });
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-1 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Build the sentence in {question.targetLanguage}
          </p>
          <p className="text-lg font-medium">{challenge.nativeSentence}</p>
        </div>

        {/* Answer row */}
        <div className="min-h-[3rem] flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3 bg-muted/30">
          {order.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Tap tiles below to build your answer…
            </p>
          ) : (
            order.map((tileIdx, position) => (
              <Button
                key={`${tileIdx}-${position}`}
                variant="secondary"
                size="sm"
                onClick={() => removeAt(position)}
                disabled={validation.status !== "idle"}
                className="font-medium"
              >
                {pool[tileIdx]}
              </Button>
            ))
          )}
        </div>

        {/* Tile pool */}
        <div className="flex flex-wrap gap-2 justify-center">
          {pool.map((tile, i) => (
            <Button
              key={`pool-${i}`}
              variant="outline"
              size="sm"
              onClick={() => appendTile(i)}
              disabled={usedSet.has(i) || validation.status !== "idle"}
              className={usedSet.has(i) ? "opacity-40" : ""}
            >
              {tile}
            </Button>
          ))}
        </div>

        {/* Actions */}
        {validation.status === "idle" && (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetOrder}
              disabled={order.length === 0}
            >
              <RotateCcw className="size-4 mr-1" />
              Reset
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={order.length === 0}
              size="lg"
            >
              Submit
            </Button>
          </div>
        )}

        {validation.status === "submitting" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Checking…</span>
          </div>
        )}

        {validation.status === "done" && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              {validation.correct ? (
                <>
                  <Check className="size-5 text-green-500" />
                  <Badge variant="default">Correct</Badge>
                </>
              ) : (
                <>
                  <X className="size-5 text-destructive" />
                  <Badge variant="destructive">Not quite</Badge>
                </>
              )}
            </div>

            {!validation.correct && (
              <div className="rounded-md bg-secondary p-3 text-sm text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Correct answer
                </p>
                <p className="font-medium">
                  {validation.correctOrdering.join(" ")}
                </p>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleContinue("again")}
              >
                Again
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleContinue("hard")}
              >
                Hard
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleContinue("good")}
              >
                Good
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleContinue("easy")}
              >
                Easy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
