"use client";

import { Bot, Film, Image as ImageIcon, Layers, LayoutTemplate, Loader2, Play, Smartphone, Sparkles, type LucideIcon } from "lucide-react";
import { h } from "@/lib/h";
import { adDisplayTitle, AD_FORMAT_LABEL, AWARENESS_LABEL, VIDEO_FORMATS, type AdFormat, type CampaignAd } from "@/types/campaign";

export const FORMAT_ICON: Record<AdFormat, LucideIcon> = {
  photo: ImageIcon,
  static_ad: LayoutTemplate,
  carousel: Layers,
  video: Film,
  ugc_video: Smartphone,
  ai_talking_head: Bot,
  motion_graphic: Sparkles,
};

function AdCardPill({ light, children }: { light: boolean; children?: React.ReactNode }) {
  return h("span", { className: `ad-card-pill ${light ? "is-light" : ""}` }, children);
}

/**
 * One ad in a track's tray, as a photo card: its cover image (or the quiet placeholder standing in for it) fills
 * the card, its reference and format sit as small pills over the top-left corner, and its title reads as a short
 * line over a blurred scrim at the bottom — a keyword-length label, not the full hook. "None" (the default for
 * every ad, including every ad made before thumbnails existed) and "failed" both read as the placeholder: a
 * generation hiccup is not this card's problem to announce loudly, and a plan made by hand never asked for an
 * image at all. Awareness and the rest of the ad's six dimensions stay one click away, in the drawer.
 */
export function AdCard({ ad, reference, selected, onSelect }: { ad: CampaignAd; reference: string; selected: boolean; onSelect: () => void }) {
  const Icon = FORMAT_ICON[ad.format];
  const ready = ad.imageStatus === "ready" && Boolean(ad.imageUrl);
  const { text: titleText, isFallback } = adDisplayTitle(ad);

  return h(
    "button",
    {
      type: "button",
      onClick: onSelect,
      "aria-pressed": selected,
      "aria-label": `Ad ${reference}: ${AD_FORMAT_LABEL[ad.format]}, ${AWARENESS_LABEL[ad.awareness]}`,
      className: `ad-card ${selected ? "is-selected" : ""}`,
    },
    h(
      "span",
      { className: `ad-card-photo ${ready ? "" : "is-placeholder"}` },
      ready
        ? h("img", { src: ad.imageUrl as string, alt: "" })
        : h(
            "span",
            { className: "flex flex-col items-center gap-1.5", "aria-hidden": true },
            h(Icon, { size: 22, strokeWidth: 1.6 }),
            ad.imageStatus === "pending" ? h(Loader2, { size: 11, className: "ad-thumb-spinner animate-spin motion-reduce:animate-none" }) : null,
          ),
      ready ? h("span", { className: "ad-card-scrim", "aria-hidden": true }) : null,
      h(
        "span",
        { className: "ad-card-top" },
        h(AdCardPill, { light: !ready }, h("span", { className: "dot", "aria-hidden": true }), reference),
        h(AdCardPill, { light: !ready }, h(Icon, { size: 10, strokeWidth: 2.2, "aria-hidden": true }), AD_FORMAT_LABEL[ad.format]),
      ),
      h(
        "span",
        { className: `ad-card-bottom ${ready ? "" : "is-plain"}` },
        h("span", { className: `ad-card-title ${isFallback ? "is-muted" : ""}` }, titleText),
      ),
      ready && VIDEO_FORMATS.has(ad.format) ? h("span", { className: "ad-card-play", "aria-hidden": true }, h(Play, { size: 10, fill: "currentColor" })) : null,
    ),
  );
}
