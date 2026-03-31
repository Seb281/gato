"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import type { Question } from "@/hooks/useReviewSession";
import { useQuizKeyboard } from "@/hooks/useQuizKeyboard";

type FlashcardQuizProps = {
  question: Question;
  onAnswer: (quality: string, correct: boolean) => void;
};

export default function FlashcardQuiz({
  question,
  onAnswer,
}: FlashcardQuizProps) {
  const [revealed, setRevealed] = useState(false);

  function handleRate(quality: string) {
    const correct = quality !== "again";
    onAnswer(quality, correct);
    setRevealed(false);
  }

  const keyboardHandlers = useMemo(() => {
    const h: Record<string, () => void> = {};
    if (revealed) {
      h["1"] = () => handleRate("again");
      h["2"] = () => handleRate("hard");
      h["3"] = () => handleRate("good");
      h["4"] = () => handleRate("easy");
    } else {
      h["Space"] = () => setRevealed(true);
    }
    return h;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  useQuizKeyboard(keyboardHandlers);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <Badge variant="outline" className="text-xs font-normal">
        {question.sourceLanguage} &rarr; {question.targetLanguage}
      </Badge>

      <Card className="w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <p className="text-3xl font-bold">{question.concept}</p>
          {question.phoneticApproximation && (
            <p className="text-sm text-muted-foreground italic">
              {question.phoneticApproximation}
            </p>
          )}

          {!revealed ? (
            <Button
              onClick={() => setRevealed(true)}
              size="lg"
              variant="outline"
              className="mt-4 gap-2"
            >
              <Eye className="size-4" />
              Show Answer
            </Button>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="pt-4">
                <p className="text-xl font-semibold text-foreground">
                  {question.translation}
                </p>
              </div>
              {question.commonUsage && (
                <p className="text-sm text-muted-foreground">
                  {question.commonUsage}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {revealed && (
        <div className="flex gap-2 w-full animate-in slide-in-from-bottom-2 duration-200">
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => handleRate("again")}
          >
            Again
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleRate("hard")}
          >
            Hard
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={() => handleRate("good")}
          >
            Good
          </Button>
          <Button
            variant="outline"
            className="flex-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
            onClick={() => handleRate("easy")}
          >
            Easy
          </Button>
        </div>
      )}
    </div>
  );
}
