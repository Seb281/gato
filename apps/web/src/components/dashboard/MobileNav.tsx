"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  BarChart3,
  Menu,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Tags, ArrowUpDown, Settings, LogOut, Languages, MessageSquare } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

const TABS = [
  { labelKey: "nav.home", icon: LayoutDashboard, href: "/dashboard" },
  { labelKey: "nav.words", icon: BookOpen, href: "/dashboard/vocabulary" },
  { labelKey: "nav.review", icon: GraduationCap, href: "/dashboard/review" },
  { labelKey: "nav.progress", icon: BarChart3, href: "/dashboard/progress" },
];

const MORE_ITEMS = [
  { labelKey: "nav.translate", icon: Languages, href: "/dashboard/translate" },
  { labelKey: "nav.tags", icon: Tags, href: "/dashboard/tags" },
  { labelKey: "nav.feedback", icon: MessageSquare, href: "/feedback" },
];

const SETTINGS_ITEMS = [
  { labelKey: "nav.settings", icon: Settings, href: "/dashboard/settings" },
  { labelKey: "nav.importExport", icon: ArrowUpDown, href: "/dashboard/import-export" },
];

export default function MobileNav({
  signOutAction,
}: {
  signOutAction: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Hide mobile nav during review session
  if (pathname.startsWith("/dashboard/review/session")) return null;

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const moreActive = [...MORE_ITEMS, ...SETTINGS_ITEMS].some((item) => isActive(item.href));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl">
      <div className="flex items-center justify-around h-14">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors",
              isActive(tab.href)
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            <tab.icon className="size-5" />
            {t(tab.labelKey)}
          </Link>
        ))}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors",
                moreActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Menu className="size-5" />
              {t("nav.more")}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-safe">
            <SheetTitle className="sr-only">{t("nav.navigation")}</SheetTitle>
            <div className="space-y-1 py-2">
              {MORE_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                    isActive(item.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <item.icon className="size-5" />
                  {t(item.labelKey)}
                </Link>
              ))}

              <div className="h-px bg-border/40 my-2" />

              {SETTINGS_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                    isActive(item.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <item.icon className="size-5" />
                  {t(item.labelKey)}
                </Link>
              ))}

              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground w-full"
                  onClick={() => setOpen(false)}
                >
                  <LogOut className="size-5" />
                  {t("nav.signOut")}
                </button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
