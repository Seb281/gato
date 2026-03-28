"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type ImportConcept = {
  concept: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  state?: string;
  userNotes?: string | null;
};

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
  total: number;
};

function parseCSV(text: string): ImportConcept[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Skip header row
  const header = lines[0]!.toLowerCase();
  const hasHeader =
    header.includes("concept") || header.includes("translation");

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const concepts: ImportConcept[] = [];

  for (const line of dataLines) {
    // Parse CSV respecting quoted fields
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    if (fields.length >= 4) {
      concepts.push({
        concept: fields[0]!,
        translation: fields[1]!,
        sourceLanguage: fields[2]!,
        targetLanguage: fields[3]!,
        state: fields[4] || undefined,
        userNotes: fields[5] || undefined,
      });
    }
  }

  return concepts;
}

export default function ImportDialog({ onComplete }: { onComplete?: () => void }) {
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportConcept[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setPreview([]);
    setFileName("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setFileName(file.name);

    const text = await file.text();

    if (file.name.endsWith(".json")) {
      try {
        const data = JSON.parse(text);
        const concepts = Array.isArray(data) ? data : data.concepts ?? [];
        setPreview(concepts);
      } catch {
        setPreview([]);
      }
    } else {
      // CSV
      setPreview(parseCSV(text));
    }
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setImporting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/saved-concepts/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ concepts: preview }),
      });

      if (res.ok) {
        const data: ImportResult = await res.json();
        setResult(data);
        onComplete?.();
      }
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="size-4 mr-2" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Vocabulary</DialogTitle>
          <DialogDescription>
            Upload a CSV or JSON file. Duplicates are automatically skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileChange}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
          />

          {preview.length > 0 && !result && (
            <>
              <div className="rounded-md border p-3 max-h-48 overflow-y-auto">
                <p className="text-sm font-medium mb-2">
                  Preview ({preview.length} items from {fileName})
                </p>
                <div className="space-y-1">
                  {preview.slice(0, 10).map((c, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {c.concept}
                      </span>{" "}
                      &rarr; {c.translation}{" "}
                      <span className="text-muted-foreground/60">
                        ({c.sourceLanguage} &rarr; {c.targetLanguage})
                      </span>
                    </p>
                  ))}
                  {preview.length > 10 && (
                    <p className="text-xs text-muted-foreground italic">
                      ...and {preview.length - 10} more
                    </p>
                  )}
                </div>
              </div>

              <Button
                onClick={handleImport}
                disabled={importing}
                className="w-full"
              >
                {importing ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="size-4 mr-2" />
                    Import {preview.length} items
                  </>
                )}
              </Button>
            </>
          )}

          {result && (
            <div className="rounded-md border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-500" />
                <p className="font-medium">Import Complete</p>
              </div>
              <div className="text-sm space-y-1">
                <p>
                  <span className="font-medium">{result.imported}</span>{" "}
                  imported
                </p>
                {result.skipped > 0 && (
                  <p>
                    <span className="font-medium">{result.skipped}</span>{" "}
                    skipped (duplicates)
                  </p>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-1 text-sm text-destructive">
                    <AlertCircle className="size-4" />
                    <span>{result.errors.length} errors</span>
                  </div>
                  <div className="mt-1 max-h-24 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive">
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                className="mt-2"
              >
                Import another file
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
