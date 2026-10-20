"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Select } from "@/components/ui/select";
import { FORMAT_ICON } from "@/components/creatives/ad-card";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import {
  AD_FORMATS,
  AD_FORMAT_LABEL,
  AWARENESS_HELP,
  AWARENESS_LABEL,
  AWARENESS_STAGES,
  type CampaignAd,
} from "@/types/campaign";

const formatOptions = AD_FORMATS.map((value) => ({ value, label: AD_FORMAT_LABEL[value] }));
const awarenessOptions = AWARENESS_STAGES.map((value) => ({ value, label: AWARENESS_LABEL[value] }));
export const inputClass = "w-full rounded-md border border-[#D8DCE1] bg-white px-2.5 py-2 text-xs leading-5 text-ink outline-none focus:border-lineage";
export const selectClass =
  "h-9 w-full rounded-md border border-[#D8DCE1] bg-white pl-2.5 pr-7 text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage";

export function Field({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) {
  return h(
    "label",
    { className: "block min-w-0" },
    h("span", { className: "mono mb-1 block text-[8px] font-semibold uppercase tracking-[.12em] text-muted" }, label),
    children,
    hint ? h("span", { className: "mt-1 block text-[10px] leading-4 text-muted" }, hint) : null,
  );
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * The six dimensions of one ad on a fixed ad set. Awareness and format are the two choices; direction, hook,
 * bridge (beats) and call to action are the words. Text is saved when you leave a field, not on every keystroke.
 * Mount it with the ad's id as its key so switching ads starts from that ad's text.
 */
export function AdFields({ conceptId, ad, index }: { conceptId: string; ad: CampaignAd; index: number }) {
  const updateAd = useAppStore((state) => state.updateAd);
  const [title, setTitle] = useState(ad.title ?? "");
  const [direction, setDirection] = useState(ad.direction ?? "");
  const [hook, setHook] = useState(ad.hook ?? "");
  const [beats, setBeats] = useState(ad.beats.join("\n"));
  const [cta, setCta] = useState(ad.cta ?? "");
  const [notes, setNotes] = useState(ad.notes ?? "");

  const saveText = (field: "title" | "direction" | "hook" | "cta" | "notes", value: string, current: string | null) => {
    const next = value.trim();
    if (next !== (current ?? "")) void updateAd(conceptId, ad.id, { [field]: next || null });
  };
  const saveBeats = () => {
    const list = beats.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!sameList(list, ad.beats)) void updateAd(conceptId, ad.id, { beats: list });
  };

  return h(
    "div",
    { className: "space-y-3" },
    h(
      Field,
      { label: "Title", hint: "A short name for the creative idea." },
      h("input", {
        value: title,
        maxLength: 120,
        placeholder: "The Electricity Bill Mystery",
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setTitle(event.target.value),
        onBlur: () => saveText("title", title, ad.title),
        className: `${inputClass} h-9 py-0`,
      }),
    ),
    h(
      "div",
      { className: "grid grid-cols-2 gap-2" },
      h(
        Field,
        { label: "Awareness stage" },
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
        Field,
        { label: "Format" },
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
    h(
      Field,
      { label: "Direction", hint: "The concrete scenario that carries the angle. Not a new angle." },
      h(AutoTextarea, {
        value: direction,
        maxLength: 1200,
        minRows: 3,
        placeholder: "A household compares one appliance's usage before and after a change",
        onChange: setDirection,
        onBlur: () => saveText("direction", direction, ad.direction),
        className: inputClass,
      }),
    ),
    h(
      Field,
      { label: "Hook", hint: "The first 2-3 seconds. Agitate the problem; don't call out the persona." },
      h(AutoTextarea, {
        value: hook,
        maxLength: 500,
        minRows: 2,
        placeholder: "What is seen or said first",
        onChange: setHook,
        onBlur: () => saveText("hook", hook, ad.hook),
        className: inputClass,
      }),
    ),
    h(
      Field,
      { label: "Bridge", hint: "One step per line, from the hook to the product and the offer. Less-aware ads bring the product in late." },
      h(AutoTextarea, {
        value: beats,
        minRows: 3,
        placeholder: "Show the problem\nName the mechanism\nDemonstrate\nIntroduce the product\nPresent the offer",
        onChange: setBeats,
        onBlur: saveBeats,
        className: inputClass,
      }),
    ),
    h(
      Field,
      { label: "Call to action" },
      h("input", {
        value: cta,
        maxLength: 200,
        placeholder: "Explore the 3-for-2 bundle",
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setCta(event.target.value),
        onBlur: () => saveText("cta", cta, ad.cta),
        className: `${inputClass} h-9 py-0`,
      }),
    ),
    h(
      Field,
      { label: "Production notes" },
      h(AutoTextarea, {
        value: notes,
        maxLength: 2000,
        minRows: 2,
        placeholder: "Proof, props, anything the maker should know",
        onChange: setNotes,
        onBlur: () => saveText("notes", notes, ad.notes),
        className: inputClass,
      }),
    ),
  );
}

/**
 * The row's own cover image, or the quiet placeholder standing in for it — same rule as everywhere else an ad
 * shows up: "none" (no request yet, including every ad made before thumbnails existed) and "failed" both read
 * as a plain format icon, never as something broken.
 */
function AdRowThumb({ ad }: { ad: CampaignAd }) {
  if (ad.imageStatus === "ready" && ad.imageUrl) {
    return h("span", { className: "ad-row-thumb is-lg" }, h("img", { src: ad.imageUrl, alt: "" }));
  }
  const Icon = FORMAT_ICON[ad.format];
  return h("span", { className: "ad-row-thumb is-lg is-placeholder", "aria-hidden": true }, h(Icon, { size: 20, strokeWidth: 1.6 }));
}

/** One ad as a collapsible card, for the ad-set drawer on the Strategy canvas. */
export function AdEditor({ conceptId, ad, index, defaultOpen = false }: { conceptId: string; ad: CampaignAd; index: number; defaultOpen?: boolean }) {
  const deleteAd = useAppStore((state) => state.deleteAd);
  const [open, setOpen] = useState(defaultOpen);

  return h(
    "li",
    { className: "rounded-lg border border-[#E7E9EC] bg-[#FAFBFC]" },
    h(
      "div",
      { className: "flex items-start gap-1 pr-2" },
      h(
        "button",
        {
          type: "button",
          onClick: () => setOpen((current) => !current),
          "aria-expanded": open,
          "aria-label": `Ad ${index + 1}: ${AD_FORMAT_LABEL[ad.format]}, ${AWARENESS_LABEL[ad.awareness]}`,
          className: "flex min-w-0 flex-1 items-start gap-2 rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
        },
        h(ChevronDown, { size: 14, className: `mt-0.5 shrink-0 text-muted transition-transform ${open ? "" : "-rotate-90"}`, "aria-hidden": true }),
        h(AdRowThumb, { ad }),
        h(
          "span",
          { className: "min-w-0 flex-1" },
          h(
            "span",
            { className: "flex flex-wrap items-center gap-1.5" },
            h("span", { className: "mono text-[9px] font-semibold uppercase tracking-[.12em] text-muted" }, `Ad ${index + 1}`),
            h("span", { className: "rounded-full border border-[#DDE0E4] px-1.5 py-0.5 text-[9px] font-semibold text-ink" }, AD_FORMAT_LABEL[ad.format]),
            h("span", { className: "rounded-full border border-[#DDE0E4] px-1.5 py-0.5 text-[9px] font-semibold text-muted" }, AWARENESS_LABEL[ad.awareness]),
          ),
          ad.title ? h("span", { className: "mt-1 block text-xs font-semibold leading-5 text-ink" }, ad.title) : null,
          h(
            "span",
            { className: `${ad.title ? "" : "mt-1"} block text-xs leading-5 ${ad.hook ? (ad.title ? "text-muted" : "text-ink") : "italic text-muted"} ${open ? "" : "line-clamp-2"}` },
            ad.hook ? `“${ad.hook}”` : "No hook yet",
          ),
        ),
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () => void deleteAd(conceptId, ad.id),
          "aria-label": `Delete ad ${index + 1}`,
          className: "mt-2.5 rounded p-1 text-muted hover:bg-red-50 hover:text-red-700",
        },
        h(Trash2, { size: 13 }),
      ),
    ),
    open ? h("div", { className: "border-t border-[#ECEEF1] p-3" }, h(AdFields, { conceptId, ad, index })) : null,
  );
}
