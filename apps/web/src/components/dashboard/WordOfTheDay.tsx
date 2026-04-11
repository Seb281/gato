"use client";

/**
 * Dashboard "Word of the Day" card.
 *
 * Fetches a single LLM-generated suggestion from
 * `GET /suggestions/word-of-the-day`. That endpoint is cached per
 * (user, day) server-side, so this component can be naïve: one request
 * per page load, no client-side caching, no revalidation. If the user
 * has no target language configured and no saved vocab the endpoint
 * returns 404, and we render an empty state prompting them to get
 * started.
 *
 * Interactions:
 *   - "Hear it" plays the word through the browser's `speechSynthesis`
 *     API. We feed it the BCP-47-ish language name lowercased; browsers
 *     do a best-effort voice match and silently fall back to the default
 *     voice, which is fine for a quick listen.
 *   - "Save" POSTs to the existing `/saved-concepts` endpoint so the
 *     suggested word lands in the user's vocabulary just like any word
 *     saved through the extension.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Volume2, Plus, Loader2, Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

type WordOfTheDay = {
  word: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  rationale: string | null;
  exampleSentence: string | null;
  date: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "loaded"; suggestion: WordOfTheDay };

export default function WordOfTheDay() {
  const supabase = createClient();
  const { t } = useTranslation();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) setState({ status: "empty" });
          return;
        }

        const res = await fetch(`${API_URL}/suggestions/word-of-the-day`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (cancelled) return;

        if (res.status === 404) {
          setState({ status: "empty" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }

        const data = (await res.json()) as { suggestion: WordOfTheDay };
        setState({ status: "loaded", suggestion: data.suggestion });
      } catch (error) {
        console.error("Failed to load word of the day:", error);
        if (!cancelled) setState({ status: "error" });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, API_URL]);

  function speak(text: string, language: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error(t("home.wordOfTheDay.speechUnsupported"));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language.toLowerCase();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function handleSave() {
    if (state.status !== "loaded" || saving || saved) return;
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t("common.notSignedIn"));
        setSaving(false);
        return;
      }

      const { suggestion } = state;
      const res = await fetch(`${API_URL}/saved-concepts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          concept: suggestion.word,
          translation: suggestion.translation,
          sourceLanguage: suggestion.sourceLanguage,
          targetLanguage: suggestion.targetLanguage,
        }),
      });

      if (res.status === 409) {
        setSaved(true);
        toast.success(t("home.wordOfTheDay.alreadySaved"));
        return;
      }
      if (!res.ok) {
        toast.error(t("home.wordOfTheDay.saveFailed"));
        return;
      }
      setSaved(true);
      toast.success(t("home.wordOfTheDay.saved"));
    } catch (error) {
      console.error("Failed to save word of the day:", error);
      toast.error(t("home.wordOfTheDay.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-muted-foreground" />
          {t("home.wordOfTheDay.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {state.status === "loading" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">{t("common.loading")}</span>
          </div>
        )}

        {state.status === "empty" && (
          <p className="text-sm text-muted-foreground">
            {t("home.wordOfTheDay.empty")}
          </p>
        )}

        {state.status === "error" && (
          <p className="text-sm text-muted-foreground">
            {t("home.wordOfTheDay.error")}
          </p>
        )}

        {state.status === "loaded" && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-2xl font-semibold tracking-tight">
                  {state.suggestion.word}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() =>
                    speak(
                      state.suggestion.word,
                      state.suggestion.targetLanguage
                    )
                  }
                  aria-label={t("home.wordOfTheDay.hearIt")}
                >
                  <Volume2 className="size-4" />
                </Button>
              </div>
              <p className="text-muted-foreground">
                {state.suggestion.translation}
              </p>
            </div>

            {state.suggestion.exampleSentence && (
              <p className="text-sm italic text-muted-foreground">
                &ldquo;{state.suggestion.exampleSentence}&rdquo;
              </p>
            )}

            {state.suggestion.rationale && (
              <p className="text-xs text-muted-foreground">
                {state.suggestion.rationale}
              </p>
            )}

            <div className="pt-1">
              <Button
                size="sm"
                variant={saved ? "secondary" : "default"}
                onClick={handleSave}
                disabled={saving || saved}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {t("common.saving")}
                  </>
                ) : saved ? (
                  <>
                    <Check className="size-4 mr-2" />
                    {t("home.wordOfTheDay.saved")}
                  </>
                ) : (
                  <>
                    <Plus className="size-4 mr-2" />
                    {t("home.wordOfTheDay.save")}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
