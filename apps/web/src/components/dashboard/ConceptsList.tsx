"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
} from "lucide-react";
import { format } from "date-fns";
import { languageToBCP47 } from "@/lib/languageCodes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  label: string;
} {
  if (!nextReviewAt) {
    return { color: "bg-neutral-400", label: "Never reviewed" };
  }

  const now = new Date();
  const reviewDate = new Date(nextReviewAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  if (reviewDate < startOfToday) {
    return { color: "bg-red-500", label: "Overdue" };
  }
  if (reviewDate < endOfToday) {
    return { color: "bg-amber-500", label: "Due today" };
  }
  return { color: "bg-emerald-500", label: "Up to date" };
}

export default function ConceptsList() {
  const supabase = createClient();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
          Something went wrong loading data. Check your connection and try refreshing.
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search words or translations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {languagePairs.length > 0 && (
            <Select value={languageFilter} onValueChange={(v) => { setLanguageFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All languages</SelectItem>
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
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="learning">Learning</SelectItem>
              <SelectItem value="familiar">Familiar</SelectItem>
              <SelectItem value="mastered">Mastered</SelectItem>
            </SelectContent>
          </Select>
          {allTags.length > 0 && (
            <Select value={tagFilter} onValueChange={(v) => { setTagFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
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
              <SelectItem value="all">All review</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due-today">Due today</SelectItem>
              <SelectItem value="reviewed">Up to date</SelectItem>
              <SelectItem value="new">Never reviewed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={`${sortBy}-${sortOrder}`} onValueChange={(v) => { const [by, order] = v.split("-"); setSortBy(by as "date" | "alpha"); setSortOrder(order as "asc" | "desc"); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest first</SelectItem>
              <SelectItem value="date-asc">Oldest first</SelectItem>
              <SelectItem value="alpha-asc">A &rarr; Z</SelectItem>
              <SelectItem value="alpha-desc">Z &rarr; A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {hasSelection && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={selectAll}
            >
              Select All
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
                  Change State
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[160px] p-1" align="end">
                <div className="flex flex-col">
                  {[
                    { value: "new", label: "New", dotClass: "bg-neutral-400" },
                    { value: "learning", label: "Learning", dotClass: "bg-blue-400" },
                    { value: "familiar", label: "Familiar", dotClass: "bg-amber-400" },
                    { value: "mastered", label: "Mastered", dotClass: "bg-emerald-400" },
                  ].map((level) => (
                    <button
                      key={level.value}
                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleBulkStateChange(level.value)}
                    >
                      <span className={`size-2 rounded-full ${level.dotClass}`} />
                      {level.label}
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
                    Add Tag
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
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete {selectedIds.size} {selectedIds.size === 1 ? "concept" : "concepts"}?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. The selected concepts will be permanently removed.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkLoading}>
                    {bulkLoading && <Loader2 className="size-4 animate-spin mr-2" />}
                    Delete
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
          {total} {total === 1 ? "concept" : "concepts"} found
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
              ? "No matching concepts"
              : "No saved concepts yet"}
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {debouncedSearch || languageFilter !== "all" || stateFilter !== "all" || tagFilter !== "all" || reviewStatusFilter !== "all"
              ? "No matching concepts. Try a different search term or clear your filters."
              : "Install the browser extension, select any text on a webpage, and right-click \u2192 Translate to start building your vocabulary."}
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
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {concepts.map((concept) => (
            <Card
              key={concept.id}
              className={`relative group cursor-pointer ${selectedIds.has(concept.id) ? "ring-2 ring-primary" : ""}`}
              onClick={() =>
                setExpandedId(
                  expandedId === concept.id ? null : concept.id
                )
              }
            >
              <div
                className={`absolute top-3 left-3 z-10 transition-opacity ${hasSelection ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selectedIds.has(concept.id)}
                  onCheckedChange={() => toggleSelect(concept.id)}
                />
              </div>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs font-normal">
                      {concept.sourceLanguage} &rarr; {concept.targetLanguage}
                    </Badge>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={`${getReviewStatus(concept.nextReviewAt).color} size-2 rounded-full inline-block shrink-0`}
                            aria-label={getReviewStatus(concept.nextReviewAt).label}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {getReviewStatus(concept.nextReviewAt).label}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
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
                </div>
                <CardTitle className="text-xl leading-tight">
                  {concept.concept}
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
                    <Volume2
                      className={`size-3.5 shrink-0 cursor-pointer transition-colors ${speakingId === concept.id ? "text-primary" : "hover:text-foreground"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeak(concept.id, concept.concept, concept.sourceLanguage);
                      }}
                    />
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
                {expandedId === concept.id && (
                  <div className="pt-3 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Status:
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
                        <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Usage</p>
                        <p className="text-sm">{concept.commonUsage}</p>
                      </div>
                    )}

                    {concept.grammarRules && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Grammar</p>
                        <p className="text-sm">{concept.grammarRules}</p>
                      </div>
                    )}

                    {concept.commonness && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Commonness</p>
                        <p className="text-sm">{concept.commonness}</p>
                      </div>
                    )}

                    {concept.fixedExpression && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Expression</p>
                        <p className="text-sm">{concept.fixedExpression}</p>
                      </div>
                    )}

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
                      <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Tags</p>
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
                      Last updated{" "}
                      {format(new Date(concept.updatedAt), "MMM d, yyyy")}
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
            Page {page} of {totalPages}
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
