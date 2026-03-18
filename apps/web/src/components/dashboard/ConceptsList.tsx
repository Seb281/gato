"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, BookOpen } from "lucide-react";
import { format } from "date-fns";

type Concept = {
  id: number;
  concept: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: string;
  state: string;
  updatedAt: string;
};

export default function ConceptsList() {
  const supabase = createClient();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    async function fetchConcepts() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const token = session.access_token;

        const res = await fetch(`${API_URL}/saved-concepts`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setConcepts(data.concepts);
        }
      } catch (error) {
        console.error("Failed to fetch concepts:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchConcepts();
  }, [supabase, API_URL]);

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn("No token available for delete request");
        return;
      }

      const token = session.access_token;

      const res = await fetch(`${API_URL}/saved-concepts/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setConcepts((prev) => prev.filter((c) => c.id !== id));
      } else {
        const errorData = await res.json();
        console.error("Failed to delete concept:", res.status, errorData);
      }
    } catch (error) {
      console.error("Failed to delete concept:", error);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (concepts.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-muted">
            <BookOpen className="size-8 text-muted-foreground" />
          </div>
        </div>
        <h3 className="text-lg font-medium">No saved concepts yet</h3>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Start using the Context Translator extension to save words and phrases you want to learn.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {concepts.map((concept) => (
        <Card
          key={concept.id}
          className="relative group cursor-pointer"
          onClick={() => setExpandedId(expandedId === concept.id ? null : concept.id)}
        >
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <Badge variant="outline" className="text-xs font-normal">
                {concept.sourceLanguage} → {concept.targetLanguage}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleDelete(concept.id); }}
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
            <p className="text-xs text-muted-foreground text-right">
              Saved {format(new Date(concept.createdAt), "MMM d, yyyy")}
            </p>
            {expandedId === concept.id && (
              <div className="pt-2 border-t space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <Badge
                    variant={concept.state === "learned" ? "default" : "secondary"}
                    className="text-xs capitalize"
                  >
                    {concept.state}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last updated {format(new Date(concept.updatedAt), "MMM d, yyyy")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}