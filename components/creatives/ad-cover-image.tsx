"use client";

import { Loader2 } from "lucide-react";
import { FORMAT_ICON } from "@/components/creatives/ad-card";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import type { CampaignAd } from "@/types/campaign";

/**
 * The ad drawer's cover image slot. Four states: a real image, a generation in progress, an ad with a scene to
 * draw from but no image yet (a retry after "failed" reads the same as a first try from "none" — both just mean
 * there is nothing to show yet), and an ad with no direction written yet, which has nothing to generate from and
 * so gets no action, only the quiet placeholder.
 */
export function AdCoverImage({ conceptId, ad }: { conceptId: string; ad: CampaignAd }) {
  const generateAdImage = useAppStore((state) => state.generateAdImage);
  const pending = useAppStore((state) => state.adImagePendingId === ad.id);
  const Icon = FORMAT_ICON[ad.format];

  if (ad.imageStatus === "ready" && ad.imageUrl) {
    return h("img", { src: ad.imageUrl, alt: "", className: "block h-44 w-full object-cover" });
  }

  if (!ad.direction?.trim()) {
    return h(
      "div",
      { className: "flex h-32 w-full flex-col items-center justify-center gap-1.5 border-b border-[#E7E9EC] bg-canvas text-muted", "aria-hidden": true },
      h(Icon, { size: 20, strokeWidth: 1.6 }),
      h("span", { className: "text-[10.5px]" }, "Add a scene to generate a cover image"),
    );
  }

  return h(
    "div",
    { className: "flex h-32 w-full flex-col items-center justify-center gap-2 border-b border-[#E7E9EC] bg-canvas" },
    h(Icon, { size: 20, strokeWidth: 1.6, className: "text-muted", "aria-hidden": true }),
    h(
      "button",
      {
        type: "button",
        disabled: pending,
        onClick: () => void generateAdImage(conceptId, ad.id),
        className:
          "prism-icon-action flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
      },
      pending ? h(Loader2, { size: 12, className: "animate-spin motion-reduce:animate-none", "aria-hidden": true }) : null,
      pending ? "Generating…" : ad.imageStatus === "failed" ? "Try again" : "Generate cover image",
    ),
  );
}
