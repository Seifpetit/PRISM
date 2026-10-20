"use client";

import { ChevronRight } from "lucide-react";
import { h } from "@/lib/h";
import { getLineage } from "@/lib/lineage";
import { useAppStore } from "@/store/use-app-store";
import { Surface } from "@/components/ui/surface";

// A campaign is not a strategy node, so the trail covers the part of the map that is one: Product > Angle.
const STAGES = [
  { type: "product", label: "Product" },
  { type: "angle", label: "Angle" },
] as const;

/** Stage breadcrumb for the selected node. Floats at the bottom of the canvas beside the zoom controls. */
export function LineageBreadcrumb() {
  const nodes = useAppStore((state) => state.nodes);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectNode = useAppStore((state) => state.selectNode);
  const activeProductId = useAppStore((state) => state.activeProductId);
  const lineage = selectedNodeId ? getLineage(selectedNodeId, nodes) : [];
  const selected = nodes.find((node) => node.id === selectedNodeId);

  return h(
    Surface,
    {
      as: "nav",
      variant: "floating",
      "aria-label": "Creative lineage levels",
      className: "lineage-grammar flex w-max max-w-full items-center gap-1 overflow-x-auto px-2.5 py-1.5",
    },
    ...STAGES.flatMap((stage, index) => {
      const ancestor = lineage.find((node) => node.type === stage.type);
      const isCurrent = selected?.type === stage.type;
      const isPassed = Boolean(ancestor);
      const button = h(
        "button",
        {
          key: stage.type,
          type: "button",
          disabled: !ancestor && stage.type !== "product",
          onClick: () => selectNode(ancestor?.id ?? (stage.type === "product" ? activeProductId : null)),
          className: `shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${isCurrent ? "bg-lineage text-white" : isPassed ? "text-lineage hover:bg-blue-50" : "text-muted/55 disabled:cursor-default"}`,
          "aria-current": isCurrent ? "step" : undefined,
        },
        stage.label,
      );
      return index === STAGES.length - 1
        ? [button]
        : [
            button,
            h(ChevronRight, {
              key: `${stage.type}-arrow`,
              size: 13,
              className: isPassed ? "shrink-0 text-lineage" : "shrink-0 text-[#B8BDC5]",
              "aria-hidden": true,
            }),
          ];
    }),
  );
}
