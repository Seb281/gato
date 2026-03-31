"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import { isCloseEnough } from "@/lib/levenshtein";
import type { Question } from "@/hooks/useReviewSession";

type ContextualRecallQuizProps = {
  question: Question;
  onAnswer: (quality: string, correct: boolean) => void;
};

export default function ContextualRecallQuiz({
  question,
  onAnswer,
}: ContextualRecallQuizProps) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const correctAnswer = question.concept;
  const isCorrect = isCloseEnough(input, correctAnswer);

  function handleSubmit() {
    if (!input.trim()) return;
    setSubmitted(true);
  }

  const handleContinue = useCallback(() => {
    onAnswer(isCorrect ? "good" : "again", isCorrect);
    setInput("");
    setSubmitted(false);
  }, [onAnswer, isCorrect]);

  // Keyboard shortcut: Space to continue after submitting
  useEffect(() => {
    if (!submitted) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleContinue();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitted, handleContinue]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <Badge variant="outline" className="text-xs font-normal">
        {question.sourceLanguage} &rarr; {question.targetLanguage}
      </Badge>

      <Card className="w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          {/* Sentence with blank */}
          <p className="text-xl leading-relaxed">
            {question.contextBefore && (
              <span>{question.contextBefore} </span>
            )}
            <span className="inline-block border-b-2 border-primary px-4 py-1 mx-1 min-w-[60px]">
              ?
            </span>
            {question.contextAfter && (
              <span> {question.contextAfter}</span>
            )}
          </p>

          {/* Translation hint */}
          <p className="text-sm text-muted-foreground italic">
            Translation: {question.translation}
          </p>

          <p className="text-sm text-muted-foreground pt-2">
            Fill in the missing word
          </p>
        </CardContent>
      </Card>

      {!submitted ? (
        <form
          className="w-full space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Input
            id="contextual-answer"
            name="answer"
            autoFocus
            placeholder="Type the missing word..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="text-center text-lg h-12"
          />
          <Button
            type="submit"
            className="w-full"
            disabled={!input.trim()}
          >
            Check
          </Button>
        </form>
      ) : (
        <div className="w-full space-y-4 animate-in fade-in duration-200">
          <div
            className={`flex items-center gap-2 rounded-lg p-3 ${
              isCorrect
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-red-500/10 text-[#ee7d77]"
            }`}
          >
            {isCorrect ? (
              <Check className="size-5 shrink-0" />
            ) : (
              <X className="size-5 shrink-0" />
            )}
            <div className="flex-1">
              {isCorrect ? (
                <p className="font-medium">Correct!</p>
              ) : (
                <>
                  <p className="font-medium">
                    Your answer: {input}
                  </p>
                  <p className="text-sm mt-1">
                    Correct answer: <strong>{correctAnswer}</strong>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Show the full sentence with the answer filled in */}
          <div className="rounded-lg bg-secondary/50 p-3 text-sm text-center">
            {question.contextBefore && (
              <span>{question.contextBefore} </span>
            )}
            <strong className="text-primary">{correctAnswer}</strong>
            {question.contextAfter && (
              <span> {question.contextAfter}</span>
            )}
          </div>

          <Button onClick={handleContinue} className="w-full">
            Continue
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Press Space or Enter to continue
          </p>
        </div>
      )}
    </div>
  );
}
