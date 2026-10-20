"use client";

import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { h } from "@/lib/h";

export type PrismLineageEdge = Edge<{ generationReveal?: boolean }, "prismLineage">;

/** The blue line remains primary; the two rear paths are a one-pixel optical fringe. */
export function StrategyPrismEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<PrismLineageEdge>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  return h(
    "g",
    {
      className: `prism-lineage-edge ${data?.generationReveal ? "is-generation-reveal" : ""}`,
      "data-generation-edge-id": data?.generationReveal ? id : undefined,
      "aria-hidden": true,
    },
    h(BaseEdge, {
      id: `${id}-cyan-fringe`,
      path,
      transform: "translate(0.8 0)",
      className: "prism-edge-fringe prism-edge-fringe-cyan",
      interactionWidth: 0,
    }),
    h(BaseEdge, {
      id: `${id}-pink-fringe`,
      path,
      transform: "translate(-0.8 0)",
      className: "prism-edge-fringe prism-edge-fringe-pink",
      interactionWidth: 0,
    }),
    h(BaseEdge, {
      id,
      path,
      markerEnd,
      className: "prism-edge-core",
      style,
    }),
  );
}
