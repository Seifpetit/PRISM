"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";

export type AvatarLinkEdgeData = { avatarId: string; angleId: string; active?: boolean };
export type AvatarLinkFlowEdge = Edge<AvatarLinkEdgeData, "avatarLink">;

/** The dashed Target Avatar -> Angle link. Click to arm the combo; the inline X cuts it. */
export function AvatarLinkEdge({
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
}: EdgeProps<AvatarLinkFlowEdge>) {
  const unlinkAvatarAngle = useAppStore((state) => state.unlinkAvatarAngle);
  const selectAvatar = useAppStore((state) => state.selectAvatar);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.4,
  });

  const armCombo = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (data?.avatarId && data?.angleId) {
      selectAvatar(data.avatarId);
    }
  };

  return h(
    "g",
    { className: `avatar-link-edge${data?.active ? " is-active" : ""}` },
    h(BaseEdge, { id, path, markerEnd, style, interactionWidth: 28 }),
    // Wide invisible hit path so the whole link is clickable to arm the combo.
    h("path", {
      d: path,
      fill: "none",
      stroke: "transparent",
      strokeWidth: 24,
      style: { cursor: "pointer" },
      onClick: armCombo,
    }),
    data?.avatarId && data?.angleId
      ? h(
          EdgeLabelRenderer,
          null,
          h(
            "button",
            {
              type: "button",
              className: "avatar-link-edge__cut nodrag nopan",
              style: {
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: "all",
              },
              onClick: (event: React.MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                unlinkAvatarAngle(data.avatarId, data.angleId);
              },
              "aria-label": "Delete this avatar-to-angle link",
              title: "Delete link",
            },
            h(X, { size: 11, strokeWidth: 2.5 }),
          ),
        )
      : null,
  );
}
