"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogTrigger,
} from "@/components/motion-primitives/morphing-dialog";
import { h } from "@/lib/h";
import type { StrategyNode } from "@/types/strategy";

type FocusedStrategyNodeProps = {
  node: StrategyNode;
  selected: boolean;
  onSelect: () => void;
  compact: ReactNode;
  expanded: ReactNode;
  triggerClassName: string;
};

export function FocusedStrategyNode({
  node,
  selected,
  onSelect,
  compact,
  expanded,
  triggerClassName,
}: FocusedStrategyNodeProps) {
  return h(
    MorphingDialog,
    null,
    h(
      MorphingDialogTrigger,
      {
        canOpen: selected,
        sharedLayout: false,
        onActivate: onSelect,
        className: triggerClassName,
        "aria-label": selected ? `Focus audience: ${node.label}` : `Select audience: ${node.label}`,
      },
      compact,
    ),
    h(
      MorphingDialogContainer,
      null,
      h(
        MorphingDialogContent,
        {
          sharedLayout: false,
          className:
            "focused-strategy-node-surface audience-node-card relative w-[min(640px,calc(100vw-2rem))] max-h-[78vh] overflow-hidden rounded-xl border border-[#DDE0E4] bg-white text-left shadow-[0_24px_80px_rgba(21,23,26,.22)]",
        },
        h(
          MorphingDialogClose,
          {
            className:
              "absolute right-4 top-4 z-20 grid h-8 w-8 place-items-center rounded-full border border-[#DDE0E4] bg-white text-muted transition-colors hover:border-[#A8AFB8] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2 motion-reduce:transition-none",
            "aria-label": "Close focused strategy node",
          },
          h(X, { size: 15, "aria-hidden": true }),
        ),
        expanded,
      ),
    ),
  );
}
