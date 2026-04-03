"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import TagManager from "@/components/dashboard/TagManager";

export default function TagsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("tags.title")}</h1>
        <p className="text-muted-foreground">
          {t("tags.subtitle")}
        </p>
      </div>
      <TagManager />
    </div>
  );
}
