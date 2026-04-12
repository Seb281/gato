"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Trophy, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { SessionResult } from "@/hooks/useReviewSession";
import { createClient } from "@/lib/supabase/client";
import { checkMilestones } from "@/components/dashboard/MilestoneToast";
import { useTranslation } from "@/lib/i18n/useTranslation";

type SessionSummaryProps = {
  results: SessionResult[];
  onReviewAgain: () => void;
};

export default function SessionSummary({
  results,
  onReviewAgain,
}: SessionSummaryProps) {
  const { t } = useTranslation();
  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  useEffect(() => {
    async function fetchAndCheckMilestones() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        const headers = { Authorization: `Bearer ${session.access_token}` };

        const [overviewRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/stats/overview`, { headers }),
          fetch(`${API_URL}/review/stats`, { headers }),
        ]);

        const overviewData = overviewRes.ok ? await overviewRes.json() : null;
        const statsData = statsRes.ok ? await statsRes.json() : null;

        checkMilestones({
          totalConcepts: overviewData?.totalConcepts,
          currentStreak: overviewData?.currentStreak,
          totalReviewed: statsData?.totalReviewed,
          conceptsByState: overviewData?.conceptsByState,
          lastSessionAccuracy: accuracy,
        });
      } catch {
        // Silently fail — milestones are non-critical
      }
    }

    fetchAndCheckMilestones();
  }, [accuracy]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <Card className="w-full">
        <CardHeader className="text-center pb-2">
          <Trophy className="size-10 text-amber-500 mx-auto mb-2" />
          <CardTitle className="font-display text-3xl">{t("quiz.sessionComplete")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("quiz.reviewed")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-500">{correct}</p>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("quiz.correct")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{accuracy}%</p>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("quiz.accuracy")}</p>
            </div>
          </div>

          {/* Results list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md bg-secondary px-3 py-2"
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
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <X className="size-4 text-[#ee7d77]" />
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
          {t("quiz.reviewAgain")}
        </Button>
        <Button className="flex-1 gap-2" asChild>
          <Link href="/dashboard/review">
            <ArrowLeft className="size-4" />
            {t("quiz.back")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
