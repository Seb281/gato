"use client";

/**
 * Controlled help dialog listing every dashboard and quiz keyboard shortcut.
 * Rendered by DashboardShortcuts and toggled via the "?" key binding.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * A single key-combo pill rendered inside a shortcut row.
 * Accepts any node so callers can render sequences like `g` then `h`.
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground min-w-[1.5rem]">
      {children}
    </kbd>
  );
}

/**
 * One row of the shortcut table: a group of keys on the left, a label on the right.
 */
function ShortcutRow({
  keys,
  label,
}: {
  keys: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="flex items-center gap-1 flex-wrap">{keys}</div>
      <span className="text-sm text-muted-foreground text-right">{label}</span>
    </div>
  );
}

/**
 * Titled group of shortcut rows.
 */
function ShortcutSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y">{children}</div>
    </div>
  );
}

export default function KeyboardShortcutsHelp({
  open,
  onOpenChange,
}: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <ShortcutSection title={t("shortcuts.section.navigation")}>
            <ShortcutRow
              keys={
                <>
                  <Kbd>g</Kbd>
                  <Kbd>h</Kbd>
                </>
              }
              label={t("shortcuts.nav.home")}
            />
            <ShortcutRow
              keys={
                <>
                  <Kbd>g</Kbd>
                  <Kbd>v</Kbd>
                </>
              }
              label={t("shortcuts.nav.vocabulary")}
            />
            <ShortcutRow
              keys={
                <>
                  <Kbd>g</Kbd>
                  <Kbd>r</Kbd>
                </>
              }
              label={t("shortcuts.nav.review")}
            />
            <ShortcutRow
              keys={
                <>
                  <Kbd>g</Kbd>
                  <Kbd>p</Kbd>
                </>
              }
              label={t("shortcuts.nav.progress")}
            />
            <ShortcutRow
              keys={
                <>
                  <Kbd>g</Kbd>
                  <Kbd>s</Kbd>
                </>
              }
              label={t("shortcuts.nav.settings")}
            />
            <ShortcutRow
              keys={<Kbd>/</Kbd>}
              label={t("shortcuts.nav.focusSearch")}
            />
            <ShortcutRow
              keys={<Kbd>Esc</Kbd>}
              label={t("shortcuts.nav.blur")}
            />
          </ShortcutSection>

          <ShortcutSection title={t("shortcuts.section.quiz")}>
            <ShortcutRow
              keys={<Kbd>Space</Kbd>}
              label={t("shortcuts.quiz.reveal")}
            />
            <ShortcutRow
              keys={
                <>
                  <Kbd>1</Kbd>
                  <Kbd>2</Kbd>
                  <Kbd>3</Kbd>
                  <Kbd>4</Kbd>
                </>
              }
              label={t("shortcuts.quiz.rate")}
            />
            <ShortcutRow
              keys={<Kbd>Enter</Kbd>}
              label={t("shortcuts.quiz.submit")}
            />
          </ShortcutSection>

          <ShortcutSection title={t("shortcuts.section.help")}>
            <ShortcutRow
              keys={<Kbd>?</Kbd>}
              label={t("shortcuts.help.toggle")}
            />
          </ShortcutSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}
