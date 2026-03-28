"use client";

import { useState } from "react";
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
  { value: "new", label: "New", color: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
  { value: "learning", label: "Learning", color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  { value: "familiar", label: "Familiar", color: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { value: "mastered", label: "Mastered", color: "bg-green-100 text-green-700 hover:bg-green-200" },
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
      }
    } catch (error) {
      console.error("Failed to update mastery state:", error);
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
                  ? "bg-gray-400"
                  : level.value === "learning"
                    ? "bg-blue-500"
                    : level.value === "familiar"
                      ? "bg-amber-500"
                      : "bg-green-500"
              }`}
            />
            {level.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
