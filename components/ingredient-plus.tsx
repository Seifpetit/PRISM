"use client";

import { Plus } from "lucide-react";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import type { SlotAxis } from "@/lib/ad-set-slots";

const AXIS_COLOR: Record<SlotAxis, string> = { avatar: "var(--type-persona)", angle: "var(--type-angle)", offer: "var(--type-offer)" };
const AXIS_NAME: Record<SlotAxis, string> = { avatar: "persona", angle: "angle", offer: "offer" };

/**
 * The satellite on every persona, angle and offer: a big floating bubble that appears on hover, like a genie out
 * of a bottle. Pressing it starts a link from this ingredient: the next click on an ad set that is missing one
 * links it. Pressing it again cancels. It sits on the node's wrapper, so hovering the bubble keeps it open.
 */
export function IngredientPlus({ axis, ingredientId, label }: { axis: SlotAxis; ingredientId: string; label: string }) {
  const startLink = useAppStore((state) => state.startLink);
  const cancelLink = useAppStore((state) => state.cancelLink);
  const armed = useAppStore((state) => state.pendingLink?.ingredientId === ingredientId);
  return h(
    "button",
    {
      type: "button",
      className: `ingredient-plus nodrag nopan${armed ? " is-armed" : ""}`,
      style: { "--axis-color": AXIS_COLOR[axis] } as React.CSSProperties,
      onClick: (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (armed) cancelLink();
        else startLink(axis, ingredientId);
      },
      "aria-label": armed ? `Cancel linking ${label}` : `Link this ${AXIS_NAME[axis]} to an ad set`,
      "aria-pressed": armed,
      title: armed ? "Cancel" : `Link this ${AXIS_NAME[axis]} to an ad set`,
    },
    h(Plus, { size: 22, strokeWidth: 2.7, "aria-hidden": true }),
  );
}
