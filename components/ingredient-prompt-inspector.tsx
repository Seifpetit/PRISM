"use client";

import { X } from "lucide-react";
import { GenerationSetup } from "@/components/generation-setup/generation-setup";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";

const KIND = {
  angle: { label: "Angles", generator: "angles" },
  offer: { label: "Offers", generator: "offers" },
} as const;

/** The prompt behind generating the angles, or the offers, of a product. The personas' twin is TargetAvatarInspector. */
export function IngredientPromptInspector({ kind }: { kind: "angle" | "offer" }) {
  const info = KIND[kind];
  const closeInspector = useAppStore((state) => state.closeTargetAvatarInspector);
  const productId = useAppStore((state) => state.activeProductId);
  const nodes = useAppStore((state) => state.nodes);
  const count = nodes.filter((node) => node.productId === productId && node.type === kind).length;
  const productName = useAppStore((state) => state.products.find((product) => product.id === productId)?.name);
  const generateAngles = useAppStore((state) => state.generateFromSelected);
  const generateOffers = useAppStore((state) => state.generateOffers);
  const anglePending = useAppStore((state) => state.generatingParentId !== null);
  const offerPending = useAppStore((state) => state.offerGenerationPending);

  return h(
    "aside",
    {
      className:
        "strategy-inspector w-full min-h-0 shrink-0 border-l border-[#DFE2E6] bg-white lg:h-full lg:w-[620px] " +
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:max-h-[78vh] max-lg:rounded-t-2xl " +
        "max-lg:shadow-[0_-12px_34px_rgba(21,23,26,.16)]",
      "aria-label": `${info.label} inspector`,
    },
    h(
      "div",
      { className: "flex h-full min-h-0 flex-col max-lg:max-h-[78vh]" },
      h(
        "header",
        { className: "flex items-center gap-2 border-b border-[#E7E9EC] px-4 py-2.5" },
        h("span", { className: "mono shrink-0 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, "Generation setup"),
        h(
          "h2",
          { className: "min-w-0 flex-1 truncate text-sm font-semibold text-ink" },
          `${info.label}${productName ? ` · ${productName}` : ""}`,
          h("span", { className: "ml-2 text-[11px] font-normal text-muted" }, count ? `${count} generated` : "none yet"),
        ),
        h(
          "button",
          {
            type: "button",
            onClick: closeInspector,
            "aria-label": `Close ${info.label} inspector`,
            className: "shrink-0 rounded p-1 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
          },
          h(X, { size: 16 }),
        ),
      ),
      productId
        ? h(GenerationSetup, {
            key: `${productId}:${info.generator}`,
            generator: info.generator,
            productId,
            onGenerate: () => (kind === "angle" ? void generateAngles(productId) : void generateOffers()),
            pending: kind === "angle" ? anglePending : offerPending,
          })
        : null,
    ),
  );
}
