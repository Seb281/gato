"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

type ConceptNotesProps = {
  conceptId: number;
  userNotes: string | null;
  exampleSentence: string | null;
  onUpdate: (fields: {
    userNotes?: string | null;
    exampleSentence?: string | null;
  }) => void;
};

export default function ConceptNotes({
  conceptId,
  userNotes,
  exampleSentence,
  onUpdate,
}: ConceptNotesProps) {
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [notes, setNotes] = useState(userNotes ?? "");
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if parent updates
  useEffect(() => {
    setNotes(userNotes ?? "");
  }, [userNotes]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleNotesChange(value: string) {
    setNotes(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNotes(value);
    }, 500);
  }

  async function saveNotes(value: string) {
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/saved-concepts/${conceptId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userNotes: value || null }),
      });

      if (res.ok) {
        onUpdate({ userNotes: value || null });
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleSuggestExample() {
    setSuggesting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${API_URL}/saved-concepts/${conceptId}/suggest-example`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        onUpdate({ exampleSentence: data.exampleSentence });
      }
    } catch (error) {
      console.error("Failed to suggest example:", error);
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      {/* Personal Notes */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">
            Personal Notes
          </p>
          {saving && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
        </div>
        <Textarea
          id="concept-notes"
          name="notes"
          placeholder="Add your own notes..."
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          className="min-h-[60px] resize-none text-sm"
          rows={2}
        />
      </div>

      {/* Example Sentence */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">
            Example Sentence
          </p>
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
        {exampleSentence ? (
          <p className="text-sm bg-secondary/50 rounded-lg p-3 italic">
            {exampleSentence}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No example yet. Click &quot;AI Suggest&quot; to generate one.
          </p>
        )}
      </div>
    </div>
  );
}
