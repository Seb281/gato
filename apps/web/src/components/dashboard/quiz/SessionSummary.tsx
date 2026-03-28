"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Trophy, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { SessionResult } from "@/hooks/useReviewSession";

type SessionSummaryProps = {
  results: SessionResult[];
  onReviewAgain: () => void;
};

export default function SessionSummary({
  results,
  onReviewAgain,
}: SessionSummaryProps) {
  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <Card className="w-full">
        <CardHeader className="text-center pb-2">
          <Trophy className="size-10 text-primary mx-auto mb-2" />
          <CardTitle className="text-2xl">Session Complete!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Reviewed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{correct}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">Accuracy</p>
            </div>
          </div>

          {/* Results list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm font-medium">{r.concept}</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs capitalize"
                  >
                    {r.quality}
                  </Badge>
                  {r.correct ? (
                    <Check className="size-4 text-green-500" />
                  ) : (
                    <X className="size-4 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 w-full">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={onReviewAgain}
        >
          <RotateCcw className="size-4" />
          Review Again
        </Button>
        <Button className="flex-1 gap-2" asChild>
          <Link href="/dashboard/review">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
      </div>
    </div>
  );
}
