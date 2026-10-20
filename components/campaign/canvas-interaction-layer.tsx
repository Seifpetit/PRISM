"use client";

import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import { useCampaignLabels } from "@/components/campaign/use-campaign-labels";
import { EMPTY_SLOT_LABEL, type SlotAxis } from "@/lib/ad-set-slots";

// The size an ad set node has on the canvas (240 wide, about 132 tall), so the ghost and the dropped node match.
export const AD_SET_GHOST_W = 240;
export const AD_SET_GHOST_H = 132;

const AXIS_COLOR: Record<SlotAxis, string> = { avatar: "var(--type-persona)", angle: "var(--type-angle)", offer: "var(--type-offer)" };
const AXIS_NAME: Record<SlotAxis, string> = { avatar: "persona", angle: "angle", offer: "offer" };

/**
 * The two moments that follow the cursor over the canvas.
 *  - Placing: "New ad set" attaches a ghost ad set to the cursor. A click (either button) drops an empty ad set
 *    there; Escape cancels. While it is active the layer catches the pointer so nothing underneath is touched.
 *  - Linking: a plus on an ingredient starts a link. A wire follows the cursor from that ingredient, and the next
 *    click on an ad set with that slot open links it. The wire never catches the pointer.
 */
export function CanvasInteractionLayer() {
  const ghost = useAppStore((state) => state.adSetGhost);
  const pending = useAppStore((state) => state.pendingLink);
  const cancelGhost = useAppStore((state) => state.cancelAdSetGhost);
  const cancelLink = useAppStore((state) => state.cancelLink);
  const placeEmptyAdSet = useAppStore((state) => state.placeEmptyAdSet);
  const labels = useCampaignLabels();
  const reactFlow = useReactFlow();
  const rootRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  // Escape ends whichever moment is active.
  useEffect(() => {
    if (!ghost && !pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelGhost();
      cancelLink();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cancelGhost, cancelLink, ghost, pending]);

  // The linking wire: from the ingredient's right edge to the cursor, redrawn on every move without re-rendering.
  useEffect(() => {
    if (!pending) return;
    const sourceId = pending.axis === "avatar" ? `avatar-${pending.ingredientId}` : pending.ingredientId;
    const draw = (clientX: number, clientY: number) => {
      const root = rootRef.current?.getBoundingClientRect();
      const source = document.querySelector(`.react-flow__node[data-id="${CSS.escape(sourceId)}"]`)?.getBoundingClientRect();
      if (!root || !source || !pathRef.current) return;
      const x0 = source.right - root.left;
      const y0 = source.top + source.height / 2 - root.top;
      const x1 = clientX - root.left;
      const y1 = clientY - root.top;
      const pull = Math.max(60, Math.abs(x1 - x0) * 0.45);
      pathRef.current.setAttribute("d", `M ${x0} ${y0} C ${x0 + pull} ${y0}, ${x1 - pull} ${y1}, ${x1} ${y1}`);
    };
    const source = document.querySelector(`.react-flow__node[data-id="${CSS.escape(sourceId)}"]`)?.getBoundingClientRect();
    if (source) draw(source.right, source.top + source.height / 2);
    const onMove = (event: PointerEvent) => draw(event.clientX, event.clientY);
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [pending]);

  const moveGhost = (event: React.PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current?.getBoundingClientRect();
    const node = ghostRef.current;
    if (!root || !node) return;
    const zoom = reactFlow.getZoom();
    const x = event.clientX - root.left - (AD_SET_GHOST_W * zoom) / 2;
    const y = event.clientY - root.top - (AD_SET_GHOST_H * zoom) / 2;
    node.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    node.style.opacity = "1";
  };
  const dropGhost = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const at = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    void placeEmptyAdSet(at.x - AD_SET_GHOST_W / 2, at.y - AD_SET_GHOST_H / 2);
  };

  const linkLabel = (() => {
    if (!pending) return "";
    return pending.axis === "avatar" ? labels.avatar(pending.ingredientId) : pending.axis === "angle" ? labels.angle(pending.ingredientId) : labels.offer(pending.ingredientId);
  })();

  return h(
    "div",
    { ref: rootRef, className: "canvas-interaction-layer", "aria-hidden": !ghost && !pending },
    ghost
      ? h(
          "div",
          { className: "adset-ghost-catcher", onPointerMove: moveGhost, onClick: dropGhost, onContextMenu: dropGhost },
          h(
            "div",
            { ref: ghostRef, className: "adset-ghost", style: { width: AD_SET_GHOST_W, height: AD_SET_GHOST_H, opacity: 0 } },
            h("span", { className: "adset-ghost-head" }),
            h("span", { className: "adset-ghost-title" }, "New ad set"),
            h("span", { className: "adset-ghost-row" }),
            h("span", { className: "adset-ghost-row" }),
            h("span", { className: "adset-ghost-row" }),
          ),
          h("p", { className: "canvas-hint-pill" }, "Click to drop the ad set here · Esc to cancel"),
        )
      : null,
    pending
      ? h(
          "div",
          null,
          h(
            "svg",
            { className: "link-pending-wire", "aria-hidden": true },
            h("path", { ref: pathRef, d: "", style: { stroke: AXIS_COLOR[pending.axis] } }),
          ),
          h(
            "p",
            { className: "canvas-hint-pill" },
            h("i", { style: { background: AXIS_COLOR[pending.axis] }, "aria-hidden": true }),
            `Linking ${linkLabel === EMPTY_SLOT_LABEL ? AXIS_NAME[pending.axis] : `“${linkLabel}”`} · click an ad set that needs a ${AXIS_NAME[pending.axis]} · Esc to cancel`,
          ),
        )
      : null,
  );
}
