"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Trash2, Workflow } from "lucide-react";
import type { PipelineTask } from "@/api/api";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { FORMAT_ICON } from "@/components/creatives/ad-card";
import { TaskDrawer } from "@/components/pipeline/task-drawer";
import { h } from "@/lib/h";
import { groupByStage, progressOf, stageAge, STAGES, type PipelineStageId, type StageInfo } from "@/lib/pipeline";
import { AD_FORMAT_LABEL, AWARENESS_LABEL, VIDEO_FORMATS, type AdFormat, type AwarenessStage } from "@/types/campaign";
import { EMPTY_TASKS, usePipelineStore } from "@/store/pipeline-store";
import { useAppStore } from "@/store/use-app-store";

interface Drag {
  id: string;
  /** Where it would land if dropped now: a stage and a position among that column's other tasks. */
  over: { stage: PipelineStageId; index: number } | null;
}

/**
 * The card's own cover image, read live off its ad (see pipeline-repository.mjs), or the quiet placeholder
 * standing in for it — same rule as everywhere else an ad's image shows up: "none" (no request yet, including
 * every task made before thumbnails existed, and any task whose ad has since been removed) and "failed" both
 * read as a plain format icon, never as something broken. Same treatment as an ad card in Creatives, carried the
 * rest of the way: ref, format and awareness sit as pills over the top-left corner; the title, its production
 * progress and how long it's sat in this stage all read over the blurred scrim at the bottom. There is no plain
 * footer left to hold them — the photo is the whole card, so every badge earns its keep as an overlay instead of
 * a row of chrome pushing the image down. A task's title is never blank — the backend derives it from the ad's
 * hook when nothing was written (see backend/pipeline/service.mjs) — so unlike an ad card fresh off "Plan an ad
 * manually", there is no fallback case to render differently here.
 */
function TaskPhoto({ task, Icon }: { task: PipelineTask; Icon: typeof FORMAT_ICON[keyof typeof FORMAT_ICON] }) {
  const ready = task.imageStatus === "ready" && Boolean(task.imageUrl);
  const format = task.format as AdFormat;
  const { done, total } = progressOf(task);
  const awareness = task.awareness ? (AWARENESS_LABEL[task.awareness as AwarenessStage] ?? task.awareness) : null;
  const meta = [task.variant, `${done}/${total}`, `In stage ${stageAge(task.stageChangedAt)}`].filter(Boolean).join(" · ");
  return h(
    "span",
    { className: `task-card-photo ${ready ? "" : "is-placeholder"}` },
    ready
      ? h("img", { src: task.imageUrl as string, alt: "" })
      : h(
          "span",
          { className: "flex flex-col items-center gap-1.5", "aria-hidden": true },
          h(Icon, { size: 20, strokeWidth: 1.6 }),
          task.imageStatus === "pending" ? h(Loader2, { size: 10, className: "ad-thumb-spinner animate-spin motion-reduce:animate-none" }) : null,
        ),
    ready ? h("span", { className: "ad-card-scrim", "aria-hidden": true }) : null,
    h(
      "span",
      { className: "ad-card-top" },
      h("span", { className: `ad-card-pill ${ready ? "" : "is-light"}` }, h("span", { className: "dot", "aria-hidden": true }), task.adRef ?? "Ad"),
      h("span", { className: `ad-card-pill ${ready ? "" : "is-light"}` }, h(Icon, { size: 10, strokeWidth: 2.2, "aria-hidden": true }), AD_FORMAT_LABEL[format] ?? task.format),
      awareness ? h("span", { className: `ad-card-pill ${ready ? "" : "is-light"}` }, awareness) : null,
    ),
    h(
      "span",
      { className: `ad-card-bottom ${ready ? "" : "is-plain"}` },
      h("span", { className: "ad-card-title" }, task.title),
      h(
        "span",
        { className: `ad-card-meta ${task.adRemoved ? "is-warning" : ""}` },
        task.adRemoved ? `Ad removed · ${meta}` : meta,
      ),
    ),
    ready && VIDEO_FORMATS.has(format) ? h("span", { className: "ad-card-play", "aria-hidden": true }, h(Play, { size: 10, fill: "currentColor" })) : null,
  );
}

function TaskCard({ task, dragging, fresh, onOpen, onDelete, onDragStart, onDragEnd, selected }: {
  task: PipelineTask;
  dragging: boolean;
  /** Just arrived from Creatives: shown with a brief highlight. */
  fresh: boolean;
  selected: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const format = task.format as AdFormat;
  const Icon = FORMAT_ICON[format] ?? FORMAT_ICON.video;
  return h(
    "div",
    { className: "group/task relative" },
    h(
    "div",
    {
      role: "button",
      tabIndex: 0,
      draggable: true,
      "data-task-id": task.id,
      "aria-pressed": selected,
      "aria-label": `${task.adRef ?? "Ad"} ${task.title}${task.variant ? `, ${task.variant}` : ""}`,
      onClick: onOpen,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      },
      onDragStart,
      onDragEnd,
      className:
        "task-card cursor-grab overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-colors active:cursor-grabbing " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage " +
        `${selected ? "border-ink" : "border-[#DDE0E4] hover:border-[#B9C0C9]"} ${dragging ? "opacity-40" : ""} ${fresh ? "pipeline-task-fresh" : ""}`,
    },
    h(TaskPhoto, { task, Icon }),
    ),
    // Shown on hover or keyboard focus (and always on touch screens); it asks before deleting.
    h(
      "button",
      {
        type: "button",
        onClick: onDelete,
        "aria-label": `Delete task ${task.adRef ?? ""} ${task.title}`.replace(/\s+/g, " ").trim(),
        title: "Delete this task",
        className:
          "absolute right-1.5 top-1.5 z-[1] grid h-6 w-6 place-items-center rounded-md border border-[#DDE0E4] bg-panel text-muted opacity-0 shadow-sm transition-opacity " +
          "hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage " +
          "group-hover/task:opacity-100 group-focus-within/task:opacity-100 [@media(hover:none)]:opacity-100",
      },
      h(Trash2, { size: 12, strokeWidth: 2, "aria-hidden": true }),
    ),
  );
}

function Column({ stage, tasks, drag, selectedId, freshId, onOpen, onDelete, onDragStart, onDragEnd, onOver, onDrop }: {
  stage: StageInfo;
  tasks: PipelineTask[];
  drag: Drag | null;
  selectedId: string | null;
  freshId: string | null;
  onOpen: (task: PipelineTask) => void;
  onDelete: (task: PipelineTask) => void;
  onDragStart: (task: PipelineTask, event: React.DragEvent) => void;
  onDragEnd: () => void;
  onOver: (stage: PipelineStageId, index: number) => void;
  onDrop: (stage: PipelineStageId, index: number) => void;
}) {
  const over = drag?.over?.stage === stage.id ? drag.over.index : null;
  const others = tasks.filter((task) => task.id !== drag?.id);

  // Where a drop at the pointer would land: before the first other card whose middle is below it.
  function indexAt(event: React.DragEvent<HTMLDivElement>) {
    const cards = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-task-id]")].filter((card) => card.dataset.taskId !== drag?.id);
    const found = cards.findIndex((card) => {
      const box = card.getBoundingClientRect();
      return event.clientY < box.top + box.height / 2;
    });
    return found === -1 ? cards.length : found;
  }

  // Where the dragged card would land: a dashed slot in the app's blue, the same language as the "Plan an ad" tile.
  const marker = h("div", { key: "drop", className: "pipeline-drop-slot mono", "aria-hidden": true }, "Drop here");
  const items: React.ReactNode[] = [];
  tasks.forEach((task) => {
    if (task.id !== drag?.id && over !== null && others.indexOf(task) === over) items.push(marker);
    items.push(
      h(TaskCard, {
        key: task.id,
        task,
        dragging: drag?.id === task.id,
        selected: selectedId === task.id,
        fresh: freshId === task.id,
        onOpen: () => onOpen(task),
        onDelete: () => onDelete(task),
        onDragStart: (event) => onDragStart(task, event),
        onDragEnd,
      }),
    );
  });
  if (over !== null && over >= others.length) items.push(marker);

  return h(
    "section",
    { className: `pipeline-column flex w-[268px] shrink-0 flex-col ${over !== null ? "is-over" : ""}`, "aria-label": `${stage.label}, ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}` },
    h(
      "header",
      { className: "flex items-center gap-2 px-3 py-2.5", title: stage.meaning },
      h("span", { className: "h-2 w-2 shrink-0 rounded-full", style: { background: stage.color }, "aria-hidden": true }),
      h("h3", { className: "min-w-0 flex-1 truncate text-xs font-semibold text-ink" }, stage.label),
      h("span", { className: "mono text-[10px] font-semibold text-muted" }, String(tasks.length)),
    ),
    h(
      "div",
      {
        className: "flex min-h-[240px] flex-1 flex-col gap-2 px-2 pb-2",
        onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
          if (!drag) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onOver(stage.id, indexAt(event));
        },
        onDrop: (event: React.DragEvent<HTMLDivElement>) => {
          if (!drag) return;
          event.preventDefault();
          onDrop(stage.id, indexAt(event));
        },
      },
      ...items,
      !tasks.length && over === null ? h("p", { className: "px-1 pt-1 text-[11px] leading-4 text-muted" }, stage.meaning) : null,
    ),
  );
}

/**
 * The production pipeline: one board for every format, a column for each stage, and a card for each piece of creative
 * work that came from a Prism ad. Cards are dragged between columns (or moved from the task's own drawer) and open in a
 * drawer with the checklist for their format.
 */
export function PipelineView({ productId, productName }: { productId: string; productName: string }) {
  const tasks = usePipelineStore((state) => state.tasksByProduct[productId]) ?? EMPTY_TASKS;
  const loaded = usePipelineStore((state) => state.loaded[productId]) === true;
  const error = usePipelineStore((state) => state.error);
  const selectedTaskId = usePipelineStore((state) => state.selectedTaskId);
  const freshTaskId = usePipelineStore((state) => state.freshTaskId);
  const clearFresh = usePipelineStore((state) => state.clearFresh);
  const remove = usePipelineStore((state) => state.remove);
  const load = usePipelineStore((state) => state.load);
  const move = usePipelineStore((state) => state.move);
  const select = usePipelineStore((state) => state.select);
  const dismissError = usePipelineStore((state) => state.dismissError);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [deleting, setDeleting] = useState<PipelineTask | null>(null);

  useEffect(() => {
    void load(productId);
  }, [productId, load]);

  // A task that was just sent here (or opened from Creatives) is scrolled to; a new arrival is also focused. The highlight
  // fades after a couple of seconds.
  // It runs once per task shown, as soon as its card exists, and not again when the board updates around it.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedTaskId) {
      shown.current = null;
      return;
    }
    const key = selectedTaskId;
    if (shown.current === key) return;
    const card = document.querySelector<HTMLElement>(`[data-task-id="${selectedTaskId}"]`);
    if (!card) return;
    shown.current = key;
    card.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    if (freshTaskId === selectedTaskId) card.focus({ preventScroll: true });
  }, [selectedTaskId, freshTaskId, tasks]);
  useEffect(() => {
    if (!freshTaskId) return;
    const timer = window.setTimeout(clearFresh, 2200);
    return () => window.clearTimeout(timer);
  }, [freshTaskId, clearFresh]);

  const columns = groupByStage(tasks);
  const selected = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const active = tasks.filter((task) => task.stage !== "launched").length;

  return h(
    "div",
    { className: "flex min-h-0 flex-1" },
    h(
      "div",
      { className: "flex min-w-0 flex-1 flex-col" },
      h(
        "div",
        { className: "flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-5" },
        h(
          "div",
          null,
          h("p", { className: "mono text-[9px] font-semibold uppercase tracking-[.16em] text-muted" }, `Pipeline · ${productName}`),
          h("h1", { className: "mt-1 text-lg font-semibold tracking-[-.02em] text-ink" }, "Creative production"),
        ),
        h("p", { className: "text-[11px] text-muted" }, tasks.length ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} · ${active} in progress · drag a card to move it` : ""),
      ),
      error
        ? h(
            "p",
            { role: "alert", className: "mx-5 mb-3 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" },
            error,
            h("button", { type: "button", onClick: dismissError, className: "font-semibold underline" }, "Dismiss"),
          )
        : null,
      loaded && !tasks.length
        ? h(
            "div",
            { className: "mx-5 mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-[#DDE0E4] px-4 py-3" },
            h(Workflow, { size: 16, className: "shrink-0 text-muted", "aria-hidden": true }),
            h("p", { className: "min-w-0 flex-1 text-xs leading-5 text-muted" }, "Nothing in the pipeline yet. Open an ad in Creatives and press Send to Pipeline to start tracking its production."),
            h("button", { type: "button", onClick: () => setActiveTab("creatives"), className: "rounded-md border border-border-default bg-panel px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-canvas" }, "Go to Creatives"),
          )
        : null,
      // The page scrolls; the columns do not. The row is as tall as its fullest column, and every column matches it, so the
      // height depends on the most tasks in any stage and not on the window or on whether a drawer is open.
      h(
        "div",
        { className: "min-h-0 flex-1 overflow-auto" },
        h(
        "div",
        { className: "flex w-max min-w-full items-stretch gap-3 px-5 pb-5", role: "list", "aria-label": "Pipeline stages" },
        ...STAGES.map((stage) =>
          h(
            "div",
            { key: stage.id, role: "listitem", className: "flex" },
            h(Column, {
              stage,
              tasks: columns[stage.id],
              drag,
              selectedId: selectedTaskId,
              freshId: freshTaskId,
              onOpen: (task) => select(task.id === selectedTaskId ? null : task.id),
              onDelete: setDeleting,
              onDragStart: (task, event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", task.id);
                setDrag({ id: task.id, over: null });
              },
              onDragEnd: () => setDrag(null),
              onOver: (over, index) => setDrag((current) => (current && (current.over?.stage !== over || current.over.index !== index) ? { ...current, over: { stage: over, index } } : current)),
              onDrop: (over, index) => {
                const id = drag?.id;
                setDrag(null);
                if (id) void move(productId, id, over, index);
              },
            }),
          ),
        ),
        ),
      ),
    ),
    selected ? h(TaskDrawer, { key: selected.id, task: selected, productId }) : null,
    h(ConfirmationDialog, {
      open: Boolean(deleting),
      title: "Delete this task?",
      description: deleting ? `It removes ${deleting.adRef ?? "this"} task${deleting.variant ? ` (${deleting.variant})` : ""} and its checklist. The ad it came from is not touched.` : "",
      confirmLabel: "Delete task",
      onCancel: () => setDeleting(null),
      onConfirm: () => {
        const target = deleting;
        setDeleting(null);
        if (target) void remove(productId, target.id);
      },
    }),
  );
}
