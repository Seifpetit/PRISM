"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Trash2, X } from "lucide-react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Select } from "@/components/ui/select";
import { useCampaignLabels } from "@/components/campaign/use-campaign-labels";
import { h } from "@/lib/h";
import { campaignToCsv, campaignWarnings, conceptBadges, TEST_TYPE_INFO, type TestType } from "@/lib/campaign-rules";
import { useAppStore } from "@/store/use-app-store";
import { CAMPAIGN_KINDS, CAMPAIGN_KIND_LABEL, type CampaignKind } from "@/types/campaign";

const kindOptions = CAMPAIGN_KINDS.map((value) => ({ value, label: CAMPAIGN_KIND_LABEL[value] }));
const testTypeOptions = (Object.keys(TEST_TYPE_INFO) as TestType[]).map((value) => ({ value, label: TEST_TYPE_INFO[value].label }));

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campaign";

/** Saves text as a CSV file. The BOM makes Excel read accented characters correctly. */
function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(name)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Campaign details: name, what it tests, whether it is a clean test, its ad sets, and export. */
export function CampaignDrawer({ campaignId }: { campaignId: string }) {
  const labels = useCampaignLabels();
  const closeCampaignPanel = useAppStore((state) => state.closeCampaignPanel);
  const updateCampaign = useAppStore((state) => state.updateCampaign);
  const deleteCampaign = useAppStore((state) => state.deleteCampaign);
  const selectConcept = useAppStore((state) => state.selectConcept);
  const error = useAppStore((state) => state.campaignError);
  const campaign = useAppStore((state) => {
    for (const campaigns of Object.values(state.campaignsByProduct)) {
      const found = campaigns.find((item) => item.id === campaignId);
      if (found) return found;
    }
    return null;
  });
  const [name, setName] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!campaign) return null;
  const nameText = name ?? campaign.name;
  const badges = conceptBadges(campaign.concepts, campaign.testType);
  const warnings = campaignWarnings(campaign.concepts, campaign.testType);
  const adCount = campaign.concepts.reduce((sum, concept) => sum + concept.ads.length, 0);

  return h(
    "aside",
    {
      className:
        "strategy-inspector w-full min-h-0 shrink-0 overflow-y-auto border-l border-[#DFE2E6] bg-white lg:h-full lg:w-[440px] " +
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:max-h-[78vh] max-lg:rounded-t-2xl max-lg:shadow-[0_-12px_34px_rgba(21,23,26,.16)]",
      "aria-label": "Campaign",
    },
    h(
      "div",
      { className: "relative border-b border-[#E7E9EC] bg-[#FAFBFC] px-4 py-3" },
      h(
        "button",
        {
          type: "button",
          onClick: closeCampaignPanel,
          "aria-label": "Close campaign",
          className: "absolute right-3 top-3 rounded p-1 text-muted hover:bg-canvas hover:text-ink",
        },
        h(X, { size: 16 }),
      ),
      h("p", { className: "mono text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, `${CAMPAIGN_KIND_LABEL[campaign.kind]} campaign`),
      h("p", { className: "mt-1 text-xs text-muted" }, `${campaign.concepts.length} ad set${campaign.concepts.length === 1 ? "" : "s"} · ${adCount} ad${adCount === 1 ? "" : "s"}`),
    ),
    h(
      "div",
      { className: "space-y-5 p-4" },
      h(
        "label",
        { className: "block" },
        h("span", { className: "mono mb-1 block text-[8px] font-semibold uppercase tracking-[.12em] text-muted" }, "Name"),
        h("input", {
          value: nameText,
          maxLength: 80,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
          onBlur: () => {
            const next = nameText.trim();
            setName(null);
            if (next && next !== campaign.name) void updateCampaign(campaign.id, { name: next });
          },
          className: "h-9 w-full rounded-md border border-[#D8DCE1] bg-white px-2.5 text-sm font-semibold text-ink outline-none focus:border-lineage",
        }),
      ),
      h(
        "div",
        null,
        h("span", { className: "mono mb-1 block text-[8px] font-semibold uppercase tracking-[.12em] text-muted" }, "Campaign type"),
        h(Select, {
          ariaLabel: "Campaign type",
          value: campaign.kind,
          onChange: (value: string) => void updateCampaign(campaign.id, { kind: value as CampaignKind }),
          options: kindOptions,
          className: "h-9 w-full rounded-md border border-[#D8DCE1] bg-white pl-2.5 pr-7 text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
          wrapperClassName: "w-full",
        }),
      ),
      h(
        "div",
        null,
        h("span", { className: "mono mb-1 block text-[8px] font-semibold uppercase tracking-[.12em] text-muted" }, "What this campaign tests"),
        h(Select, {
          ariaLabel: "What this campaign tests",
          value: campaign.testType,
          onChange: (value: string) => void updateCampaign(campaign.id, { testType: value as TestType }),
          options: testTypeOptions,
          className: "h-9 w-full rounded-md border border-[#D8DCE1] bg-white pl-2.5 pr-7 text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
          wrapperClassName: "w-full",
        }),
        h("p", { className: "mt-1.5 text-[11px] leading-4 text-muted" }, TEST_TYPE_INFO[campaign.testType].hint),
      ),
      h(
        "section",
        { "aria-label": "Test quality" },
        warnings.length
          ? h("ul", { className: "space-y-1.5" }, ...warnings.map((warning) => h("li", { key: warning, className: "flex items-start gap-1.5 text-[11px] leading-4 text-amber-700" }, h(AlertTriangle, { size: 12, className: "mt-0.5 shrink-0" }), warning)))
          : h("p", { className: "flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700" }, h(CheckCircle2, { size: 13 }), "A clean test: every ad set changes only what this campaign tests."),
      ),
      h(
        "section",
        null,
        h("h2", { className: "text-xs font-semibold text-ink" }, "Ad sets"),
        campaign.concepts.length
          ? h(
              "ul",
              { className: "mt-2 divide-y divide-[#ECEEF1] rounded-lg border border-[#E7E9EC]" },
              ...campaign.concepts.map((concept, index) =>
                h(
                  "li",
                  { key: concept.id },
                  h(
                    "button",
                    { type: "button", onClick: () => selectConcept(concept.id), className: "block w-full px-3 py-2 text-left hover:bg-[#F6F7F9]" },
                    h("p", { className: "truncate text-[11px] font-semibold text-ink" }, `${labels.avatar(concept.avatarId)} · ${labels.angle(concept.angleId)}`),
                    h("p", { className: "truncate text-[10px] text-muted" }, `${labels.offer(concept.offerId)} · ${badges[index]?.label ?? ""} · ${concept.ads.length} ad${concept.ads.length === 1 ? "" : "s"}`),
                  ),
                ),
              ),
            )
          : h("p", { className: "mt-2 text-[11px] leading-4 text-muted" }, "This campaign has no ad sets."),
      ),
      error ? h("p", { role: "alert", className: "text-[11px] text-red-600" }, error) : null,
      h(
        "div",
        { className: "flex flex-wrap gap-2" },
        h(
          "button",
          {
            type: "button",
            disabled: campaign.concepts.length === 0,
            onClick: () => downloadCsv(campaign.name, campaignToCsv(campaign, labels)),
            className: "flex h-9 items-center gap-1.5 rounded-md bg-ink px-3 text-xs font-semibold text-white disabled:opacity-35",
          },
          h(Download, { size: 13 }),
          "Export CSV",
        ),
        h(
          "button",
          {
            type: "button",
            onClick: () => setConfirming(true),
            className: "flex h-9 items-center gap-1.5 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50",
          },
          h(Trash2, { size: 13 }),
          "Delete campaign",
        ),
      ),
    ),
    h(ConfirmationDialog, {
      open: confirming,
      title: `Delete ${campaign.name}?`,
      description: `It removes the campaign, its ${campaign.concepts.length} ad set${campaign.concepts.length === 1 ? "" : "s"} and their ads. Personas, angles and offers are kept.`,
      confirmLabel: "Delete campaign",
      onCancel: () => setConfirming(false),
      onConfirm: () => {
        setConfirming(false);
        void deleteCampaign(campaign.id);
      },
    }),
  );
}
