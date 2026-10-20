"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import type { Campaign, CampaignConcept } from "@/types/campaign";

type Slot = "avatar" | "angle" | "offer";
const SLOTS: Slot[] = ["avatar", "angle", "offer"];
const SLOT_LABEL: Record<Slot, string> = { avatar: "persona", angle: "angle", offer: "offer" };

const selectClass =
  "h-9 w-full rounded-md border border-[#D8DCE1] bg-white pl-2.5 pr-7 text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage";

function SlotRelink({ concept, campaign, slot, options }: { concept: CampaignConcept; campaign: Campaign; slot: Slot; options: Array<{ value: string; label: string }> }) {
  const relinkConcept = useAppStore((state) => state.relinkConcept);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const label = SLOT_LABEL[slot];

  // Linking must not make this ad set identical to another one in the campaign.
  const field = `${slot}Id` as const;
  const free = options.filter((option) => {
    const next = { avatarId: concept.avatarId, angleId: concept.angleId, offerId: concept.offerId, [field]: option.value };
    return !campaign.concepts.some(
      (other) => other.id !== concept.id && other.avatarId === next.avatarId && other.angleId === next.angleId && other.offerId === next.offerId,
    );
  });

  return h(
    "div",
    { className: "rounded-lg border border-dashed border-amber-300/70 p-3", role: "group", "aria-label": `Relink the ${label}` },
    h("p", { className: "text-xs font-semibold text-ink" }, `The ${label} was removed`),
    h(
      "p",
      { className: "mt-0.5 text-[11px] leading-4 text-muted" },
      free.length
        ? `Link another ${label} to bring this ad set back. Its ads and dates stay.`
        : `There is no other ${label} this ad set can take. Add or generate one, then come back.`,
    ),
    free.length
      ? h(
          "div",
          { className: "mt-2 flex items-center gap-2" },
          h(Select, {
            ariaLabel: `Choose a ${label} to link`,
            value: choice,
            onChange: setChoice,
            options: [{ value: "", label: `Choose ${slot === "angle" ? "an" : slot === "offer" ? "an" : "a"} ${label}…` }, ...free],
            className: selectClass,
            wrapperClassName: "min-w-0 flex-1",
          }),
          h(
            "button",
            {
              type: "button",
              disabled: !choice || busy,
              onClick: async () => {
                setBusy(true);
                await relinkConcept(concept.id, slot, choice);
                setBusy(false);
              },
              className:
                "flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-ink px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2",
            },
            h(Link2, { size: 13, "aria-hidden": true }),
            "Link",
          ),
        )
      : null,
  );
}

/**
 * Offers a way back for an ad set whose persona, angle or offer was removed: one block per dead slot, listing what
 * it could be linked to. Renders nothing while the ad set is complete.
 */
export function RelinkPanel({ concept, campaign }: { concept: CampaignConcept; campaign: Campaign }) {
  const avatars = useAppStore((state) => state.targetAvatarsByProduct[concept.productId]);
  const nodes = useAppStore((state) => state.nodes);

  const options: Record<Slot, Array<{ value: string; label: string }>> = {
    avatar: (avatars ?? []).map((avatar) => ({ value: avatar.id, label: avatar.label })),
    angle: nodes.filter((node) => node.type === "angle" && node.productId === concept.productId).map((node) => ({ value: node.id, label: node.label })),
    offer: nodes.filter((node) => node.type === "offer" && node.productId === concept.productId).map((node) => ({ value: node.id, label: node.label })),
  };
  const dead = SLOTS.filter((slot) => !options[slot].some((option) => option.value === concept[`${slot}Id` as const]));
  if (!dead.length) return null;

  return h(
    "section",
    { "aria-label": "Relink this ad set", className: "space-y-2" },
    ...dead.map((slot) => h(SlotRelink, { key: slot, concept, campaign, slot, options: options[slot] })),
  );
}
