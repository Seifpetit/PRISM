"use client";

import { Fragment, useState } from "react";
import { Trash2, UserRound, X } from "lucide-react";
import { h } from "@/lib/h";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { GenderIcon } from "@/components/gender-icon";
import { GenerationSetup } from "@/components/generation-setup/generation-setup";
import { useAppStore } from "@/store/use-app-store";
import type { TargetAvatar } from "@/types/strategy";

const EMPTY_AVATARS: TargetAvatar[] = [];

function AvatarDetail({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null;
  return h(
    "div",
    null,
    h("p", { className: "mono text-[8px] font-semibold uppercase tracking-[.12em] text-muted" }, label),
    h("p", { className: "mt-0.5 text-[11px] leading-[1.55] text-ink" }, value),
  );
}

function TargetAvatarMetadata({
  avatars,
  onDelete,
}: {
  avatars: TargetAvatar[];
  onDelete: (avatar: TargetAvatar) => void;
}) {
  if (!avatars.length)
    return h(
      "section",
      {
        className: "shrink-0 rounded-lg border border-[#DDE0E4] bg-[#FAFBFC] px-3.5 py-3",
        "aria-label": "Target Avatar metadata",
      },
      h(
        "p",
        { className: "text-xs text-muted" },
        "No Target Avatars generated yet. Generate a set to inspect their metadata here.",
      ),
    );

  return h(
    "section",
    {
      className:
        "max-h-[42%] shrink-0 space-y-2.5 overflow-y-auto rounded-lg border border-[#DDE0E4] bg-[#FAFBFC] px-3.5 py-3",
      "aria-label": "Target Avatar metadata",
    },
    ...avatars.map((avatar) =>
      h(
        "article",
        {
          key: avatar.id,
          className: "rounded-md border border-[#E4E7EB] bg-panel px-3 py-2.5",
        },
        h(
          "div",
          { className: "flex items-center gap-2" },
          h(
            "span",
            {
              className: "grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#DDE0E4] text-muted",
              "aria-hidden": true,
            },
            h(GenderIcon, { gender: avatar.gender, size: 13, strokeWidth: 1.9 }),
          ),
          h("h4", { className: "min-w-0 flex-1 truncate text-xs font-semibold text-ink" }, avatar.label),
          h(
            "span",
            { className: "mono shrink-0 text-[9px] text-muted" },
            [avatar.gender, avatar.ageRange].filter(Boolean).join(" · "),
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => onDelete(avatar),
              "aria-label": `Delete ${avatar.label}`,
              title: "Delete this Target Avatar",
              className:
                "grid h-6 w-6 shrink-0 place-items-center rounded-md border border-transparent text-muted transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700",
            },
            h(Trash2, { size: 12, strokeWidth: 2 }),
          ),
        ),
        h(
          "div",
          { className: "mt-2 space-y-2" },
          h(AvatarDetail, { label: "Profession", value: avatar.profession }),
          h(AvatarDetail, { label: "Life rhythm", value: avatar.lifeRhythm }),
          h(AvatarDetail, { label: "Pain point", value: avatar.painPoint }),
          h(AvatarDetail, { label: "Product connection", value: avatar.productConnection }),
          h(AvatarDetail, { label: "Priorities", value: avatar.priorities }),
          h(AvatarDetail, { label: "Buying context", value: avatar.buyingContext }),
        ),
      ),
    ),
  );
}

export function TargetAvatarInspector() {
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState<TargetAvatar | null>(null);
  const activeProductId = useAppStore((state) => state.activeProductId);
  const targetAvatarsByProduct = useAppStore((state) => state.targetAvatarsByProduct);
  const closeInspector = useAppStore((state) => state.closeTargetAvatarInspector);
  const deleteTargetAvatar = useAppStore((state) => state.deleteTargetAvatar);
  const generateTargetAvatars = useAppStore((state) => state.generateTargetAvatars);
  const generating = useAppStore((state) => state.targetAvatarGenerationPending);
  const productName = useAppStore((state) => state.products.find((product) => product.id === state.activeProductId)?.name);
  const avatars = activeProductId
    ? (targetAvatarsByProduct[activeProductId] ?? EMPTY_AVATARS)
    : EMPTY_AVATARS;

  return h(
    Fragment,
    null,
    h(
    "aside",
    {
      className:
        "strategy-inspector w-full min-h-0 shrink-0 border-l border-[#DFE2E6] bg-white lg:h-full lg:w-[620px] " +
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:max-h-[78vh] max-lg:rounded-t-2xl " +
        "max-lg:shadow-[0_-12px_34px_rgba(21,23,26,.16)]",
      "aria-label": "Target Avatar inspector",
    },
    h(
      "div",
      { className: "flex h-full min-h-0 flex-col max-lg:max-h-[78vh]" },
      h(
        "header",
        { className: "flex items-center gap-2 border-b border-[#E7E9EC] px-4 py-2.5" },
        h(
          "span",
          { className: "mono shrink-0 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" },
          "Generation setup",
        ),
        h(
          "h2",
          { className: "min-w-0 flex-1 truncate text-sm font-semibold text-ink" },
          `Target Avatars${productName ? ` · ${productName}` : ""}`,
          h("span", { className: "ml-2 text-[11px] font-normal text-muted" }, avatars.length ? `${avatars.length} generated` : "none yet"),
        ),
        h(
          "button",
          {
            type: "button",
            onClick: () => setMetadataOpen((current) => !current),
            "aria-expanded": metadataOpen,
            title: "Target Avatar metadata",
            className: `inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
              metadataOpen
                ? "border-lineage bg-canvas text-lineage"
                : "border-border-default bg-panel text-muted hover:bg-canvas hover:text-ink"
            }`,
          },
          h(UserRound, { size: 13 }),
          "Avatars",
        ),
        h(
          "button",
          {
            type: "button",
            onClick: closeInspector,
            "aria-label": "Close Target Avatar inspector",
            className:
              "shrink-0 rounded p-1 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
          },
          h(X, { size: 16 }),
        ),
      ),
      metadataOpen ? h("div", { className: "flex max-h-[42%] shrink-0 flex-col px-4 pt-4" }, h(TargetAvatarMetadata, { avatars, onDelete: setDeletingAvatar })) : null,
      activeProductId
        ? h(GenerationSetup, { key: activeProductId, generator: "targetAvatars", productId: activeProductId, onGenerate: () => void generateTargetAvatars(), pending: generating })
        : null,
    ),
    ),
    h(ConfirmationDialog, {
      open: Boolean(deletingAvatar),
      title: "Delete this Target Avatar?",
      description: deletingAvatar
        ? `This removes "${deletingAvatar.label}" along with its map placement and any angle link. This can't be undone.`
        : "",
      confirmLabel: "Delete avatar",
      onCancel: () => setDeletingAvatar(null),
      onConfirm: () => {
        if (deletingAvatar) deleteTargetAvatar(deletingAvatar.id);
        setDeletingAvatar(null);
      },
    }),
  );
}
