"use client";

import { Lightbulb, Tag, UserRound, type LucideIcon } from "lucide-react";
import { h } from "@/lib/h";

function Row({ kind, Icon, label, value }: { kind: "persona" | "angle" | "offer"; Icon: LucideIcon; label: string; value: string }) {
  const dead = value.startsWith("Removed ");
  return h(
    "div",
    { className: `adset-row is-${kind} ${dead ? "is-dead" : ""}` },
    h("span", { className: "adset-tile" }, h(Icon, { size: 10, strokeWidth: 2.4 })),
    h("span", { className: "adset-row-label" }, label),
    h("span", { className: `min-w-0 flex-1 truncate text-[11px] font-semibold ${dead ? "italic text-muted" : "text-ink"}`, title: value }, value),
  );
}

/**
 * The strategic identity of an ad set, in the same three colours as its card on the canvas. It is read-only on
 * purpose: everything planned inside the ad set executes this concept, and changing it is a Strategy action.
 */
export function ConceptIdentity({ persona, angle, offer, color }: { persona: string; angle: string; offer: string; color?: string }) {
  return h(
    "div",
    { className: `adset-card ${color ? "is-tracked" : ""}`, style: color ? ({ "--track": color } as React.CSSProperties) : undefined, role: "group", "aria-label": "Ad set concept" },
    h(Row, { kind: "persona", Icon: UserRound, label: "Persona", value: persona }),
    h(Row, { kind: "angle", Icon: Lightbulb, label: "Angle", value: angle }),
    h(Row, { kind: "offer", Icon: Tag, label: "Offer", value: offer }),
  );
}
