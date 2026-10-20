"use client";

import { Fragment, useRef, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { h } from "@/lib/h";

export type LinkEdgeData = { onDelete?: () => void; deleteLabel?: string };
export type LinkEdgeType = Edge<LinkEdgeData, "junctionLink">;

/**
 * A wire into an ad set (or into a merger). Hovering it reveals a small delete button at its middle; clicking that
 * cuts the link. A short grace period on leave lets the pointer travel from the wire to the button.
 */
export function LinkEdge({ id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, markerEnd, style, data }: EdgeProps<LinkEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const [hover, setHover] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const enter = () => {
    window.clearTimeout(timer.current);
    setHover(true);
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHover(false), 180);
  };
  return h(
    Fragment,
    null,
    h("g", { onMouseEnter: enter, onMouseLeave: leave }, h(BaseEdge, { id, path, markerEnd, style, interactionWidth: 26 })),
    data?.onDelete
      ? h(
          EdgeLabelRenderer,
          null,
          h(
            "button",
            {
              type: "button",
              className: `link-edge-delete nodrag nopan${hover ? " is-visible" : ""}`,
              style: { transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` },
              onMouseEnter: enter,
              onMouseLeave: leave,
              onClick: (event: React.MouseEvent) => {
                event.stopPropagation();
                setHover(false);
                data.onDelete?.();
              },
              "aria-label": data.deleteLabel ?? "Remove link",
              title: data.deleteLabel ?? "Remove link",
            },
            h(X, { size: 13, strokeWidth: 2.6, "aria-hidden": true }),
          ),
        )
      : null,
  );
}
