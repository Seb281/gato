"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  ListChecks,
  Keyboard,
  FileText,
  Loader2,
  GraduationCap,
  PartyPopper,
  Blocks,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";

const MODES = [
  {
    value: "flashcard",
    labelKey: "review.flashcards",
    icon: BookOpen,
    descKey: "review.flashcardsDesc",
  },
  {
    value: "multiple-choice",
    labelKey: "review.multipleChoice",
    icon: ListChecks,
    descKey: "review.multipleChoiceDesc",
  },
  {
    value: "type-answer",
    labelKey: "review.typeAnswer",
    icon: Keyboard,
    descKey: "review.typeAnswerDesc",
  },
  {
    value: "contextual-recall",
    labelKey: "review.contextRecall",
    icon: FileText,
    descKey: "review.contextRecallDesc",
  },
  {
    value: "sentence-builder",
    labelKey: "review.sentenceBuilder",
    icon: Blocks,
    descKey: "review.sentenceBuilderDesc",
  },
] as const;

export default function ReviewPage() {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useTranslation();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [dueCount, setDueCount] = useState<number | null>(null);
  const [totalConcepts, setTotalConcepts] = useState<number | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>("flashcard");
  const [selectedCount, setSelectedCount] = useState("10");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchReviewData() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${session.access_token}` };

        const [dueRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/review/due?countOnly=true`, { headers }),
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
          setTotalConcepts(data.totalConcepts ?? 0);
        }
      } catch (err) {
        console.error("Failed to fetch review data:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchReviewData();
  }, [supabase, API_URL]);

  function handleStart() {
    const params = new URLSearchParams({
      mode: selectedMode,
      count: selectedCount,
    });
    router.push(`/dashboard/review/session?${params}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">{t("review.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("review.subtitle")}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t("common.error")}
        </div>
      )}

      {/* Due count card or empty state */}
      {!loading && totalConcepts !== null && totalConcepts === 0 ? (
        <div className="text-center py-12 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted">
              <BookOpen className="size-8 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-lg font-medium">{t("review.noVocabulary")}</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {t("review.noVocabularyDesc")}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard">{t("common.goToDashboard")}</Link>
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-secondary">
              {dueCount === 0 ? (
                <PartyPopper className="size-6 text-emerald-500" />
              ) : (
                <GraduationCap className="size-6 text-amber-500" />
              )}
            </div>
            <div className="flex-1">
              {loading ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : dueCount === 0 ? (
                <>
                  <p className="font-semibold">{t("review.allCaughtUp")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("review.allCaughtUpDesc")}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">
                    {t("review.itemsDue", {
                      count: dueCount ?? 0,
                      items: dueCount === 1 ? t("common.item") : t("common.items"),
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("review.startSession")}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mode selector */}
      {(totalConcepts === null || totalConcepts > 0) && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {MODES.map((mode) => (
            <Card
              key={mode.value}
              className={`cursor-pointer transition-all ${
                selectedMode === mode.value
                  ? "bg-primary/10 ring-1 ring-primary/50"
                  : "hover:bg-card/80"
              }`}
              onClick={() => setSelectedMode(mode.value)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <mode.icon className={`size-5 ${selectedMode === mode.value ? "text-primary" : "text-muted-foreground"}`} />
                  {t(mode.labelKey)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t(mode.descKey)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Count & start */}
      {(totalConcepts === null || totalConcepts > 0) && (
        <div className="flex items-center gap-3 justify-end">
          <span className="text-sm text-muted-foreground">{t("review.items")}</span>
          <Select value={selectedCount} onValueChange={setSelectedCount}>
            <SelectTrigger id="review-count" className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="15">15</SelectItem>
              <SelectItem value="20">20</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleStart} size="lg">
            {t("review.startReview")}
          </Button>
        </div>
      )}
    </div>
  );
}
