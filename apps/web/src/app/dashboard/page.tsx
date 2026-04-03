"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  GraduationCap,
  BarChart3,
  Target,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import GoalRing from "@/components/dashboard/GoalRing";
import { checkMilestones } from "@/components/dashboard/MilestoneToast";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function DashboardHome() {
  const supabase = createClient();
  const { t } = useTranslation();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [dueCount, setDueCount] = useState<number | null>(null);
  const [stats, setStats] = useState<{
    totalReviewed: number;
    dueNow: number;
    avgAccuracy: number;
  } | null>(null);
  const [overview, setOverview] = useState<{
    totalConcepts: number;
    currentStreak: number;
    longestStreak: number;
    dailyGoal?: number;
    todayReviews?: number;
  } | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(true); // default true to avoid flash

  useEffect(() => {
    setOnboardingDismissed(
      localStorage.getItem("onboarding-dismissed") === "true"
    );
  }, []);

  const handleDismissOnboarding = useCallback(() => {
    localStorage.setItem("onboarding-dismissed", "true");
    setOnboardingDismissed(true);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${session.access_token}` };

        const [dueRes, statsRes, overviewRes, settingsRes] = await Promise.all([
          fetch(`${API_URL}/review/due?countOnly=true`, { headers }),
          fetch(`${API_URL}/review/stats`, { headers }),
          fetch(`${API_URL}/stats/overview`, { headers }),
          fetch(`${API_URL}/user/settings`, { headers }),
        ]);

        // Prefer DB name (updated via settings) over auth metadata
        let resolvedName: string | null = null;
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.name) {
            resolvedName = settingsData.name.split(" ")[0];
          }
        }
        if (!resolvedName) {
          const fullName = session.user?.user_metadata?.full_name ?? session.user?.user_metadata?.name;
          if (fullName) {
            resolvedName = fullName.split(" ")[0];
          }
        }
        if (resolvedName) {
          setUserName(resolvedName);
        }

        let statsData: { totalReviewed: number; dueNow: number; avgAccuracy: number } | null = null;
        let overviewData: { totalConcepts: number; currentStreak: number; longestStreak: number; conceptsByState?: { new?: number; learning?: number; familiar?: number; mastered?: number } } | null = null;

        if (dueRes.ok) {
          const data = await dueRes.json();
          setDueCount(data.dueCount);
        } else {
          setError(true);
        }
        if (statsRes.ok) {
          statsData = await statsRes.json();
          setStats(statsData);
        } else {
          setError(true);
        }
        if (overviewRes.ok) {
          overviewData = await overviewRes.json();
          setOverview(overviewData);
        } else {
          setError(true);
        }

        // Check milestones with fresh data from both endpoints
        if (overviewData) {
          checkMilestones({
            totalConcepts: overviewData.totalConcepts,
            currentStreak: overviewData.currentStreak,
            totalReviewed: statsData?.totalReviewed,
            conceptsByState: overviewData.conceptsByState,
          });
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [supabase, API_URL]);

  const totalConcepts = overview?.totalConcepts ?? 0;
  const totalReviewed = stats?.totalReviewed ?? 0;
  const allOnboardingComplete = totalConcepts > 0 && totalReviewed > 0;
  const showOnboarding =
    !loading && !onboardingDismissed && !allOnboardingComplete;

  const dailyGoal = overview?.dailyGoal ?? 10;
  const todayReviews = overview?.todayReviews ?? 0;
  const goalMet = todayReviews >= dailyGoal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {userName ? t("home.welcomeBack", { name: userName }) : t("home.welcomeBackGeneric")}
        </h1>
        <p className="text-muted-foreground">
          {t("home.learningOverview")}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t("common.error")}
        </div>
      )}

      {showOnboarding ? (
        <OnboardingChecklist
          totalConcepts={totalConcepts}
          totalReviewed={totalReviewed}
          onDismiss={handleDismissOnboarding}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Today's Progress */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Target className="size-5 text-muted-foreground" />
                  {t("home.todaysProgress")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {loading ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <GoalRing current={todayReviews} goal={dailyGoal} />
                    {goalMet && (
                      <p className="text-sm font-medium text-emerald-500">
                        {t("home.goalMet")}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Due for Review */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="size-5 text-muted-foreground" />
                  {t("home.review")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 justify-between">
                {loading ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : dueCount === 0 ? (
                  <p className="text-muted-foreground">
                    {t("home.allCaughtUp")}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    {t("home.itemsDue", {
                      count: dueCount ?? 0,
                      items: dueCount === 1 ? t("common.item") : t("common.items"),
                    })}
                  </p>
                )}
                <Button asChild className="mt-4">
                  <Link href="/dashboard/review">
                    {dueCount && dueCount > 0 ? t("home.startReview") : t("home.goToReview")}
                    <ArrowRight className="size-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5 text-muted-foreground" />
                  {t("home.quickStats")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{t("home.reviews")}</p>
                    <p className="text-3xl font-bold tracking-tighter">
                      {loading ? "--" : (stats?.totalReviewed ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{t("home.accuracy")}</p>
                    <p className="text-3xl font-bold tracking-tighter">
                      {loading ? "--" : `${stats?.avgAccuracy ?? 0}%`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{t("home.dueNow")}</p>
                    <p className="text-3xl font-bold tracking-tighter">
                      {loading ? "--" : (dueCount ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{t("home.streak")}</p>
                    <p className="text-3xl font-bold tracking-tighter">
                      {loading ? "--" : (overview?.currentStreak ?? 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Words placeholder */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-muted-foreground" />
                  {t("home.recentWords")}
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/vocabulary">
                    {t("home.viewAll")}
                    <ArrowRight className="size-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {t("home.recentWordsEmpty")}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
