"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type QuizMode = "flashcard" | "multiple-choice" | "type-answer";

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
        }
      } catch (error) {
        console.error("Failed to start session:", error);
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
