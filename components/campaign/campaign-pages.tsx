"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Layers, Trash2 } from "lucide-react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { NewCampaignButton } from "@/components/campaign/new-campaign-button";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import type { Campaign } from "@/types/campaign";

const NO_CAMPAIGNS: Campaign[] = [];

/**
 * Every campaign is a page of the canvas: its own set of ad sets on the shared map of personas, angles and
 * offers. Under the Ingredients button this is a small dock: the add button, and a chip naming the open page that
 * unfolds into the list of all campaigns. Picking one switches pages; picking the open one again toggles its
 * details. Hovering a row reveals its delete.
 */
export function CampaignPages() {
  const campaigns = useAppStore((state) =>
    state.activeProductId ? (state.campaignsByProduct[state.activeProductId] ?? NO_CAMPAIGNS) : NO_CAMPAIGNS,
  );
  const activeCampaignId = useAppStore((state) => state.activeCampaignId);
  const detailsOpen = useAppStore((state) => state.campaignPanelOpen);
  const openCampaignPage = useAppStore((state) => state.openCampaignPage);
  const openCampaignPanel = useAppStore((state) => state.openCampaignPanel);
  const closeCampaignPanel = useAppStore((state) => state.closeCampaignPanel);
  const deleteCampaign = useAppStore((state) => state.deleteCampaign);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null);
  const dock = useRef<HTMLDivElement>(null);
  const current = campaigns.find((campaign) => campaign.id === activeCampaignId) ?? campaigns[0];

  // The list folds away on Escape or a press outside it.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!dock.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return h(
    "div",
    { ref: dock, className: "pointer-events-auto flex w-max max-w-full flex-col items-start gap-2" },
    h(
      "div",
      { className: "flex items-center gap-2" },
      current
        ? h(
            "button",
            {
              type: "button",
              onClick: () => setOpen((value) => !value),
              "aria-expanded": open,
              "aria-haspopup": "listbox",
              title: "Campaigns",
              className:
                "flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border-default bg-bg-elevated pl-3 pr-2.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
            },
            h(Layers, { size: 14, className: "shrink-0 text-muted", "aria-hidden": true }),
            h("span", { className: "max-w-[130px] truncate" }, current.name),
            h(
              "span",
              { className: "mono rounded-md bg-canvas px-1.5 py-0.5 text-[10px] text-muted" },
              campaigns.length,
            ),
            h(ChevronDown, {
              size: 14,
              className: `shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`,
              "aria-hidden": true,
            }),
          )
        : null,
      h(NewCampaignButton),
    ),
    open && campaigns.length
      ? h(
          "ul",
          {
            role: "listbox",
            "aria-label": "Campaign pages",
            className:
              "m-0 flex max-h-[45vh] w-64 list-none flex-col gap-0.5 overflow-y-auto rounded-xl border border-border-default bg-bg-elevated p-1 shadow-[0_10px_28px_rgba(21,23,26,.14)]",
          },
          ...campaigns.map((campaign) => {
            const isCurrent = campaign.id === current?.id;
            return h(
              "li",
              { key: campaign.id, className: "group/page relative" },
              h(
                "button",
                {
                  type: "button",
                  role: "option",
                  "aria-selected": isCurrent,
                  title: isCurrent ? "Campaign details" : `Open ${campaign.name}`,
                  onClick: () => {
                    if (!isCurrent) {
                      openCampaignPage(campaign.id);
                      setOpen(false);
                    } else if (detailsOpen) closeCampaignPanel();
                    else openCampaignPanel(campaign.id);
                  },
                  className: `flex h-9 w-full items-center gap-2 rounded-lg pl-3 pr-9 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${
                    isCurrent ? "bg-ink text-bg-elevated" : "text-ink hover:bg-canvas"
                  }`,
                },
                h("span", { className: "min-w-0 flex-1 truncate" }, campaign.name),
                h(
                  "span",
                  { className: `mono text-[10px] ${isCurrent ? "opacity-70" : "text-muted"}` },
                  `${campaign.concepts.length} ad set${campaign.concepts.length === 1 ? "" : "s"}`,
                ),
              ),
              h(
                "button",
                {
                  type: "button",
                  "aria-label": `Delete ${campaign.name}`,
                  title: "Delete campaign",
                  onClick: () => setPendingDelete(campaign),
                  className:
                    "absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md bg-bg-elevated text-muted opacity-0 shadow-sm ring-1 ring-border-default transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover/page:opacity-100",
                },
                h(Trash2, { size: 12 }),
              ),
            );
          }),
        )
      : null,
    h(ConfirmationDialog, {
      open: Boolean(pendingDelete),
      title: `Delete ${pendingDelete?.name ?? "campaign"}?`,
      description: `It removes the campaign, its ${pendingDelete?.concepts.length ?? 0} ad set${pendingDelete?.concepts.length === 1 ? "" : "s"} and their ads. Personas, angles and offers are kept.`,
      confirmLabel: "Delete campaign",
      onCancel: () => setPendingDelete(null),
      onConfirm: () => {
        const id = pendingDelete?.id;
        setPendingDelete(null);
        if (id) void deleteCampaign(id);
      },
    }),
  );
}
