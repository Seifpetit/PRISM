"use client";

import { createContext, useContext } from "react";
import { viewIn, type Market } from "@/lib/currency";
import { NO_CURRENCY_PREFS, type CurrencyPrefs } from "@/lib/currency-prefs";
import { formatMoney } from "@/lib/meta-metrics";

/** The currency amounts are shown in, the person's own rates, and the live market rates, for everything on Performance. */
export interface CurrencyState extends CurrencyPrefs {
  market: Market | null;
}
export const CurrencyContext = createContext<CurrencyState>({ ...NO_CURRENCY_PREFS, market: null });

export type MoneyFormat = (value: number | null, currency: string, digits?: number) => string;

/**
 * `view(currency)` says what to multiply an amount in that currency by and which currency it is then in (unchanged when
 * no display currency is chosen or no rate is known); `money` formats an amount that way. Charts convert their data
 * with `view` first, so what they plot and what their axes say agree.
 */
export function useCurrency() {
  const { display, rates, market } = useContext(CurrencyContext);
  const view = (currency: string) => viewIn(rates, display, currency, market);
  const money: MoneyFormat = (value, currency, digits) => {
    if (value === null) return "–";
    const shown = view(currency);
    return formatMoney(value * shown.factor, shown.currency, digits);
  };
  return { display, rates, market, view, money };
}
