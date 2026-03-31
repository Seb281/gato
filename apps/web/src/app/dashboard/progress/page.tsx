"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Flame, Target, Trophy, BookOpen, Loader2, TrendingUp } from "lucide-react";
import Link from "next/link";
import ActivityHeatmap from "@/components/dashboard/ActivityHeatmap";
import AccuracyChart from "@/components/dashboard/AccuracyChart";

type OverviewStats = {
  totalConcepts: number;
  currentStreak: number;
  longestStreak: number;
  avgAccuracy: number;
  conceptsByState: Record<string, number>;
};

type ActivityDay = {
  date: string;
  conceptsAdded: number;
  reviewsCompleted: number;
  correctReviews: number;
};

type ReviewSession = {
  id: string;
  userId: string;
  mode: string;
  totalItems: number;
  correctItems: number;
  accuracy: number;
  durationSeconds: number;
  completedAt: string;
};

const STATE_COLORS: Record<string, string> = {
  new: "bg-neutral-400",
  learning: "bg-blue-400",
  familiar: "bg-amber-400",
  mastered: "bg-emerald-500",
};

const STATE_LABELS: Record<string, string> = {
  new: "New",
  learning: "Learning",
  familiar: "Familiar",
  mastered: "Mastered",
};

export default function ProgressPage() {
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${session.access_token}` };

        const [overviewRes, activityRes, sessionsRes] = await Promise.all([
          fetch(`${API_URL}/stats/overview`, { headers }),
          fetch(`${API_URL}/stats/activity?days=90`, { headers }),
          fetch(`${API_URL}/review/sessions?limit=30`, { headers }),
        ]);

        if (overviewRes.ok) {
          setOverview(await overviewRes.json());
        } else {
          setError(true);
        }
        if (activityRes.ok) {
          const data = await activityRes.json();
          setActivity(data.activity);
        } else {
          setError(true);
        }
        if (sessionsRes.ok) {
          const data = await sessionsRes.json();
          setSessions(data.sessions ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [supabase, API_URL]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const states = ["new", "learning", "familiar", "mastered"];
  const totalForBar = overview?.totalConcepts ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground">Track your learning journey.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Something went wrong loading data. Check your connection and try refreshing.
        </div>
      )}

      {overview && overview.totalConcepts === 0 ? (
        <div className="text-center py-12 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted">
              <BarChart3 className="size-8 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-lg font-medium">No progress to show yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Complete your first review session to start tracking progress.
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/review">Start a Review</Link>
          </Button>
        </div>
      ) : (
      <>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
              Total Words
            </p>
            <p className="text-3xl font-bold tracking-tighter">
              {overview?.totalConcepts ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
              Mastered
            </p>
            <p className="text-3xl font-bold tracking-tighter">
              {overview?.conceptsByState?.mastered ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
              Accuracy
            </p>
            <p className="text-3xl font-bold tracking-tighter">
              {overview?.avgAccuracy ?? 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
              Streak
            </p>
            <p className="text-3xl font-bold tracking-tighter">
              {overview?.currentStreak ?? 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                days
              </span>
            </p>
            {overview && overview.longestStreak > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Best: {overview.longestStreak} days
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accuracy trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-muted-foreground" />
            Accuracy Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AccuracyChart sessions={sessions} />
        </CardContent>
      </Card>

      {/* Vocabulary breakdown */}
      {totalForBar > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-muted-foreground" />
              Vocabulary Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress bar */}
            <div className="flex h-1.5 rounded-full overflow-hidden">
              {states.map((state) => {
                const count = overview?.conceptsByState?.[state] ?? 0;
                const pct = totalForBar > 0 ? (count / totalForBar) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={state}
                    className={`${STATE_COLORS[state]} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4">
              {states.map((state) => {
                const count = overview?.conceptsByState?.[state] ?? 0;
                return (
                  <div key={state} className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${STATE_COLORS[state]}`}
                    />
                    <span className="text-sm">
                      {STATE_LABELS[state]}{" "}
                      <span className="text-muted-foreground font-medium">
                        {count}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap activity={activity} days={90} />
        </CardContent>
      </Card>

      </>
      )}
    </div>
  );
}
