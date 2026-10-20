"use client";

import { type ReactNode } from "react";
import { Check } from "lucide-react";
import { h } from "@/lib/h";

export type ProductWorkbenchStage = "material" | "package" | "build" | "review" | "strategy";

/**
 * Checkpoints shown in the breadcrumb. "build" is deliberately not one of
 * these — it is an unattended wait between Package and Review, not a place
 * the user does anything or would ever navigate back to.
 */
type Checkpoint = "material" | "package" | "review" | "strategy";

const checkpoints: Array<{
  id: Checkpoint;
  number: string;
  label: string;
  description: string;
}> = [
  { id: "material", number: "01", label: "Material", description: "Bring the product in" },
  { id: "package", number: "02", label: "Package", description: "Structure it" },
  { id: "review", number: "03", label: "Review", description: "Check & refine" },
  { id: "strategy", number: "04", label: "Strategy", description: "Plan the attack" },
];

/** Only checkpoints owned by onboarding's own local state can be jumped back to. */
const navigableCheckpoints = new Set<Checkpoint>(["material", "package"]);


/** Where "build" (not a checkpoint) sits relative to the real checkpoints: past Package, before Review. */
function currentCheckpointIndex(stage: ProductWorkbenchStage) {
  if (stage === "build") return checkpoints.findIndex((item) => item.id === "package") + 1;
  return checkpoints.findIndex((item) => item.id === stage);
}

export function ProductWorkbench({
  stage,
  onNavigateBack,
  children,
}: {
  stage: ProductWorkbenchStage;
  /** Jump back to an earlier, already-visited checkpoint. Omit to make the breadcrumb read-only. */
  onNavigateBack?: (stage: "material" | "package") => void;
  children?: ReactNode;
}) {
  const currentIndex = currentCheckpointIndex(stage);
  const isWaiting = stage === "build";
  return h(
    "main",
    {
      className:
        "new-product-workbench relative min-h-screen bg-canvas px-4 py-7 sm:px-6 sm:py-8",
    },
    h(
      "div",
      { className: "mx-auto w-full max-w-[1180px]" },
      h(
        "ol",
        { className: "new-product-progress", "aria-label": "New product progress" },
        ...checkpoints.map((item, index) => {
          const completed = index < currentIndex;
          const current = !isWaiting && index === currentIndex;
          const unlocked = completed && navigableCheckpoints.has(item.id) && onNavigateBack;
          const marker = h(
            "span",
            { className: "new-product-progress-marker" },
            completed ? h(Check, { size: 12, "aria-hidden": true }) : item.number,
          );
          const copy = h(
            "span",
            { className: "new-product-progress-copy" },
            h("span", { className: "new-product-progress-label" }, item.label),
            h("span", { className: "new-product-progress-description" }, item.description),
          );
          return h(
            "li",
            {
              key: item.id,
              className: `${completed ? "is-complete " : ""}${current ? "is-current" : ""}`,
              "aria-current": current ? "step" : undefined,
            },
            unlocked
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "new-product-progress-jump",
                    title: `Back to ${item.label}`,
                    onClick: () => onNavigateBack(item.id as "material" | "package"),
                  },
                  marker,
                  copy,
                )
              : h("span", { className: "new-product-progress-static" }, marker, copy),
          );
        }),
      ),
      h("div", { className: "new-product-workbench-content" }, children),
    ),
  );
}
