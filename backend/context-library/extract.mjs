import { createHash } from "node:crypto";
import { parseCsvText } from "../csv-import/parse.mjs";

// Turning what a person adds to the Context Library into text a generator can read. Each reader either returns
// { text, structure, warnings } or throws a ContextSourceError whose message says what to do about it: an empty
// extraction is a failure, never a source. Pure apart from the PDF reader's use of the PDF library.

export class ContextSourceError extends Error {
  constructor(message, code = "CONTEXT_SOURCE_INVALID") {
    super(message);
    this.name = "ContextSourceError";
    this.code = code;
  }
}

export const LIMITS = Object.freeze({
  /** A file, as received. */
  maxPdfBytes: 10 * 1024 * 1024,
  maxTextBytes: 5 * 1024 * 1024,
  /** What is kept of one source after extraction; a longer one is cut here and says so. */
  maxStoredChars: 400_000,
  maxNoteChars: 20_000,
  /** Fewer characters than this from a PDF means it is a scan or has no text layer, not a short document. */
  minPdfChars: 40,
  maxNameChars: 120,
  maxMarketChars: 60,
});

export const SUPPORTED_FILES = "PDF, TXT, Markdown (.md) and CSV";

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Which reader a file needs, by extension first and then by the type the browser reported. */
export function fileKind(fileName, mimeType = "") {
  const extension = /\.([a-z0-9]+)$/i.exec(String(fileName ?? ""))?.[1]?.toLowerCase() ?? "";
  const mime = String(mimeType ?? "").toLowerCase();
  if (extension === "pdf" || mime === "application/pdf") return "pdf";
  if (extension === "csv" || mime === "text/csv") return "csv";
  if (["txt", "md", "markdown", "text"].includes(extension) || mime === "text/plain" || mime === "text/markdown") return "text";
  throw new ContextSourceError(`Prism can read ${SUPPORTED_FILES} here. “${fileName || "That file"}” is a different type.`, "CONTEXT_SOURCE_UNSUPPORTED");
}

function decodeUtf8(bytes, fileName) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    throw new ContextSourceError(`“${fileName}” isn't UTF-8 text. Save it as UTF-8 and add it again.`);
  }
}

const normalizeNewlines = (text) => text.replace(/\r\n?/g, "\n");

/** Cuts text at the stored limit, at a line break when there is one nearby, and says how much was dropped. */
function bound(text) {
  if (text.length <= LIMITS.maxStoredChars) return { text, truncated: false, droppedChars: 0 };
  const cut = text.lastIndexOf("\n", LIMITS.maxStoredChars);
  const end = cut > LIMITS.maxStoredChars * 0.9 ? cut : LIMITS.maxStoredChars;
  return { text: text.slice(0, end), truncated: true, droppedChars: text.length - end };
}

// ---------------------------------------------------------------------------------------------------------------------
// Notes and plain text

export function extractNote(rawText) {
  const text = normalizeNewlines(String(rawText ?? "")).trim();
  if (!text) throw new ContextSourceError("The note is empty.");
  if (text.length > LIMITS.maxNoteChars) throw new ContextSourceError(`A note can be up to ${LIMITS.maxNoteChars.toLocaleString("en-US")} characters. This one is ${text.length.toLocaleString("en-US")}; add the rest as a second note or a file.`);
  return { text, structure: { chars: text.length, lines: text.split("\n").length, warnings: [] } };
}

export function extractPlainText(bytes, fileName) {
  if (bytes.byteLength > LIMITS.maxTextBytes) throw new ContextSourceError(`“${fileName}” is over ${LIMITS.maxTextBytes / 1024 / 1024} MB.`);
  const decoded = normalizeNewlines(decodeUtf8(bytes, fileName)).replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (!decoded) throw new ContextSourceError(`“${fileName}” has no text in it.`);
  if (/\u0000/.test(decoded.slice(0, 2000))) throw new ContextSourceError(`“${fileName}” looks like a binary file, not text.`);
  const { text, truncated, droppedChars } = bound(decoded);
  const warnings = truncated ? [`Only the first ${text.length.toLocaleString("en-US")} characters are kept; ${droppedChars.toLocaleString("en-US")} more were left out.`] : [];
  return { text, structure: { chars: text.length, lines: text.split("\n").length, truncated, warnings } };
}

// ---------------------------------------------------------------------------------------------------------------------
// CSV

/** The delimiter of a header line: the one of comma, semicolon and tab that occurs most outside quotes. */
export function detectDelimiter(text) {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char in counts) counts[char] += 1;
  }
  const [best, occurrences] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return occurrences > 0 ? best : ",";
}

const csvField = (value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const looksNumeric = (value) => /^-?\d[\d\s.,]*%?$/.test(value);
const looksDate = (value) => /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value);

/** A short account of each column: what it seems to hold and, when it has few distinct values, the values that repeat. */
function profileColumns(headers, body) {
  return headers.map((name, position) => {
    const values = body.map((row) => String(row[position] ?? "").trim()).filter(Boolean);
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    const distinct = counts.size;
    const numeric = values.length > 0 && values.filter(looksNumeric).length / values.length >= 0.9;
    const dates = values.length > 0 && values.filter(looksDate).length / values.length >= 0.9;
    const averageLength = values.length ? Math.round(values.reduce((sum, value) => sum + value.length, 0) / values.length) : 0;
    const type = numeric ? "number" : dates ? "date" : averageLength > 60 ? "long text" : "text";
    const repeating = type === "text" && distinct > 1 && distinct < values.length && distinct <= Math.max(12, values.length / 4);
    const top = repeating ? [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([value, count]) => [value.slice(0, 80), count]) : [];
    return { name, type, filled: values.length, distinct, averageLength, top };
  });
}

export function extractCsv(bytes, fileName) {
  if (bytes.byteLength > LIMITS.maxTextBytes) throw new ContextSourceError(`“${fileName}” is over ${LIMITS.maxTextBytes / 1024 / 1024} MB.`);
  const decoded = decodeUtf8(bytes, fileName);
  if (!decoded.trim()) throw new ContextSourceError(`“${fileName}” is empty.`);
  const delimiter = detectDelimiter(decoded);
  const table = parseCsvText(decoded, delimiter);
  if (table.length < 2) throw new ContextSourceError(`“${fileName}” has a header but no rows.`);
  const width = table[0].length;
  if (width < 1 || table[0].every((header) => !header.trim())) throw new ContextSourceError(`“${fileName}” has no column names in its first row.`);
  const seen = new Map();
  const headers = table[0].map((header, position) => {
    const base = header.trim() || `column ${position + 1}`;
    const times = (seen.get(base) ?? 0) + 1;
    seen.set(base, times);
    return times > 1 ? `${base} (${times})` : base;
  });
  const body = table.slice(1).map((row) => headers.map((_, position) => String(row[position] ?? "").replace(/\s+/g, " ").trim()));
  const warnings = [];
  if (headers.length === 1 && delimiter === ",") warnings.push("This file has a single column. If it should have more, check that its columns are separated by commas, semicolons or tabs.");
  const columns = profileColumns(headers, body);

  // The rows are kept whole, in a normalised comma form, up to the stored limit.
  const lines = [headers.map(csvField).join(",")];
  let size = lines[0].length;
  let rowsStored = 0;
  for (const row of body) {
    const line = row.map(csvField).join(",");
    if (size + line.length + 1 > LIMITS.maxStoredChars) break;
    lines.push(line);
    size += line.length + 1;
    rowsStored += 1;
  }
  if (rowsStored < body.length) warnings.push(`Only the first ${rowsStored.toLocaleString("en-US")} of ${body.length.toLocaleString("en-US")} rows are kept.`);
  return { text: lines.join("\n"), structure: { delimiter, rows: body.length, rowsStored, columns, truncated: rowsStored < body.length, warnings } };
}

// ---------------------------------------------------------------------------------------------------------------------
// PDF

const pageRanges = (pages) => {
  const runs = [];
  for (const page of pages) {
    const last = runs.at(-1);
    if (last && page === last[1] + 1) last[1] = page;
    else runs.push([page, page]);
  }
  return runs.map(([from, to]) => (from === to ? String(from) : `${from}–${to}`)).join(", ");
};

/** The page text that the PDF library returns, with the fragments it leaves behind tidied. */
const tidyPage = (text) => normalizeNewlines(text).replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/**
 * Text of a PDF, page by page, as "[Page N]" sections. A PDF whose pages carry no text (a scan) is refused with that
 * reason rather than stored empty, and pages without text inside an otherwise readable file are listed as a warning.
 */
export async function extractPdf(bytes, fileName) {
  if (bytes.byteLength > LIMITS.maxPdfBytes) throw new ContextSourceError(`“${fileName}” is over ${LIMITS.maxPdfBytes / 1024 / 1024} MB.`);
  if (bytes.byteLength < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new ContextSourceError(`“${fileName}” isn't a readable PDF.`);
  let pages;
  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const document = await getDocumentProxy(new Uint8Array(bytes));
    const result = await extractText(document, { mergePages: false });
    pages = result.text.map(tidyPage);
  } catch (error) {
    if (error?.name === "PasswordException") throw new ContextSourceError(`“${fileName}” is password-protected. Remove the password and add it again.`);
    throw new ContextSourceError(`“${fileName}” couldn't be read as a PDF (${error?.message ?? "unknown error"}).`);
  }
  const withText = pages.map((text, index) => ({ page: index + 1, text })).filter((entry) => entry.text);
  const chars = withText.reduce((sum, entry) => sum + entry.text.length, 0);
  if (chars < LIMITS.minPdfChars) {
    throw new ContextSourceError(`“${fileName}” has no readable text. It is probably a scan or an image-only PDF, which Prism can't read yet; add a text version or paste the relevant parts as a note.`, "CONTEXT_SOURCE_NO_TEXT");
  }
  const warnings = [];
  const empty = pages.map((text, index) => (text ? 0 : index + 1)).filter(Boolean);
  if (empty.length) warnings.push(`No readable text on page${empty.length > 1 ? "s" : ""} ${pageRanges(empty)} (images or scans); those pages are not included.`);

  const combined = withText.map((entry) => `[Page ${entry.page}]\n${entry.text}`).join("\n\n");
  const { text, truncated, droppedChars } = bound(combined);
  if (truncated) warnings.push(`Only the first ${text.length.toLocaleString("en-US")} characters are kept; ${droppedChars.toLocaleString("en-US")} more were left out.`);
  return { text, structure: { pages: pages.length, pagesWithText: withText.length, chars: text.length, truncated, warnings } };
}

// ---------------------------------------------------------------------------------------------------------------------

/** A one-line account of what was extracted, for the library list. */
export function describeStructure(kind, structure, charCount = 0) {
  if (!structure) return null;
  const n = (value) => Number(value).toLocaleString("en-US");
  if (kind === "pdf") return `${n(structure.pages)} page${structure.pages === 1 ? "" : "s"} · ${n(charCount)} characters`;
  if (kind === "csv") return `${n(structure.rows)} row${structure.rows === 1 ? "" : "s"} · ${n(structure.columns?.length ?? 0)} columns`;
  return `${n(charCount)} characters`;
}

/** Reads one file (its bytes) with the reader its kind needs. */
export async function extractFile(kind, bytes, fileName) {
  if (kind === "pdf") return extractPdf(bytes, fileName);
  if (kind === "csv") return extractCsv(bytes, fileName);
  return extractPlainText(bytes, fileName);
}
