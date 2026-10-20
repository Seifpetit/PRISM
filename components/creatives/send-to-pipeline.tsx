"use client";

import { useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import type { CampaignAd } from "@/types/campaign";
import { h } from "@/lib/h";
import { stageInfo, tasksForAd } from "@/lib/pipeline";
import { EMPTY_TASKS, usePipelineStore } from "@/store/pipeline-store";

/**
 * Sends an ad to the production pipeline. It does not move or copy the ad: it creates a production task linked to it,
 * in Planned. The same ad can be sent again for another version (a 9:16 cut, a translation), and each version is its own
 * task. Once an ad has tasks, they are listed here with their stage and open on the Pipeline board when clicked.
 */
export function SendToPipeline({ productId, ad, reference }: { productId: string; ad: CampaignAd; reference: string }) {
  const tasks = tasksForAd(usePipelineStore((state) => state.tasksByProduct[productId]) ?? EMPTY_TASKS, ad.id);
  const send = usePipelineStore((state) => state.send);
  const showTask = usePipelineStore((state) => state.showTask);
  const error = usePipelineStore((state) => state.error);
  const [naming, setNaming] = useState(false);
  const [variant, setVariant] = useState("");
  const [busy, setBusy] = useState(false);
  const first = tasks.length === 0;

  async function submit() {
    setBusy(true);
    const task = await send(productId, { id: ad.id, reference }, first ? undefined : variant);
    setBusy(false);
    if (task) {
      setNaming(false);
      setVariant("");
      // Sent: open the Pipeline on the new task.
      showTask(task.id, true);
    }
  }

  const open = (id: string) => showTask(id);

  return h(
    "section",
    { "aria-label": "Production pipeline", className: "space-y-2" },
    h(
      "button",
      {
        type: "button",
        disabled: busy,
        "aria-busy": busy || undefined,
        "aria-expanded": first ? undefined : naming,
        onClick: () => (first ? void submit() : setNaming((current) => !current)),
        className:
          "prism-contour h-10 px-5 text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70",
      },
      busy ? h(Loader2, { size: 15, className: "animate-spin motion-reduce:animate-none", "aria-hidden": true }) : h(ArrowRightLeft, { size: 15, "aria-hidden": true }),
      first ? "Send to Pipeline" : "Send another version to Pipeline",
    ),
    naming
      ? h(
          "form",
          { className: "flex items-center gap-1.5", onSubmit: (event: React.FormEvent) => { event.preventDefault(); void submit(); } },
          h("input", {
            value: variant,
            autoFocus: true,
            maxLength: 60,
            placeholder: "Name this version, e.g. 9:16 cut, French",
            "aria-label": "Version name",
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setVariant(event.target.value),
            className: "w-full rounded-md border border-border-default bg-bg-input px-2.5 py-1.5 text-xs text-ink outline-none focus:border-lineage focus:ring-2 focus:ring-lineage/20",
          }),
          h("button", { type: "submit", disabled: busy, className: "shrink-0 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 disabled:opacity-50" }, "Send"),
        )
      : null,
    tasks.length
      ? h(
          "ul",
          { className: "flex flex-wrap gap-1.5", "aria-label": "In the pipeline" },
          ...tasks.map((task) =>
            h(
              "li",
              { key: task.id },
              h(
                "button",
                { type: "button", onClick: () => open(task.id), title: "Open in the pipeline", className: "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#DDE0E4] px-2 py-1 text-[10px] font-semibold text-ink hover:border-[#B9C0C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" },
                h("span", { className: "h-1.5 w-1.5 shrink-0 rounded-full", style: { background: stageInfo(task.stage).color }, "aria-hidden": true }),
                h("span", { className: "truncate" }, `${stageInfo(task.stage).label}${task.variant ? ` · ${task.variant}` : ""}`),
              ),
            ),
          ),
        )
      : null,
    error && !busy ? h("p", { role: "alert", className: "text-[11px] text-red-700" }, error) : null,
  );
}
