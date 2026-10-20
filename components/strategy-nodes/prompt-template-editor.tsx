"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Redo2, Save, Undo2 } from "lucide-react";
import { api, type CreativeExplorationPromptTemplate } from "@/api/api";
import { h } from "@/lib/h";

type EditableTemplate = Pick<CreativeExplorationPromptTemplate, "content" | "isCustom" | "updatedAt"> & { version: number | null };

/** Where a template is read from and saved to. Defaults to the Creative Exploration templates. */
export interface PromptTemplateSource {
  load: () => Promise<EditableTemplate>;
  save: (content: string) => Promise<EditableTemplate>;
}

/** Editable input template for one AI operation: undo/redo, copy, save for next runs. */
export function PromptTemplateEditor({
  templateId,
  title,
  description,
  source,
  headless = false,
  onSaved,
}: {
  templateId: string;
  title: string;
  description: string;
  source?: PromptTemplateSource;
  /** Hide the title row (the host already shows it, e.g. a modal header). */
  headless?: boolean;
  onSaved?: () => void;
}) {
  const sourceRef = useRef<PromptTemplateSource>({
    load: () => api.creativeExplorationPromptTemplate({ templateId }),
    save: (content) => api.updateCreativeExplorationPromptTemplate({ templateId, content }),
  });
  if (source) sourceRef.current = source;
  const [template, setTemplate] = useState<EditableTemplate | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const lastCommittedRef = useRef("");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void sourceRef.current
      .load()
      .then((result) => {
        if (!active) return;
        setTemplate(result);
        setDraft(result.content);
        lastCommittedRef.current = result.content;
        setHistory([]);
        setFuture([]);
        setStatus("idle");
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [templateId]);

  const dirty = template !== null && draft !== template.content;
  const canUndo = history.length > 0;
  const canRedo = future.length > 0;
  const saveEnabled = status !== "loading" && status !== "saving" && dirty && Boolean(draft.trim());

  function editDraft(next: string) {
    setDraft(next);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const checkpoint = lastCommittedRef.current;
      if (next === checkpoint) return;
      setHistory((current) => [...current, checkpoint]);
      setFuture([]);
      lastCommittedRef.current = next;
    }, 500);
  }

  function undo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    const current = lastCommittedRef.current;
    setHistory((entries) => entries.slice(0, -1));
    setFuture((entries) => [current, ...entries]);
    lastCommittedRef.current = previous;
    setDraft(previous);
  }

  function redo() {
    if (!future.length) return;
    const next = future[0];
    const current = lastCommittedRef.current;
    setFuture((entries) => entries.slice(1));
    setHistory((entries) => [...entries, current]);
    lastCommittedRef.current = next;
    setDraft(next);
  }

  async function save() {
    setStatus("saving");
    try {
      const saved = await sourceRef.current.save(draft);
      setTemplate(saved);
      onSaved?.();
      setDraft(saved.content);
      lastCommittedRef.current = saved.content;
      setHistory([]);
      setFuture([]);
      setStatus("saved");
      window.setTimeout(() => setStatus((current) => (current === "saved" ? "idle" : current)), 2200);
    } catch {
      setStatus("error");
    }
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access denied; nothing further to do.
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (saveEnabled) void save();
    }
  }

  return h(
    "section",
    { className: "flex min-h-0 flex-1 flex-col" },
    h(
      "div",
      { className: "flex items-center justify-between gap-3" },
      headless ? h("span", null) : h("h3", { className: "min-w-0 truncate text-sm font-semibold text-ink" }, title),
      h(
        "div",
        { className: "flex shrink-0 items-center gap-2" },
        h(
          "span",
          { className: "mono text-[9px] font-semibold uppercase tracking-[.1em] text-muted" },
          template ? (template.isCustom ? (template.version ? `Customized · v${template.version}` : "Customized") : "Default") : " ",
        ),
        h(
          "button",
          {
            type: "button",
            onClick: () => void copyAll(),
            disabled: !draft,
            className:
              "inline-flex items-center gap-1.5 rounded-md border border-border-default bg-panel px-2 py-1 text-[11px] font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50",
          },
          copied ? h(Check, { size: 13, className: "text-lineage" }) : h(Copy, { size: 13 }),
          copied ? "Copied" : "Copy all",
        ),
      ),
    ),
    headless ? null : h("p", { className: "mt-1 truncate text-[11px] leading-4 text-muted", title: description }, description),
    h("textarea", {
      value: draft,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => editDraft(event.target.value),
      onKeyDown,
      disabled: status === "loading",
      spellCheck: false,
      "aria-label": title,
      className:
        "prism-angle-template-field mt-2 w-full flex-1 resize-none rounded-lg border border-border-default " +
        "bg-bg-input p-3.5 font-mono text-[12.5px] leading-[1.65] text-ink outline-none " +
        "focus:border-lineage focus:ring-2 focus:ring-lineage/20 disabled:opacity-60",
    }),
    h(
      "div",
      { className: "mt-2.5 flex items-center justify-between gap-2" },
      h(
        "p",
        { className: "min-w-0 truncate text-[11px] leading-4 text-muted" },
        status === "error"
          ? "Something went wrong. Try again."
          : dirty
            ? "Unsaved changes"
            : template?.updatedAt
              ? `Last saved ${new Date(template.updatedAt).toLocaleString()}`
              : " ",
      ),
      h(
        "div",
        { className: "flex shrink-0 items-center gap-1.5" },
        h(
          "button",
          {
            type: "button",
            onClick: undo,
            disabled: !canUndo,
            title: "Undo",
            "aria-label": "Undo last edit",
            className:
              "grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border-default bg-panel " +
              "text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40",
          },
          h(Undo2, { size: 14 }),
        ),
        h(
          "button",
          {
            type: "button",
            onClick: redo,
            disabled: !canRedo,
            title: "Redo",
            "aria-label": "Redo last undone edit",
            className:
              "grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border-default bg-panel " +
              "text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40",
          },
          h(Redo2, { size: 14 }),
        ),
        h(
          "button",
          {
            type: "button",
            onClick: () => void save(),
            disabled: !saveEnabled,
            className:
              (saveEnabled ? "prism-save-button-active text-white " : "bg-ink text-white hover:bg-ink/90 ") +
              "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold " +
              "disabled:cursor-not-allowed disabled:opacity-40",
          },
          status === "saving"
            ? h(Loader2, { size: 14, className: "animate-spin" })
            : status === "saved"
              ? h(Check, { size: 14 })
              : h(Save, { size: 14 }),
          status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save for next runs",
        ),
      ),
    ),
  );
}
