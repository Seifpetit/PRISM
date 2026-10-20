"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { GenerationSetup } from "@/components/generation-setup/generation-setup";
import { h } from "@/lib/h";
import type { GeneratorId } from "@/lib/generation-setup";
import { useAppStore } from "@/store/use-app-store";

const PROMPTS: Array<{ generator: Extract<GeneratorId, "adPlan" | "adHooks">; label: string }> = [
  { generator: "adPlan", label: "Creative plan" },
  { generator: "adHooks", label: "Hook alternatives" },
];

/**
 * The setup behind generating ads, in the Creatives drawer. Two generators live here: the one that plans an ad set's ads
 * (the default) and the one that writes hook alternatives for a single ad. The small switch in the header picks which one
 * is being set up; below it, like every other Generation Setup, page one is its saved template and page two its
 * Context (library sources and run instructions). Ads are generated per ad set and per ad, so there is no Generate
 * button here: the selection is used whenever Generate ads or Hook alternatives is pressed.
 */
export function AdPromptInspector() {
  const close = useAppStore((state) => state.setCreativesPromptOpen);
  const productId = useAppStore((state) => state.activeProductId);
  const [generator, setGenerator] = useState<(typeof PROMPTS)[number]["generator"]>("adPlan");

  return h(
    "aside",
    {
      className:
        "strategy-inspector w-full min-h-0 shrink-0 border-l border-[#DFE2E6] bg-white lg:h-full lg:w-[620px] " +
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:max-h-[78vh] max-lg:rounded-t-2xl " +
        "max-lg:shadow-[0_-12px_34px_rgba(21,23,26,.16)]",
      "aria-label": "Ad generation prompts",
    },
    h(
      "div",
      { className: "flex h-full min-h-0 flex-col max-lg:max-h-[78vh]" },
      h(
        "header",
        { className: "flex items-center gap-2 border-b border-[#E7E9EC] px-4 py-2.5" },
        h("span", { className: "mono shrink-0 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, "Generation setup"),
        h(
          "div",
          { role: "radiogroup", "aria-label": "Ad generator", className: "flex min-w-0 flex-1 items-center gap-1" },
          ...PROMPTS.map((item) =>
            h(
              "button",
              {
                key: item.generator,
                type: "button",
                role: "radio",
                "aria-checked": item.generator === generator,
                onClick: () => setGenerator(item.generator),
                className: `rounded-md border px-2.5 py-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${
                  item.generator === generator ? "border-ink bg-ink text-white" : "border-[#DDE0E4] text-muted hover:text-ink"
                }`,
              },
              item.label,
            ),
          ),
        ),
        h(
          "button",
          {
            type: "button",
            onClick: () => close(false),
            "aria-label": "Close prompts",
            className: "shrink-0 rounded p-1 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
          },
          h(X, { size: 16 }),
        ),
      ),
      productId ? h(GenerationSetup, { key: `${productId}:${generator}`, generator, productId }) : null,
    ),
  );
}
