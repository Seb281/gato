"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import SettingsForm from "@/components/dashboard/SettingsForm";

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">{t("settings.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("settings.subtitle")}
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
