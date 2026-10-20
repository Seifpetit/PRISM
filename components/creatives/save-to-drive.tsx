"use client";

import { useState } from "react";
import { CheckCircle2, HardDrive, Loader2 } from "lucide-react";
import type { CampaignAd } from "@/types/campaign";
import { h } from "@/lib/h";
import { api } from "@/api/api";
import { openGoogleDrivePicker } from "@/components/integrations/google-drive-picker";

/**
 * Saves an ad's cover image to the workspace's connected Google Drive: a plain utility action, not
 * generation, so it stays visually neutral rather than using the Prism gradient. Default click creates
 * a new file; "Replace existing file…" opens the Drive picker first so an existing file can be
 * overwritten instead.
 */
export function SaveToDrive({ ad }: { ad: CampaignAd }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedLink, setSavedLink] = useState<string | null>(null);
  const ready = ad.imageStatus === "ready" && Boolean(ad.imageUrl);

  async function save(targetFileId?: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.exportAdImageToGoogleDrive({ adId: ad.id, targetFileId });
      setSavedLink(result.webViewLink);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save to Google Drive.");
    } finally {
      setBusy(false);
    }
  }

  async function replaceExisting() {
    setBusy(true);
    setError(null);
    try {
      const picked = await openGoogleDrivePicker("export");
      if (!picked) {
        setBusy(false);
        return;
      }
      await save(picked.fileId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open Google's file picker.");
      setBusy(false);
    }
  }

  if (!ready) return null;

  return h(
    "section",
    { "aria-label": "Save to Google Drive", className: "space-y-1.5" },
    h(
      "div",
      { className: "flex flex-wrap items-center gap-1.5" },
      h(
        "button",
        {
          type: "button",
          disabled: busy,
          "aria-busy": busy || undefined,
          onClick: () => void save(),
          className:
            "inline-flex h-9 items-center gap-1.5 rounded-md border border-[#DDE0E4] px-3.5 text-xs font-semibold text-ink " +
            "hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-wait disabled:opacity-60",
        },
        busy
          ? h(Loader2, { size: 14, className: "animate-spin motion-reduce:animate-none", "aria-hidden": true })
          : h(HardDrive, { size: 14, "aria-hidden": true }),
        "Save to Drive",
      ),
      h(
        "button",
        {
          type: "button",
          disabled: busy,
          onClick: () => void replaceExisting(),
          className: "text-[11px] font-medium text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-60",
        },
        "Replace existing file…",
      ),
    ),
    savedLink
      ? h(
          "a",
          {
            href: savedLink,
            target: "_blank",
            rel: "noreferrer",
            className: "inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline",
          },
          h(CheckCircle2, { size: 12, "aria-hidden": true }),
          "Saved — open in Drive",
        )
      : null,
    error ? h("p", { role: "alert", className: "text-[11px] text-red-700" }, error) : null,
  );
}
