"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Registers keyboard shortcuts for dashboard navigation.
 *
 * Two-key combos (g → key within 500ms):
 *   g → h  Navigate to /dashboard
 *   g → v  Navigate to /dashboard/vocabulary
 *   g → r  Navigate to /dashboard/review
 *   g → p  Navigate to /dashboard/progress
 *   g → s  Navigate to /dashboard/settings
 *
 * Single-key shortcuts:
 *   /       Focus the search input (element with data-search-input attribute)
 *   Escape  Blur the active element
 *   ?       Invoke options.onOpenHelp (typically opens the shortcuts help modal)
 *
 * All shortcuts are suppressed when focus is inside an input, textarea, or
 * contenteditable element.
 */
export function useDashboardShortcuts(options?: { onOpenHelp?: () => void }) {
  const router = useRouter();
  const [firstKey, setFirstKey] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onOpenHelp = options?.onOpenHelp;

  useEffect(() => {
    function clearFirstKey() {
      setFirstKey(null);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable;

      if (isEditable) {
        // Still allow Escape to blur out of inputs
        if (e.key === "Escape") {
          (target as HTMLElement).blur();
        }
        return;
      }

      // Handle second key of g-combo
      if (firstKey === "g") {
        const DESTINATIONS: Record<string, string> = {
          h: "/dashboard",
          v: "/dashboard/vocabulary",
          r: "/dashboard/review",
          p: "/dashboard/progress",
          s: "/dashboard/settings",
        };

        if (e.key in DESTINATIONS) {
          e.preventDefault();
          router.push(DESTINATIONS[e.key]);
        }

        clearFirstKey();
        return;
      }

      // Handle first key
      if (e.key === "g") {
        setFirstKey("g");
        // Reset after 500ms if no second key is pressed
        timeoutRef.current = setTimeout(() => {
          setFirstKey(null);
          timeoutRef.current = null;
        }, 500);
        return;
      }

      if (e.key === "/") {
        const searchInput = document.querySelector<HTMLElement>(
          "[data-search-input]"
        );
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        onOpenHelp?.();
        return;
      }

      if (e.key === "Escape") {
        const active = document.activeElement as HTMLElement | null;
        active?.blur();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
    // firstKey must be in deps so the closure always reads the latest value
  }, [firstKey, router, onOpenHelp]);
}
