import { randomUUID } from "node:crypto";
import mammoth from "mammoth";
import { extractPdf } from "../context-library/extract.mjs";
import {
  classifySource,
  deleteWorkspaceSource,
  getWorkspaceProduct,
  getWorkspaceSourceRow,
  persistProductSources,
  renameWorkspaceSource,
} from "../database/workspace-data-repository.mjs";

// The Data library's editors: read one stored source whole, write an edit back over it ("Save"), or store the edit
// as a new source beside it ("Save as copy"). Every write keeps the storage envelope the rest of Prism reads
// (Product Context building, the media picker), so an edited source is used downstream exactly like an uploaded one.

export class DataItemError extends Error {
  constructor(message) {
    super(message);
    this.name = "DataItemError";
  }
}

const PLAIN_TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "json", "csv", "tsv", "html", "htm", "xml", "yaml", "yml"]);
const MAX_TEXT_CHARS = 2_000_000;
const MAX_DATA_URL_CHARS = 60 * 1024 * 1024;

const extensionOf = (filename) => /\.([a-z0-9]+)$/i.exec(String(filename ?? ""))?.[1]?.toLowerCase() ?? "";

function parseEnvelope(source) {
  if (typeof source.value !== "string") return null;
  try {
    const parsed = JSON.parse(source.value);
    return parsed && parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function isPlainText(filename, mimeType) {
  const mime = String(mimeType ?? "").toLowerCase();
  return PLAIN_TEXT_EXTENSIONS.has(extensionOf(filename)) || mime.startsWith("text/") || mime === "application/json";
}

function requireRow(workspaceId, id) {
  const row = getWorkspaceSourceRow(workspaceId, id);
  if (!row) throw new DataItemError("That item no longer exists.");
  return row;
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/s.exec(String(dataUrl ?? ""));
  if (!match) throw new DataItemError("The edited file isn't in a format Prism can store.");
  if (dataUrl.length > MAX_DATA_URL_CHARS) throw new DataItemError("That file is too large to store.");
  return { mimeType: match[1] || "application/octet-stream", base64: match[2] };
}

function cleanTrim(trim) {
  if (!trim) return null;
  const start = Number(trim.start);
  const end = Number(trim.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new DataItemError("The trim range isn't valid.");
  return { start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000 };
}

function cleanText(text) {
  if (typeof text !== "string") throw new DataItemError("There is no text to save.");
  if (!text.trim()) throw new DataItemError("The text is empty.");
  if (text.length > MAX_TEXT_CHARS) throw new DataItemError("That text is too long to store.");
  return text;
}

/** The item whole, plus what its editor may do with it. */
export async function readDataItem(workspaceId, id) {
  const row = requireRow(workspaceId, id);
  const { source } = row;
  const filename = source.filename ?? null;
  const mimeType = source.mimeType ?? null;
  const kind = classifySource(row.type, filename, mimeType);
  const item = {
    id: row.id,
    kind,
    label: row.label,
    filename,
    mimeType,
    productId: row.productId,
    text: null,
    dataUrl: null,
    frames: null,
    url: null,
    trim: source.trim ?? null,
    saveMode: "overwrite",
    notice: null,
  };

  if (kind === "note") return { ...item, text: String(source.value ?? "") };
  if (kind === "link") return { ...item, url: String(source.value ?? ""), saveMode: "none" };

  const envelope = parseEnvelope(source);
  if (row.type === "image") {
    if (!envelope?.dataUrl) throw new DataItemError("This image's data is missing.");
    return { ...item, dataUrl: envelope.dataUrl };
  }
  if (row.type === "video") {
    return {
      ...item,
      frames: Array.isArray(envelope?.frames) ? envelope.frames.filter((frame) => typeof frame === "string") : [],
      saveMode: "none",
      notice: "Only three stills were kept when this video was added — the clip itself isn't stored, so there is nothing to trim.",
    };
  }

  const base64 = typeof envelope?.data === "string" ? envelope.data : null;
  if (!base64) throw new DataItemError("This file's data is missing.");
  const bytes = Buffer.from(base64, "base64");
  const extension = extensionOf(filename);

  if (kind === "image" || kind === "audio" || kind === "video") {
    return { ...item, dataUrl: `data:${mimeType || "application/octet-stream"};base64,${base64}` };
  }
  if (kind === "table") {
    if (extension === "xlsx" || extension === "xls" || String(mimeType).includes("spreadsheet") || mimeType === "application/vnd.ms-excel") {
      return {
        ...item,
        dataUrl: `data:${mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"};base64,${base64}`,
        saveMode: "copy-only",
        notice: "Spreadsheet files open on their first sheet. Edits are saved as a CSV copy; the original workbook is kept as it is.",
      };
    }
    return { ...item, text: new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "") };
  }
  if (extension === "pdf" || mimeType === "application/pdf") {
    try {
      const { text } = await extractPdf(bytes, filename ?? "document.pdf");
      return {
        ...item,
        text,
        saveMode: "copy-only",
        notice: "This is the text read out of the PDF. The PDF itself is kept as it is — save your edit as a copy.",
      };
    } catch (error) {
      return { ...item, saveMode: "none", notice: error.message };
    }
  }
  if (extension === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    try {
      const { value: text } = await mammoth.extractRawText({ buffer: bytes });
      if (!text.trim()) throw new Error("This document has no readable text — it may be empty or scanned.");
      return {
        ...item,
        text,
        saveMode: "copy-only",
        notice: "This is the text read out of the Word document. The document itself is kept as it is — save your edit as a copy.",
      };
    } catch (error) {
      return { ...item, saveMode: "none", notice: error instanceof Error ? error.message : "Prism couldn't read this Word document." };
    }
  }
  if (extension === "doc") {
    return { ...item, saveMode: "none", notice: "Prism can read .docx Word documents but not the older .doc format yet. It is still used as product material." };
  }
  if (isPlainText(filename, mimeType)) {
    return { ...item, text: new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "") };
  }
  return {
    ...item,
    saveMode: "none",
    notice: `Prism can't open ${extension ? `.${extension}` : "this kind of"} file for editing yet. It is still used as product material.`,
  };
}

/** The source after an edit, in the same envelope it was read from. An edit that changes the contents drops the
 * card preview, so the library makes a fresh one; a trim only marks in and out points, so it keeps it. */
function applyEdit(row, current, edit) {
  const { preview, ...stored } = row.source;
  const source = { ...stored, id: row.id, type: row.type, label: row.label, status: row.status };
  if (current.kind === "audio" || current.kind === "video") return { ...source, ...(preview ? { preview } : {}), trim: cleanTrim(edit.trim) };
  if (current.kind === "note") return { ...source, value: cleanText(edit.text) };
  if (row.type === "image") {
    const { base64, mimeType } = parseDataUrl(edit.dataUrl);
    return {
      ...source,
      mimeType,
      size: Math.floor((base64.length * 3) / 4),
      value: JSON.stringify({ version: 1, kind: "image", dataUrl: edit.dataUrl }),
    };
  }
  if (current.kind === "image") {
    const { base64, mimeType } = parseDataUrl(edit.dataUrl);
    return { ...source, mimeType, size: Math.floor((base64.length * 3) / 4), value: JSON.stringify({ version: 1, kind: "document", data: base64 }) };
  }
  const text = cleanText(edit.text);
  const bytes = Buffer.from(text, "utf8");
  return { ...source, size: bytes.byteLength, value: JSON.stringify({ version: 1, kind: "document", data: bytes.toString("base64") }) };
}

export async function saveDataItem(workspaceId, edit) {
  const row = requireRow(workspaceId, edit.id);
  const current = await readDataItem(workspaceId, edit.id);
  if (current.saveMode !== "overwrite") {
    throw new DataItemError(current.saveMode === "copy-only" ? "This original is kept as it is. Save your edit as a copy." : "This item can't be edited.");
  }
  persistProductSources(workspaceId, [applyEdit(row, current, edit)], row.productId);
  return readDataItem(workspaceId, row.id);
}

function copyName(filename, extension) {
  const base = String(filename ?? "").replace(/\.[a-z0-9]+$/i, "") || "Untitled";
  return `${base} (copy)${extension ? `.${extension}` : ""}`;
}

export async function copyDataItem(workspaceId, edit) {
  const row = requireRow(workspaceId, edit.id);
  const current = await readDataItem(workspaceId, edit.id);
  if (current.saveMode === "none") throw new DataItemError("This item can't be copied from here.");

  const id = `source-${randomUUID()}`;
  const extension = extensionOf(current.filename);
  let copy;
  if (current.kind === "table" && current.saveMode === "copy-only") {
    // A workbook's edit comes back as CSV text.
    const bytes = Buffer.from(cleanText(edit.text), "utf8");
    const filename = edit.filename?.trim() || copyName(current.filename, "csv");
    copy = {
      ...row.source,
      id,
      type: "file",
      label: filename,
      status: "ready",
      filename,
      mimeType: "text/csv",
      size: bytes.byteLength,
      value: JSON.stringify({ version: 1, kind: "document", data: bytes.toString("base64") }),
    };
  } else if (current.kind === "document" && current.saveMode === "copy-only") {
    // A PDF's edited text becomes a Markdown file.
    const bytes = Buffer.from(cleanText(edit.text), "utf8");
    const filename = edit.filename?.trim() || copyName(current.filename, "md");
    copy = {
      ...row.source,
      id,
      type: "file",
      label: filename,
      status: "ready",
      filename,
      mimeType: "text/markdown",
      size: bytes.byteLength,
      value: JSON.stringify({ version: 1, kind: "document", data: bytes.toString("base64") }),
    };
  } else {
    const edited = applyEdit(row, current, edit);
    const filename = current.kind === "note" ? null : edit.filename?.trim() || copyName(current.filename, extension);
    copy = {
      ...edited,
      id,
      status: "ready",
      label: filename ?? (edit.filename?.trim() || `${row.label} (copy)`),
      ...(filename ? { filename } : {}),
    };
  }
  persistProductSources(workspaceId, [copy], row.productId);
  return readDataItem(workspaceId, id);
}

/** Renames a source in place. Its stored contents (text, file bytes, trim) are untouched. A source with a
 * filename is shown by that filename, not its label (sourceEntry in workspace-data-repository.mjs prefers
 * filename), so renaming one renames the filename too — keeping its extension unless the new name already ends
 * in one — and keeps label in step with it. A note or a link has no filename, so only label changes. */
export async function renameDataItem(workspaceId, id, label) {
  const row = requireRow(workspaceId, id);
  const clean = String(label ?? "").trim();
  if (!clean) throw new DataItemError("Give it a name.");
  if (clean.length > 200) throw new DataItemError("That name is too long.");
  const currentFilename = row.source.filename ?? null;
  if (currentFilename) {
    const extension = /\.[a-z0-9]+$/i.exec(currentFilename)?.[0] ?? "";
    const filename = extension && !clean.toLowerCase().endsWith(extension.toLowerCase()) ? `${clean}${extension}` : clean;
    const source = { ...row.source, filename, label: filename, id: row.id, type: row.type, status: row.status };
    persistProductSources(workspaceId, [source], row.productId);
  } else {
    renameWorkspaceSource(workspaceId, id, clean);
  }
  return readDataItem(workspaceId, id);
}

function withCopySuffix(filename) {
  if (!filename) return null;
  const extension = /\.[a-z0-9]+$/i.exec(filename)?.[0] ?? "";
  const base = extension ? filename.slice(0, -extension.length) : filename;
  return `${base} (copy)${extension}`;
}

/** An exact copy of a source's stored contents, beside the original — unlike Save as copy, this never re-encodes
 * anything (no text round-trip, no workbook-to-CSV conversion), so it works for every kind, including originals
 * an editor can only view. */
export async function duplicateDataItem(workspaceId, id) {
  const row = requireRow(workspaceId, id);
  const copyId = `source-${randomUUID()}`;
  const filename = withCopySuffix(row.source.filename ?? null);
  const label = filename ?? `${row.label} (copy)`;
  const copy = { ...row.source, id: copyId, type: row.type, label, status: row.status, ...(filename ? { filename } : {}) };
  persistProductSources(workspaceId, [copy], row.productId);
  return readDataItem(workspaceId, copyId);
}

const MAX_THUMBNAIL_CHARS = 300_000; // ~220 KB of image; the browser aims for well under 40 KB
const MAX_PEAKS = 256;

/** Stores a media item's card preview beside its contents: a small still for an image or video, and a waveform
 * for audio (a video's audio track too). The browser makes it once from the item itself; nothing about the item's
 * contents changes. */
export function saveDataItemPreview(workspaceId, input) {
  const row = requireRow(workspaceId, input.id);
  const kind = classifySource(row.type, row.source.filename, row.source.mimeType);
  if (kind !== "image" && kind !== "video" && kind !== "audio") throw new DataItemError("Only images, video and audio have a preview.");
  const preview = {};
  if (input.thumbnail != null) {
    const thumbnail = String(input.thumbnail);
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(thumbnail)) throw new DataItemError("The preview isn't an image Prism can store.");
    if (thumbnail.length > MAX_THUMBNAIL_CHARS) throw new DataItemError("The preview is too large.");
    preview.thumbnail = thumbnail;
  }
  if (input.peaks != null) {
    if (!Array.isArray(input.peaks) || input.peaks.length > MAX_PEAKS) throw new DataItemError("The waveform isn't valid.");
    preview.peaks = input.peaks.map((peak) => Math.round(Math.min(1, Math.max(0, Number(peak) || 0)) * 1000) / 1000);
  }
  if (input.duration != null) {
    const duration = Number(input.duration);
    if (Number.isFinite(duration) && duration > 0 && duration < 86_400) preview.duration = Math.round(duration * 100) / 100;
  }
  persistProductSources(workspaceId, [{ ...row.source, id: row.id, type: row.type, label: row.label, status: row.status, preview }], row.productId);
  return true;
}

const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Something dropped straight into the Data library: a file of any format, a link, or a piece of text. Files are
 * stored in the same envelopes product intake and Google Drive imports use (an image as an image source,
 * everything else as a file whose own type decides its editor), so they are usable downstream like any other
 * material. A file Prism can't open yet is still kept, downloadable, and listed as a document. */
export function addDataItem(workspaceId, input) {
  const productId = input.productId ? String(input.productId) : null;
  if (productId && !getWorkspaceProduct(workspaceId, productId)) throw new DataItemError("That product isn't in this workspace.");
  const id = `source-${randomUUID()}`;

  if (typeof input.url === "string" && input.url.trim()) {
    const url = input.url.trim();
    if (!/^https?:\/\//i.test(url) || !hostnameOf(url)) throw new DataItemError("Only http and https links can be added.");
    persistProductSources(workspaceId, [{ id, type: "url", label: hostnameOf(url), status: "ready", value: url }], productId);
    return id;
  }
  if (typeof input.text === "string" && !input.data) {
    const text = cleanText(input.text);
    const label = text.split("\n").find((line) => line.trim())?.trim().slice(0, 80) || "Note";
    persistProductSources(workspaceId, [{ id, type: "text", label, status: "ready", value: text }], productId);
    return id;
  }

  const filename = String(input.filename ?? "").trim().slice(0, 200) || "Untitled";
  const mimeType = String(input.mimeType ?? "").trim().toLowerCase() || "application/octet-stream";
  const base64 = typeof input.data === "string" ? input.data.replace(/^data:[^,]*,/, "") : "";
  if (!base64) throw new DataItemError(`${filename} is empty.`);
  const size = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (size > MAX_UPLOAD_BYTES) throw new DataItemError(`${filename} is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  const isImage = mimeType.startsWith("image/") && mimeType !== "image/svg+xml";
  persistProductSources(
    workspaceId,
    [
      {
        id,
        type: isImage ? "image" : "file",
        label: filename,
        status: "ready",
        filename,
        mimeType,
        size,
        value: JSON.stringify(
          isImage ? { version: 1, kind: "image", dataUrl: `data:${mimeType};base64,${base64}` } : { version: 1, kind: "document", data: base64 },
        ),
      },
    ],
    productId,
  );
  return id;
}

export function deleteDataItem(workspaceId, id) {
  requireRow(workspaceId, id);
  deleteWorkspaceSource(workspaceId, id);
  return true;
}
