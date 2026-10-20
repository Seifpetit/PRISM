"use client";

import { useState } from "react";
import { Loader2, Pencil, Sparkles, X } from "lucide-react";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Select } from "@/components/ui/select";
import { inputClass, selectClass } from "@/components/campaign/ad-editor";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import { AD_FORMATS, AD_FORMAT_LABEL, AWARENESS_HELP, AWARENESS_LABEL, AWARENESS_STAGES, type CampaignAd } from "@/types/campaign";

const formatOptions = AD_FORMATS.map((value) => ({ value, label: AD_FORMAT_LABEL[value] }));
const awarenessOptions = AWARENESS_STAGES.map((value) => ({ value, label: AWARENESS_LABEL[value] }));

/**
 * One section of the brief. It reads as text first; clicking it turns it into a field, and leaving the field
 * saves it (Escape drops the edit). `action` sits on the section's label row.
 */
function BriefSection({
  label,
  value,
  placeholder,
  minRows = 2,
  maxLength,
  display,
  onSave,
  action,
  children,
}: {
  label: string;
  value: string;
  placeholder: string;
  minRows?: number;
  maxLength?: number;
  display?: (value: string) => React.ReactNode;
  onSave: (value: string) => void;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const finish = (save: boolean) => {
    setEditing(false);
    if (save && draft.trim() !== value.trim()) onSave(draft);
  };

  return h(
    "section",
    { "aria-label": label, className: "border-t border-[#ECEEF1] pt-3" },
    h(
      "div",
      { className: "mb-1.5 flex items-center justify-between gap-2" },
      h("h3", { className: "mono text-[8px] font-semibold uppercase tracking-[.14em] text-muted" }, label),
      action ?? null,
    ),
    editing
      ? h(AutoTextarea, {
          value: draft,
          onChange: setDraft,
          onBlur: () => finish(true),
          onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === "Escape") finish(false);
          },
          minRows,
          maxLength,
          placeholder,
          autoFocus: true,
          ariaLabel: label,
          className: inputClass,
        })
      : h(
          "button",
          {
            type: "button",
            onClick: () => {
              setDraft(value);
              setEditing(true);
            },
            "aria-label": `Edit ${label.toLowerCase()}`,
            className:
              "group relative block w-full rounded-md px-2 py-1.5 -mx-2 text-left text-xs leading-5 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
          },
          value.trim() ? (display ? display(value) : h("span", { className: "whitespace-pre-wrap text-ink" }, value)) : h("span", { className: "italic text-muted" }, placeholder),
          h(Pencil, { size: 11, className: "absolute right-2 top-2 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100", "aria-hidden": true }),
        ),
    children ?? null,
  );
}

/** State and pieces for the hook alternatives: a button for the hook's label row and the list of options under it. Other ways to open this ad, from the AI. They are options, not changes: picking one saves it as the hook. */
function useHookAlternatives({ ad, onPick }: { ad: CampaignAd; onPick: (hook: string) => void }) {
  const generateHookAlternatives = useAppStore((state) => state.generateHookAlternatives);
  const [options, setOptions] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);

  return {
    button: h(
      "button",
      {
        type: "button",
        disabled: pending,
        "aria-busy": pending || undefined,
        onClick: async () => {
          setPending(true);
          const list = await generateHookAlternatives(ad.id);
          setPending(false);
          setOptions(list.length ? list : null);
        },
        className:
          "flex items-center gap-1 rounded-md border border-[#DDE0E4] px-2 py-1 text-[10px] font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60 " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
      },
      pending ? h(Loader2, { size: 11, className: "animate-spin motion-reduce:animate-none", "aria-hidden": true }) : h(Sparkles, { size: 11, "aria-hidden": true }),
      pending ? "Writing hooks…" : "Hook alternatives",
    ),
    list: options
      ? h(
          "div",
          { className: "mt-2 rounded-lg border border-[#DDE0E4] bg-canvas/40 p-2", role: "group", "aria-label": "Hook alternatives" },
          h(
            "div",
            { className: "flex items-center justify-between px-1 pb-1" },
            h("p", { className: "text-[10px] text-muted" }, "Pick one to use it as the hook."),
            h("button", { type: "button", onClick: () => setOptions(null), "aria-label": "Dismiss hook alternatives", className: "rounded p-0.5 text-muted hover:text-ink" }, h(X, { size: 12 })),
          ),
          h(
            "ul",
            { className: "space-y-1" },
            ...options.map((hook) =>
              h(
                "li",
                { key: hook },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      onPick(hook);
                      setOptions(null);
                    },
                    className: "block w-full rounded-md border border-transparent px-2 py-1.5 text-left text-xs leading-5 text-ink hover:border-lineage hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
                  },
                  `“${hook}”`,
                ),
              ),
            ),
          ),
        )
      : null,
  };
}

/**
 * The selected ad as a creative brief: its idea, hook, message sequence and call to action, read as text and
 * edited in place. Awareness stage and format stay as two always-live choices at the top.
 */
export function AdBrief({ conceptId, ad, index }: { conceptId: string; ad: CampaignAd; index: number }) {
  const updateAd = useAppStore((state) => state.updateAd);
  const save = (field: "title" | "direction" | "hook" | "cta" | "notes") => (value: string) => void updateAd(conceptId, ad.id, { [field]: value.trim() || null });
  const alternatives = useHookAlternatives({ ad, onPick: (hook) => save("hook")(hook) });

  return h(
    "div",
    { className: "space-y-3" },
    h(
      "div",
      { className: "grid grid-cols-2 gap-2" },
      h(
        "div",
        { className: "min-w-0" },
        h("span", { className: "mono mb-1 block text-[8px] font-semibold uppercase tracking-[.12em] text-muted" }, "Awareness stage"),
        h(Select, {
          ariaLabel: `Ad ${index + 1} awareness stage`,
          value: ad.awareness,
          onChange: (value: string) => void updateAd(conceptId, ad.id, { awareness: value }),
          options: awarenessOptions,
          className: selectClass,
          wrapperClassName: "w-full",
        }),
      ),
      h(
        "div",
        { className: "min-w-0" },
        h("span", { className: "mono mb-1 block text-[8px] font-semibold uppercase tracking-[.12em] text-muted" }, "Format"),
        h(Select, {
          ariaLabel: `Ad ${index + 1} format`,
          value: ad.format,
          onChange: (value: string) => void updateAd(conceptId, ad.id, { format: value }),
          options: formatOptions,
          className: selectClass,
          wrapperClassName: "w-full",
        }),
      ),
    ),
    h("p", { className: "-mt-1 text-[10px] leading-4 text-muted" }, AWARENESS_HELP[ad.awareness]),
    h(BriefSection, {
      label: "Title",
      value: ad.title ?? "",
      placeholder: "Name this creative idea",
      minRows: 1,
      maxLength: 120,
      display: (value) => h("span", { className: "text-base font-semibold leading-6 text-ink" }, value),
      onSave: save("title"),
    }),
    h(
      BriefSection,
      {
        label: "Hook",
        value: ad.hook ?? "",
        placeholder: "What is seen or said first",
        maxLength: 500,
        display: (value) => h("span", { className: "text-[13px] leading-5 text-ink" }, `“${value}”`),
        onSave: save("hook"),
        action: alternatives.button,
      },
      alternatives.list,
    ),
    h(BriefSection, {
      label: "Creative idea",
      value: ad.direction ?? "",
      placeholder: "The concrete scenario that carries the angle",
      minRows: 3,
      maxLength: 1200,
      onSave: save("direction"),
    }),
    h(BriefSection, {
      label: "Message sequence",
      value: ad.beats.join("\n"),
      placeholder: "One step per line, from the hook to the product and the offer",
      minRows: 4,
      display: (value) =>
        h(
          "ol",
          { className: "space-y-1.5" },
          ...value
            .split("\n")
            .filter((line) => line.trim())
            .map((line, position) =>
              h(
                "li",
                { key: `${position}-${line}`, className: "flex gap-2.5 text-ink" },
                h("span", { className: "mono mt-0.5 w-4 shrink-0 text-[10px] font-semibold text-muted" }, String(position + 1).padStart(2, "0")),
                h("span", null, line),
              ),
            ),
        ),
      onSave: (value) => {
        const beats = value.split("\n").map((line) => line.trim()).filter(Boolean);
        if (beats.join("\n") !== ad.beats.join("\n")) void updateAd(conceptId, ad.id, { beats });
      },
    }),
    h(BriefSection, { label: "Call to action", value: ad.cta ?? "", placeholder: "Explore the 3-for-2 bundle", minRows: 1, maxLength: 200, onSave: save("cta") }),
    h(BriefSection, { label: "Production notes", value: ad.notes ?? "", placeholder: "Proof, props, anything the maker should know", maxLength: 2000, onSave: save("notes") }),
  );
}
