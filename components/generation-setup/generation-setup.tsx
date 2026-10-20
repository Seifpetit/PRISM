"use client";

import { useEffect, useState } from "react";
import { Eye, Library, Loader2, Lock, Plus, Sparkles } from "lucide-react";
import type { ContextSource } from "@/api/api";
import { api } from "@/api/api";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { DrawerPages } from "@/components/drawer-pages";
import { AddSourcePanel } from "@/components/generation-setup/add-source";
import { ContextPreview } from "@/components/generation-setup/context-preview";
import { SourceList } from "@/components/generation-setup/source-list";
import { useContextLibrary } from "@/components/generation-setup/use-context-library";
import { PromptTemplateEditor } from "@/components/strategy-nodes/prompt-template-editor";
import { h } from "@/lib/h";
import { contextRequest, GENERATORS, instructionKey, MAX_INSTRUCTIONS, MAX_SOURCES, setupSummary, toggled, usableSelection, type GeneratorId } from "@/lib/generation-setup";
import { useGenerationSetup } from "@/store/generation-setup-store";

const NO_IDS: string[] = [];

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return h(
    "section",
    { "aria-label": title },
    h(
      "div",
      { className: "mb-2 flex items-center justify-between gap-2" },
      h("h3", { className: "mono text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, title),
      action,
    ),
    hint ? h("p", { className: "mb-2 text-[11px] leading-4 text-muted" }, hint) : null,
    children,
  );
}

const secondary =
  "inline-flex items-center gap-1.5 rounded-md border border-border-default bg-panel px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:bg-canvas " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-not-allowed disabled:opacity-40";

/**
 * The drawer behind a generator's Generate button. It keeps three things apart: the saved template (what Prism should
 * do), the Context Library (what Prism should know, chosen source by source) and instructions for the next run (what
 * to focus on this time). The confirmed Product Context is always part of a generation and is shown as such.
 */
export function GenerationSetup({ generator, productId, onGenerate, pending = false }: {
  generator: GeneratorId;
  productId: string;
  /** The generator's own button in the footer. Omitted where generating happens elsewhere (per ad set, per ad). */
  onGenerate?: () => void;
  pending?: boolean;
}) {
  const info = GENERATORS[generator];
  const library = useContextLibrary(productId);
  const saved = useGenerationSetup((state) => state.selections[productId]?.[generator]) ?? NO_IDS;
  const instructions = useGenerationSetup((state) => state.instructions[instructionKey(productId, generator)]) ?? "";
  const select = useGenerationSetup((state) => state.select);
  const forget = useGenerationSetup((state) => state.forget);
  const setInstructions = useGenerationSetup((state) => state.setInstructions);

  const [view, setView] = useState<"setup" | "preview">("setup");
  const [adding, setAdding] = useState(false);
  const [manage, setManage] = useState(false);
  // Page one is the saved template, as the drawer always was; page two is what Prism should know and focus on.
  const [page, setPage] = useState<"template" | "context">("template");
  const [deleting, setDeleting] = useState<ContextSource | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // What is selected is only ever a ready source that is still in the library.
  // Checked only against a library that has been reloaded since the last change, so a source that was just added is not
  // dropped as "missing" before the library has heard of it.
  const loaded = !library.loading && !library.error;
  const selected = library.settled ? usableSelection(saved, library.sources) : saved;
  const selectedKey = selected.join("|");
  const savedKey = saved.join("|");
  useEffect(() => {
    if (library.settled && selectedKey !== savedKey) select(productId, generator, selectedKey ? selectedKey.split("|") : []);
  }, [library.settled, selectedKey, savedKey, select, productId, generator]);

  const context = contextRequest(selected, instructions);
  const notSelected = library.sources.filter((source) => source.status === "ready" && !selected.includes(source.id)).map((source) => source.name);

  function toggle(source: ContextSource) {
    select(productId, generator, toggled(selected, source.id));
  }

  async function confirmDelete() {
    const source = deleting;
    setDeleting(null);
    if (!source) return;
    setDeleteError(null);
    try {
      await api.deleteContextSource({ id: source.id });
      forget(productId, source.id);
      library.reload();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "That source couldn't be deleted.");
    }
  }

  const generateButton = !onGenerate
    ? null
    : h(
    "button",
    {
      type: "button",
      onClick: onGenerate,
      disabled: pending,
      "aria-busy": pending || undefined,
      className:
        "prism-icon-action inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold text-white " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
    },
    pending ? h(Loader2, { size: 14, className: "animate-spin motion-reduce:animate-none", "aria-hidden": true }) : h(Sparkles, { size: 14, "aria-hidden": true }),
    pending ? `Generating ${info.label}…` : `Generate ${info.label}`,
  );

  const footer = h(
    "footer",
    { className: "flex shrink-0 items-center gap-2 border-t border-[#E7E9EC] px-4 py-3" },
    h("p", { className: "min-w-0 flex-1 truncate text-[11px] text-muted", title: setupSummary(selected.length, Boolean(context?.instructions)) }, setupSummary(selected.length, Boolean(context?.instructions))),
    page === "context" && view === "preview"
      ? h("button", { type: "button", onClick: () => setView("setup"), className: secondary }, "Back to setup")
      : h(
          "button",
          {
            type: "button",
            onClick: () => {
              setPage("context");
              setView("preview");
            },
            className: secondary,
          },
          h(Eye, { size: 13 }),
          "Preview context",
        ),
    generateButton,
  );

  const contextPage =
    view === "preview"
      ? h(ContextPreview, { productId, generator, generatorLabel: info.label, context, notIncluded: notSelected, onBack: () => setView("setup") })
      : h(
    "div",
    { className: "min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4" },
      h(
        Section,
        {
          title: "Context",
          hint: `What Prism should know. Sources are reused across generators; choose them for each one. ${info.usedBy ?? ""}`.trim(),
        },
        h(
          "div",
          { className: "flex items-center gap-2.5 rounded-lg border border-[#DDE0E4] bg-[#FAFBFC] px-3 py-2" },
          h("span", { className: "grid h-4 w-4 shrink-0 place-items-center rounded bg-ink text-white", "aria-hidden": true }, h(Lock, { size: 10 })),
          h("span", { className: "min-w-0 flex-1" }, h("span", { className: "block text-xs font-semibold text-ink" }, "Confirmed Product Context"), h("span", { className: "block text-[11px] text-muted" }, "Product facts come only from here.")),
          h("span", { className: "mono shrink-0 text-[9px] font-semibold uppercase tracking-[.1em] text-lineage" }, "Always included"),
        ),
        h(
          "div",
          { className: "mt-2" },
          library.error ? h("p", { role: "alert", className: "text-xs text-[#B42318]" }, library.error) : null,
          library.loading ? h("p", { className: "text-xs text-muted" }, "Loading the library…") : null,
          loaded && library.sources.length === 0 && !adding
            ? h(
                "div",
                { className: "rounded-lg border border-dashed border-[#DDE0E4] px-3 py-3.5 text-center" },
                h("p", { className: "text-xs font-semibold text-ink" }, "No extra sources yet"),
                h("p", { className: "mx-auto mt-1 max-w-sm text-[11px] leading-4 text-muted" }, "Add customer interviews, a sales-objection CSV, a market study or your own notes. Upload once; use them in any generator."),
              )
            : null,
          library.sources.length
            ? h(SourceList, { sources: library.sources, selectedIds: selected, manage, onToggle: toggle, onChanged: library.reload, onDelete: setDeleting })
            : null,
          deleteError ? h("p", { role: "alert", className: "mt-1.5 text-[11px] text-[#B42318]" }, deleteError) : null,
        ),
        h(
          "div",
          { className: "mt-2.5 flex flex-wrap items-center gap-2" },
          h("button", { type: "button", onClick: () => setAdding((current) => !current), "aria-expanded": adding, className: secondary }, h(Plus, { size: 13 }), "Add source"),
          library.sources.length ? h("button", { type: "button", onClick: () => setManage((current) => !current), "aria-pressed": manage, className: `${secondary} ${manage ? "!border-ink" : ""}` }, h(Library, { size: 13 }), "Manage library") : null,
          h("span", { className: "flex-1" }),
          library.sources.length ? h("span", { className: "mono text-[9px] text-muted" }, `${selected.length} of ${Math.min(MAX_SOURCES, library.sources.filter((source) => source.status === "ready").length)} selected`) : null,
        ),
        adding
          ? h(AddSourcePanel, {
              productId,
              onAdded: (added) => {
                library.reload();
                if (added.length) select(productId, generator, [...selected, ...added.map((source) => source.id)].slice(0, MAX_SOURCES));
              },
              onClose: () => setAdding(false),
            })
          : null,
      ),
      h(
        Section,
        { title: "Instructions for this run", hint: "Optional. Applies to the next generation only, then clears. It steers focus; it can't change product facts or your template." },
        h("textarea", {
          value: instructions,
          onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setInstructions(productId, generator, event.target.value),
          rows: 3,
          maxLength: MAX_INSTRUCTIONS,
          placeholder: "e.g. Focus on apartment households in Madrid and Seville. Keep French and Spainn Arabic expressions where the sources support them.",
          "aria-label": "Instructions for this run",
          className:
            "w-full resize-none rounded-lg border border-border-default bg-bg-input p-3 text-xs leading-5 text-ink outline-none " +
            "focus:border-lineage focus:ring-2 focus:ring-lineage/20",
        }),
        h("p", { className: "mt-1 text-right mono text-[9px] text-muted" }, `${instructions.length.toLocaleString("en-US")} / ${MAX_INSTRUCTIONS.toLocaleString("en-US")}`),
      ),
  );

  return h(
    "div",
    { className: "flex min-h-0 flex-1 flex-col" },
    h(DrawerPages, {
      label: `${info.label} generation setup pages`,
      active: page,
      onChange: (id) => setPage(id === "context" ? "context" : "template"),
      pages: [
        { id: "template", label: "Template" },
        { id: "context", label: "Context", badge: selected.length || (context?.instructions ? "•" : null) },
      ],
    }),
    // Both pages stay mounted, so an unsaved template edit or a typed instruction survives a look at the other page.
    h(
      "div",
      { id: "drawer-page-template", role: "tabpanel", "aria-labelledby": "drawer-page-tab-template", className: page === "template" ? "flex min-h-0 flex-1 flex-col px-4 py-4" : "hidden" },
      h(PromptTemplateEditor, { key: info.templateId, templateId: info.templateId, title: info.templateTitle, description: info.templateDescription }),
    ),
    h("div", { id: "drawer-page-context", role: "tabpanel", "aria-labelledby": "drawer-page-tab-context", className: page === "context" ? "flex min-h-0 flex-1 flex-col" : "hidden" }, contextPage),
    footer,
    h(ConfirmationDialog, {
      open: Boolean(deleting),
      title: "Delete this source?",
      description: deleting ? `“${deleting.name}” will be removed from this product's library and from every selection. Generations already made keep their record of it.` : "",
      confirmLabel: "Delete source",
      onCancel: () => setDeleting(null),
      onConfirm: () => void confirmDelete(),
    }),
  );
}
