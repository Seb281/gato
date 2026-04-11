/**
 * Pure parsers for the vocabulary import dialog.
 *
 * Each parser returns an array of {@link ImportConceptItem} — the shape the
 * `/saved-concepts/import` API endpoint accepts. CSV and JSON carry their own
 * language metadata, so they ignore any passed-in defaults. TSV / plain-text
 * formats have no language metadata, so callers must supply defaults that
 * get stamped on every row.
 */

export type ImportConceptItem = {
  concept: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  state?: string;
  userNotes?: string | null;
};

export type LanguageDefaults = {
  sourceLanguage: string;
  targetLanguage: string;
};

/**
 * Splits a single CSV line into fields, honoring double-quoted segments and
 * escaped `""` quotes. Kept private because callers want whole-document
 * parsing, not line-level tokenization.
 */
function splitCsvLine(line: string): string[] {
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
  return fields;
}

/**
 * Parses a CSV document with columns:
 * `concept, translation, sourceLanguage, targetLanguage, state?, userNotes?`.
 *
 * The first row is treated as a header when it contains the literal text
 * `concept` or `translation`; otherwise it is treated as data. Rows with
 * fewer than four fields are dropped.
 */
export function parseCsv(text: string): ImportConceptItem[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  const header = lines[0]!.toLowerCase();
  const hasHeader =
    header.includes("concept") || header.includes("translation");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const out: ImportConceptItem[] = [];
  for (const line of dataLines) {
    const fields = splitCsvLine(line);
    if (fields.length < 4) continue;
    out.push({
      concept: fields[0]!,
      translation: fields[1]!,
      sourceLanguage: fields[2]!,
      targetLanguage: fields[3]!,
      state: fields[4] || undefined,
      userNotes: fields[5] || undefined,
    });
  }
  return out;
}

/**
 * Parses a JSON document. Accepts either a top-level array of concept objects
 * or an object with a `concepts` array. Rows that don't have string
 * `concept` and `translation` fields are dropped.
 */
export function parseJson(text: string): ImportConceptItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  const raw = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { concepts?: unknown }).concepts)
    ? ((parsed as { concepts: unknown[] }).concepts)
    : [];

  const out: ImportConceptItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.concept !== "string" || typeof rec.translation !== "string") {
      continue;
    }
    out.push({
      concept: rec.concept,
      translation: rec.translation,
      sourceLanguage: typeof rec.sourceLanguage === "string" ? rec.sourceLanguage : "",
      targetLanguage: typeof rec.targetLanguage === "string" ? rec.targetLanguage : "",
      state: typeof rec.state === "string" ? rec.state : undefined,
      userNotes: typeof rec.userNotes === "string" ? rec.userNotes : undefined,
    });
  }
  return out;
}

/**
 * Parses an Anki "Notes in Plain Text" export: tab-delimited, one row per
 * note, first column is the front (concept), second column is the back
 * (translation). Lines that start with `#` are Anki metadata (deck, tags
 * header, separator hint) and are skipped. Any extra columns are ignored.
 *
 * Anki has no language metadata in the export, so `defaults` is stamped on
 * every row.
 */
export function parseAnkiTsv(
  text: string,
  defaults: LanguageDefaults,
): ImportConceptItem[] {
  const out: ImportConceptItem[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim() || line.startsWith("#")) continue;
    const fields = line.split("\t");
    if (fields.length < 2) continue;
    const concept = fields[0]!.trim();
    const translation = fields[1]!.trim();
    if (!concept || !translation) continue;
    out.push({
      concept,
      translation,
      sourceLanguage: defaults.sourceLanguage,
      targetLanguage: defaults.targetLanguage,
    });
  }
  return out;
}

/**
 * Parses a Quizlet export. Quizlet lets the user pick delimiters between
 * term/definition and between cards; the two common exports are
 * `term<TAB>definition<NEWLINE>` and `term,definition<NEWLINE>`. This parser
 * inspects the first non-empty line to decide which delimiter to use, then
 * treats every following line the same way. Rows without both parts are
 * skipped. Language metadata is supplied by `defaults`.
 */
export function parseQuizletTsv(
  text: string,
  defaults: LanguageDefaults,
): ImportConceptItem[] {
  const lines = text.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const firstTab = lines[0]!.indexOf("\t");
  const firstComma = lines[0]!.indexOf(",");
  const delimiter =
    firstTab !== -1 && (firstComma === -1 || firstTab < firstComma) ? "\t" : ",";

  const out: ImportConceptItem[] = [];
  for (const line of lines) {
    const idx = line.indexOf(delimiter);
    if (idx === -1) continue;
    const concept = line.slice(0, idx).trim();
    const translation = line.slice(idx + 1).trim();
    if (!concept || !translation) continue;
    out.push({
      concept,
      translation,
      sourceLanguage: defaults.sourceLanguage,
      targetLanguage: defaults.targetLanguage,
    });
  }
  return out;
}

/**
 * Parses a hand-typed plain-text list. Each non-empty line is one concept.
 * The delimiter between concept and translation can be a tab, ` - ` (space
 * hyphen space), ` — ` (space em-dash space), ` – ` (space en-dash space),
 * or ` => `. Blank lines are tolerated.
 */
export function parsePlainText(
  text: string,
  defaults: LanguageDefaults,
): ImportConceptItem[] {
  const out: ImportConceptItem[] = [];
  const splitRegex = /\t| => | — | – | - /;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "").trim();
    if (!line) continue;
    const match = splitRegex.exec(line);
    if (!match) continue;
    const idx = match.index;
    const concept = line.slice(0, idx).trim();
    const translation = line.slice(idx + match[0].length).trim();
    if (!concept || !translation) continue;
    out.push({
      concept,
      translation,
      sourceLanguage: defaults.sourceLanguage,
      targetLanguage: defaults.targetLanguage,
    });
  }
  return out;
}
