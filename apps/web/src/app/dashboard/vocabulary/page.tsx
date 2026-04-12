"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import ConceptsList from "@/components/dashboard/ConceptsList";

export default function VocabularyPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">{t("vocabulary.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("vocabulary.subtitle")}
        </p>
      </div>
      <ConceptsList />
    </div>
  );
}
