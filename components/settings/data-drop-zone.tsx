"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { UploadCloud } from "lucide-react";
import { api } from "@/api/api";
import { h } from "@/lib/h";

/** The largest single file the Data library takes; the backend enforces the same limit. */
export const MAX_DATA_FILE_BYTES = 40 * 1024 * 1024;

type DroppedPayload = { files: File[]; urls: string[]; text: string | null };

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Couldn't read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

/** What a drop carries: files first; otherwise links (from a browser's address bar or a page) or plain text. */
function readDrop(transfer: DataTransfer): DroppedPayload {
  const files = Array.from(transfer.files ?? []);
  if (files.length) return { files, urls: [], text: null };
  const uriList = transfer.getData("text/uri-list");
  const plain = transfer.getData("text/plain");
  const urls = (uriList || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && /^https?:\/\//i.test(line));
  if (urls.length) return { files: [], urls, text: null };
  const trimmed = plain.trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) return { files: [], urls: [trimmed], text: null };
  return { files: [], urls: [], text: trimmed || null };
}

/** A drop carrying something to add, landing on the page itself — not inside an editor portaled out of it, whose
 * React events still bubble here. */
const carriesData = (event: React.DragEvent) =>
  event.currentTarget.contains(event.target as Node) &&
  Array.from(event.dataTransfer?.types ?? []).some((type) => type === "Files" || type === "text/uri-list" || type === "text/plain");

/**
 * Adding data straight to the library: files of any format, links, or text, dropped anywhere on the page or picked
 * with Browse. Each one is stored the way product intake stores it, so it opens in the right editor and can be used
 * as product material. `productId` attaches new items to the product the library is filtered to.
 */
export function useDataDrop({ productId, onAdded }: { productId: string | null; onAdded: (count: number) => void }) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const depth = useRef(0);

  async function add(payload: DroppedPayload) {
    const jobs: Array<() => Promise<unknown>> = [];
    const rejected: string[] = [];
    for (const file of payload.files) {
      if (file.size === 0) {
        rejected.push(`${file.name} is empty.`);
        continue;
      }
      if (file.size > MAX_DATA_FILE_BYTES) {
        rejected.push(`${file.name} is larger than ${MAX_DATA_FILE_BYTES / 1024 / 1024} MB.`);
        continue;
      }
      jobs.push(async () =>
        api.addDataItem({ filename: file.name, mimeType: file.type || undefined, data: await readAsDataUrl(file), productId }),
      );
    }
    for (const url of payload.urls) jobs.push(() => api.addDataItem({ url, productId }));
    if (payload.text) jobs.push(() => api.addDataItem({ text: payload.text!, productId }));

    setErrors(rejected);
    if (!jobs.length) return;
    setProgress({ done: 0, total: jobs.length });
    let added = 0;
    for (const job of jobs) {
      try {
        await job();
        added += 1;
      } catch (failure) {
        rejected.push(failure instanceof Error ? failure.message : "Couldn't add one of the items.");
        setErrors([...rejected]);
      }
      setProgress((current) => (current ? { ...current, done: current.done + 1 } : current));
    }
    setProgress(null);
    if (added) onAdded(added);
  }

  const busy = progress !== null;
  const dropHandlers = {
    onDragEnter: (event: React.DragEvent) => {
      if (!carriesData(event)) return;
      event.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (event: React.DragEvent) => {
      if (!carriesData(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = busy ? "none" : "copy";
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (event: React.DragEvent) => {
      if (!carriesData(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (!busy) void add(readDrop(event.dataTransfer));
    },
  };

  return {
    dragging,
    busy,
    progress,
    errors,
    clearErrors: () => setErrors([]),
    addFiles: (files: File[]) => void add({ files, urls: [], text: null }),
    dropHandlers,
  };
}

/** The visible drop box: it wraps the library itself, so the cards sit inside the same surface that accepts files —
 * not a separate strip floating above an unrelated grid. Browse still lives in its header row for picking files. */
export function DataDropZone({
  dragging,
  busy,
  progress,
  onFiles,
  children,
}: {
  dragging: boolean;
  busy: boolean;
  progress: { done: number; total: number } | null;
  onFiles: (files: File[]) => void;
  // Optional only so createElement(DataDropZone, props, ...children) type-checks without repeating it in props —
  // in practice the caller always passes the library's own content here.
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [addedFlash, setAddedFlash] = useState(false);
  const wasBusy = useRef(false);

  useEffect(() => {
    if (wasBusy.current && !busy) {
      setAddedFlash(true);
      const timer = window.setTimeout(() => setAddedFlash(false), 1600);
      wasBusy.current = busy;
      return () => window.clearTimeout(timer);
    }
    wasBusy.current = busy;
  }, [busy]);

  const label = busy
    ? `Adding ${Math.min((progress?.done ?? 0) + 1, progress?.total ?? 1)} of ${progress?.total ?? 1}…`
    : dragging
      ? "Drop to add it to your data"
      : addedFlash
        ? "Added"
        : null;

  return h(
    "div",
    {
      // Arbitrary values reference theme tokens directly (var(--bg-elevated) etc.) rather than literal hex, so this
      // reads correctly in both themes without relying on the generic dark-mode compatibility layer in legacy.css —
      // that layer maps old hardcoded light hex to merely "not broken", not to real contrast against a dark canvas.
      // The dashed border wraps the whole library area (header row + cards), not just a strip above it, so the box
      // you can drop onto is visibly the same box the cards live in.
      className: `relative flex shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-dashed transition-colors duration-200 ${
        dragging
          ? "border-[var(--control-accent,#2864DC)] bg-[color-mix(in_srgb,var(--control-accent,#2864DC)_9%,var(--bg-elevated))]"
          : "border-[color-mix(in_srgb,var(--control-accent,#2864DC)_30%,var(--border-strong))] bg-[var(--bg-elevated)] hover:border-[color-mix(in_srgb,var(--control-accent,#2864DC)_48%,var(--border-strong))] hover:bg-[color-mix(in_srgb,var(--control-accent,#2864DC)_4%,var(--bg-elevated))]"
      }`,
    },
    h("span", {
      "aria-hidden": true,
      className: "pointer-events-none absolute inset-0 opacity-[0.035]",
      style: {
        backgroundImage: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 11px)",
        color: "var(--control-accent, #2864DC)",
      },
    }),
    h(
      "div",
      {
        className:
          "relative flex shrink-0 items-center gap-3 border-b border-[color-mix(in_srgb,var(--control-accent,#2864DC)_16%,var(--border-subtle))] px-3.5 py-2",
      },
      h(
        "span",
        {
          className: `grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
            dragging
              ? "border-[var(--control-accent,#2864DC)] bg-[var(--control-accent,#2864DC)] text-[var(--control-accent-ink,#fff)]"
              : "border-[color-mix(in_srgb,var(--control-accent,#2864DC)_30%,var(--border-default))] bg-[color-mix(in_srgb,var(--control-accent,#2864DC)_12%,var(--bg-panel))] text-[var(--control-accent,#2864DC)]"
          }`,
        },
        h(UploadCloud, { size: 17, className: busy ? "animate-pulse" : undefined }),
      ),
      h(
        "div",
        { className: "min-w-0 flex-1" },
        h(
          "p",
          { className: "truncate text-[12.5px] font-semibold text-ink", role: busy ? "status" : undefined, "aria-live": "polite" },
          label ?? `Drop files anywhere here, any format, up to ${MAX_DATA_FILE_BYTES / 1024 / 1024} MB each`,
        ),
      ),
      h("input", {
        ref: inputRef,
        type: "file",
        multiple: true,
        className: "sr-only",
        tabIndex: -1,
        "aria-hidden": true,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) onFiles(files);
        },
      }),
      h(
        "button",
        {
          type: "button",
          disabled: busy,
          onClick: () => inputRef.current?.click(),
          className:
            "shrink-0 rounded-md border border-[#DDE0E4] bg-white px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-not-allowed disabled:opacity-40",
        },
        "Browse files",
      ),
    ),
    h("div", { className: "relative flex min-h-0 flex-1 flex-col px-3.5 pb-2 pt-3" }, children),
  );
}
