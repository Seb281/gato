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
import {
  Trash2,
  Loader2,
  BookOpen,
  Search,
  Volume2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import ConceptNotes from "./ConceptNotes";
import MasteryBadge from "./MasteryBadge";
import TagBadge from "./TagBadge";
import TagSelector from "./TagSelector";

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
  createdAt: string;
  state: string;
  updatedAt: string;
};

const PAGE_SIZE = 30;

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

  // Distinct language pairs for filter dropdown
  const [languagePairs, setLanguagePairs] = useState<string[]>([]);

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
        }
        if (tagsRes.ok) {
          const data = await tagsRes.json();
          setAllTags(data.tags);
        }
      } catch (error) {
        console.error("Failed to fetch filters:", error);
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
      }
    } catch (error) {
      console.error("Failed to fetch concepts:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, API_URL, debouncedSearch, languageFilter, stateFilter, tagFilter, sortBy, sortOrder, page]);

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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "concept" : "concepts"} found
      </p>

      {/* Concept Cards */}
      {concepts.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted">
              <BookOpen className="size-8 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-lg font-medium">
            {debouncedSearch || languageFilter !== "all" || stateFilter !== "all" || tagFilter !== "all"
              ? "No matching concepts"
              : "No saved concepts yet"}
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {debouncedSearch || languageFilter !== "all" || stateFilter !== "all" || tagFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Start using the Context Translator extension to save words and phrases you want to learn."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {concepts.map((concept) => (
            <Card
              key={concept.id}
              className="relative group cursor-pointer"
              onClick={() =>
                setExpandedId(
                  expandedId === concept.id ? null : concept.id
                )
              }
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="text-xs font-normal">
                    {concept.sourceLanguage} &rarr; {concept.targetLanguage}
                  </Badge>
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
                    <Volume2 className="size-3.5 shrink-0" />
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
                  <div className="pt-2 border-t space-y-3 animate-in fade-in duration-200">
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
                        <p className="text-xs font-medium text-muted-foreground">Usage</p>
                        <p className="text-sm">{concept.commonUsage}</p>
                      </div>
                    )}

                    {concept.grammarRules && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Grammar</p>
                        <p className="text-sm">{concept.grammarRules}</p>
                      </div>
                    )}

                    {concept.commonness && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Commonness</p>
                        <p className="text-sm">{concept.commonness}</p>
                      </div>
                    )}

                    {concept.fixedExpression && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Expression</p>
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
                      <p className="text-xs font-medium text-muted-foreground">Tags</p>
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
