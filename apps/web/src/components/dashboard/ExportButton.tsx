"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2 } from "lucide-react";

type ExportFormat = "csv" | "json" | "anki";

const FORMAT_LABELS: Record<ExportFormat, { label: string; ext: string }> = {
  csv: { label: "CSV (.csv)", ext: "csv" },
  json: { label: "JSON (.json)", ext: "json" },
  anki: { label: "Anki (.txt)", ext: "txt" },
};

export default function ExportButton() {
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const [exporting, setExporting] = useState(false);

  async function handleExport(format: ExportFormat) {
    setExporting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${API_URL}/saved-concepts/export?format=${format}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (!res.ok) {
        console.error("Export failed:", res.statusText);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vocabulary-export.${FORMAT_LABELS[format].ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          {exporting ? (
            <Loader2 className="size-4 animate-spin mr-2" />
          ) : (
            <Download className="size-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((format) => (
          <DropdownMenuItem key={format} onClick={() => handleExport(format)}>
            {FORMAT_LABELS[format].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
