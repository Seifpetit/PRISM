"use client";

import { useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import type { CampaignAd } from "@/types/campaign";
import { h } from "@/lib/h";
import { badgeFor, stageInfo, tasksForAd } from "@/lib/pipeline";
import { EMPTY_TASKS, usePipelineStore } from "@/store/pipeline-store";
import { useAppStore } from "@/store/use-app-store";

/**
 * The production pipeline's place on an ad card in the tray: top right, just left of the delete icon (clear of the step
 * count). An ad that is not in the pipeline shows a small "Pipeline" button with the prism gradient on hover, which sends it
 * there in one click. An ad that is in the pipeline shows a badge with the stage of its furthest task (and "+2" if it has
 * more) in the same place, which opens that task on the board. Sending also opens the board, on the new task.
 */
export function PipelineSlot({ productId, ad, reference }: { productId: string; ad: CampaignAd; reference: string }) {
  const tasks = tasksForAd(usePipelineStore((state) => state.tasksByProduct[productId]) ?? EMPTY_TASKS, ad.id);
  const send = usePipelineStore((state) => state.send);
  const showTask = usePipelineStore((state) => state.showTask);
  const [busy, setBusy] = useState(false);
  const badge = badgeFor(tasks);

  if (badge) {
    const info = stageInfo(badge.task.stage);
    const more = badge.more ? `, and ${badge.more} more` : "";
    return h(
      "button",
      {
        type: "button",
        onClick: () => showTask(badge.task.id),
        title: `In the pipeline: ${info.label}${badge.more ? ` (+${badge.more} more)` : ""}`,
        "aria-label": `Open ${reference} in the pipeline, ${info.label}${more}`,
        className:
          "absolute right-9 top-2 z-[1] inline-flex h-6 max-w-[96px] items-center gap-1 rounded-full border border-[#DDE0E4] bg-panel px-2 text-[10px] font-semibold text-ink " +
          "hover:border-[#B9C0C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
      },
      h("span", { className: "h-1.5 w-1.5 shrink-0 rounded-full", style: { background: info.color }, "aria-hidden": true }),
      h("span", { className: "truncate" }, badge.label),
      badge.more ? h("span", { className: "shrink-0 text-muted" }, `+${badge.more}`) : null,
    );
  }

  async function transfer() {
    setBusy(true);
    const task = await send(productId, { id: ad.id, reference });
    setBusy(false);
    // Sent: open the Pipeline on the new task. A refusal is shown in the Creatives page's own error banner, since this
    // button has no room for a message.
    if (task) showTask(task.id, true);
    else useAppStore.setState({ campaignError: usePipelineStore.getState().error ?? "The ad could not be sent to the pipeline." });
  }

  // Shown on hover or keyboard focus (and always on touch screens, which have no hover), and while it is sending. The
  // wrapper places it; the button inside carries the prism gradient (the same fill as the Generate ads buttons).
  return h(
    "span",
    { className: `absolute right-9 top-2 z-[1] transition-opacity ${busy ? "opacity-100" : "opacity-0"} group-hover/ad:opacity-100 group-focus-within/ad:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100` },
    h(
      "button",
      {
        type: "button",
        disabled: busy,
        onClick: () => void transfer(),
        "aria-busy": busy || undefined,
        "aria-label": `Send ${reference} to the pipeline`,
        title: "Send to Pipeline",
        className:
          "prism-icon-action inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[10px] font-semibold text-white whitespace-nowrap " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-1 disabled:cursor-wait",
      },
      busy ? h(Loader2, { size: 11, className: "animate-spin motion-reduce:animate-none", "aria-hidden": true }) : h(ArrowRightLeft, { size: 11, strokeWidth: 2.2, "aria-hidden": true }),
      "Pipeline",
    ),
  );
}
