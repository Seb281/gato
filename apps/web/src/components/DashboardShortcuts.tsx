"use client";

import { useDashboardShortcuts } from "@/hooks/useDashboardShortcuts";

/**
 * Registers dashboard keyboard shortcuts.
 * Renders nothing — side-effects only.
 */
export default function DashboardShortcuts() {
  useDashboardShortcuts();
  return null;
}
