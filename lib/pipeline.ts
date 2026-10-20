// The production pipeline as the client sees it: the stages and what each means, tasks grouped into columns, the
// optimistic result of a move, and small summaries for badges. Pure: only types are imported, so it is tested alone.

import type { PipelineTask } from "@/api/api";

export type PipelineStageId = "planned" | "script_brief" | "approved" | "in_production" | "in_editing" | "in_review" | "ready_to_launch" | "launched";

export interface StageInfo {
  id: PipelineStageId;
  label: string;
  /** A short form for tight places, such as the badge on an ad card. */
  short: string;
  /** What being in this stage means, in one line. */
  meaning: string;
  /** The dot colour: cool and quiet at the start, warm while work is under way, green at the end. */
  color: string;
}

export const STAGES: StageInfo[] = [
  { id: "planned", label: "Planned", short: "Planned", meaning: "Creative direction, format, hook, bridge and CTA defined", color: "var(--muted)" },
  { id: "script_brief", label: "Script / Brief", short: "Brief", meaning: "Production instructions drafted: a script, or a design brief for static formats", color: "var(--prism-blue)" },
  { id: "approved", label: "Approved for production", short: "Approved", meaning: "Someone has reviewed and approved the concept", color: "var(--prism-violet)" },
  { id: "in_production", label: "In production", short: "Production", meaning: "Filming, design, asset collection or AI generation underway", color: "var(--prism-pink)" },
  { id: "in_editing", label: "In editing", short: "Editing", meaning: "Assembly, copy, subtitles, graphics and revisions", color: "var(--prism-amber)" },
  { id: "in_review", label: "In review", short: "Review", meaning: "Final creative and ad copy awaiting approval", color: "var(--prism-violet)" },
  { id: "ready_to_launch", label: "Ready to launch", short: "Ready", meaning: "Final asset, primary text, headline, CTA and destination ready", color: "var(--status-success)" },
  { id: "launched", label: "Launched", short: "Launched", meaning: "Linked to a live Meta ad", color: "var(--status-success)" },
];

export const STAGE_IDS: PipelineStageId[] = STAGES.map((stage) => stage.id);

export const stageInfo = (id: string): StageInfo => STAGES.find((stage) => stage.id === id) ?? STAGES[0];

export const progressOf = (task: PipelineTask) => ({ done: task.checklist.filter((item) => item.done).length, total: task.checklist.length });

const byOrder = (a: PipelineTask, b: PipelineTask) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);

/** Every stage's tasks, in column order; a stage nobody is in is an empty list, so the board always has all its columns. */
export function groupByStage(tasks: PipelineTask[]): Record<PipelineStageId, PipelineTask[]> {
  const columns = Object.fromEntries(STAGE_IDS.map((id) => [id, [] as PipelineTask[]])) as Record<PipelineStageId, PipelineTask[]>;
  for (const task of [...tasks].sort(byOrder)) (columns[task.stage as PipelineStageId] ?? columns.planned).push(task);
  return columns;
}

/**
 * The tasks as they will be once a task is dropped into a stage at a position, so the board can show the move at once and
 * the server confirms it afterwards. The target column is renumbered 1, 2, 3… exactly as the server does.
 */
export function moveInList(tasks: PipelineTask[], id: string, stage: PipelineStageId, index: number | null, now = new Date().toISOString()): PipelineTask[] {
  const moving = tasks.find((task) => task.id === id);
  if (!moving) return tasks;
  const others = tasks.filter((task) => task.stage === stage && task.id !== id).sort(byOrder);
  const at = index === null ? others.length : Math.max(0, Math.min(index, others.length));
  const order = [...others.slice(0, at), moving, ...others.slice(at)].map((task) => task.id);
  return tasks.map((task) => {
    const position = order.indexOf(task.id);
    if (position < 0) return task;
    return task.id === id
      ? { ...task, stage, sortOrder: position + 1, stageChangedAt: task.stage === stage ? task.stageChangedAt : now }
      : { ...task, sortOrder: position + 1 };
  });
}

/** The tasks of one ad, furthest along first. */
export function tasksForAd(tasks: PipelineTask[], adId: string): PipelineTask[] {
  return tasks.filter((task) => task.adId === adId).sort((a, b) => STAGE_IDS.indexOf(b.stage as PipelineStageId) - STAGE_IDS.indexOf(a.stage as PipelineStageId) || a.createdAt.localeCompare(b.createdAt));
}

/** The badge for an ad in Creatives: the stage of its furthest task, and how many more it has. */
export function badgeFor(tasks: PipelineTask[]): { task: PipelineTask; label: string; more: number } | null {
  if (!tasks.length) return null;
  const [lead] = tasks;
  return { task: lead, label: stageInfo(lead.stage).short, more: tasks.length - 1 };
}

/** How long a task has been in its stage: "today", "1 day", "5 days". */
export function stageAge(since: string, now = Date.now()): string {
  const days = Math.max(0, Math.floor((now - new Date(since).getTime()) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}
