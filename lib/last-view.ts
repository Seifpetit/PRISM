// Which page (and product) was open last, kept in this browser so a reload or a restart lands back there. Browser
// storage can be empty, blocked or throw (private windows), so every read and write is guarded and the app works without it.

import type { AppTab, SettingsSectionId } from "@/types/strategy";

const KEY = "prism-last-view";
const TABS: AppTab[] = ["strategy", "creatives", "pipeline", "performance", "profile"];
const SECTIONS: SettingsSectionId[] = ["profile", "integrations", "data", "ai-prompts", "cost-ledger", "operations-logs", "user-notes"];

export interface LastView {
  tab: AppTab;
  productId: string | null;
  settingsSection: SettingsSectionId;
}

export function readLastView(): LastView | null {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LastView>;
    if (!value.tab || !TABS.includes(value.tab)) return null;
    return {
      tab: value.tab,
      productId: typeof value.productId === "string" ? value.productId : null,
      settingsSection: value.settingsSection && SECTIONS.includes(value.settingsSection) ? value.settingsSection : "profile",
    };
  } catch {
    return null;
  }
}

export function saveLastView(view: LastView) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    // Nothing to do: the next visit simply opens on the default page.
  }
}
