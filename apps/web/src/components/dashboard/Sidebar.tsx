"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Languages,
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  BarChart3,
  Tags,
  ArrowUpDown,
  Settings,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";

const NAV_ITEMS = [
  { labelKey: "nav.home", icon: LayoutDashboard, href: "/dashboard" },
  { labelKey: "nav.translate", icon: Languages, href: "/dashboard/translate" },
  { labelKey: "nav.vocabulary", icon: BookOpen, href: "/dashboard/vocabulary" },
  { labelKey: "nav.review", icon: GraduationCap, href: "/dashboard/review" },
  { labelKey: "nav.progress", icon: BarChart3, href: "/dashboard/progress" },
  { labelKey: "nav.tags", icon: Tags, href: "/dashboard/tags" },
];

/** Items nested under Settings — shown when settings section is expanded. */
const SETTINGS_CHILDREN = [
  { labelKey: "nav.importExport", icon: ArrowUpDown, href: "/dashboard/import-export" },
];

/** Paths that count as "inside settings" and auto-expand the group. */
const SETTINGS_PATHS = ["/dashboard/settings", "/dashboard/import-export"];

export default function Sidebar({
  userEmail,
  signOutAction,
}: {
  userEmail?: string;
  signOutAction: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("sidebar-collapsed") === "true"
      : false
  );
  const [settingsToggled, setSettingsToggled] = useState(false);

  /** Auto-expand settings group when navigating to a child route. */
  const isInSettingsPath = useMemo(
    () => SETTINGS_PATHS.some((p) => pathname.startsWith(p)),
    [pathname]
  );
  const settingsOpen = settingsToggled || isInSettingsPath;

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const settingsActive = SETTINGS_PATHS.some((p) => pathname.startsWith(p));

  /** Renders a single nav link, optionally wrapped in a tooltip when collapsed. */
  function renderNavLink(item: { labelKey: string; icon: React.ComponentType<{ className?: string }>; href: string }, indent = false) {
    const active = isActive(item.href);
    const label = t(item.labelKey);
    const link = (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          collapsed && "justify-center px-2",
          indent && !collapsed && "pl-9"
        )}
      >
        <item.icon className="size-4 shrink-0" />
        {!collapsed && <span>{label}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-sidebar border-r border-border/50 h-screen sticky top-0 transition-all duration-200",
          collapsed ? "w-16" : "w-[220px]"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 shrink-0 mb-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold min-w-0">
            <Image src="/cat-icon.png" alt="Gato" width={20} height={20} className="shrink-0" />
            {!collapsed && <span className="truncate text-sidebar-foreground tracking-tight">Gato</span>}
          </Link>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 py-1 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => renderNavLink(item))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 space-y-1 shrink-0 border-t border-border/40">
          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapse}
            className={cn("w-full text-muted-foreground hover:text-foreground", collapsed ? "justify-center" : "justify-start")}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <>
                <ChevronLeft className="size-4 mr-2" />
                {t("nav.collapse")}
              </>
            )}
          </Button>

          {/* Feedback */}
          {renderNavLink({ labelKey: "nav.feedback", icon: MessageSquare, href: "/feedback" })}

          {/* Settings group */}
          {collapsed ? (
            // Collapsed: single icon linking to settings
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/settings"
                  className={cn(
                    "flex items-center justify-center rounded-lg px-2 py-2 text-sm font-medium transition-all duration-150",
                    settingsActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Settings className="size-4 shrink-0" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{t("nav.settings")}</TooltipContent>
            </Tooltip>
          ) : (
            <>
              {/* Settings toggle */}
              <button
                type="button"
                onClick={() => setSettingsToggled((prev) => !prev)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 w-full",
                  settingsActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Settings className="size-4 shrink-0" />
                <span className="flex-1 text-left">{t("nav.settings")}</span>
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-150",
                    settingsOpen && "rotate-180"
                  )}
                />
              </button>

              {/* Settings children — revealed on expand */}
              {settingsOpen && (
                <div className="space-y-0.5">
                  {/* Settings page itself */}
                  <Link
                    href="/dashboard/settings"
                    className={cn(
                      "flex items-center gap-3 rounded-lg pl-9 pr-3 py-2 text-sm font-medium transition-all duration-150",
                      isActive("/dashboard/settings")
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <span>{t("nav.preferences")}</span>
                  </Link>

                  {/* Import/Export */}
                  {SETTINGS_CHILDREN.map((item) => renderNavLink(item, true))}

                  {/* User info */}
                  <div className="flex items-center gap-2 px-2 pl-9 py-1">
                    <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="size-3 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {userEmail}
                    </span>
                  </div>

                  {/* Sign out */}
                  <form action={signOutAction}>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="submit"
                      className="w-full justify-start pl-9 text-muted-foreground hover:text-foreground"
                    >
                      <LogOut className="size-4 shrink-0" />
                      <span className="ml-2">{t("nav.signOut")}</span>
                    </Button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
