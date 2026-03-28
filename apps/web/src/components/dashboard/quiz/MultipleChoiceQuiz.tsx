"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import type { Question } from "@/hooks/useReviewSession";

type MultipleChoiceQuizProps = {
  question: Question;
  onAnswer: (quality: string, correct: boolean) => void;
};

export default function MultipleChoiceQuiz({
  question,
  onAnswer,
}: MultipleChoiceQuizProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const correct = question.correctAnswer ?? question.translation;
  const options = question.options ?? [correct];

  function handleSelect(option: string) {
    if (answered) return;
    setSelected(option);
    setAnswered(true);

    // Auto-advance after a short delay
    const isCorrect = option === correct;
    timerRef.current = setTimeout(() => {
      onAnswer(isCorrect ? "good" : "again", isCorrect);
      setSelected(null);
      setAnswered(false);
    }, 1200);
  }

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
            Select the correct translation
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 w-full">
        {options.map((option, i) => {
          let variant: "outline" | "default" | "destructive" = "outline";
          let icon = null;

          if (answered) {
            if (option === correct) {
              variant = "default";
              icon = <Check className="size-4 shrink-0" />;
            } else if (option === selected) {
              variant = "destructive";
              icon = <X className="size-4 shrink-0" />;
            }
          }

          return (
            <Button
              key={i}
              variant={variant}
              className="justify-start text-left h-auto py-3 px-4 gap-2"
              onClick={() => handleSelect(option)}
              disabled={answered}
            >
              {icon}
              <span className="flex-1">{option}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
