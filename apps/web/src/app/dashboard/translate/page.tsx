"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Volume2,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Check,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { languageToBCP47 } from "./languageCodes";
import { parseRelatedWords, normalizeFrequency } from "@gato/shared";
import type { TranslationResponse, EnrichmentResponse } from "@gato/shared";

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Russian", "Japanese", "Chinese", "Korean", "Arabic", "Hindi",
  "Dutch", "Swedish", "Norwegian", "Danish", "Finnish", "Polish",
  "Turkish", "Greek", "Hebrew", "Thai", "Vietnamese", "Indonesian",
  "Malay", "Czech", "Slovak", "Hungarian", "Romanian", "Bulgarian",
];

export default function TranslatePage() {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useTranslation();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [sourceText, setSourceText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("English");
  // `personalContext` mirrors the user's global profile context (managed
  // in Settings) and is sent with every translation to improve relevance.
  // It is never displayed or editable on this page — edit in Settings.
  const [personalContext, setPersonalContext] = useState("");
  // `surroundingContext` is the per-query context the user types in the
  // "Add context" collapsible — e.g. the sentence the word came from.
  // This maps to the API's `contextBefore` field.
  const [surroundingContext, setSurroundingContext] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<TranslationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [enrichment, setEnrichment] = useState<EnrichmentResponse | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const requestIdRef = useRef(0);

  // Load user settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(`${API_URL}/user/settings`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.targetLanguage) setTargetLanguage(data.targetLanguage);
          if (data.personalContext) setPersonalContext(data.personalContext);
        }
      } catch {
        // Settings load is non-critical
      }
    }
    loadSettings();
  }, [supabase, API_URL]);

  async function handleTranslate() {
    if (!sourceText.trim()) return;

    const currentRequestId = ++requestIdRef.current;
    setIsTranslating(true);
    setError(null);
    setResult(null);
    setEnrichment(null);
    setShowMore(false);
    setSaveState("idle");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${API_URL}/translation`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          // Use the structured format: explicit selection + surrounding
          // context, so the API's per-query context path is taken.
          selection: sourceText,
          contextBefore: surroundingContext,
          targetLanguage,
          sourceLanguage: sourceLanguage === "auto" ? "" : sourceLanguage,
          personalContext,
        }),
      });

      if (currentRequestId !== requestIdRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Translation failed");
      }

      const data = await res.json();
      setResult(data);

      // On successful auto-detect, populate the Select with the detected
      // language so the UI reflects what the API decided. If the detected
      // name isn't in our curated list, leave "auto" untouched.
      if (sourceLanguage === "auto" && data.language) {
        const detected = LANGUAGES.find(
          (l) => l.toLowerCase() === String(data.language).toLowerCase()
        );
        if (detected) setSourceLanguage(detected);
      }
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        setError(
          err instanceof Error ? err.message : t("translate.error")
        );
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsTranslating(false);
      }
    }
  }

  async function handleSave() {
    if (!result) return;

    setSaveState("saving");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/saved-concepts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          concept: sourceText,
          translation: result.contextualTranslation,
          sourceLanguage: result.language,
          targetLanguage,
          contextBefore: surroundingContext,
        }),
      });

      if (res.ok) {
        setSaveState("saved");
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error?.includes("already")) {
          setSaveState("saved");
        } else {
          setSaveState("error");
        }
      }
    } catch {
      setSaveState("error");
    }
  }

  async function handleEnrich() {
    if (!result || isEnriching || enrichment) return;

    // If LLM fallback already provided enrichment, use it directly
    if (result.provider === "llm" && result.phoneticApproximation) {
      setEnrichment({
        phoneticApproximation: result.phoneticApproximation,
        fixedExpression: result.fixedExpression,
        commonUsage: result.commonUsage,
        grammarRules: result.grammarRules,
        commonness: result.commonness,
        relatedWords: parseRelatedWords(result.relatedWords),
      });
      return;
    }

    setIsEnriching(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${API_URL}/translation/enrich`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: sourceText,
          translation: result.contextualTranslation,
          targetLanguage,
          sourceLanguage: result.language || "",
          personalContext,
          contextBefore: surroundingContext,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setEnrichment(data);
      }
    } catch {
      // Enrichment failure is non-critical
    } finally {
      setIsEnriching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleTranslate();
    }
  }

  function speakText(text: string, lang: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    const bcp47 = languageToBCP47[lang];
    if (bcp47) utterance.lang = bcp47;
    speechSynthesis.speak(utterance);
  }

  const parsedRelated = parseRelatedWords(enrichment?.relatedWords);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">
          {t("translate.title")}
        </h1>
        <p className="text-muted-foreground mt-2">{t("translate.subtitle")}</p>
      </div>

      {/* Translation panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source panel */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger className="w-full max-w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    {t("translate.autoDetect")}
                  </SelectItem>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sourceText.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    // Pick the best signal for the source language:
                    // explicit user choice first, then auto-detected result.
                    const lang =
                      sourceLanguage !== "auto"
                        ? sourceLanguage
                        : result?.language;
                    speakText(sourceText, lang ?? "");
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t("translate.listen")}
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <Textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("translate.sourcePlaceholder")}
              className="min-h-[200px] resize-none border-0 shadow-none focus-visible:ring-0 p-3 text-lg"
            />

            {/* Context input */}
            <div>
              <button
                type="button"
                onClick={() => setShowContext(!showContext)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {t("translate.addContext")}
              </button>
              {showContext && (
                <Textarea
                  value={surroundingContext}
                  onChange={(e) => setSurroundingContext(e.target.value)}
                  placeholder={t("translate.contextPlaceholder")}
                  className="mt-2 min-h-[60px] resize-none text-sm"
                />
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {sourceText.length > 0 && `${sourceText.length} chars`}
              </span>
              <Button
                onClick={handleTranslate}
                disabled={isTranslating || !sourceText.trim()}
              >
                {isTranslating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isTranslating
                  ? t("translate.translating")
                  : t("translate.translateButton")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Target panel */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger className="w-full max-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="min-h-[200px]">
              {isTranslating && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t("translate.translating")}</span>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {result && (
                <div className="space-y-3">
                  <p className="text-lg">{result.contextualTranslation}</p>
                </div>
              )}

              {!isTranslating && !result && !error && (
                <p className="text-muted-foreground text-sm">
                  {t("translate.translation")}
                </p>
              )}
            </div>

            {result && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={saveState === "saving" || saveState === "saved"}
                >
                  {saveState === "saved" ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {t("translate.saved")}
                    </>
                  ) : saveState === "error" ? (
                    t("translate.saveFailed")
                  ) : (
                    <>
                      <Bookmark className="h-3.5 w-3.5 mr-1" />
                      {t("translate.saveToVocabulary")}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rich details — on-demand enrichment */}
      {result && (
        <Card>
          <CardContent className="p-4">
            <button
              onClick={() => {
                const next = !showMore;
                setShowMore(next);
                if (next) handleEnrich();
              }}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {showMore ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {t("translate.moreDetails")}
            </button>

            {showMore && (
              <div className="mt-4 space-y-4">
                {isEnriching && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">{t("translate.translating")}</span>
                  </div>
                )}

                {enrichment && (
                  <>
                    {enrichment.phoneticApproximation && (
                      <DetailItem
                        label={t("translate.pronunciation")}
                        value={enrichment.phoneticApproximation}
                      />
                    )}
                    {enrichment.fixedExpression &&
                      enrichment.fixedExpression !== "no" && (
                        <DetailItem
                          label={t("translate.expression")}
                          value={enrichment.fixedExpression}
                        />
                      )}
                    {enrichment.commonUsage && enrichment.commonUsage !== "no" && (
                      <DetailItem
                        label={t("translate.usageNote")}
                        value={enrichment.commonUsage}
                      />
                    )}
                    {enrichment.grammarRules && (
                      <DetailItem
                        label={t("translate.grammar")}
                        value={enrichment.grammarRules}
                      />
                    )}
                    {enrichment.commonness &&
                      (() => {
                        /** Localize enum/numeric values; fall back to raw for unmappable legacy rows. */
                        const key = normalizeFrequency(enrichment.commonness);
                        const display = key ? t(key) : enrichment.commonness;
                        return (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                              {t("translate.frequency")}
                            </p>
                            <Badge variant="secondary">{display}</Badge>
                          </div>
                        );
                      })()}
                    {parsedRelated.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                          {t("translate.relatedWords")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {parsedRelated.map((r, i) => (
                            <Badge key={i} variant="outline">
                              {r.word} — {r.translation}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Renders a labeled detail row in the enrichment panel. */
function DetailItem({ label, value }: { label: string; value: string | Record<string, unknown> }) {
  /** LLM may return a structured object instead of a string — flatten it for display. */
  const display =
    typeof value === 'string'
      ? value
      : Object.entries(value)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}: ${v}`)
          .join(', ');

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-sm">{display}</p>
    </div>
  );
}
