"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload } from "lucide-react";
import ExportButton from "@/components/dashboard/ExportButton";
import ImportDialog from "@/components/dashboard/ImportDialog";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function ImportExportPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("importExport.title")}</h1>
        <p className="text-muted-foreground">
          {t("importExport.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="size-5 text-muted-foreground" />
              {t("importExport.export")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {t("importExport.exportDesc")}
            </p>
            <ExportButton />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-5 text-muted-foreground" />
              {t("importExport.import")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {t("importExport.importDesc")}
            </p>
            <ImportDialog />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
