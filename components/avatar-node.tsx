"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Link2, X } from "lucide-react";
import { h } from "@/lib/h";
import type { NodeTag } from "@/lib/node-tags";
import { IngredientPlus } from "@/components/ingredient-plus";
import { PersonaPhoto } from "@/components/persona-photo";
import { personaInitials, personaMarkStyle } from "@/lib/persona-avatar";
import { useAppStore } from "@/store/use-app-store";
import type { TargetAvatar } from "@/types/strategy";

export type AvatarFlowData = {
  avatar: TargetAvatar;
  linkedAngleCount?: number;
  awaitingLink: boolean;
  tag?: NodeTag | null;
  /** An ad set uses this persona, so it stays on the canvas as one end of that ad set's joint. */
  inUse?: boolean;
};
export type AvatarFlowNode = Node<AvatarFlowData, "avatarNode">;

/** Source handle ids on the avatar node. */
export const AVATAR_ANGLE_HANDLE_ID = "avatar-angle-out";
export const AVATAR_CONCEPT_HANDLE_ID = "avatar-concept-out";
/** Target handle on top: the product's persona wire lands here. */
export const AVATAR_FROM_PRODUCT_HANDLE_ID = "avatar-from-product";

/**
 * A persona on the canvas. It is a rounded violet profile card with a round portrait and the age range in its
 * header, so it reads as "a person" next to the blue angle cards and the amber offer tickets.
 */
export function AvatarNodeCard({ data, selected }: NodeProps<AvatarFlowNode>) {
  const { avatar, linkedAngleCount = 0, awaitingLink, tag, inUse = false } = data;
  const removeAvatarFromCanvas = useAppStore((state) => state.removeAvatarFromCanvas);

  return h(
    "div",
    { className: "group relative w-[190px]" },
    h(
      "div",
      {
        className: ["ingredient-card ingredient-persona", awaitingLink ? "is-awaiting" : selected ? "is-selected" : ""]
          .filter(Boolean)
          .join(" "),
        role: "button",
        tabIndex: 0,
        "aria-label": `Target avatar: ${avatar.label}${linkedAngleCount ? `, linked to ${linkedAngleCount} ${linkedAngleCount === 1 ? "angle" : "angles"}` : ""}`,
      },
      // Left: outgoing link to Angles. Right: outgoing edge into the ad sets that use this persona.
      h(Handle, { type: "target", id: AVATAR_FROM_PRODUCT_HANDLE_ID, position: Position.Top, className: "!h-2 !w-2 !border-2" }),
      h(Handle, { type: "source", id: AVATAR_ANGLE_HANDLE_ID, position: Position.Left, className: "!h-2 !w-2 !border-2" }),
      h(Handle, { type: "source", id: AVATAR_CONCEPT_HANDLE_ID, position: Position.Right, className: "!h-2 !w-2 !border-2" }),
      inUse
        ? null
        : h(
            "button",
            {
              type: "button",
              onClick: (event: React.MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                removeAvatarFromCanvas(avatar.id);
              },
              className:
                "absolute right-1.5 top-1.5 z-20 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-muted opacity-0 shadow-sm transition-opacity hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100",
              "aria-label": `Remove ${avatar.label} from canvas`,
              title: "Remove from canvas",
            },
            h(X, { size: 11 }),
          ),
      h(
        "div",
        { className: "ingredient-band" },
        h(
          "span",
          {
            className: "ingredient-portrait persona-mark",
            style: personaMarkStyle(avatar.id),
            "aria-hidden": true,
          },
          personaInitials(avatar.label),
          h(PersonaPhoto, { avatarId: avatar.id, size: 96 }),
        ),
        h(
          "div",
          { className: "min-w-0 leading-tight" },
          h("span", { className: "block" }, "Persona"),
          avatar.ageRange ? h("span", { className: "mt-0.5 block text-[8px] tracking-[.1em] opacity-85" }, `Age ${avatar.ageRange}`) : null,
        ),
        tag ? h("span", { className: "node-ref-tag ml-auto", title: `Reference ${tag.code}` }, tag.code) : null,
      ),
      h(
        "div",
        { className: "ingredient-body" },
        h("p", { className: "line-clamp-3 text-[11.5px] font-semibold leading-[1.3] text-ink" }, avatar.label),
        h("p", { className: "mt-1 truncate text-[9.5px] text-muted" }, avatar.profession),
        awaitingLink
          ? h("p", { className: "mono mt-1.5 text-[9px] font-semibold text-[color:var(--type-persona)]" }, "Click angles to link")
          : linkedAngleCount > 0
            ? h(
                "p",
                { className: "mono mt-1.5 flex items-center gap-1 text-[9px] font-semibold text-[color:var(--type-persona)]" },
                h(Link2, { size: 9 }),
                `${linkedAngleCount} ${linkedAngleCount === 1 ? "angle" : "angles"}`,
              )
            : null,
      ),
    ),
    h(IngredientPlus, { axis: "avatar", ingredientId: avatar.id, label: avatar.label }),
  );
}
