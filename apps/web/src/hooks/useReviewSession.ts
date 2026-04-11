"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export type QuizMode =
  | "flashcard"
  | "multiple-choice"
  | "type-answer"
  | "contextual-recall"
  | "sentence-builder";

/**
 * Server-delivered challenge attached to a sentence-builder question.
 * The API withholds `correctOrdering` from the client — that only comes
 * back after validate, so the puzzle stays a puzzle.
 */
export type SentenceBuilderChallenge = {
  id: string;
  nativeSentence: string;
  tiles: string[];
};

export type Question = {
  conceptId: number;
  concept: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  phoneticApproximation: string | null;
  commonUsage?: string | null;
  correctAnswer?: string;
  options?: string[];
  contextBefore?: string | null;
  contextAfter?: string | null;
  challenge?: SentenceBuilderChallenge;
};

export type SessionResult = {
  conceptId: number;
  concept: string;
  quality: string;
  correct: boolean;
};

export function useReviewSession() {
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  const currentQuestion = questions[currentIndex] ?? null;
  const progress = questions.length > 0 ? ((currentIndex) / questions.length) * 100 : 0;
  const isComplete = sessionActive && currentIndex >= questions.length;

  const startSession = useCallback(
    async (mode: QuizMode, count: number) => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        // Sentence-builder has its own shape: we fetch due concepts using
        // the existing /quiz/generate pipeline (as plain flashcard questions)
        // and then mint one LLM-backed challenge per concept in parallel.
        // Concepts whose challenge generation fails are dropped rather than
        // failing the whole session — the user still sees the ones that
        // succeeded.
        if (mode === "sentence-builder") {
          const baseParams = new URLSearchParams({
            type: "flashcard",
            count: count.toString(),
          });
          const baseRes = await fetch(
            `${API_URL}/quiz/generate?${baseParams}`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          );
          if (!baseRes.ok) {
            toast.error("Could not load review questions.");
            return;
          }
          const baseData = await baseRes.json();
          if (!baseData.questions || baseData.questions.length === 0) {
            setQuestions([]);
            setSessionActive(false);
            return;
          }

          const withChallenges = await Promise.all(
            (baseData.questions as Question[]).map(async (q) => {
              try {
                const r = await fetch(
                  `${API_URL}/review/sentence-builder/generate`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ conceptId: q.conceptId }),
                  }
                );
                if (!r.ok) return null;
                const { challenge } = (await r.json()) as {
                  challenge: SentenceBuilderChallenge;
                };
                const withChallenge: Question = { ...q, challenge };
                return withChallenge;
              } catch {
                return null;
              }
            })
          );

          const usable = withChallenges.filter(
            (q): q is Question => q !== null
          );
          if (usable.length === 0) {
            toast.error("Could not generate sentence challenges.");
            setQuestions([]);
            setSessionActive(false);
            return;
          }
          setQuestions(usable);
          setCurrentIndex(0);
          setResults([]);
          setSessionActive(true);
          return;
        }

        const params = new URLSearchParams({
          type: mode,
          count: count.toString(),
        });

        const res = await fetch(`${API_URL}/quiz/generate?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.questions.length === 0) {
            setQuestions([]);
            setSessionActive(false);
            return;
          }
          setQuestions(data.questions);
          setCurrentIndex(0);
          setResults([]);
          setSessionActive(true);
        } else {
          toast.error("Could not load review questions.");
        }
      } catch (error) {
        console.error("Failed to start session:", error);
        toast.error("Could not load review questions.");
      } finally {
        setLoading(false);
      }
    },
    [supabase, API_URL]
  );

  const submitAnswer = useCallback(
    async (quality: string, correct: boolean) => {
      const question = questions[currentIndex];
      if (!question) return;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        // Fire and forget — don't block UI on the API call
        fetch(`${API_URL}/review/${question.conceptId}/result`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ quality }),
        }).catch(console.error);

        setResults((prev) => [
          ...prev,
          {
            conceptId: question.conceptId,
            concept: question.concept,
            quality,
            correct,
          },
        ]);

        setCurrentIndex((prev) => prev + 1);
      } catch (error) {
        console.error("Failed to submit answer:", error);
      }
    },
    [supabase, API_URL, questions, currentIndex]
  );

  const resetSession = useCallback(() => {
    setQuestions([]);
    setCurrentIndex(0);
    setResults([]);
    setSessionActive(false);
  }, []);

  return {
    questions,
    currentQuestion,
    currentIndex,
    results,
    loading,
    sessionActive,
    progress,
    isComplete,
    startSession,
    submitAnswer,
    resetSession,
  };
}
