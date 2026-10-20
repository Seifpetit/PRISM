"use client";

import { useState } from "react";
import { FileText, Loader2, StickyNote, X } from "lucide-react";
import { api, type ContextSource } from "@/api/api";
import { h } from "@/lib/h";
import { ACCEPTED_FILES, ACCEPTED_LABEL, fileKindOf, fileProblem, MAX_NOTE } from "@/lib/generation-setup";

const tab = (selected: boolean) =>
  `rounded-md border px-2.5 py-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${
    selected ? "border-ink bg-ink text-white" : "border-[#DDE0E4] text-muted hover:text-ink"
  }`;

const field =
  "w-full rounded-md border border-border-default bg-bg-input px-2.5 py-1.5 text-xs text-ink outline-none focus:border-lineage focus:ring-2 focus:ring-lineage/20";

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result.split(",")[1] ?? "") : reject(new Error(`Could not read ${file.name}.`)));
    reader.readAsDataURL(file);
  });

/**
 * Adds a file or a written note to the product's Context Library. Files are read on the server; a file that can't be
 * read is reported here with the reason and kept in the list as failed, never quietly dropped.
 */
export function AddSourcePanel({ productId, onAdded, onClose }: { productId: string; onAdded: (added: ContextSource[]) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"file" | "note">("file");
  const [market, setMarket] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  async function addFiles(files: File[]) {
    setBusy(true);
    setProblems([]);
    const added: ContextSource[] = [];
    const failures: string[] = [];
    for (const file of files) {
      const problem = fileProblem(file);
      if (problem) {
        failures.push(problem);
        continue;
      }
      try {
        const kind = fileKindOf(file.name);
        const source = await api.addContextSource({
          productId,
          kind: "file",
          fileName: file.name,
          mimeType: file.type || undefined,
          market: market.trim() || undefined,
          ...(kind === "pdf" ? { contentBase64: await readBase64(file) } : { text: await file.text() }),
        });
        if (source.status === "ready") added.push(source);
        else failures.push(source.statusDetail ?? `“${file.name}” couldn't be read.`);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `“${file.name}” couldn't be added.`);
      }
    }
    setBusy(false);
    setProblems(failures);
    if (added.length || failures.length) onAdded(added);
    if (added.length && !failures.length) onClose();
  }

  async function addNote() {
    setBusy(true);
    setProblems([]);
    try {
      const source = await api.addContextSource({ productId, kind: "note", name: name.trim() || undefined, text, market: market.trim() || undefined });
      onAdded([source]);
      onClose();
    } catch (error) {
      setProblems([error instanceof Error ? error.message : "The note couldn't be added."]);
    } finally {
      setBusy(false);
    }
  }

  return h(
    "div",
    { className: "mt-2.5 rounded-lg border border-[#DDE0E4] bg-white p-3", "aria-label": "Add a source", "data-add-source": "" },
    h(
      "div",
      { className: "flex items-center gap-1.5" },
      h("button", { type: "button", onClick: () => setMode("file"), "aria-pressed": mode === "file", className: tab(mode === "file") }, "Upload file"),
      h("button", { type: "button", onClick: () => setMode("note"), "aria-pressed": mode === "note", className: tab(mode === "note") }, "Write a note"),
      h("span", { className: "flex-1" }),
      h("button", { type: "button", onClick: onClose, "aria-label": "Close add source", className: "rounded p-1 text-muted hover:bg-canvas hover:text-ink" }, h(X, { size: 14 })),
    ),
    mode === "file"
      ? h(
          "div",
          { className: "mt-2.5" },
          h(
            "button",
            {
              type: "button",
              disabled: busy,
              onClick: (event: React.MouseEvent<HTMLButtonElement>) => event.currentTarget.closest("[data-add-source]")?.querySelector<HTMLInputElement>("input[type=file]")?.click(),
              className:
                "flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-[#C9CED4] px-3 py-3.5 text-center text-xs text-muted " +
                "hover:border-ink hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-wait disabled:opacity-60",
            },
            busy ? h(Loader2, { size: 16, className: "animate-spin motion-reduce:animate-none" }) : h(FileText, { size: 16 }),
            h("span", { className: "font-semibold" }, busy ? "Reading…" : "Choose files"),
            h("span", { className: "text-[11px]" }, `${ACCEPTED_LABEL}. Read here, in text; PDFs need a text layer.`),
          ),
          h("input", {
            type: "file",
            multiple: true,
            accept: ACCEPTED_FILES,
            className: "sr-only",
            "aria-label": "Choose files to add",
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              if (files.length) void addFiles(files);
            },
          }),
        )
      : h(
          "div",
          { className: "mt-2.5 space-y-2" },
          h("input", { value: name, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value), placeholder: "Name (optional), e.g. Seville call notes", maxLength: 120, "aria-label": "Note name", className: field }),
          h("textarea", { value: text, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setText(event.target.value.slice(0, MAX_NOTE)), rows: 5, placeholder: "Customer quotes, objections, what you heard in the market…", "aria-label": "Note text", className: `${field} resize-none leading-5` }),
          h(
            "div",
            { className: "flex items-center justify-between gap-2" },
            h("span", { className: "mono text-[9px] text-muted" }, `${text.length.toLocaleString("en-US")} / ${MAX_NOTE.toLocaleString("en-US")}`),
            h(
              "button",
              { type: "button", disabled: busy || !text.trim(), onClick: () => void addNote(), className: "inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40" },
              busy ? h(Loader2, { size: 13, className: "animate-spin motion-reduce:animate-none" }) : h(StickyNote, { size: 13 }),
              "Add note",
            ),
          ),
        ),
    h(
      "label",
      { className: "mt-2.5 block" },
      h("span", { className: "mono mb-1 block text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, "Market (optional)"),
      h("input", { value: market, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setMarket(event.target.value), placeholder: "e.g. Spain", maxLength: 60, className: field }),
    ),
    problems.length
      ? h("ul", { role: "alert", className: "mt-2.5 space-y-1" }, ...problems.map((problem, index) => h("li", { key: index, className: "text-[11px] leading-4 text-[#B42318]" }, problem)))
      : null,
  );
}
