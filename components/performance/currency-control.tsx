"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Coins } from "lucide-react";
import { conversionFactor, currencyChoices, rateKey, type Market } from "@/lib/currency";
import type { CurrencyPrefs } from "@/lib/currency-prefs";
import { h } from "@/lib/h";

/** What the panel says about the live rates. */
export interface RatesStatus {
  loading: boolean;
  error: string | null;
  source: string | null;
  updatedAt: string | null;
  stale: boolean;
}

const chipClass = (selected: boolean) =>
  `rounded-md border px-2.5 py-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${
    selected ? "border-ink bg-ink text-white" : "border-[#DDE0E4] text-muted hover:text-ink"
  }`;
const inputClass = "w-24 rounded-md border border-[#DDE0E4] bg-transparent px-2 py-1 text-right text-xs tabular-nums text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * A button in the Performance toolbar that says which currency amounts are in. It opens a small panel: the currency to
 * show everything in, and the rate for each other currency in the data. Rates are live (looked up once a day) unless
 * you type your own, and an amount with no rate at all stays in its own currency.
 */
export function CurrencyControl({ prefs, present, market, status, onChange }: { prefs: CurrencyPrefs; present: string[]; market: Market | null; status: RatesStatus; onChange: (next: CurrencyPrefs) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !(event.target as Element | null)?.closest?.("[data-currency-control]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const { display, rates } = prefs;
  // What the button says: the chosen currency, else the one currency in the data, else that there is more than one.
  const label = display ?? (present.length === 1 ? present[0] : present.length > 1 ? "Mixed" : "Currency");
  const others = display ? present.filter((currency) => currency !== display) : [];

  const setRate = (from: string, text: string) => {
    if (!display) return;
    const value = Number(text);
    const next = { ...rates };
    // A rate typed one way replaces the same rate given the other way round; an empty box goes back to the live rate.
    delete next[rateKey(display, from)];
    if (value > 0) next[rateKey(from, display)] = value;
    else delete next[rateKey(from, display)];
    onChange({ display, rates: next });
  };
  const typedRate = (from: string) => {
    const factor = display ? conversionFactor(rates, from, display) : null;
    return factor === null ? "" : String(Number(factor.toPrecision(6)));
  };
  const liveRate = (from: string) => {
    const factor = display ? conversionFactor({}, from, display, market) : null;
    return factor === null ? "rate" : String(Number(factor.toPrecision(5)));
  };

  const statusText = !display
    ? "Each source is shown in its own currency. Pick one to see everything in it."
    : status.loading
      ? "Looking up today's rates…"
      : status.error
        ? `Couldn't look up live rates. ${status.error} Type your own below.`
        : `Live rates · ${status.source ?? "Exchange Rate API"}${status.updatedAt ? ` · ${day(status.updatedAt)}` : ""}${status.stale ? " (last known, the service is unreachable)" : ""}. Type a rate to use your own.`;

  return h(
    "div",
    { "data-currency-control": true, className: "relative" },
    h(
      "button",
      {
        type: "button",
        onClick: () => setOpen((value) => !value),
        "aria-expanded": open,
        "aria-haspopup": "dialog",
        "aria-label": display ? `Currency: ${display}. Amounts are shown in ${display}` : `Currency: ${label}. Amounts are shown as recorded`,
        title: display ? `Amounts shown in ${display}` : present.length > 1 ? "Amounts are in different currencies. Pick one to see everything in it" : "Show amounts in another currency",
        className: `flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${display ? "border-ink" : "border-[#DDE0E4] hover:bg-[#F6F7F9]"}`,
      },
      h(Coins, { size: 13, "aria-hidden": true }),
      h("span", { className: "tabular-nums" }, label),
      h(ChevronDown, { size: 12, className: `text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`, "aria-hidden": true }),
    ),
    open
      ? h(
          "div",
          { role: "dialog", "aria-label": "Currency", className: "absolute left-0 top-full z-30 mt-2 w-[320px] rounded-xl border border-[#DDE0E4] bg-white p-4 shadow-lg" },
          h("p", { id: "display-currency-label", className: "text-[11px] font-semibold text-ink" }, "Show amounts in"),
          h(
            "div",
            { role: "radiogroup", "aria-labelledby": "display-currency-label", className: "mt-2 flex flex-wrap gap-1.5" },
            h("button", { type: "button", role: "radio", "aria-checked": display === null, onClick: () => onChange({ display: null, rates }), className: chipClass(display === null) }, "As recorded"),
            ...currencyChoices(present).map((currency) => h("button", { key: currency, type: "button", role: "radio", "aria-checked": display === currency, onClick: () => onChange({ display: currency, rates }), className: chipClass(display === currency) }, currency)),
          ),
          display && others.length
            ? h(
                "div",
                { className: "mt-4 space-y-2 border-t border-[#ECEEF1] pt-3" },
                h("p", { className: "text-[11px] font-semibold text-ink" }, "Rates"),
                ...others.map((currency) =>
                  h(
                    "label",
                    { key: `${currency}>${display}`, className: "flex items-center justify-between gap-2 text-xs text-muted" },
                    h("span", null, `1 ${currency} =`),
                    h(
                      "span",
                      { className: "flex items-center gap-1.5" },
                      h("input", { type: "number", inputMode: "decimal", min: 0, step: "any", defaultValue: typedRate(currency), placeholder: liveRate(currency), onChange: (event: React.ChangeEvent<HTMLInputElement>) => setRate(currency, event.target.value), "aria-label": `1 ${currency} in ${display}`, className: inputClass }),
                      display,
                    ),
                  ),
                ),
              )
            : null,
          h("p", { className: `mt-3 text-[11px] leading-4 ${display && status.error ? "text-amber-700" : "text-muted"}` }, statusText),
        )
      : null,
  );
}
