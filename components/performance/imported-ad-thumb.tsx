"use client";

import { ImageIcon } from "lucide-react";
import type { ImportedAd } from "@/api/api";
import { h } from "@/lib/h";

/**
 * An imported ad's own cover image — Meta's own live creative thumbnail when the connected account still has
 * it, PRISM's own generated one when a pipeline task explicitly linked this name to a PRISM ad, or the same
 * quiet placeholder as everywhere else (no format is known here, so a plain photo icon stands in).
 */
export function ImportedAdThumb({ ad, large }: { ad: ImportedAd; large?: boolean }) {
  const className = `ad-row-thumb${large ? " is-lg" : ""}`;
  if (ad.imageStatus === "ready" && ad.imageUrl) {
    return h("span", { className }, h("img", { src: ad.imageUrl, alt: "" }));
  }
  return h("span", { className: `${className} is-placeholder`, "aria-hidden": true }, h(ImageIcon, { size: large ? 18 : 14, strokeWidth: 1.8 }));
}
