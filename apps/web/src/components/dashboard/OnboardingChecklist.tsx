"use client";

import { Rocket, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface OnboardingChecklistProps {
  totalConcepts: number;
  totalReviewed: number;
  onDismiss: () => void;
}

const steps = [
  { id: "install", label: "Install the extension", check: () => true },
  {
    id: "translate",
    label: "Translate your first word",
    check: (props: OnboardingChecklistProps) => props.totalConcepts > 0,
  },
  {
    id: "save",
    label: "Save a word to your vocabulary",
    check: (props: OnboardingChecklistProps) => props.totalConcepts > 0,
  },
  {
    id: "review",
    label: "Complete your first review",
    check: (props: OnboardingChecklistProps) => props.totalReviewed > 0,
  },
] as const;

export function OnboardingChecklist({
  totalConcepts,
  totalReviewed,
  onDismiss,
}: OnboardingChecklistProps) {
  const props = { totalConcepts, totalReviewed, onDismiss };
  const allComplete = steps.every((step) => step.check(props));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Rocket className="size-5 text-primary" />
          Get Started
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {steps.map((step) => {
            const checked = step.check(props);
            return (
              <div key={step.id} className="flex items-center gap-3 py-2">
                {checked ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
                <span className={checked ? "line-through text-muted-foreground" : ""}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {allComplete && (
          <p className="text-emerald-500 font-medium mt-4">
            You&apos;re all set!
          </p>
        )}

        <div className="mt-4 flex items-center gap-4">
          {allComplete && (
            <Button onClick={onDismiss}>Dismiss</Button>
          )}
          <button
            onClick={onDismiss}
            className="text-xs text-muted-foreground hover:underline"
          >
            Dismiss
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
