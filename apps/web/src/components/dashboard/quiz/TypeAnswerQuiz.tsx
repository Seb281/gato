"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import type { Question } from "@/hooks/useReviewSession";
import { useQuizKeyboard } from "@/hooks/useQuizKeyboard";

type TypeAnswerQuizProps = {
  question: Question;
  onAnswer: (quality: string, correct: boolean) => void;
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function TypeAnswerQuiz({
  question,
  onAnswer,
}: TypeAnswerQuizProps) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const correct = question.translation;
  // Check if the typed answer matches (case-insensitive, trimmed)
  // Also check if it matches the start of the translation (before any / or separator)
  const isCorrect =
    normalize(input) === normalize(correct) ||
    correct
      .split(/[\/|]/)
      .some((part) => normalize(input) === normalize(part));

  function handleSubmit() {
    if (!input.trim()) return;
    setSubmitted(true);
  }

  function handleContinue() {
    onAnswer(isCorrect ? "good" : "again", isCorrect);
    setInput("");
    setSubmitted(false);
  }

  const keyboardHandlers = useMemo(() => {
    const h: Record<string, () => void> = {};
    if (submitted) {
      h["Space"] = () => handleContinue();
      h["Enter"] = () => handleContinue();
    }
    return h;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  useQuizKeyboard(keyboardHandlers);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <Badge variant="outline" className="text-xs font-normal">
        {question.sourceLanguage} &rarr; {question.targetLanguage}
      </Badge>

      <Card className="w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-2">
          <p className="text-3xl font-bold">{question.concept}</p>
          {question.phoneticApproximation && (
            <p className="text-sm text-muted-foreground italic">
              {question.phoneticApproximation}
            </p>
          )}
          <p className="text-sm text-muted-foreground pt-2">
            Type the translation
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
            autoFocus
            placeholder="Type your answer..."
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
                    Correct answer: <strong>{correct}</strong>
                  </p>
                </>
              )}
            </div>
          </div>
          <Button onClick={handleContinue} className="w-full">
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
