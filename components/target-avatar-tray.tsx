"use client";


import { Fragment, useMemo, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { Lightbulb, Loader2, RotateCcw, ScanSearch, Settings2, Sparkles, Tag, UserRound, X, type LucideIcon } from "lucide-react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { GenderIcon } from "@/components/gender-icon";
import { HorizontalTray } from "@/components/ui/horizontal-tray";
import { Surface } from "@/components/ui/surface";
import { h } from "@/lib/h";
import { PersonaPhoto } from "@/components/persona-photo";
import { personaInitials, personaMarkStyle } from "@/lib/persona-avatar";
import { useAppStore } from "@/store/use-app-store";
import { TARGET_AVATAR_COUNT_BOUNDS, type TargetAvatar } from "@/types/strategy";

export const AVATAR_DRAG_MIME = "application/x-prism-avatar";
const EMPTY_POSITIONS: Record<string, { x: number; y: number }> = {};

/**
 * The tile that stands for one persona, angle or offer, in the silhouette its canvas card has: a round portrait,
 * a tilted lightbulb tile, a notched ticket. All three are solid and in their own colour.
 */
export function ChipIcon({
  kind,
  gender,
  onMap,
  avatarId,
  avatarLabel,
}: {
  kind: "avatar" | "angle" | "offer";
  gender?: string;
  onMap?: boolean;
  /** Only for kind === "avatar": renders the persona's deterministic mark instead of a generic icon. */
  avatarId?: string;
  avatarLabel?: string;
}) {
  const Icon = kind === "avatar" ? UserRound : kind === "angle" ? Lightbulb : Tag;
  const mark = kind === "avatar" && avatarId ? personaMarkStyle(avatarId) : null;
  return h(
    "span",
    { className: "relative block shrink-0", "aria-hidden": true },
    h(
      "span",
      { className: `tray-chip-tile is-${kind}`, style: mark ?? undefined },
      mark ? h("span", { className: "persona-mark" }, personaInitials(avatarLabel ?? "")) : h(Icon, { size: 16, strokeWidth: 2.1 }),
      mark && avatarId ? h(PersonaPhoto, { avatarId, size: 96 }) : null,
    ),
    kind === "avatar" && gender
      ? h(
          "span",
          { className: "absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full border border-border-default bg-bg-elevated text-muted" },
          h(GenderIcon, { gender, size: 8, strokeWidth: 2.4 }),
        )
      : null,
    onMap ? h("span", { className: "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-bg-elevated", style: { background: "var(--type-persona)" } }) : null,
  );
}

/** The tray has one page per ingredient of an ad set. Each page has its own colour, from the canvas cards. */
type Mode = "avatar" | "angle" | "offer";
const MODES: Array<{ mode: Mode; label: string; noun: string; color: string; Icon: LucideIcon }> = [
  { mode: "avatar", label: "Personas", noun: "Target Avatars", color: "var(--type-persona)", Icon: UserRound },
  { mode: "angle", label: "Angles", noun: "angles", color: "var(--type-angle)", Icon: Lightbulb },
  { mode: "offer", label: "Offers", noun: "offers", color: "var(--type-offer)", Icon: Tag },
];

interface TargetAvatarTrayProps {
  avatars: TargetAvatar[];
  generating?: boolean;
  count: number;
  onCountChange: (count: number) => void;
  onGenerate: () => void;
}

/** Product-level people context. This tray is intentionally outside graph lineage. */
export function TargetAvatarTray({
  avatars,
  generating = false,
  count,
  onCountChange,
  onGenerate,
}: TargetAvatarTrayProps) {
  const [mode, setMode] = useState<Mode>("avatar");
  const [configOpen, setConfigOpen] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingIngredientReset, setConfirmingIngredientReset] = useState<"angle" | "offer" | null>(null);
  const [deletingIngredient, setDeletingIngredient] = useState<{ id: string; label: string; type: "angle" | "offer" } | null>(null);
  const [deletingAvatar, setDeletingAvatar] = useState<TargetAvatar | null>(null);
  const { min, max } = TARGET_AVATAR_COUNT_BOUNDS;
  const activeProductId = useAppStore((state) => state.activeProductId);
  const placedAvatarIds = useAppStore((state) =>
    activeProductId ? state.avatarCanvasByProduct[activeProductId]?.positions ?? EMPTY_POSITIONS : EMPTY_POSITIONS,
  );
  const resetTargetAvatars = useAppStore((state) => state.resetTargetAvatars);
  const deleteTargetAvatar = useAppStore((state) => state.deleteTargetAvatar);
  const openInspector = useAppStore((state) => state.openTargetAvatarInspector);
  const openAvatarDetail = useAppStore((state) => state.openAvatarDetail);
  const nodes = useAppStore((state) => state.nodes);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectNode = useAppStore((state) => state.selectNode);
  const openIngredientInspector = useAppStore((state) => state.openIngredientInspector);
  const resetIngredients = useAppStore((state) => state.resetIngredients);
  const deleteIngredients = useAppStore((state) => state.deleteIngredients);
  const generateAngles = useAppStore((state) => state.generateFromSelected);
  const generateOffers = useAppStore((state) => state.generateOffers);
  const anglePending = useAppStore((state) => state.generatingParentId !== null);
  const offerPending = useAppStore((state) => state.offerGenerationPending);
  const ingredients = useMemo(
    () => ({
      angle: nodes.filter((node) => node.productId === activeProductId && node.type === "angle"),
      offer: nodes.filter((node) => node.productId === activeProductId && node.type === "offer"),
    }),
    [nodes, activeProductId],
  );
  const isAvatar = mode === "avatar";
  const page = MODES.find((item) => item.mode === mode)!;
  const counts: Record<Mode, number> = { avatar: avatars.length, angle: ingredients.angle.length, offer: ingredients.offer.length };
  const total = counts[mode];
  const pending = isAvatar ? generating : mode === "angle" ? anglePending : offerPending;
  const runGenerate = () => {
    if (isAvatar) onGenerate();
    else if (mode === "angle") void generateAngles(activeProductId ?? undefined);
    else void generateOffers();
  };

  function handleCountInput(event: ChangeEvent<HTMLInputElement>) {
    const next = Number(event.target.value);
    if (Number.isFinite(next)) onCountChange(next);
  }

  function handleConfigKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") setConfigOpen(false);
  }

  function handleAvatarDragStart(event: DragEvent<HTMLDivElement>, avatarId: string) {
    event.dataTransfer.setData(AVATAR_DRAG_MIME, avatarId);
    event.dataTransfer.effectAllowed = "copy";
  }

  return h(
    Fragment,
    null,
    h(
    Surface,
    {
      as: "section",
      variant: "floating",
      className: "target-avatar-tray flex min-w-0 flex-1 flex-col px-2.5 py-2",
      "aria-label": "Personas, angles and offers",
    },
    h(
      "div",
      { className: "mb-1.5 flex min-h-6 items-center gap-2" },
      h(
        "div",
        { role: "tablist", "aria-label": "Tray page", className: "flex min-w-0 items-center gap-0.5" },
        ...MODES.map((item) => {
          const active = item.mode === mode;
          return h(
            "button",
            {
              key: item.mode,
              type: "button",
              role: "tab",
              "aria-selected": active,
              onClick: () => {
                setMode(item.mode);
                setConfigOpen(false);
              },
              className: `flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[10px] font-semibold uppercase tracking-[.12em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lineage ${
                active ? "bg-canvas text-ink" : "text-muted hover:text-ink"
              }`,
            },
            h("span", { className: "h-1.5 w-1.5 rounded-full", style: { background: item.color }, "aria-hidden": true }),
            item.label,
            counts[item.mode]
              ? h("span", { className: "rounded-full bg-panel px-1.5 py-0.5 text-[9px] font-semibold text-muted", "aria-label": `${counts[item.mode]} ${item.noun}` }, counts[item.mode])
              : null,
          );
        }),
      ),
      h(
        "div",
        { className: "relative ml-auto flex shrink-0 items-center gap-1.5", onKeyDown: handleConfigKeyDown },
        h(
          "button",
          {
            type: "button",
            onClick: isAvatar ? openInspector : () => openIngredientInspector(mode),
            "aria-label": `Inspect ${page.noun}`,
            title: `Inspect ${page.noun} and generation prompt`,
            className:
              "grid h-6 w-6 shrink-0 place-items-center rounded-md border border-transparent text-muted transition-colors hover:border-border-default hover:bg-canvas hover:text-ink",
          },
          h(ScanSearch, { size: 13, strokeWidth: 2 }),
        ),
        total
          ? h(
              "button",
              {
                type: "button",
                onClick: () => (isAvatar ? setConfirmingReset(true) : setConfirmingIngredientReset(mode)),
                "aria-label": `Reset ${page.noun}`,
                title: `Reset ${page.noun}, start from zero`,
                className:
                  "grid h-6 w-6 shrink-0 place-items-center rounded-md border border-transparent text-muted transition-colors hover:border-border-default hover:bg-canvas hover:text-red-700",
              },
              h(RotateCcw, { size: 13, strokeWidth: 2 }),
            )
          : null,
        isAvatar
          ? h(
              "button",
              {
                type: "button",
                onClick: () => setConfigOpen((open) => !open),
                "aria-expanded": configOpen,
                "aria-label": "Target Avatar generation settings",
                title: "Generation settings",
                className: `grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors ${
                  configOpen
                    ? "border-lineage bg-canvas text-lineage"
                    : "border-transparent text-muted hover:border-border-default hover:bg-canvas hover:text-ink"
                }`,
              },
              h(Settings2, { size: 13, strokeWidth: 2 }),
            )
          : null,
        isAvatar && configOpen
          ? h(
              "div",
              {
                role: "dialog",
                "aria-label": "Target Avatar generation settings",
                className:
                  "absolute left-0 top-[calc(100%+6px)] z-20 w-56 rounded-lg border border-border-default bg-panel p-3 shadow-[0_12px_28px_rgba(21,23,26,.16)]",
              },
              h(
                "label",
                { htmlFor: "target-avatar-count", className: "block text-[9px] font-semibold uppercase tracking-[.1em] text-muted" },
                "Number of avatars",
              ),
              h(
                "div",
                { className: "mt-2 flex items-center gap-2.5" },
                h("input", {
                  id: "target-avatar-count",
                  type: "range",
                  min,
                  max,
                  step: 1,
                  value: count,
                  onChange: handleCountInput,
                  className: "prism-slider flex-1",
                }),
                h(
                  "span",
                  { className: "mono w-7 shrink-0 text-right text-[11px] font-semibold text-ink" },
                  count,
                ),
              ),
            )
          : null,
        h(
          "button",
          {
            type: "button",
            onClick: runGenerate,
            disabled: pending,
            "aria-label": isAvatar ? (total ? "Regenerate Target Avatars" : "Generate Target Avatars") : total ? `Generate more ${page.noun}` : `Generate ${page.noun}`,
            title: isAvatar ? (total ? "Regenerate Target Avatars" : "Generate Target Avatars") : total ? `Generate more ${page.noun}` : `Generate ${page.noun}`,
            className:
              "prism-icon-action grid h-6 w-6 shrink-0 place-items-center rounded-md text-white " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage " +
              "focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60",
          },
          pending
            ? h(Loader2, { size: 13, strokeWidth: 2.2, className: "animate-spin" })
            : h(Sparkles, { size: 13, strokeWidth: 2.2 }),
        ),
      ),
    ),
    h(
      HorizontalTray,
      {
        className:
          "target-avatar-scroll flex min-h-[52px] flex-nowrap items-start gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap pb-1",
        accessibleLabel: isAvatar ? "Target Avatar profiles" : `${page.label} of this product`,
      },
      ...(!isAvatar
        ? total
          ? ingredients[mode].map((node) => {
              const selected = selectedNodeId === node.id;
              const activate = () => selectNode(selected ? null : node.id);
              return h(
                "div",
                {
                  key: node.id,
                  role: "listitem",
                  tabIndex: 0,
                  onClick: activate,
                  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      activate();
                    }
                  },
                  title: `${node.label}${"framing" in node && node.framing ? ` — ${node.framing}` : ""}`,
                  "aria-label": `${page.label.slice(0, -1)}: ${node.label}`,
                  "aria-current": selected || undefined,
                  className: `group relative flex w-[92px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-md border px-1.5 py-1 text-center text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lineage ${
                    selected ? "bg-canvas" : "border-transparent hover:border-border-default"
                  }`,
                  style: selected ? { borderColor: page.color } : undefined,
                },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: (event: MouseEvent<HTMLButtonElement>) => {
                      event.stopPropagation();
                      setDeletingIngredient({ id: node.id, label: node.label, type: mode as "angle" | "offer" });
                    },
                    "aria-label": `Delete ${node.label}`,
                    title: `Delete this ${mode}`,
                    className:
                      "absolute right-0.5 top-0.5 z-10 grid h-4 w-4 place-items-center rounded-full border border-[#DDE0E4] bg-white text-muted opacity-0 transition-opacity hover:border-red-300 hover:text-red-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 group-hover:opacity-100",
                  },
                  h(X, { size: 9, strokeWidth: 2.6 }),
                ),
                h(ChipIcon, { kind: mode }),
                h("span", { className: "block w-full truncate text-[9px] font-medium leading-3" }, node.label),
              );
            })
          : [h("p", { key: "empty", className: "flex min-h-[48px] items-center text-[10px] text-muted/70" }, `No ${page.noun} yet`)]
        : avatars.length
        ? avatars.map((avatar) => {
            const onCanvas = Boolean(placedAvatarIds[avatar.id]);
            return h(
              "div",
              {
                key: avatar.id,
                role: "listitem",
                tabIndex: 0,
                draggable: true,
                onDragStart: (event: DragEvent<HTMLDivElement>) => handleAvatarDragStart(event, avatar.id),
                onClick: () => openAvatarDetail(avatar.id),
                onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openAvatarDetail(avatar.id);
                  }
                },
                className:
                  "group relative flex w-[82px] shrink-0 cursor-grab flex-col items-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-center text-ink transition-colors hover:border-border-default hover:bg-canvas focus-visible:border-lineage focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lineage active:cursor-grabbing",
                title: `${avatar.label} — ${avatar.profession}, ${avatar.ageRange}. Click for details, drag onto the map to place it.`,
                "aria-label": `${avatar.label}, ${avatar.profession}, age ${avatar.ageRange}${onCanvas ? ", already on the map" : ""}`,
              },
              h(
                "button",
                {
                  type: "button",
                  onClick: (event: MouseEvent<HTMLButtonElement>) => {
                    event.stopPropagation();
                    setDeletingAvatar(avatar);
                  },
                  "aria-label": `Delete ${avatar.label}`,
                  title: "Delete this Target Avatar",
                  className:
                    "absolute right-0.5 top-0.5 z-10 grid h-4 w-4 place-items-center rounded-full border border-[#DDE0E4] bg-white text-muted opacity-0 transition-opacity hover:border-red-300 hover:text-red-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 group-hover:opacity-100",
                },
                h(X, { size: 9, strokeWidth: 2.6 }),
              ),
              h(ChipIcon, { kind: "avatar", gender: avatar.gender, onMap: onCanvas, avatarId: avatar.id, avatarLabel: avatar.label }),
              h(
                "span",
                { className: "block w-full truncate text-[9px] font-medium leading-3" },
                avatar.label,
              ),
            );
          })
        : [
            h(
              "p",
              {
                key: "empty",
                className: "flex min-h-[48px] items-center text-[10px] text-muted/70",
              },
              "No target avatars yet",
            ),
          ]),
    ),
    ),
    h(ConfirmationDialog, {
      open: confirmingReset,
      title: "Reset Target Avatars?",
      description: "This clears every generated Target Avatar along with any placed on the map and their angle links. Strategy generations are not affected.",
      confirmLabel: "Reset to zero",
      onCancel: () => setConfirmingReset(false),
      onConfirm: () => { setConfirmingReset(false); resetTargetAvatars(); },
    }),
    h(ConfirmationDialog, {
      open: Boolean(confirmingIngredientReset),
      title: `Delete every ${confirmingIngredientReset ?? "angle"}?`,
      description: `This deletes all ${confirmingIngredientReset ?? "angle"}s of this product. Ad sets that use them are removed too. Personas${confirmingIngredientReset === "offer" ? " and angles" : " and offers"} are not affected.`,
      confirmLabel: `Delete all ${confirmingIngredientReset ?? "angle"}s`,
      onCancel: () => setConfirmingIngredientReset(null),
      onConfirm: () => {
        const kind = confirmingIngredientReset;
        setConfirmingIngredientReset(null);
        if (kind) void resetIngredients(kind);
      },
    }),
    h(ConfirmationDialog, {
      open: Boolean(deletingIngredient),
      title: `Delete this ${deletingIngredient?.type ?? "angle"}?`,
      description: deletingIngredient
        ? `This removes "${deletingIngredient.label}". Ad sets that use it are removed too. This can't be undone.`
        : "",
      confirmLabel: `Delete ${deletingIngredient?.type ?? "angle"}`,
      onCancel: () => setDeletingIngredient(null),
      onConfirm: () => {
        if (deletingIngredient) void deleteIngredients([deletingIngredient.id]);
        setDeletingIngredient(null);
      },
    }),
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
