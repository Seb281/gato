"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  GraduationCap,
  BarChart3,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardHome() {
  const supabase = createClient();
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
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

        const [dueRes, statsRes, overviewRes] = await Promise.all([
          fetch(`${API_URL}/review/due?countOnly=true`, { headers }),
          fetch(`${API_URL}/review/stats`, { headers }),
          fetch(`${API_URL}/stats/overview`, { headers }),
        ]);

        if (dueRes.ok) {
          const data = await dueRes.json();
          setDueCount(data.dueCount);
        } else {
          setError(true);
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        } else {
          setError(true);
        }
        if (overviewRes.ok) {
          const data = await overviewRes.json();
          setOverview(data);
        } else {
          setError(true);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Home</h1>
        <p className="text-muted-foreground">
          Welcome back. Here&apos;s your learning overview.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Something went wrong loading data. Check your connection and try refreshing.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Due for Review */}
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-5 text-muted-foreground" />
              Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : dueCount === 0 ? (
              <p className="text-muted-foreground mb-4">
                All caught up! No items due for review.
              </p>
            ) : (
              <p className="text-muted-foreground mb-4">
                You have{" "}
                <span className="font-semibold text-foreground">
                  {dueCount}
                </span>{" "}
                {dueCount === 1 ? "item" : "items"} ready for review.
              </p>
            )}
            <Button asChild>
              <Link href="/dashboard/review">
                {dueCount && dueCount > 0 ? "Start Review" : "Go to Review"}
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
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Reviews</p>
                <p className="text-3xl font-bold tracking-tighter">
                  {loading ? "--" : (stats?.totalReviewed ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Accuracy</p>
                <p className="text-3xl font-bold tracking-tighter">
                  {loading ? "--" : `${stats?.avgAccuracy ?? 0}%`}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Due Now</p>
                <p className="text-3xl font-bold tracking-tighter">
                  {loading ? "--" : (dueCount ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Streak</p>
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
              Recent Words
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/vocabulary">
                View all
                <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Your recently saved words will appear here. Use the extension to
            translate and save new vocabulary.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
