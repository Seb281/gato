"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import TagManager from "@/components/dashboard/TagManager";

export default function TagsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">{t("tags.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("tags.subtitle")}
        </p>
      </div>
      <TagManager />
    </div>
  );
}
