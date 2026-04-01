"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import SettingsForm from "@/components/dashboard/SettingsForm";

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground">
          {t("settings.subtitle")}
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
