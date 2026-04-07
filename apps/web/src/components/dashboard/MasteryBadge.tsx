"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

const MASTERY_LEVELS = [
  { value: "new", label: "New", color: "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700" },
  { value: "learning", label: "Learning", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25" },
  { value: "familiar", label: "Familiar", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25" },
  { value: "mastered", label: "Mastered", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25" },
] as const;

type MasteryBadgeProps = {
  conceptId: number;
  state: string;
  onStateChange: (newState: string) => void;
};

export default function MasteryBadge({
  conceptId,
  state,
  onStateChange,
}: MasteryBadgeProps) {
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const [updating, setUpdating] = useState(false);

  const current = MASTERY_LEVELS.find((l) => l.value === state) ?? MASTERY_LEVELS[0];

  async function handleChange(newState: string) {
    if (newState === state) return;
    setUpdating(true);
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
        body: JSON.stringify({ state: newState }),
      });

      if (res.ok) {
        onStateChange(newState);
      } else {
        toast.error("Failed to update mastery level.");
      }
    } catch (error) {
      console.error("Failed to update mastery state:", error);
      toast.error("Failed to update mastery level.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={updating}>
        <button
          className="inline-flex items-center gap-1 focus:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <Badge className={`${current.color} border-0 text-xs capitalize cursor-pointer`}>
            {current.label}
            <ChevronDown className="size-3 ml-0.5" />
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {MASTERY_LEVELS.map((level) => (
          <DropdownMenuItem
            key={level.value}
            onClick={() => handleChange(level.value)}
            className="gap-2"
          >
            <span
              className={`inline-block size-2 rounded-full ${
                level.value === "new"
                  ? "bg-neutral-400"
                  : level.value === "learning"
                    ? "bg-blue-400"
                    : level.value === "familiar"
                      ? "bg-amber-400"
                      : "bg-emerald-400"
              }`}
            />
            {level.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
