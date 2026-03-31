"use client";

import { Check } from "lucide-react";

interface GoalRingProps {
  current: number;
  goal: number;
  size?: number;
}

export default function GoalRing({ current, goal, size = 120 }: GoalRingProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / Math.max(goal, 1), 1);
  const offset = circumference * (1 - progress);
  const goalMet = current >= goal;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={goalMet ? "stroke-emerald-500" : "stroke-primary"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {goalMet ? (
          <>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold">
                {current}/{goal}
              </span>
              <Check className="size-5 text-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground">today</span>
          </>
        ) : (
          <>
            <span className="text-2xl font-bold">
              {current}/{goal}
            </span>
            <span className="text-xs text-muted-foreground">today</span>
          </>
        )}
      </div>
    </div>
  );
}
