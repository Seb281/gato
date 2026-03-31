"use client";

import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { createElement } from "react";

type MilestoneStats = {
  totalConcepts?: number;
  totalReviewed?: number;
  currentStreak?: number;
  conceptsByState?: { new?: number; learning?: number; familiar?: number; mastered?: number };
  lastSessionAccuracy?: number;
};

type MilestoneDefinition = {
  id: string;
  check: (s: MilestoneStats) => boolean;
  title: string;
  description: string;
};

const milestones: MilestoneDefinition[] = [
  {
    id: "first-10",
    check: (s) => (s.totalConcepts ?? 0) >= 10,
    title: "First 10 Words!",
    description: "Your vocabulary is growing.",
  },
  {
    id: "first-review",
    check: (s) => (s.totalReviewed ?? 0) >= 1,
    title: "First Review!",
    description: "Spaced repetition has begun.",
  },
  {
    id: "streak-7",
    check: (s) => (s.currentStreak ?? 0) >= 7,
    title: "7-Day Streak!",
    description: "A full week of learning.",
  },
  {
    id: "streak-30",
    check: (s) => (s.currentStreak ?? 0) >= 30,
    title: "30-Day Streak!",
    description: "Unstoppable.",
  },
  {
    id: "mastered-10",
    check: (s) => (s.conceptsByState?.mastered ?? 0) >= 10,
    title: "10 Words Mastered!",
    description: "They're part of you now.",
  },
  {
    id: "mastered-50",
    check: (s) => (s.conceptsByState?.mastered ?? 0) >= 50,
    title: "50 Words Mastered!",
    description: "Seriously impressive.",
  },
  {
    id: "perfect-session",
    check: (s) => s.lastSessionAccuracy === 100,
    title: "Perfect Session!",
    description: "Not a single mistake.",
  },
];

function isMilestoneSeen(id: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(`milestone-seen-${id}`) === "true";
}

function markMilestoneSeen(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`milestone-seen-${id}`, "true");
}

export function checkMilestones(stats: MilestoneStats): void {
  for (const milestone of milestones) {
    if (milestone.check(stats) && !isMilestoneSeen(milestone.id)) {
      markMilestoneSeen(milestone.id);
      toast(milestone.title, {
        description: milestone.description,
        icon: createElement(Trophy, { className: "size-5 text-amber-500" }),
        duration: 5000,
      });
    }
  }
}
