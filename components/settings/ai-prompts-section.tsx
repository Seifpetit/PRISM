"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  Check,
  Code2,
  Copy,
  Images,
  LayoutList,
  Lightbulb,
  Package,
  Quote,
  Tag,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { api, type PromptCatalogEntry } from "@/api/api";
import { LibraryHeader, LibraryToolbar, matchesSearch, PagedLibrary } from "@/components/settings/library";
import { PromptTemplateEditor } from "@/components/strategy-nodes/prompt-template-editor";
import { Modal } from "@/components/ui/modal";
import { h } from "@/lib/h";

const GROUP_LABEL: Record<PromptCatalogEntry["group"], string> = {
  product: "Product",
  strategy: "Strategy",
  ads: "Ads",
};

/** Each prompt's picture: the ingredient colours where there is one (persona violet, angle blue, offer amber). */
const PROMPT_LOOK: Record<string, { icon: LucideIcon; accent: string }> = {
  "product-context": { icon: Package, accent: "var(--lineage-selected)" },
  "product-image": { icon: Camera, accent: "var(--lineage-selected)" },
  creative_exploration_target_avatars: { icon: UserRound, accent: "var(--type-persona)" },
  creative_exploration_angles: { icon: Lightbulb, accent: "var(--type-angle)" },
  creative_exploration_offers: { icon: Tag, accent: "var(--type-offer)" },
  creative_exploration_ad_plan: { icon: LayoutList, accent: "#e0457b" },
  creative_exploration_ad_hooks: { icon: Quote, accent: "#e0457b" },
  "persona-image": { icon: UserRound, accent: "var(--type-persona)" },
  "ad-thumbnail": { icon: Images, accent: "#e0457b" },
};

function PromptIcon({ id, size = 44 }: { id: string; size?: number }) {
  const look = PROMPT_LOOK[id] ?? { icon: Code2, accent: "var(--text-muted)" };
  const Icon = look.icon;
  return h(
    "span",
    {
      className: "grid shrink-0 place-items-center",
      style: {
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.27),
        color: look.accent,
        background: `color-mix(in srgb, ${look.accent} 22%, var(--bg-panel))`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${look.accent} 45%, transparent)`,
      },
      "aria-hidden": true,
    },
    h(Icon, { size: Math.round(size * 0.5), strokeWidth: 2 }),
  );
}

function stateLabel(entry: PromptCatalogEntry) {
  if (!entry.isCustom) return "Default";
  return entry.version ? `Customized · v${entry.version}` : "Customized";
}

function PromptCard({ entry, onOpen }: { entry: PromptCatalogEntry; onOpen: () => void }) {
  return h(
    "button",
    {
      type: "button",
      "aria-label": `${entry.label} prompt, ${GROUP_LABEL[entry.group]}, ${stateLabel(entry)}. Open.`,
      onClick: onOpen,
      className: `flex h-full flex-col rounded-2xl border border-[#E4E7EB] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#C9CED5] hover:shadow-[0_8px_24px_rgba(21,23,26,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${entry.inactiveNote ? "opacity-75" : ""}`,
    },
    h(
      "div",
      { className: "flex items-start gap-3" },
      h(PromptIcon, { id: entry.id }),
      h(
        "div",
        { className: "min-w-0 flex-1" },
        h("p", { className: "truncate text-[13px] font-semibold text-ink" }, entry.label),
        h(
          "p",
          { className: "mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.08em] text-muted" },
          GROUP_LABEL[entry.group],
          h("span", { "aria-hidden": true }, "·"),
          entry.modality === "image" ? "Image prompt" : "Text prompt",
        ),
      ),
      entry.isCustom
        ? h("span", { className: "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", style: { color: "var(--lineage-selected)", background: "color-mix(in srgb, var(--lineage-selected) 12%, var(--bg-panel))" } }, entry.version ? `v${entry.version}` : "Edited")
        : null,
    ),
    h("p", { className: "mt-3 line-clamp-2 text-[11.5px] leading-[17px] text-muted" }, entry.description),
    h(
      "div",
      { className: "mt-auto flex items-center justify-between gap-2 border-t border-[#ECEEF1] pt-2.5 text-[10.5px] text-muted" },
      h("span", { className: "min-w-0 truncate", title: entry.inactiveNote ?? entry.usedWhen ?? undefined }, entry.inactiveNote ?? entry.usedWhen ?? ""),
      h("span", { className: "shrink-0 font-mono" }, `${(entry.chars / 1000).toFixed(1)}k chars`),
    ),
  );
}

function PlaceholderList({ placeholders }: { placeholders: PromptCatalogEntry["placeholders"] }) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(token);
      window.setTimeout(() => setCopied((current) => (current === token ? null : current)), 1400);
    } catch {
      // Clipboard access denied; the token is still visible to copy by hand.
    }
  }
  return h(
    "div",
    null,
    h("p", { className: "flex items-center gap-2 text-xs font-semibold text-ink" }, h(Code2, { size: 14 }), "Placeholders"),
    h("p", { className: "mt-1 text-[11px] leading-4 text-muted" }, "Filled in with the current call's data. Click one to copy it."),
    h(
      "ul",
      { className: "mt-3 space-y-2.5" },
      ...placeholders.map((placeholder) =>
        h(
          "li",
          { key: placeholder.token },
          h(
            "button",
            { type: "button", onClick: () => void copy(placeholder.token), className: "inline-flex items-center gap-1.5 rounded border border-[#DDE0E4] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink hover:bg-[#F6F7F9]" },
            placeholder.token,
            copied === placeholder.token ? h(Check, { size: 11, style: { color: "var(--status-success)" } }) : h(Copy, { size: 11, className: "text-muted" }),
          ),
          h("p", { className: "mt-1 text-[10.5px] leading-4 text-muted" }, placeholder.description),
        ),
      ),
    ),
  );
}

function PromptModal({ entry, onClose, onSaved }: { entry: PromptCatalogEntry; onClose: () => void; onSaved: () => void }) {
  const source = useMemo(
    () => ({
      load: () => api.promptCatalogContent({ id: entry.id }),
      save: (content: string) => api.savePromptCatalogContent({ id: entry.id, content }),
    }),
    [entry.id],
  );
  return h(
    Modal,
    {
      open: true,
      onClose,
      size: "xl",
      fill: true,
      icon: h(PromptIcon, { id: entry.id, size: 32 }),
      title: `${entry.label} prompt`,
      subtitle: `${GROUP_LABEL[entry.group]} · ${entry.modality === "image" ? "sent to the image model" : "sent to the text model"}`,
    },
    h(
      "div",
      { className: "grid min-h-0 flex-1 gap-5 p-5 lg:grid-cols-[230px_minmax(0,1fr)]" },
      h(
        "aside",
        { className: "min-h-0 space-y-4 overflow-y-auto text-xs lg:border-r lg:border-[#ECEEF1] lg:pr-5" },
        h("p", { className: "leading-5 text-ink" }, entry.description),
        h(
          "dl",
          { className: "space-y-2.5 text-[11px]" },
          h("div", null, h("dt", { className: "font-semibold text-muted" }, "Used"), h("dd", { className: "mt-0.5 text-ink" }, entry.inactiveNote ?? entry.usedWhen ?? "—")),
          h("div", null, h("dt", { className: "font-semibold text-muted" }, "Takes effect"), h("dd", { className: "mt-0.5 text-ink" }, "From the next run. Runs already made keep the prompt they used.")),
          h(
            "div",
            null,
            h("dt", { className: "font-semibold text-muted" }, "Saved as"),
            h("dd", { className: "mt-0.5 text-ink" }, entry.id.startsWith("creative_exploration_") ? "A new version for this workspace; earlier versions are kept." : "This server's prompt override, replacing the shipped default."),
          ),
        ),
        entry.placeholders.length ? h(PlaceholderList, { placeholders: entry.placeholders }) : null,
      ),
      h(
        "div",
        { className: "flex min-h-[320px] min-w-0 flex-col" },
        h(PromptTemplateEditor, { templateId: entry.id, title: entry.label, description: entry.description, source, headless: true, onSaved }),
      ),
    ),
  );
}

const SORT_OPTIONS = [
  { value: "workflow", label: "Workflow order" },
  { value: "name", label: "Name A–Z" },
  { value: "edited", label: "Recently edited" },
  { value: "length", label: "Longest first" },
];

export function AiPromptsSection() {
  const [entries, setEntries] = useState<PromptCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");
  const [sort, setSort] = useState("workflow");
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEntries(await api.promptCatalog());
      setError(null);
    } catch {
      setError("The prompts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const chips = [
    { value: "all", label: "All", count: entries.length },
    ...(Object.keys(GROUP_LABEL) as Array<PromptCatalogEntry["group"]>).map((group) => ({ value: group, label: GROUP_LABEL[group], count: entries.filter((entry) => entry.group === group).length })),
    { value: "image", label: "Image prompts", count: entries.filter((entry) => entry.modality === "image").length },
    { value: "custom", label: "Customized", count: entries.filter((entry) => entry.isCustom).length },
  ];

  const visible = useMemo(() => {
    const order = new Map(entries.map((entry, index) => [entry.id, index]));
    const filtered = entries.filter(
      (entry) =>
        (chip === "all" || entry.group === chip || (chip === "custom" && entry.isCustom) || (chip === "image" && entry.modality === "image")) &&
        matchesSearch(search, [entry.label, entry.description, entry.usedWhen, GROUP_LABEL[entry.group], entry.id]),
    );
    return [...filtered].sort((a, b) =>
      sort === "name"
        ? a.label.localeCompare(b.label)
        : sort === "edited"
          ? (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || Number(b.isCustom) - Number(a.isCustom)
          : sort === "length"
            ? b.chars - a.chars
            : (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
  }, [entries, chip, search, sort]);

  const open = entries.find((entry) => entry.id === openId) ?? null;
  const customized = entries.filter((entry) => entry.isCustom).length;

  return h(
    "section",
    { className: "flex h-full min-h-[480px] flex-col gap-4 px-5 py-6 sm:px-8 lg:px-10", "aria-labelledby": "ai-prompts-title" },
    h(LibraryHeader, {
      eyebrow: "AI prompts",
      title: "Every prompt Prism sends",
      description: "One card per AI call, in the order the workflow uses them. Click a prompt to read and edit it.",
      aside: h("p", { id: "ai-prompts-title", className: "text-xs text-muted" }, loading ? "Loading…" : `${entries.length} prompts · ${customized} customized`),
    }),
    h(LibraryToolbar, {
      search,
      onSearch: setSearch,
      searchPlaceholder: "Search prompts",
      chips,
      chip,
      onChip: setChip,
      sortOptions: SORT_OPTIONS,
      sort,
      onSort: setSort,
    }),
    error
      ? h("div", { role: "alert", className: "grid flex-1 place-items-center text-sm", style: { color: "var(--status-error)" } }, error)
      : loading
        ? h("div", { role: "status", className: "grid flex-1 place-items-center text-sm text-muted" }, "Loading prompts…")
        : h(PagedLibrary<PromptCatalogEntry>, {
            items: visible,
            getKey: (entry) => entry.id,
            renderTile: (entry) =>
              h(PromptCard, { entry, onOpen: () => setOpenId(entry.id) }),
            tileMinWidth: 250,
            tileHeight: 172,
            gap: 14,
            resetKey: `${chip}|${search}|${sort}`,
            empty: search ? `No prompt matches “${search}”.` : "No prompts here.",
          }),
    open ? h(PromptModal, { key: open.id, entry: open, onClose: () => setOpenId(null), onSaved: () => void refresh() }) : null,
  );
}
