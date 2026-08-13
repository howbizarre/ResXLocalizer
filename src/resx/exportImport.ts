/**
 * @module resx/exportImport
 * Pure data-shaping logic for the table's Export/Import buttons: no `vscode` calls, no I/O —
 * {@link ../panels/tablePanel} owns the actual file dialogs and disk access, and calls into
 * this module to build file content, validate uploads, and turn parsed rows into
 * {@link TranslationEdit}s that {@link ../resx/saveTranslations} can apply.
 */
import { ResxGroup } from "./resxParser";
import { TranslationEdit } from "./saveTranslations";

function columnKey(locale: string | null): string {
  return locale ? locale : "default";
}

function csvEscapeField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sortedGroupKeys(group: ResxGroup): string[] {
  const allKeys = new Set<string>();
  for (const file of group.files) {
    for (const key of file.entries.keys()) {
      allKeys.add(key);
    }
  }
  return Array.from(allKeys).sort((a, b) => a.localeCompare(b));
}

/** Serializes a group's current table data to CSV: a `Key` column plus one column per language. */
export function buildCsvContent(group: ResxGroup): string {
  const header = ["Key", ...group.files.map((f) => columnKey(f.locale))];
  const lines = [header.map(csvEscapeField).join(",")];

  for (const key of sortedGroupKeys(group)) {
    const cells = [key, ...group.files.map((f) => f.entries.get(key)?.value ?? "")];
    lines.push(cells.map(csvEscapeField).join(","));
  }

  return lines.join("\r\n") + "\r\n";
}

/** Serializes a group's current table data to JSON: one object per key, `Key` + one field per language. */
export function buildJsonContent(group: ResxGroup): string {
  const rows = sortedGroupKeys(group).map((key) => {
    const row: Record<string, string> = { Key: key };
    for (const file of group.files) {
      row[columnKey(file.locale)] = file.entries.get(key)?.value ?? "";
    }
    return row;
  });
  return JSON.stringify(rows, null, 2);
}

/** One row parsed from an import file: a key plus its per-column (locale) values. */
export interface ImportRow {
  key: string;
  values: Map<string, string>;
}

/** Result of validating + parsing an import file, before it's turned into an {@link ImportPlan}. */
export interface ImportParseResult {
  rows: ImportRow[];
  /** Structural problems — if non-empty, the import must be aborted without writing anything. */
  errors: string[];
  /** Non-fatal notes (e.g. a key repeated within the file itself). */
  warnings: string[];
}

/** Parses raw CSV text into rows of fields, honoring RFC4180-style quoting. */
function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // ignore; \n (or end of input) terminates the row
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseCsvImport(text: string): ImportParseResult {
  const warnings: string[] = [];
  const raw = parseCsvLines(text).filter((r) => !(r.length === 1 && r[0].trim() === ""));

  if (raw.length === 0) {
    return { rows: [], errors: ["The CSV file is empty."], warnings };
  }

  const header = raw[0].map((h) => h.trim());
  const keyIdx = header.findIndex((h) => h.toLowerCase() === "key");
  if (keyIdx === -1) {
    return { rows: [], errors: ['The CSV header is missing a "Key" column.'], warnings };
  }

  const errors: string[] = [];
  const rows: ImportRow[] = [];
  const seenAt = new Map<string, number>();

  for (let i = 1; i < raw.length; i++) {
    const fields = raw[i];
    const lineNo = i + 1;
    if (fields.length !== header.length) {
      errors.push(`Row ${lineNo}: expected ${header.length} column(s), found ${fields.length}.`);
      continue;
    }
    const key = (fields[keyIdx] ?? "").trim();
    if (!key) {
      errors.push(`Row ${lineNo}: empty "Key" value.`);
      continue;
    }
    const values = new Map<string, string>();
    for (let c = 0; c < header.length; c++) {
      if (c === keyIdx || !header[c]) {
        continue;
      }
      values.set(header[c], fields[c] ?? "");
    }
    const existingIdx = seenAt.get(key);
    if (existingIdx !== undefined) {
      warnings.push(`Key "${key}" appears more than once in the file (row ${lineNo}); using the last occurrence.`);
      rows[existingIdx] = { key, values };
    } else {
      seenAt.set(key, rows.length);
      rows.push({ key, values });
    }
  }

  return { rows, errors, warnings };
}

function parseJsonImport(text: string): ImportParseResult {
  const warnings: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { rows: [], errors: [`Invalid JSON: ${(e as Error).message}`], warnings };
  }
  if (!Array.isArray(data)) {
    return { rows: [], errors: ["Expected the JSON root to be an array of row objects."], warnings };
  }

  const errors: string[] = [];
  const rows: ImportRow[] = [];
  const seenAt = new Map<string, number>();

  data.forEach((item, idx) => {
    const lineNo = idx + 1;
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      errors.push(`Item ${lineNo}: expected an object.`);
      return;
    }
    const record = item as Record<string, unknown>;
    const keyField = Object.keys(record).find((k) => k.toLowerCase() === "key");
    const rawKey = keyField ? record[keyField] : undefined;
    const key = typeof rawKey === "string" ? rawKey.trim() : "";
    if (!key) {
      errors.push(`Item ${lineNo}: missing or empty "Key".`);
      return;
    }
    const values = new Map<string, string>();
    for (const [col, val] of Object.entries(record)) {
      if (col === keyField) {
        continue;
      }
      values.set(col, typeof val === "string" ? val : String(val ?? ""));
    }
    const existingIdx = seenAt.get(key);
    if (existingIdx !== undefined) {
      warnings.push(`Key "${key}" appears more than once in the file (item ${lineNo}); using the last occurrence.`);
      rows[existingIdx] = { key, values };
    } else {
      seenAt.set(key, rows.length);
      rows.push({ key, values });
    }
  });

  return { rows, errors, warnings };
}

/**
 * Validates and parses an import file. Format (CSV vs JSON) is inferred from `fileName`'s
 * extension. Callers must not write anything if the result's `errors` array is non-empty.
 */
export function parseImportContent(fileName: string, text: string): ImportParseResult {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) {
    return parseJsonImport(text);
  }
  if (lower.endsWith(".csv")) {
    return parseCsvImport(text);
  }
  return { rows: [], errors: [`Unsupported file type: "${fileName}". Expected a .csv or .json file.`], warnings: [] };
}

/** One (key, column) write an import will make — `action` records whether it's new or an overwrite. */
export interface ImportLogEntry {
  key: string;
  column: string;
  file: string;
  action: "added" | "overwritten";
  oldValue?: string;
  newValue: string;
}

/** The concrete result of {@link buildImportPlan}: edits ready for `saveTranslations`, plus a log for review. */
export interface ImportPlan {
  edits: TranslationEdit[];
  log: ImportLogEntry[];
  /** Column names from the import file that didn't match any language file in this group. */
  ignoredColumns: string[];
}

/** Turns parsed import rows into concrete file edits, logging every pre-existing key as an overwrite. */
export function buildImportPlan(group: ResxGroup, rows: ImportRow[]): ImportPlan {
  const fileByColumn = new Map(group.files.map((f) => [columnKey(f.locale), f]));
  const edits: TranslationEdit[] = [];
  const log: ImportLogEntry[] = [];
  const ignoredColumns = new Set<string>();

  for (const row of rows) {
    for (const [column, value] of row.values) {
      if (value === "") {
        continue; // blank cells never overwrite an existing translation
      }

      const file = fileByColumn.get(column);
      if (!file) {
        ignoredColumns.add(column);
        continue;
      }

      const existing = file.entries.get(row.key);
      edits.push({ file: file.uri.fsPath, key: row.key, value });
      log.push(
        existing
          ? { key: row.key, column, file: file.uri.fsPath, action: "overwritten", oldValue: existing.value, newValue: value }
          : { key: row.key, column, file: file.uri.fsPath, action: "added", newValue: value }
      );
    }
  }

  return { edits, log, ignoredColumns: Array.from(ignoredColumns) };
}
