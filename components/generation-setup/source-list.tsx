"use client";

import { useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet, FileText, Loader2, Pencil, StickyNote, Trash2 } from "lucide-react";
import { api, type ContextSource } from "@/api/api";
import { h } from "@/lib/h";
import { isUsable, KIND_LABEL, MAX_NOTE, MAX_SOURCES, sizeLabel } from "@/lib/generation-setup";

const ICON = { pdf: FileText, text: FileText, csv: FileSpreadsheet, note: StickyNote } as const;
const VIEW_LIMIT = 3000;

const STATUS = {
  ready: { label: "Ready", className: "text-lineage" },
  processing: { label: "Processing", className: "text-muted" },
  failed: { label: "Failed", className: "text-[#B42318]" },
} as const;

const smallButton =
  "inline-flex items-center gap-1 rounded-md border border-[#DDE0E4] px-2 py-1 text-[11px] font-semibold text-muted hover:text-ink " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-not-allowed disabled:opacity-40";

const field =
  "w-full rounded-md border border-border-default bg-bg-input px-2.5 py-1.5 text-xs text-ink outline-none focus:border-lineage focus:ring-2 focus:ring-lineage/20";

/** Reading, renaming, editing (notes) and deleting one source, shown under its row in manage mode. */
function ManageSource({ source, onChanged, onDelete }: { source: ContextSource; onChanged: () => void; onDelete: (source: ContextSource) => void }) {
  const [panel, setPanel] = useState<"view" | "rename" | "edit" | null>(null);
  const [content, setContent] = useState<{ text: string; failed?: string } | null>(null);
  const [name, setName] = useState(source.name);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(next: "view" | "edit") {
    setPanel(next);
    setError(null);
    setBusy(true);
    try {
      const loaded = await api.contextSourceContent({ id: source.id });
      setContent({ text: loaded.text });
      setText(loaded.text);
    } catch (failure) {
      setContent({ text: "", failed: failure instanceof Error ? failure.message : "The text couldn't be loaded." });
    } finally {
      setBusy(false);
    }
  }

  async function save(patch: { name?: string; text?: string }) {
    setBusy(true);
    setError(null);
    try {
      await api.updateContextSource({ id: source.id, ...patch });
      setPanel(null);
      onChanged();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }

  return h(
    "div",
    { className: "mt-1.5 pl-6" },
    h(
      "div",
      { className: "flex flex-wrap items-center gap-1.5" },
      source.status === "ready" ? h("button", { type: "button", onClick: () => (panel === "view" ? setPanel(null) : void open("view")), className: smallButton, "aria-expanded": panel === "view" }, "View text") : null,
      h("button", { type: "button", onClick: () => setPanel(panel === "rename" ? null : "rename"), className: smallButton }, h(Pencil, { size: 11 }), "Rename"),
      source.kind === "note" ? h("button", { type: "button", onClick: () => (panel === "edit" ? setPanel(null) : void open("edit")), className: smallButton }, "Edit note") : null,
      h("button", { type: "button", onClick: () => onDelete(source), className: `${smallButton} hover:!border-red-200 hover:!bg-red-50 hover:!text-red-700` }, h(Trash2, { size: 11 }), "Delete"),
    ),
    panel === "view"
      ? h(
          "div",
          { className: "mt-1.5" },
          busy ? h("p", { className: "text-[11px] text-muted" }, "Loading…") : null,
          content?.failed ? h("p", { className: "text-[11px] text-[#B42318]" }, content.failed) : null,
          content && !content.failed
            ? h(
                "div",
                null,
                h("pre", { className: "max-h-44 overflow-auto whitespace-pre-wrap rounded-md border border-[#E4E7EB] bg-[#FAFBFC] p-2 font-mono text-[11px] leading-4 text-ink" }, content.text.slice(0, VIEW_LIMIT)),
                content.text.length > VIEW_LIMIT ? h("p", { className: "mt-1 text-[10px] text-muted" }, `Showing the first ${VIEW_LIMIT.toLocaleString("en-US")} of ${content.text.length.toLocaleString("en-US")} characters.`) : null,
              )
            : null,
        )
      : null,
    panel === "rename"
      ? h(
          "form",
          { className: "mt-1.5 flex items-center gap-1.5", onSubmit: (event: React.FormEvent) => { event.preventDefault(); if (name.trim()) void save({ name: name.trim() }); } },
          h("input", { value: name, autoFocus: true, maxLength: 120, "aria-label": "Source name", onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value), className: field }),
          h("button", { type: "submit", disabled: busy || !name.trim(), className: `${smallButton} shrink-0` }, busy ? h(Loader2, { size: 11, className: "animate-spin" }) : h(Check, { size: 11 }), "Save"),
        )
      : null,
    panel === "edit"
      ? h(
          "div",
          { className: "mt-1.5 space-y-1.5" },
          h("textarea", { value: text, rows: 6, disabled: busy, "aria-label": "Note text", onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setText(event.target.value.slice(0, MAX_NOTE)), className: `${field} resize-none leading-5` }),
          h("p", { className: "text-[10px] text-muted" }, "Saving a changed note makes a new version; earlier generations keep the version they used."),
          h("button", { type: "button", disabled: busy || !text.trim(), onClick: () => void save({ text }), className: smallButton }, busy ? h(Loader2, { size: 11, className: "animate-spin" }) : h(Check, { size: 11 }), "Save note"),
        )
      : null,
    error ? h("p", { role: "alert", className: "mt-1.5 text-[11px] text-[#B42318]" }, error) : null,
  );
}

function SourceRow({ source, selected, atLimit, manage, onToggle, onChanged, onDelete }: {
  source: ContextSource;
  selected: boolean;
  atLimit: boolean;
  manage: boolean;
  onToggle: (source: ContextSource) => void;
  onChanged: () => void;
  onDelete: (source: ContextSource) => void;
}) {
  const usable = isUsable(source);
  const disabled = !usable || (!selected && atLimit);
  const status = STATUS[source.status];
  const Icon = ICON[source.kind];
  const meta = [KIND_LABEL[source.kind], source.summary, sizeLabel(source.sizeBytes), source.market, source.version > 1 ? `v${source.version}` : null].filter(Boolean).join(" · ");
  return h(
    "li",
    { className: `rounded-lg border px-3 py-2 ${selected ? "border-ink bg-[#F6F7F9]" : "border-[#DDE0E4] bg-white"}` },
    h(
      "button",
      {
        type: "button",
        role: "checkbox",
        "aria-checked": selected,
        "aria-disabled": disabled || undefined,
        disabled,
        onClick: () => onToggle(source),
        title: !usable ? "This source can't be used until it has been read successfully" : !selected && atLimit ? `Up to ${MAX_SOURCES} sources per generation` : undefined,
        className: "flex w-full items-start gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-not-allowed",
      },
      h("span", { className: `mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${selected ? "border-ink bg-ink text-white" : "border-[#8A93A0] bg-white text-transparent"} ${disabled ? "opacity-40" : ""}`, "aria-hidden": true }, h(Check, { size: 11, strokeWidth: 3 })),
      h(
        "span",
        { className: `min-w-0 flex-1 ${disabled && !usable ? "opacity-80" : ""}` },
        h(
          "span",
          { className: "flex items-center gap-2" },
          h(Icon, { size: 13, className: "shrink-0 text-muted", "aria-hidden": true }),
          h("span", { className: "min-w-0 flex-1 truncate text-xs font-semibold text-ink" }, source.name),
          h("span", { className: `mono shrink-0 text-[9px] font-semibold uppercase tracking-[.1em] ${status.className}` }, status.label),
        ),
        h("span", { className: "mt-0.5 block truncate text-[11px] text-muted" }, meta),
        source.status === "failed" ? h("span", { className: "mt-1 flex items-start gap-1 text-[11px] leading-4 text-[#B42318]" }, h(AlertTriangle, { size: 12, className: "mt-0.5 shrink-0" }), source.statusDetail ?? "It couldn't be read.") : null,
        source.status === "ready" && source.warnings.length ? h("span", { className: "mt-1 block text-[11px] leading-4 text-[#9A6700]" }, source.warnings[0]) : null,
      ),
    ),
    manage ? h(ManageSource, { source, onChanged, onDelete }) : null,
  );
}

/** The product's library as a list of choices: select a source to use it in this generator, or open manage mode to read, rename, edit or delete. */
export function SourceList({ sources, selectedIds, manage, onToggle, onChanged, onDelete }: {
  sources: ContextSource[];
  selectedIds: string[];
  manage: boolean;
  onToggle: (source: ContextSource) => void;
  onChanged: () => void;
  onDelete: (source: ContextSource) => void;
}) {
  const atLimit = selectedIds.length >= MAX_SOURCES;
  return h(
    "ul",
    { className: "space-y-1.5", "aria-label": "Context sources" },
    ...sources.map((source) => h(SourceRow, { key: source.id, source, selected: selectedIds.includes(source.id), atLimit, manage, onToggle, onChanged, onDelete })),
  );
}
