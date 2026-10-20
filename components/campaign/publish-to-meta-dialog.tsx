"use client";

import { useEffect, useRef, useState } from "react";
import { Rocket, X } from "lucide-react";
import { createPortal } from "react-dom";
import { api, type MetaPage } from "@/api/api";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import type { CampaignConcept } from "@/types/campaign";

const fieldClass =
  "w-full rounded-md border border-[#DDE0E4] bg-white px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-lineage focus:outline-none focus:ring-1 focus:ring-lineage";

/**
 * Collects what Meta needs but PRISM's ad set doesn't store on its own (a Page, a destination link, a daily
 * budget) and publishes the ad set as a paused Meta Campaign / Ad Set / Ads. Targeting is broad by default
 * (US, 18-65, Advantage+ audience) — refine it in Ads Manager before activating anything.
 */
export function PublishToMetaDialog({ open, concept, onClose }: { open: boolean; concept: CampaignConcept; onClose: () => void }) {
  const publishConceptToMeta = useAppStore((state) => state.publishConceptToMeta);
  const pending = useAppStore((state) => state.metaPublishPendingId === concept.id);
  const campaignError = useAppStore((state) => state.campaignError);
  const clearCampaignError = useAppStore((state) => state.clearCampaignError);

  const [pages, setPages] = useState<MetaPage[] | null>(null);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [pageId, setPageId] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [dailyBudget, setDailyBudget] = useState("20");
  const [result, setResult] = useState<{ publishedCount: number; notReadyCount: number } | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    clearCampaignError();
    let active = true;
    api
      .metaPages()
      .then((list) => {
        if (!active) return;
        setPages(list);
        if (list.length === 1) setPageId(list[0].id);
      })
      .catch((failure) => active && setPagesError(failure instanceof Error ? failure.message : "Could not load your Facebook Pages."));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    cancelRef.current?.focus();
    return () => {
      active = false;
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const readyCount = concept.ads.filter((ad) => ad.imageStatus === "ready").length;
  const budgetCents = Math.round(Number(dailyBudget) * 100);
  const canSubmit = Boolean(pageId) && /^https?:\/\/.+/i.test(destinationUrl.trim()) && Number.isFinite(budgetCents) && budgetCents >= 100 && readyCount > 0;

  async function submit() {
    const outcome = await publishConceptToMeta(concept.id, { pageId, destinationUrl: destinationUrl.trim(), dailyBudgetCents: budgetCents });
    if (outcome) setResult(outcome);
  }

  return createPortal(
    h(
      "div",
      {
        className: "fixed inset-0 z-[150] grid place-items-center bg-[#15171A]/80 p-4 backdrop-blur-[1px]",
        role: "presentation",
        onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
          if (event.target === event.currentTarget) onClose();
        },
      },
      h(
        "div",
        { role: "dialog", "aria-modal": true, className: "w-full max-w-sm rounded-xl border border-[#E7E9EC] bg-panel p-5 shadow-[0_24px_60px_rgb(21_23_26/.24)]" },
        h(
          "div",
          { className: "flex items-start justify-between gap-2" },
          h(
            "div",
            { className: "flex items-center gap-2.5" },
            h(
              "span",
              {
                className: "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white",
                style: { background: "linear-gradient(110deg, var(--prism-blue), var(--prism-violet), var(--prism-pink), var(--prism-amber))" },
                "aria-hidden": true,
              },
              h(Rocket, { size: 16 }),
            ),
            h(
              "div",
              null,
              h("h2", { className: "text-sm font-semibold text-ink" }, "Publish to Meta"),
              h("p", { className: "mt-0.5 text-[11px] leading-4 text-muted" }, "Created paused. Review targeting and activate it in Ads Manager."),
            ),
          ),
          h("button", { type: "button", onClick: onClose, "aria-label": "Close", className: "shrink-0 rounded-md p-1 text-muted hover:bg-[#F6F7F9] hover:text-ink" }, h(X, { size: 16 })),
        ),
        result
          ? h(
              "div",
              { className: "mt-4 space-y-3" },
              h(
                "p",
                { className: "rounded-md bg-[#F6F7F9] px-3 py-2.5 text-xs leading-5 text-ink" },
                `Published ${result.publishedCount} ad${result.publishedCount === 1 ? "" : "s"} to Meta, paused.`,
                result.notReadyCount ? ` ${result.notReadyCount} more still need a cover image before they can publish.` : "",
              ),
              h("button", { type: "button", onClick: onClose, className: "w-full rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-ink/90" }, "Done"),
            )
          : h(
              "div",
              { className: "mt-4 space-y-3" },
              h(
                "label",
                { className: "block" },
                h("span", { className: "mb-1 block text-[11px] font-medium text-muted" }, "Facebook Page"),
                pagesError
                  ? h("p", { className: "text-[11px] text-red-600" }, pagesError)
                  : h(
                      "select",
                      { className: fieldClass, value: pageId, disabled: !pages, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => setPageId(event.target.value) },
                      h("option", { value: "" }, pages ? "Choose a Page…" : "Loading your Pages…"),
                      (pages ?? []).map((page) => h("option", { key: page.id, value: page.id }, page.name)),
                    ),
              ),
              h(
                "label",
                { className: "block" },
                h("span", { className: "mb-1 block text-[11px] font-medium text-muted" }, "Destination link"),
                h("input", {
                  type: "url",
                  placeholder: "https://example.com/product",
                  className: fieldClass,
                  value: destinationUrl,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDestinationUrl(event.target.value),
                }),
              ),
              h(
                "label",
                { className: "block" },
                h("span", { className: "mb-1 block text-[11px] font-medium text-muted" }, "Daily budget (USD)"),
                h("input", {
                  type: "number",
                  min: "1",
                  step: "1",
                  className: fieldClass,
                  value: dailyBudget,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDailyBudget(event.target.value),
                }),
              ),
              h(
                "p",
                { className: "text-[11px] leading-4 text-muted" },
                readyCount > 0
                  ? `${readyCount} of ${concept.ads.length} ads have a cover image and will publish.`
                  : "None of this ad set's ads have a cover image yet — generate one first.",
              ),
              campaignError ? h("p", { role: "alert", className: "text-[11px] text-red-600" }, campaignError) : null,
              h(
                "div",
                { className: "mt-1 flex justify-end gap-2" },
                h("button", { ref: cancelRef, type: "button", onClick: onClose, className: "rounded-md border border-border-default px-3 py-2 text-xs font-semibold text-muted hover:bg-canvas hover:text-ink" }, "Cancel"),
                h(
                  "button",
                  {
                    type: "button",
                    disabled: !canSubmit || pending,
                    onClick: () => void submit(),
                    className:
                      "rounded-md px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40",
                    style: { background: "linear-gradient(110deg, var(--prism-blue), var(--prism-violet), var(--prism-pink), var(--prism-amber))" },
                  },
                  pending ? "Publishing…" : "Publish",
                ),
              ),
            ),
      ),
    ),
    document.body,
  );
}
