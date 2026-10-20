"use client";

import { useEffect, useState } from "react";
import {
  Database,
  FileClock,
  MessageSquareText,
  Plug,
  ReceiptText,
  StickyNote,
  UserRound,
} from "lucide-react";
import { AiPromptsSection } from "@/components/settings/ai-prompts-section";
import { CostLedgerSection } from "@/components/settings/cost-ledger-section";
import { DataSection } from "@/components/settings/data-section";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import { OperationsLogsSection } from "@/components/settings/operations-logs-section";
import { ProfileSettingsSection } from "@/components/settings/profile-section";
import { UserNotesSection } from "@/components/settings/user-notes-section";
import { h } from "@/lib/h";
import { readableOn, useControlRoomAppearance } from "@/lib/control-room-appearance";
import { aiLedgerEntryToCostRecord, getAiCostLedgerEntries } from "@/services/cost-ledger";
import { getOperationLogs } from "@/services/operation-logs";
import { useAppStore } from "@/store/use-app-store";
import type { CostLedgerRecord } from "@/types/cost-ledger";
import type { AuthSession } from "@/types/auth";
import type { OperationLog } from "@/types/operation-log";
import type { SettingsSectionId } from "@/types/strategy";

const settingsSections = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "data", label: "Data", icon: Database },
  { id: "ai-prompts", label: "AI prompts", icon: MessageSquareText },
  { id: "cost-ledger", label: "Cost ledger", icon: ReceiptText },
  { id: "operations-logs", label: "Operations logs", icon: FileClock },
  { id: "user-notes", label: "User notes", icon: StickyNote },
] satisfies Array<{ id: SettingsSectionId; label: string; icon: typeof UserRound }>;

export function SettingsShell({ session }: { session: AuthSession }) {
  const products = useAppStore((state) => state.products);
  const { appearance } = useControlRoomAppearance(session.user.id);
  const activeSection = useAppStore((state) => state.settingsSection);
  const setActiveSection = useAppStore((state) => state.setSettingsSection);
  const [costRecords, setCostRecords] = useState<CostLedgerRecord[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerError, setLedgerError] = useState(false);

  useEffect(() => {
    let active = true;
    void getAiCostLedgerEntries()
      .then(async (entries) => {
        if (active) {
          setCostRecords(entries.map(aiLedgerEntryToCostRecord));
          setOperationLogs(await getOperationLogs(entries));
        }
      })
      .catch(() => {
        if (active) setLedgerError(true);
      })
      .finally(() => {
        if (active) setLedgerLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const content =
    activeSection === "profile"
      ? h(ProfileSettingsSection, { session })
      : activeSection === "integrations"
        ? h(IntegrationsSection)
        : activeSection === "data"
          ? h(DataSection)
        : activeSection === "ai-prompts"
        ? h(AiPromptsSection)
      : activeSection === "cost-ledger"
        ? h(CostLedgerSection, { records: costRecords, loading: ledgerLoading, error: ledgerError })
        : activeSection === "operations-logs"
          ? h(OperationsLogsSection, {
              logs: operationLogs,
              products,
              loading: ledgerLoading,
              error: ledgerError,
            })
          : h(UserNotesSection);

  // A fixed-height room: the library screens (Integrations, Data, AI prompts) fill exactly one screen and page
  // sideways; the reading screens (Profile, ledger, logs, notes) scroll inside the content area, never the page.
  return h(
    "main",
    {
      className: "h-[calc(100vh-65px)] overflow-hidden bg-[#F7F8FA]",
      // The person's accent colour, for the few contrast marks in this room (see lib/control-room-appearance).
      style: { "--control-accent": appearance.accent, "--control-accent-ink": readableOn(appearance.accent) } as React.CSSProperties,
    },
    h(
      "div",
      { className: "mx-auto flex h-full max-w-[1440px] flex-col md:flex-row" },
      h(
        "aside",
        {
          className:
            "shrink-0 border-b border-[#E1E4E8] bg-white px-4 py-4 md:w-[210px] md:border-b-0 md:border-r md:py-7",
          "aria-label": "Control room",
        },
        h(
          "p",
          { className: "px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-muted" },
          "Control room",
        ),
        h(
          "nav",
          {
            className: "mt-3 flex flex-wrap gap-1 md:mt-4 md:flex-col",
            "aria-label": "Settings sections",
          },
          ...settingsSections.map(({ id, label, icon: Icon }) => {
            const selected = activeSection === id;
            return h(
              "button",
              {
                key: id,
                type: "button",
                onClick: () => setActiveSection(id),
                "aria-current": selected ? "page" : undefined,
                className: `relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${selected ? "bg-[#EEF1F5] text-ink before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-[var(--control-accent)]" : "text-muted hover:bg-[#F6F7F9] hover:text-ink"}`,
              },
              h(Icon, { size: 15, style: selected ? { color: "var(--control-accent)" } : undefined }),
              label,
            );
          }),
        ),
      ),
      h("div", { className: "min-h-0 min-w-0 flex-1 overflow-y-auto" }, content),
    ),
  );
}
