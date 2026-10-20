"use client";

import { useState } from "react";
import { ArrowUpRight, Plus, Trash2, X } from "lucide-react";
import type { PipelineTask } from "@/api/api";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { h } from "@/lib/h";
import { progressOf, stageAge, stageInfo, STAGES, type PipelineStageId } from "@/lib/pipeline";
import { AD_FORMAT_LABEL, AWARENESS_LABEL, type AdFormat, type AwarenessStage } from "@/types/campaign";
import { usePipelineStore } from "@/store/pipeline-store";
import { useAppStore } from "@/store/use-app-store";

const field =
  "w-full rounded-md border border-border-default bg-bg-input px-2.5 py-1.5 text-xs text-ink outline-none focus:border-lineage focus:ring-2 focus:ring-lineage/20";

function Label({ children }: { children?: React.ReactNode }) {
  return h("p", { className: "mono mb-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, children);
}

/**
 * One task in the pipeline: which stage it is in, the ad it came from, its checklist for its format, and what to write
 * down (a name for this version, notes, the live Meta ad once it launches). Text is saved when a field is left.
 */
export function TaskDrawer({ task, productId }: { task: PipelineTask; productId: string }) {
  const move = usePipelineStore((state) => state.move);
  const update = usePipelineStore((state) => state.update);
  const remove = usePipelineStore((state) => state.remove);
  const select = usePipelineStore((state) => state.select);
  const openCreatives = useAppStore((state) => state.openCreatives);
  const selectCreativeAd = useAppStore((state) => state.selectCreativeAd);
  const [title, setTitle] = useState(task.title);
  const [variant, setVariant] = useState(task.variant ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [metaAdRef, setMetaAdRef] = useState(task.metaAdRef ?? "");
  const [newItem, setNewItem] = useState("");
  const [confirming, setConfirming] = useState(false);
  const { done, total } = progressOf(task);
  const info = stageInfo(task.stage);
  const format = task.format as AdFormat;

  const save = (patch: Omit<Parameters<typeof update>[1], "id">) => void update(productId, { id: task.id, ...patch });
  const setChecklist = (next: PipelineTask["checklist"]) => save({ checklist: next });
  const addItem = () => {
    const label = newItem.trim();
    if (!label) return;
    setNewItem("");
    setChecklist([...task.checklist, { id: "", label, done: false }]);
  };

  return h(
    "aside",
    {
      "aria-label": `Task ${task.title}`,
      className:
        "strategy-inspector w-full min-h-0 shrink-0 overflow-y-auto border-l border-[#DFE2E6] bg-white lg:h-full lg:w-[420px] " +
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:max-h-[78vh] max-lg:rounded-t-2xl max-lg:shadow-[0_-12px_34px_rgba(21,23,26,.16)]",
    },
    h(
      "header",
      { className: "flex items-center gap-2 border-b border-[#E7E9EC] px-4 py-2.5" },
      h("span", { className: "mono shrink-0 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, task.adRef ?? "Task"),
      h("span", { className: "flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-semibold text-ink" }, h("span", { className: "h-2 w-2 shrink-0 rounded-full", style: { background: info.color }, "aria-hidden": true }), h("span", { className: "truncate" }, info.label)),
      h("button", { type: "button", onClick: () => select(null), "aria-label": "Close task", className: "shrink-0 rounded p-1 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" }, h(X, { size: 16 })),
    ),
    task.imageStatus === "ready" && task.imageUrl
      ? h("img", { src: task.imageUrl, alt: "", className: "block h-44 w-full object-cover" })
      : null,
    h(
      "div",
      { className: "space-y-5 p-4" },
      h(
        "div",
        null,
        h(Label, null, "Title"),
        h("input", { value: title, maxLength: 120, "aria-label": "Task title", onChange: (event: React.ChangeEvent<HTMLInputElement>) => setTitle(event.target.value), onBlur: () => title.trim() && title.trim() !== task.title && save({ title: title.trim() }), className: `${field} text-sm font-semibold` }),
      ),
      h(
        "div",
        { className: "grid grid-cols-2 gap-3" },
        h(
          "div",
          null,
          h(Label, null, "Stage"),
          h(
            "select",
            { value: task.stage, "aria-label": "Stage", onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void move(productId, task.id, event.target.value as PipelineStageId), className: field },
            ...STAGES.map((stage) => h("option", { key: stage.id, value: stage.id }, stage.label)),
          ),
        ),
        h(
          "div",
          null,
          h(Label, null, "Version"),
          h("input", { value: variant, maxLength: 60, placeholder: "e.g. 9:16, French", "aria-label": "Version name", onChange: (event: React.ChangeEvent<HTMLInputElement>) => setVariant(event.target.value), onBlur: () => variant.trim() !== (task.variant ?? "") && save({ variant: variant.trim() || null }), className: field }),
        ),
      ),
      h("p", { className: "-mt-3 text-[11px] leading-4 text-muted" }, `${info.meaning}. In this stage ${stageAge(task.stageChangedAt)}.`),
      h(
        "div",
        { className: "rounded-lg border border-[#DDE0E4] bg-[#FAFBFC] px-3 py-2.5" },
        h(
          "div",
          { className: "flex items-center gap-1.5 text-[10px] font-semibold text-muted" },
          h("span", null, AD_FORMAT_LABEL[format] ?? task.format),
          task.awareness ? h("span", null, `· ${AWARENESS_LABEL[task.awareness as AwarenessStage] ?? task.awareness}`) : null,
        ),
        h("p", { className: `mt-1 text-xs leading-5 ${task.hook ? "text-ink" : "italic text-muted"}` }, task.hook ? `“${task.hook}”` : "No hook written"),
        task.adRemoved
          ? h("p", { className: "mt-1.5 text-[11px] leading-4 text-[#9A6700]" }, "The ad this came from was deleted. The task keeps a copy of what it was.")
          : h(
              "button",
              {
                type: "button",
                onClick: () => {
                  if (!task.conceptId) return;
                  openCreatives(task.conceptId);
                  selectCreativeAd(task.adId);
                },
                className: "mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-lineage hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
              },
              "Open ad in Creatives",
              h(ArrowUpRight, { size: 12, "aria-hidden": true }),
            ),
      ),
      h(
        "div",
        null,
        h("div", { className: "mb-1.5 flex items-center justify-between" }, h(Label, null, "Checklist"), h("span", { className: "mono -mt-1.5 text-[9px] font-semibold text-muted" }, `${done}/${total}`)),
        h(
          "ul",
          { className: "space-y-1" },
          ...task.checklist.map((item) =>
            h(
              "li",
              { key: item.id, className: "group/item flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-canvas" },
              h(
                "button",
                {
                  type: "button",
                  role: "checkbox",
                  "aria-checked": item.done,
                  "aria-label": item.label,
                  onClick: () => setChecklist(task.checklist.map((entry) => (entry.id === item.id ? { ...entry, done: !entry.done } : entry))),
                  className: `grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${item.done ? "border-ink bg-ink text-white" : "border-[#8A93A0] bg-white text-transparent"}`,
                },
                "✓",
              ),
              h("span", { className: `min-w-0 flex-1 text-xs leading-5 ${item.done ? "text-muted line-through" : "text-ink"}` }, item.label),
              h(
                "button",
                {
                  type: "button",
                  onClick: () => setChecklist(task.checklist.filter((entry) => entry.id !== item.id)),
                  "aria-label": `Remove ${item.label}`,
                  className: "rounded p-1 text-muted opacity-0 hover:text-red-700 focus-visible:opacity-100 group-hover/item:opacity-100",
                },
                h(X, { size: 12 }),
              ),
            ),
          ),
        ),
        h(
          "form",
          { className: "mt-2 flex items-center gap-1.5", onSubmit: (event: React.FormEvent) => { event.preventDefault(); addItem(); } },
          h("input", { value: newItem, maxLength: 120, placeholder: "Add a step", "aria-label": "New checklist step", onChange: (event: React.ChangeEvent<HTMLInputElement>) => setNewItem(event.target.value), className: field }),
          h("button", { type: "submit", disabled: !newItem.trim(), "aria-label": "Add step", className: "grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border-default bg-panel text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40" }, h(Plus, { size: 14 })),
        ),
      ),
      h(
        "div",
        null,
        h(Label, null, "Notes"),
        h("textarea", { value: notes, rows: 4, maxLength: 4000, placeholder: "Briefs, feedback, where the files are…", "aria-label": "Notes", onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value), onBlur: () => notes.trim() !== (task.notes ?? "") && save({ notes: notes.trim() || null }), className: `${field} resize-none leading-5` }),
      ),
      h(
        "div",
        null,
        h(Label, null, "Live Meta ad"),
        h("input", { value: metaAdRef, maxLength: 200, placeholder: task.stage === "launched" ? "Ad ID or name in Ads Manager" : "Once it launches", "aria-label": "Live Meta ad", onChange: (event: React.ChangeEvent<HTMLInputElement>) => setMetaAdRef(event.target.value), onBlur: () => metaAdRef.trim() !== (task.metaAdRef ?? "") && save({ metaAdRef: metaAdRef.trim() || null }), className: field }),
      ),
      h(
        "button",
        { type: "button", onClick: () => setConfirming(true), className: "flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-[11px] font-semibold text-red-700 hover:bg-red-50" },
        h(Trash2, { size: 12 }),
        "Delete this task",
      ),
    ),
    h(ConfirmationDialog, {
      open: confirming,
      title: "Delete this task?",
      description: "It removes this production task and its checklist. The ad it came from is not touched.",
      confirmLabel: "Delete task",
      onCancel: () => setConfirming(false),
      onConfirm: () => {
        setConfirming(false);
        void remove(productId, task.id);
      },
    }),
  );
}
