"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { languageToBCP47 } from "@/lib/languageCodes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Volume2,
  BookOpen,
  MessageSquare,
  BarChart3,
  Sparkles,
  Hash,
  Loader2,
  Pencil,
  Check,
  X,
  Trash2,
  Calendar,
  Target,
  TrendingUp,
  Percent,
} from "lucide-react";
import { format } from "date-fns";
import MasteryBadge from "./MasteryBadge";
import TagBadge from "./TagBadge";
import TagSelector from "./TagSelector";

type Tag = {
  id: number;
  name: string;
  color: string;
};

type Schedule = {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  totalReviews: number;
  correctReviews: number;
};

type ConceptData = {
  id: number;
  concept: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  phoneticApproximation: string | null;
  commonUsage: string | null;
  grammarRules: string | null;
  commonness: string | null;
  fixedExpression: string | null;
  userNotes: string | null;
  exampleSentence: string | null;
  tags: Tag[];
  schedule: Schedule | null;
  createdAt: string;
  updatedAt: string;
  state: string;
};

type ConceptDetailProps = {
  conceptId: string;
};

export default function ConceptDetail({ conceptId }: ConceptDetailProps) {
  const router = useRouter();
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [concept, setConcept] = useState<ConceptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Translation edit state
  const [editingTranslation, setEditingTranslation] = useState(false);
  const [translationDraft, setTranslationDraft] = useState("");

  // Notes state
  const [notesDraft, setNotesDraft] = useState("");
  const [exampleDraft, setExampleDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingExample, setSavingExample] = useState(false);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exampleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Tags state
  const [allTags, setAllTags] = useState<Tag[]>([]);

  // Example suggestion
  const [suggesting, setSuggesting] = useState(false);

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  // Fetch concept data
  const fetchConcept = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const [conceptRes, tagsRes] = await Promise.all([
        fetch(`${API_URL}/saved-concepts/${conceptId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/tags`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (conceptRes.ok) {
        const data = await conceptRes.json();
        setConcept(data.concept);
        setNotesDraft(data.concept.userNotes ?? "");
        setExampleDraft(data.concept.exampleSentence ?? "");
      } else {
        setError(true);
      }

      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setAllTags(data.tags);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [API_URL, conceptId, getToken]);

  useEffect(() => {
    fetchConcept();
  }, [fetchConcept]);

  // Cleanup debounce timers
  useEffect(() => {
    return () => {
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
      if (exampleDebounceRef.current) clearTimeout(exampleDebounceRef.current);
    };
  }, []);

  // --- Handlers ---

  async function patchConcept(fields: Record<string, string | null>) {
    const token = await getToken();
    if (!token) return null;

    const res = await fetch(`${API_URL}/saved-concepts/${conceptId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(fields),
    });

    if (res.ok) {
      const data = await res.json();
      return data.concept;
    }
    return null;
  }

  async function handleTranslationSave() {
    if (!concept || translationDraft === concept.translation) {
      setEditingTranslation(false);
      return;
    }

    const updated = await patchConcept({ translation: translationDraft });
    if (updated) {
      setConcept((prev) => (prev ? { ...prev, translation: translationDraft } : prev));
    }
    setEditingTranslation(false);
  }

  function handleNotesChange(value: string) {
    setNotesDraft(value);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(async () => {
      setSavingNotes(true);
      const updated = await patchConcept({ userNotes: value || null });
      if (updated) {
        setConcept((prev) => (prev ? { ...prev, userNotes: value || null } : prev));
      }
      setSavingNotes(false);
    }, 500);
  }

  function handleExampleChange(value: string) {
    setExampleDraft(value);
    if (exampleDebounceRef.current) clearTimeout(exampleDebounceRef.current);
    exampleDebounceRef.current = setTimeout(async () => {
      setSavingExample(true);
      const updated = await patchConcept({ exampleSentence: value || null });
      if (updated) {
        setConcept((prev) => (prev ? { ...prev, exampleSentence: value || null } : prev));
      }
      setSavingExample(false);
    }, 500);
  }

  async function handleSuggestExample() {
    setSuggesting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(
        `${API_URL}/saved-concepts/${conceptId}/suggest-example`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setExampleDraft(data.exampleSentence);
        setConcept((prev) =>
          prev ? { ...prev, exampleSentence: data.exampleSentence } : prev
        );
      }
    } catch {
      console.error("Failed to suggest example");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/saved-concepts/${conceptId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push("/dashboard/vocabulary");
      }
    } catch {
      console.error("Failed to delete concept");
    } finally {
      setDeleting(false);
    }
  }

  function handleSpeak() {
    if (!concept) return;
    const utterance = new SpeechSynthesisUtterance(concept.concept);
    utterance.lang = languageToBCP47[concept.sourceLanguage] ?? concept.sourceLanguage;
    utterance.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  // --- Render ---

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !concept) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-sm text-muted-foreground">
          <Link
            href="/dashboard/vocabulary"
            className="hover:text-foreground transition-colors"
          >
            Vocabulary
          </Link>{" "}
          / ...
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center space-y-2">
          <p className="text-sm text-destructive">
            {error
              ? "Failed to load concept. Check your connection and try again."
              : "Concept not found."}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/vocabulary">Back to Vocabulary</Link>
          </Button>
        </div>
      </div>
    );
  }

  const accuracy =
    concept.schedule && concept.schedule.totalReviews > 0
      ? Math.round(
          (concept.schedule.correctReviews / concept.schedule.totalReviews) * 100
        )
      : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground">
        <Link
          href="/dashboard/vocabulary"
          className="hover:text-foreground transition-colors"
        >
          Vocabulary
        </Link>{" "}
        / {concept.concept}
      </div>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold">{concept.concept}</h1>
            <MasteryBadge
              conceptId={concept.id}
              state={concept.state}
              onStateChange={(newState) =>
                setConcept((prev) =>
                  prev ? { ...prev, state: newState } : prev
                )
              }
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-normal">
              {concept.sourceLanguage} &rarr; {concept.targetLanguage}
            </Badge>
          </div>

          {concept.phoneticApproximation && (
            <button
              onClick={handleSpeak}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Volume2 className="size-4 shrink-0" />
              <span className="italic">{concept.phoneticApproximation}</span>
            </button>
          )}
        </CardContent>
      </Card>

      {/* Translation Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Translation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editingTranslation ? (
            <div className="flex items-center gap-2">
              <Input
                value={translationDraft}
                onChange={(e) => setTranslationDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTranslationSave();
                  if (e.key === "Escape") {
                    setEditingTranslation(false);
                    setTranslationDraft(concept.translation);
                  }
                }}
                autoFocus
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleTranslationSave}
              >
                <Check className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setEditingTranslation(false);
                  setTranslationDraft(concept.translation);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div
              className="bg-primary/5 p-4 rounded-lg border border-primary/20 cursor-pointer group relative"
              onClick={() => {
                setTranslationDraft(concept.translation);
                setEditingTranslation(true);
              }}
            >
              <p className="font-medium text-foreground pr-8">
                {concept.translation}
              </p>
              <Pencil className="size-3.5 absolute top-4 right-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Card */}
      {(concept.grammarRules ||
        concept.commonUsage ||
        concept.commonness ||
        concept.fixedExpression) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {concept.grammarRules && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Grammar Rules
                  </span>
                </div>
                <p className="text-sm leading-relaxed pl-6">
                  {concept.grammarRules}
                </p>
              </div>
            )}

            {concept.commonUsage && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Common Usage
                  </span>
                </div>
                <p className="text-sm leading-relaxed pl-6">
                  {concept.commonUsage}
                </p>
              </div>
            )}

            {concept.commonness && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Commonness
                  </span>
                </div>
                <p className="text-sm leading-relaxed pl-6">
                  {concept.commonness}
                </p>
              </div>
            )}

            {concept.fixedExpression && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Fixed Expression
                  </span>
                </div>
                <p className="text-sm leading-relaxed pl-6">
                  {concept.fixedExpression}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium text-muted-foreground">
                Personal Notes
              </span>
              {savingNotes && (
                <span className="text-xs text-muted-foreground">Saving...</span>
              )}
            </div>
            <Textarea
              placeholder="Add your own notes..."
              value={notesDraft}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
              rows={3}
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium text-muted-foreground">
                Example Sentence
              </span>
              <div className="flex items-center gap-2">
                {savingExample && (
                  <span className="text-xs text-muted-foreground">
                    Saving...
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleSuggestExample}
                  disabled={suggesting}
                >
                  {suggesting ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3" />
                  )}
                  {suggesting ? "Generating..." : "AI Suggest"}
                </Button>
              </div>
            </div>
            <Textarea
              placeholder="Add an example sentence..."
              value={exampleDraft}
              onChange={(e) => handleExampleChange(e.target.value)}
              className="min-h-[60px] resize-none text-sm"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tags Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Tags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TagSelector
            conceptId={concept.id}
            assignedTags={concept.tags}
            allTags={allTags}
            onTagsChange={(tags) =>
              setConcept((prev) => (prev ? { ...prev, tags } : prev))
            }
          />
        </CardContent>
      </Card>

      {/* Review Stats Card */}
      {concept.schedule && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Review Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="size-3.5" />
                  <span className="text-xs">Next Review</span>
                </div>
                <p className="text-sm font-medium">
                  {format(
                    new Date(concept.schedule.nextReviewAt),
                    "MMM d, yyyy"
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Target className="size-3.5" />
                  <span className="text-xs">Ease Factor</span>
                </div>
                <p className="text-sm font-medium">
                  {concept.schedule.easeFactor.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="size-3.5" />
                  <span className="text-xs">Total Reviews</span>
                </div>
                <p className="text-sm font-medium">
                  {concept.schedule.totalReviews}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Percent className="size-3.5" />
                  <span className="text-xs">Accuracy</span>
                </div>
                <p className="text-sm font-medium">
                  {accuracy !== null ? `${accuracy}%` : "N/A"}
                </p>
              </div>
            </div>
            <Button asChild className="w-full">
              <Link href="/dashboard/review">Practice Now</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Section */}
      <div className="pt-2 pb-8">
        <Separator className="mb-6" />
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="size-4 mr-2" />
              Delete Concept
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete concept</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &ldquo;{concept.concept}&rdquo;?
                This action cannot be undone. All associated review data and tags
                will be removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="size-4 mr-2" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
