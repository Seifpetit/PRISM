"use client";

import { useEffect, useState } from "react";
import { api, type MetaAccountCampaign } from "@/api/api";
import { StatusPill } from "@/components/performance/status-pill";
import { h } from "@/lib/h";
import { suggestCampaigns } from "@/lib/meta-campaigns";

const buttonClass =
  "shrink-0 rounded-md border border-[#DDE0E4] px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-[#F6F7F9] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Choose which of the ad account's campaigns launch this product. Performance then counts only those. A campaign
 * another product already has is shown but cannot be ticked here; names that contain this product's name are
 * suggested (and ticked, the first time).
 */
export function CampaignAssignment({
  productId,
  productName,
  onSaved,
  onCancel,
}: {
  productId: string;
  productName: string;
  onSaved: (count: number) => void;
  onCancel: () => void;
}) {
  const [campaigns, setCampaigns] = useState<MetaAccountCampaign[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suggested, setSuggested] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .metaCampaigns({ productId })
      .then((list) => {
        if (!active) return;
        const mine = list.filter((campaign) => campaign.assignedProductId === productId).map((campaign) => campaign.id);
        const free = list.filter((campaign) => !campaign.assignedProductId);
        const guesses = suggestCampaigns(free, productName);
        setCampaigns(list);
        setSuggested(new Set(guesses));
        // The first time, the likely ones are ticked for you; after that, your own choice is what is shown.
        setSelected(new Set(mine.length ? mine : guesses));
      })
      .catch((failure) => active && setError(failure instanceof Error ? failure.message : "Could not load the ad account's campaigns."));
    return () => {
      active = false;
    };
  }, [productId, productName]);

  const query = search.trim().toLowerCase();
  const shown = (campaigns ?? []).filter((campaign) => !query || campaign.name.toLowerCase().includes(query));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!campaigns) return;
    setSaving(true);
    setError(null);
    try {
      const chosen = campaigns.filter((campaign) => selected.has(campaign.id)).map((campaign) => ({ id: campaign.id, name: campaign.name }));
      onSaved(await api.setProductMetaCampaigns({ productId, campaigns: chosen }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the assignment.");
      setSaving(false);
    }
  }

  return h(
    "div",
    { className: "mb-4 rounded-xl border border-[#0866FF]/40 bg-white", role: "region", "aria-label": "Assign Meta campaigns" },
    h(
      "div",
      { className: "border-b border-[#ECEEF1] px-4 py-3" },
      h("h3", { className: "text-sm font-semibold text-ink" }, `Which campaigns launch ${productName}?`),
      h("p", { className: "mt-0.5 text-[11px] leading-4 text-muted" }, "Performance will count only the campaigns you tick. A campaign can belong to one product."),
    ),
    error ? h("p", { role: "alert", className: "px-4 pt-3 text-xs text-red-600" }, error) : null,
    !campaigns && !error ? h("p", { className: "px-4 py-6 text-center text-xs text-muted", "aria-busy": true }, "Loading the ad account's campaigns…") : null,
    campaigns
      ? h(
          "div",
          null,
          campaigns.length > 8
            ? h("div", { className: "px-4 pt-3" }, h("input", { type: "search", value: search, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value), placeholder: "Search campaigns", "aria-label": "Search campaigns", className: "h-8 w-full rounded-md border border-[#D8DCE1] bg-white px-2.5 text-xs text-ink outline-none focus:border-lineage" }))
            : null,
          campaigns.length === 0 ? h("p", { className: "px-4 py-6 text-center text-xs text-muted" }, "This ad account has no campaigns yet.") : null,
          h(
            "ul",
            { className: "max-h-[300px] overflow-y-auto px-2 py-2" },
            ...shown.map((campaign) => {
              const elsewhere = campaign.assignedProductId && campaign.assignedProductId !== productId;
              return h(
                "li",
                { key: campaign.id },
                h(
                  "label",
                  { className: `flex items-center gap-2.5 rounded-md px-2 py-1.5 ${elsewhere ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-[#F6F7F9]"}` },
                  h("input", { type: "checkbox", checked: selected.has(campaign.id), disabled: Boolean(elsewhere), onChange: () => toggle(campaign.id), className: "h-3.5 w-3.5 shrink-0 accent-[#0866FF]" }),
                  h("span", { className: "min-w-0 flex-1 truncate text-xs font-semibold text-ink", title: campaign.name }, campaign.name),
                  elsewhere
                    ? h("span", { className: "shrink-0 text-[10px] text-muted" }, `In ${campaign.assignedProductName}`)
                    : suggested.has(campaign.id)
                      ? h("span", { className: "shrink-0 rounded-full bg-[#0866FF]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#0866FF]" }, "Suggested")
                      : null,
                  h(StatusPill, { status: campaign.status }),
                ),
              );
            }),
          ),
        )
      : null,
    h(
      "div",
      { className: "flex items-center justify-between gap-3 border-t border-[#ECEEF1] px-4 py-2.5" },
      h("p", { className: "text-[11px] text-muted" }, campaigns ? `${selected.size} selected` : ""),
      h(
        "div",
        { className: "flex gap-2" },
        h("button", { type: "button", onClick: onCancel, disabled: saving, className: buttonClass }, "Cancel"),
        h("button", { type: "button", onClick: () => void save(), disabled: !campaigns || saving, className: "shrink-0 rounded-md bg-ink px-3.5 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35" }, saving ? "Saving…" : "Save"),
      ),
    ),
  );
}
