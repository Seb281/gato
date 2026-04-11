"use client";

/**
 * Vocabulary import dialog with pluggable format parsers.
 *
 * Supports CSV and JSON (both self-describing — they carry source/target
 * language per row) as well as Anki TSV, Quizlet exports, and hand-typed
 * plain text (none of which carry language metadata — the user picks the
 * source/target languages once and they're stamped on every parsed row).
 *
 * The file stays a single component rather than splitting per-format for
 * two reasons: all tabs share the preview / import / result UI, and the
 * per-tab inputs are thin wrappers around a textarea plus an optional file
 * picker. Extracting would trade locality for ceremony.
 */

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  parseCsv,
  parseJson,
  parseAnkiTsv,
  parseQuizletTsv,
  parsePlainText,
  type ImportConceptItem,
  type LanguageDefaults,
} from "@/lib/import/parsers";

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
  total: number;
};

type FormatId = "csv" | "json" | "anki" | "quizlet" | "plain";

/**
 * Formats that don't carry language metadata in the file itself and therefore
 * need the user to pick source/target via the dialog's language selectors.
 */
const FORMATS_NEED_LANGUAGES: ReadonlySet<FormatId> = new Set([
  "anki",
  "quizlet",
  "plain",
]);

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Russian", "Japanese", "Chinese", "Korean", "Arabic", "Hindi",
  "Dutch", "Swedish", "Norwegian", "Danish", "Finnish", "Polish",
  "Turkish", "Greek", "Hebrew", "Thai", "Vietnamese", "Indonesian",
  "Malay", "Czech", "Slovak", "Hungarian", "Romanian", "Bulgarian",
];

/**
 * Dispatches to the right parser for the active format. Pure — takes the raw
 * text and the user-chosen language defaults, returns the parsed rows.
 */
function parseForFormat(
  format: FormatId,
  text: string,
  defaults: LanguageDefaults,
): ImportConceptItem[] {
  switch (format) {
    case "csv":
      return parseCsv(text);
    case "json":
      return parseJson(text);
    case "anki":
      return parseAnkiTsv(text, defaults);
    case "quizlet":
      return parseQuizletTsv(text, defaults);
    case "plain":
      return parsePlainText(text, defaults);
  }
}

export default function ImportDialog({ onComplete }: { onComplete?: () => void }) {
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<FormatId>("csv");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("English");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [preview, setPreview] = useState<ImportConceptItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  /**
   * Re-run the active parser whenever the raw text, format, or the picked
   * language defaults change. Derived state as an effect is fine here because
   * parsing is cheap and the inputs are user-driven (no render loops).
   */
  useEffect(() => {
    if (!rawText.trim()) {
      setPreview([]);
      return;
    }
    const defaults = { sourceLanguage, targetLanguage };
    setPreview(parseForFormat(format, rawText, defaults));
  }, [rawText, format, sourceLanguage, targetLanguage]);

  function resetInput() {
    setRawText("");
    setFileName("");
    setPreview([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetAll() {
    resetInput();
    setFormat("csv");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    setRawText(text);
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
      } else {
        toast.error("Import failed. Please check your file and try again.");
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Import failed. Please check your file and try again.");
    } finally {
      setImporting(false);
    }
  }

  const needsLanguages = FORMATS_NEED_LANGUAGES.has(format);
  const fileAccept = format === "json" ? ".json" : format === "csv" ? ".csv" : ".txt,.tsv";
  const textareaPlaceholder = placeholderFor(format);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetAll();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="size-4 mr-2" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Vocabulary</DialogTitle>
          <DialogDescription>
            Pick a format. Duplicates are automatically skipped.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <Tabs
            value={format}
            onValueChange={(v) => {
              setFormat(v as FormatId);
              resetInput();
            }}
            className="space-y-4"
          >
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="csv">CSV</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="anki">Anki</TabsTrigger>
              <TabsTrigger value="quizlet">Quizlet</TabsTrigger>
              <TabsTrigger value="plain">Plain text</TabsTrigger>
            </TabsList>

            <TabsContent value={format} className="space-y-4 mt-4">
              {needsLanguages && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Source language</Label>
                    <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {lang}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Target language</Label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {lang}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={fileAccept}
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
              />

              <div className="space-y-1">
                <Label className="text-xs">
                  ...or paste content{fileName ? ` (loaded: ${fileName})` : ""}
                </Label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={textareaPlaceholder}
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>
            </TabsContent>
          </Tabs>
        )}

        {preview.length > 0 && !result && (
          <div className="space-y-4">
            <div className="rounded-md bg-secondary p-3 max-h-40 overflow-y-auto">
              <p className="text-sm font-medium mb-2">
                Preview ({preview.length} items)
              </p>
              <div className="space-y-1">
                {preview.slice(0, 5).map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.concept}</span>{" "}
                    &rarr; {c.translation}{" "}
                    <span className="text-muted-foreground/60">
                      ({c.sourceLanguage || "?"} &rarr; {c.targetLanguage || "?"})
                    </span>
                  </p>
                ))}
                {preview.length > 5 && (
                  <p className="text-xs text-muted-foreground italic">
                    ...and {preview.length - 5} more
                  </p>
                )}
              </div>
            </div>

            <Button onClick={handleImport} disabled={importing} className="w-full">
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
          </div>
        )}

        {rawText.trim() && preview.length === 0 && !result && (
          <p className="text-xs text-destructive">
            Nothing parsed from this input. Check the format and delimiter.
          </p>
        )}

        {result && (
          <div className="rounded-md bg-secondary p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-500" />
              <p className="font-medium">Import Complete</p>
            </div>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-medium">{result.imported}</span> imported
              </p>
              {result.skipped > 0 && (
                <p>
                  <span className="font-medium">{result.skipped}</span> skipped (duplicates)
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
              onClick={resetInput}
              className="mt-2"
            >
              Import another file
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Example snippet displayed in the textarea for each format so users know
 * what shape is expected before they paste real data.
 */
function placeholderFor(format: FormatId): string {
  switch (format) {
    case "csv":
      return "concept,translation,sourceLanguage,targetLanguage\nhola,hello,Spanish,English";
    case "json":
      return '[{"concept":"hola","translation":"hello","sourceLanguage":"Spanish","targetLanguage":"English"}]';
    case "anki":
      return "# tab-separated Anki export\nhola\thello\nadiós\tgoodbye";
    case "quizlet":
      return "hola\thello\nadiós\tgoodbye";
    case "plain":
      return "hola - hello\nadiós - goodbye";
  }
}
