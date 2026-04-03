"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Trash2,
  Loader2,
  BookOpen,
  Search,
  Volume2,
  ChevronLeft,
  ChevronRight,
  X,
  Tags,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  Clock,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { format } from "date-fns";
import { languageToBCP47 } from "@/lib/languageCodes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n/useTranslation";
import ConceptNotes from "./ConceptNotes";
import MasteryBadge from "./MasteryBadge";
import TagBadge from "./TagBadge";
import TagSelector from "./TagSelector";
import ExportButton from "./ExportButton";

type Tag = {
  id: number;
  name: string;
  color: string;
};

type Concept = {
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
  relatedWords: string | null;
  userNotes: string | null;
  exampleSentence: string | null;
  tags: Tag[];
  nextReviewAt: string | null;
  createdAt: string;
  state: string;
  updatedAt: string;
};

const PAGE_SIZE = 30;

function getReviewStatus(nextReviewAt: string | null): {
  color: string;
  labelKey: string;
  icon: typeof AlertCircle;
} {
  if (!nextReviewAt) {
    return { color: "text-neutral-400", labelKey: "vocabulary.neverReviewed", icon: Circle };
  }

  const now = new Date();
  const reviewDate = new Date(nextReviewAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  if (reviewDate < startOfToday) {
    return { color: "text-red-500", labelKey: "vocabulary.overdue", icon: AlertCircle };
  }
  if (reviewDate < endOfToday) {
    return { color: "text-amber-500", labelKey: "vocabulary.dueToday", icon: Clock };
  }
  return { color: "text-emerald-500", labelKey: "vocabulary.upToDate", icon: CheckCircle2 };
}

export default function ConceptsList() {
  const supabase = createClient();
  const { t } = useTranslation();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Search/filter/sort state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "alpha">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Tags state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState("all");

  // Review status filter
  const [reviewStatusFilter, setReviewStatusFilter] = useState("all");

  // Distinct language pairs for filter dropdown
  const [languagePairs, setLanguagePairs] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  function handleSpeak(conceptId: number, text: string, sourceLanguage: string) {
    if (speakingId === conceptId) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const langCode = languageToBCP47[sourceLanguage];
    if (langCode) {
      utterance.lang = langCode;
    }
    setSpeakingId(conceptId);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    speechSynthesis.speak(utterance);
    setTimeout(() => setSpeakingId(null), 500);
  }

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch language pairs and tags once on mount
  useEffect(() => {
    async function fetchFilters() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const headers = { Authorization: `Bearer ${session.access_token}` };

        const [langRes, tagsRes] = await Promise.all([
          fetch(`${API_URL}/saved-concepts/languages`, { headers }),
          fetch(`${API_URL}/tags`, { headers }),
        ]);

        if (langRes.ok) {
          const data = await langRes.json();
          setLanguagePairs(data.languages);
        } else {
          setError(true);
        }
        if (tagsRes.ok) {
          const data = await tagsRes.json();
          setAllTags(data.tags);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to fetch filters:", err);
        setError(true);
      }
    }
    fetchFilters();
  }, [supabase, API_URL]);

  // Fetch concepts with search/filter/sort
  const fetchConcepts = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const token = session.access_token;

      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (languageFilter !== "all") params.set("language", languageFilter);
      if (stateFilter !== "all") params.set("state", stateFilter);
      if (tagFilter !== "all") params.set("tags", tagFilter);
      if (reviewStatusFilter !== "all") params.set("reviewStatus", reviewStatusFilter);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", page.toString());
      params.set("limit", PAGE_SIZE.toString());

      const res = await fetch(
        `${API_URL}/saved-concepts?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setConcepts(data.concepts);
        setTotal(data.total ?? data.concepts.length);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Failed to fetch concepts:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [supabase, API_URL, debouncedSearch, languageFilter, stateFilter, tagFilter, reviewStatusFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchConcepts();
  }, [fetchConcepts]);

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/saved-concepts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setConcepts((prev) => prev.filter((c) => c.id !== id));
        setTotal((prev) => prev - 1);
      }
    } catch (error) {
      console.error("Failed to delete concept:", error);
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(concepts.map((c) => c.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    setBulkLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/saved-concepts/bulk`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (res.ok) {
        clearSelection();
        setDeleteDialogOpen(false);
        fetchConcepts();
      }
    } catch (error) {
      console.error("Failed to bulk delete:", error);
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkStateChange(state: string) {
    setBulkLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/saved-concepts/bulk`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedIds), state }),
      });

      if (res.ok) {
        clearSelection();
        fetchConcepts();
      }
    } catch (error) {
      console.error("Failed to bulk update state:", error);
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkAddTag(tagId: number) {
    setBulkLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/saved-concepts/bulk`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedIds), addTagId: tagId }),
      });

      if (res.ok) {
        clearSelection();
        fetchConcepts();
      }
    } catch (error) {
      console.error("Failed to bulk add tag:", error);
    } finally {
      setBulkLoading(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasSelection = selectedIds.size > 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t("common.error")}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="concepts-search"
            name="search"
            placeholder={t("vocabulary.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-search-input
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {languagePairs.length > 0 && (
            <Select value={languageFilter} onValueChange={(v) => { setLanguageFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("vocabulary.allLanguages")}</SelectItem>
                {languagePairs.map((pair) => (
                  <SelectItem key={pair} value={pair}>
                    {pair.replace("->", " \u2192 ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("vocabulary.allStatus")}</SelectItem>
              <SelectItem value="new">{t("common.stateNew")}</SelectItem>
              <SelectItem value="learning">{t("common.stateLearning")}</SelectItem>
              <SelectItem value="familiar">{t("common.stateFamiliar")}</SelectItem>
              <SelectItem value="mastered">{t("common.stateMastered")}</SelectItem>
            </SelectContent>
          </Select>
          {allTags.length > 0 && (
            <Select value={tagFilter} onValueChange={(v) => { setTagFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("vocabulary.allTags")}</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id.toString()}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={reviewStatusFilter} onValueChange={(v) => { setReviewStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Review" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("vocabulary.allReview")}</SelectItem>
              <SelectItem value="overdue">{t("vocabulary.overdue")}</SelectItem>
              <SelectItem value="due-today">{t("vocabulary.dueToday")}</SelectItem>
              <SelectItem value="reviewed">{t("vocabulary.upToDate")}</SelectItem>
              <SelectItem value="new">{t("vocabulary.neverReviewed")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={`${sortBy}-${sortOrder}`} onValueChange={(v) => { const [by, order] = v.split("-"); setSortBy(by as "date" | "alpha"); setSortOrder(order as "asc" | "desc"); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">{t("vocabulary.newestFirst")}</SelectItem>
              <SelectItem value="date-asc">{t("vocabulary.oldestFirst")}</SelectItem>
              <SelectItem value="alpha-asc">{t("vocabulary.aToZ")}</SelectItem>
              <SelectItem value="alpha-desc">{t("vocabulary.zToA")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {hasSelection && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {t("vocabulary.selected", { count: selectedIds.size })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={selectAll}
            >
              {t("vocabulary.selectAll")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={clearSelection}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {/* Change State Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={bulkLoading}>
                  {t("vocabulary.changeState")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[160px] p-1" align="end">
                <div className="flex flex-col">
                  {[
                    { value: "new", labelKey: "common.stateNew", dotClass: "bg-neutral-400" },
                    { value: "learning", labelKey: "common.stateLearning", dotClass: "bg-blue-400" },
                    { value: "familiar", labelKey: "common.stateFamiliar", dotClass: "bg-amber-400" },
                    { value: "mastered", labelKey: "common.stateMastered", dotClass: "bg-emerald-400" },
                  ].map((level) => (
                    <button
                      key={level.value}
                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleBulkStateChange(level.value)}
                    >
                      <span className={`size-2 rounded-full ${level.dotClass}`} />
                      {t(level.labelKey)}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Add Tag Popover */}
            {allTags.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={bulkLoading}>
                    <Tags className="size-3" />
                    {t("vocabulary.addTag")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[180px] p-1" align="end">
                  <div className="flex flex-col">
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => handleBulkAddTag(tag.id)}
                      >
                        <span
                          className="size-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Delete with Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-7 text-xs" disabled={bulkLoading}>
                  {bulkLoading ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="size-3 mr-1" />
                  )}
                  {t("vocabulary.delete")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("vocabulary.deleteConfirmTitle", { count: selectedIds.size, concepts: selectedIds.size === 1 ? t("common.concept") : t("common.concepts") })}</DialogTitle>
                  <DialogDescription>
                    {t("vocabulary.deleteConfirmDesc")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                    {t("vocabulary.cancel")}
                  </Button>
                  <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkLoading}>
                    {bulkLoading && <Loader2 className="size-4 animate-spin mr-2" />}
                    {t("vocabulary.delete")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {/* Results count + Export */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("vocabulary.conceptsFound", { count: total, concepts: total === 1 ? t("common.concept") : t("common.concepts") })}
        </p>
        {total > 0 && <ExportButton />}
      </div>

      {/* Concept Cards */}
      {concepts.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted">
              {debouncedSearch || languageFilter !== "all" || stateFilter !== "all" || tagFilter !== "all"
                ? <Search className="size-8 text-muted-foreground" />
                : <BookOpen className="size-8 text-muted-foreground" />}
            </div>
          </div>
          <h3 className="text-lg font-medium">
            {debouncedSearch || languageFilter !== "all" || stateFilter !== "all" || tagFilter !== "all" || reviewStatusFilter !== "all"
              ? t("vocabulary.noMatchingConcepts")
              : t("vocabulary.noConceptsTitle")}
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {debouncedSearch || languageFilter !== "all" || stateFilter !== "all" || tagFilter !== "all" || reviewStatusFilter !== "all"
              ? t("vocabulary.noMatchingDesc")
              : t("vocabulary.noConceptsDesc")}
          </p>
          {(debouncedSearch || languageFilter !== "all" || stateFilter !== "all" || tagFilter !== "all" || reviewStatusFilter !== "all") && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
                setLanguageFilter("all");
                setStateFilter("all");
                setTagFilter("all");
                setReviewStatusFilter("all");
                setSortBy("date");
                setSortOrder("desc");
                setPage(1);
              }}
            >
              {t("vocabulary.clearFilters")}
            </Button>
          )}
        </div>
      ) : (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
          {concepts.map((concept) => (
            <Card
              key={concept.id}
              className={`relative group cursor-pointer break-inside-avoid ${selectedIds.has(concept.id) ? "ring-2 ring-primary" : ""}`}
              onClick={() =>
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(concept.id)) next.delete(concept.id);
                  else next.add(concept.id);
                  return next;
                })
              }
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs font-normal">
                      {concept.sourceLanguage} &rarr; {concept.targetLanguage}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(concept.id);
                      }}
                      disabled={deletingId === concept.id}
                    >
                      {deletingId === concept.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 transition-opacity ${selectedIds.has(concept.id) ? "text-blue-500 opacity-100" : "text-muted-foreground hover:text-blue-500 opacity-0 group-hover:opacity-100"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(concept.id);
                      }}
                      title="Select"
                    >
                      {selectedIds.has(concept.id) ? (
                        <CheckSquare className="size-4" />
                      ) : (
                        <Square className="size-4" />
                      )}
                    </Button>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={`${getReviewStatus(concept.nextReviewAt).color} inline-flex items-center justify-center size-8 shrink-0`}
                            aria-label={t(getReviewStatus(concept.nextReviewAt).labelKey)}
                          >
                            {(() => {
                              const StatusIcon = getReviewStatus(concept.nextReviewAt).icon;
                              return <StatusIcon className="size-4" />;
                            })()}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t(getReviewStatus(concept.nextReviewAt).labelKey)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <CardTitle className="text-xl leading-tight">
                  <Link
                    href={`/dashboard/vocabulary/${concept.id}`}
                    className="hover:underline underline-offset-4 transition-colors"
                    title="View concept details"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {concept.concept}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="font-medium text-foreground">
                    {concept.translation}
                  </p>
                </div>

                {/* Pronunciation preview (always visible if available) */}
                {concept.phoneticApproximation && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeak(concept.id, concept.concept, concept.sourceLanguage);
                      }}
                      title="Listen to pronunciation"
                      className={`inline-flex items-center justify-center shrink-0 rounded p-0.5 transition-colors ${speakingId === concept.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Volume2 className="size-3.5" />
                    </button>
                    <span className="italic">{concept.phoneticApproximation}</span>
                  </div>
                )}

                {/* Tags (always visible if any) */}
                {concept.tags && concept.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {concept.tags.map((tag) => (
                      <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-right">
                  Saved {format(new Date(concept.createdAt), "MMM d, yyyy")}
                </p>

                {/* Expanded details */}
                {expandedIds.has(concept.id) && (
                  <div className="pt-3 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t("vocabulary.statusLabel")}
                      </span>
                      <MasteryBadge
                        conceptId={concept.id}
                        state={concept.state}
                        onStateChange={(newState) => {
                          setConcepts((prev) =>
                            prev.map((c) =>
                              c.id === concept.id
                                ? { ...c, state: newState }
                                : c
                            )
                          );
                        }}
                      />
                    </div>

                    {concept.commonUsage && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">{t("vocabulary.usage")}</p>
                        <p className="text-sm">{concept.commonUsage}</p>
                      </div>
                    )}

                    {concept.grammarRules && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">{t("vocabulary.grammar")}</p>
                        <p className="text-sm">{concept.grammarRules}</p>
                      </div>
                    )}

                    {concept.commonness && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">{t("vocabulary.commonness")}</p>
                        <p className="text-sm">{concept.commonness}</p>
                      </div>
                    )}

                    {concept.fixedExpression && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">{t("vocabulary.expression")}</p>
                        <p className="text-sm">{concept.fixedExpression}</p>
                      </div>
                    )}

                    {(() => {
                      try {
                        const words = concept.relatedWords ? JSON.parse(concept.relatedWords) as Array<{ word: string; translation: string; relation: string }> : [];
                        if (words.length === 0) return null;
                        return (
                          <div className="space-y-1.5">
                            <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">{t("vocabulary.relatedWords")}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {words.map((rw, i) => (
                                <div key={i} className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-sm">
                                  <span className="font-medium">{rw.word}</span>
                                  <span className="text-muted-foreground">({rw.translation})</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1 py-0 ${
                                      rw.relation === 'synonym' ? 'border-blue-400 text-blue-600 dark:text-blue-400' :
                                      rw.relation === 'antonym' ? 'border-amber-400 text-amber-600 dark:text-amber-400' :
                                      'border-border text-muted-foreground'
                                    }`}
                                  >
                                    {rw.relation}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      } catch { return null; }
                    })()}

                    <ConceptNotes
                      conceptId={concept.id}
                      userNotes={concept.userNotes}
                      exampleSentence={concept.exampleSentence}
                      onUpdate={(fields) => {
                        setConcepts((prev) =>
                          prev.map((c) =>
                            c.id === concept.id
                              ? { ...c, ...fields }
                              : c
                          )
                        );
                      }}
                    />

                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">{t("vocabulary.tagsLabel")}</p>
                      <TagSelector
                        conceptId={concept.id}
                        assignedTags={concept.tags ?? []}
                        allTags={allTags}
                        onTagsChange={(tags) => {
                          setConcepts((prev) =>
                            prev.map((c) =>
                              c.id === concept.id
                                ? { ...c, tags }
                                : c
                            )
                          );
                        }}
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {t("vocabulary.lastUpdated", { date: format(new Date(concept.updatedAt), "MMM d, yyyy") })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("vocabulary.pageOf", { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
