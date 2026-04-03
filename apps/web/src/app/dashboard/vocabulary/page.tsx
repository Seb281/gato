"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import ConceptsList from "@/components/dashboard/ConceptsList";

export default function VocabularyPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("vocabulary.title")}</h1>
        <p className="text-muted-foreground">
          {t("vocabulary.subtitle")}
        </p>
      </div>
      <ConceptsList />
    </div>
  );
}
