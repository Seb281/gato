"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useReviewSession } from "@/hooks/useReviewSession";
import type { QuizMode } from "@/hooks/useReviewSession";
import FlashcardQuiz from "@/components/dashboard/quiz/FlashcardQuiz";
import MultipleChoiceQuiz from "@/components/dashboard/quiz/MultipleChoiceQuiz";
import TypeAnswerQuiz from "@/components/dashboard/quiz/TypeAnswerQuiz";
import ContextualRecallQuiz from "@/components/dashboard/quiz/ContextualRecallQuiz";
import SentenceBuilderQuiz from "@/components/dashboard/quiz/SentenceBuilderQuiz";
import SessionSummary from "@/components/dashboard/quiz/SessionSummary";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function ReviewSessionPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") ?? "flashcard") as QuizMode;
  const count = parseInt(searchParams.get("count") ?? "10", 10);

  const {
    currentQuestion,
    currentIndex,
    questions,
    results,
    loading,
    sessionActive,
    progress,
    isComplete,
    startSession,
    submitAnswer,
    resetSession,
  } = useReviewSession();

  const hasStarted = useRef(false);
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    startSession(mode, count);
  }, [startSession, mode, count]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">{t("review.loadingQuestions")}</p>
      </div>
    );
  }

  if (!sessionActive && questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-3">
        <p className="text-muted-foreground">
          {t("review.noItemsDueNow")}
        </p>
        <a
          href="/dashboard/review"
          className="text-muted-foreground underline text-sm hover:text-foreground"
        >
          {t("review.backToReview")}
        </a>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="py-8">
        <SessionSummary
          results={results}
          onReviewAgain={() => startSession(mode, count)}
        />
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6">
      {/* Progress bar */}
      <div className="max-w-lg mx-auto space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {currentIndex + 1} of {questions.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Quiz component */}
      {currentQuestion && mode === "flashcard" && (
        <FlashcardQuiz
          key={currentQuestion.conceptId}
          question={currentQuestion}
          onAnswer={submitAnswer}
        />
      )}
      {currentQuestion && mode === "multiple-choice" && (
        <MultipleChoiceQuiz
          key={currentQuestion.conceptId}
          question={currentQuestion}
          onAnswer={submitAnswer}
        />
      )}
      {currentQuestion && mode === "type-answer" && (
        <TypeAnswerQuiz
          key={currentQuestion.conceptId}
          question={currentQuestion}
          onAnswer={submitAnswer}
        />
      )}
      {currentQuestion && mode === "contextual-recall" && (
        <ContextualRecallQuiz
          key={currentQuestion.conceptId}
          question={currentQuestion}
          onAnswer={submitAnswer}
        />
      )}
      {currentQuestion && mode === "sentence-builder" && (
        <SentenceBuilderQuiz
          key={currentQuestion.conceptId}
          question={currentQuestion}
          onAnswer={submitAnswer}
        />
      )}
    </div>
  );
}
