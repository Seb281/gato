"use client";

/**
 * Mounts dashboard keyboard shortcuts and the keyboard shortcuts help modal.
 * The hook has no DOM output; the modal is a controlled Dialog toggled by "?".
 */

import { useState } from "react";
import { useDashboardShortcuts } from "@/hooks/useDashboardShortcuts";
import KeyboardShortcutsHelp from "@/components/dashboard/KeyboardShortcutsHelp";

export default function DashboardShortcuts() {
  const [helpOpen, setHelpOpen] = useState(false);

  useDashboardShortcuts({ onOpenHelp: () => setHelpOpen(true) });

  return <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />;
}
