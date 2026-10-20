"use client";

import { useState } from "react";
import type { ShopifySales } from "@/api/api";
import { useCurrency } from "@/components/performance/currency-context";
import { MetricCard, Notice, SectionSkeleton, cardClass } from "@/components/performance/metric-card";
import { ShopifyLinkCard } from "@/components/performance/shopify-link-card";
import type { Remote } from "@/components/performance/use-remote";
import { h } from "@/lib/h";
import { change, formatInteger, ratio } from "@/lib/meta-metrics";
import { useAppStore } from "@/store/use-app-store";

const SHOPIFY_GREEN = "#5E8E3E";
const buttonClass =
  "shrink-0 rounded-md border border-[#DDE0E4] px-3 py-1.5 text-[11px] font-semibold text-ink " +
  "hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-not-allowed disabled:opacity-40";

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const STATUS_TONE: Record<string, string> = {
  PAID: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  PARTIALLY_PAID: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  REFUNDED: "border-[#DDE0E4] text-muted",
  PARTIALLY_REFUNDED: "border-[#DDE0E4] text-muted",
  VOIDED: "border-[#DDE0E4] text-muted",
};

function OrderStatus({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "border-[#DDE0E4] text-muted";
  return h("span", { className: `shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[.06em] ${tone}` }, status.replace(/_/g, " ").toLowerCase());
}

function RecentOrders({ orders, currency }: { orders: NonNullable<ShopifySales["recentOrders"]>; currency: string }) {
  const { money } = useCurrency();
  if (!orders.length) return h("p", { className: "px-4 py-6 text-center text-xs text-muted" }, "No orders in this range.");
  return h(
    "ul",
    null,
    ...orders.map((order) =>
      h(
        "li",
        { key: order.id, className: "flex items-center gap-3 border-t border-[#F1F3F5] px-4 py-2.5 first:border-t-0" },
        h(
          "div",
          { className: "min-w-0 flex-1" },
          h("p", { className: "flex items-center gap-2 text-xs font-semibold text-ink" }, order.name, order.test ? h("span", { className: "rounded-full border border-[#DDE0E4] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[.06em] text-muted" }, "test") : null),
          h("p", { className: "mt-0.5 truncate text-[11px] text-muted", title: order.items }, `${dateTime(order.createdAt)} · ${order.items || "No items"}`),
        ),
        h(OrderStatus, { status: order.status }),
        h("p", { className: "w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-ink" }, money(order.total, currency)),
      ),
    ),
  );
}

function TopProducts({ products, currency }: { products: NonNullable<ShopifySales["topProducts"]>; currency: string }) {
  const { money } = useCurrency();
  if (!products.length) return h("p", { className: "px-4 py-6 text-center text-xs text-muted" }, "No sales in this range.");
  const top = Math.max(1, ...products.map((product) => product.revenue));
  return h(
    "ul",
    { className: "px-4 py-2" },
    ...products.map((product) =>
      h(
        "li",
        { key: product.id ?? product.title, className: "py-2" },
        h("div", { className: "flex items-baseline justify-between gap-3" }, h("p", { className: "min-w-0 truncate text-xs font-semibold text-ink", title: product.title }, product.title), h("p", { className: "shrink-0 text-xs tabular-nums text-ink" }, money(product.revenue, currency))),
        h("div", { className: "mt-1 h-1 rounded-full bg-[#ECEEF1]", "aria-hidden": true }, h("div", { className: "h-1 rounded-full", style: { width: `${(product.revenue / top) * 100}%`, background: SHOPIFY_GREEN } })),
        h("p", { className: "mt-0.5 text-[10.5px] text-muted" }, `${formatInteger(product.units)} sold`),
      ),
    ),
  );
}

/**
 * The Shopify section of Performance: what sold in the range the page has chosen, against the range before it, the
 * latest orders, and (for the whole store) the top products. "This product" counts only the orders that contain the
 * Shopify product linked to the open PRISM product.
 */
export function ShopifySalesSection({
  productId,
  productName,
  onScope,
  state,
  onLinkChange,
}: {
  productId: string;
  productName: string;
  onScope: (scope: "product" | "account") => void;
  state: Remote<ShopifySales>;
  onLinkChange: () => void;
}) {
  const openSettings = useAppStore((store) => store.openSettings);
  const { money } = useCurrency();
  const [linking, setLinking] = useState(false);
  const { data, error, loading } = state;
  const currency = data?.currency ?? "USD";

  let body: React.ReactNode;
  if (!data && !error) {
    body = h(SectionSkeleton, { cards: 4, label: "Loading Shopify sales" });
  } else if (error) {
    body = h(Notice, { title: "Couldn't load Shopify", body: error });
  } else if (data?.connected && data.unlinked) {
    body = h(Notice, {
      title: `${productName} isn't linked to a Shopify product yet`,
      body: "Link it so Performance can count the orders that contain it. Without a link you can still see the whole store.",
      action: h(
        "div",
        { className: "flex gap-2" },
        h("button", { type: "button", onClick: () => setLinking(true), className: "shrink-0 rounded-md bg-ink px-3.5 py-1.5 text-[11px] font-semibold text-white" }, "Link a product"),
        h("button", { type: "button", onClick: () => onScope("account"), className: buttonClass }, "View whole store"),
      ),
    });
  } else if (!data?.connected || !data.totals || !data.daily) {
    body = h(Notice, {
      title: data?.error ? "Shopify isn't reachable" : "Connect Shopify",
      body: data?.error ? `Shopify said: ${data.error}` : "Connect your store to see orders, revenue and what sold.",
      action: h("button", { type: "button", onClick: () => openSettings("integrations"), className: buttonClass }, "Open Integrations"),
    });
  } else {
    const totals = data.totals;
    const previous = data.previousTotals ?? null;
    const days = data.range?.days ?? 0;
    const aov = ratio(totals.revenue, totals.orders);
    const previousAov = previous ? ratio(previous.revenue, previous.orders) : null;
    const compare = previous ? `vs previous ${days}d` : undefined;
    const daily = data.daily;
    const notes = [
      data.historyLimited ? "Shopify returns only the last 60 days of orders with the permission PRISM has, so this range is cut at 60 days and there is nothing earlier to compare with." : null,
      data.truncated ? "This store has more orders in the range than PRISM reads, so the numbers are a floor." : null,
      data.testOrders ? `Includes ${data.testOrders} test order${data.testOrders === 1 ? "" : "s"}.` : null,
      data.scope === "product" ? `Only orders containing ${data.linkedTitle ?? "the linked product"}: revenue is that product's lines after discounts (no shipping or tax).` : "The whole store: revenue is the order total, net of refunds.",
    ].filter(Boolean);

    body = h(
      "div",
      { className: loading ? "opacity-60 transition-opacity" : "transition-opacity" },
      h(
        "div",
        { className: "grid grid-cols-2 gap-3 lg:grid-cols-4" },
        h(MetricCard, { label: "Revenue", value: money(totals.revenue, currency), fraction: previous ? change(totals.revenue, previous.revenue) : null, good: "up", compareLabel: compare, series: daily.map((day) => day.revenue), color: SHOPIFY_GREEN, note: previous ? undefined : "no earlier data" }),
        h(MetricCard, { label: "Orders", value: formatInteger(totals.orders), fraction: previous ? change(totals.orders, previous.orders) : null, good: "up", compareLabel: compare, series: daily.map((day) => day.orders), color: SHOPIFY_GREEN, note: previous ? undefined : "no earlier data" }),
        h(MetricCard, { label: "Units sold", value: formatInteger(totals.units), fraction: previous ? change(totals.units, previous.units) : null, good: "up", compareLabel: compare, color: SHOPIFY_GREEN, note: previous ? undefined : "no earlier data" }),
        h(MetricCard, { label: "Average order value", value: money(aov, currency), fraction: previous ? change(aov, previousAov) : null, good: "up", compareLabel: compare, color: SHOPIFY_GREEN, note: previous ? undefined : "no earlier data", hint: "Revenue divided by orders" }),
      ),
      h(
        "div",
        { className: `mt-4 grid gap-4 ${data.scope === "store" ? "lg:grid-cols-[1.6fr_1fr]" : ""}` },
        h(
          "div",
          { className: `${cardClass} overflow-hidden` },
          h("div", { className: "flex items-baseline justify-between gap-3 px-4 pb-2 pt-4" }, h("h3", { className: "text-sm font-semibold text-ink" }, "Latest orders"), h("p", { className: "text-[11px] text-muted" }, `${formatInteger(totals.orders)} in this range`)),
          h(RecentOrders, { orders: data.recentOrders ?? [], currency }),
        ),
        data.scope === "store"
          ? h(
              "div",
              { className: `${cardClass} overflow-hidden` },
              h("div", { className: "px-4 pb-1 pt-4" }, h("h3", { className: "text-sm font-semibold text-ink" }, "Top products")),
              h(TopProducts, { products: data.topProducts ?? [], currency }),
            )
          : null,
      ),
      h("p", { className: "mt-3 text-[11px] leading-4 text-muted" }, notes.join(" ")),
    );
  }

  return h(
    "section",
    { "aria-labelledby": "shopify-title" },
    h(
      "div",
      { className: "mb-4 flex flex-wrap items-center gap-x-3 gap-y-2" },
      h("span", { className: "grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold text-white", style: { background: SHOPIFY_GREEN }, "aria-hidden": true }, "S"),
      h("h2", { id: "shopify-title", className: "text-lg font-semibold tracking-[-.02em] text-ink" }, "Shopify"),
      data?.shopName
        ? h(
            "span",
            { className: "inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-[#5E8E3E]/45 bg-[#5E8E3E]/10 py-0.5 pl-1.5 pr-2.5 text-[11px] font-semibold text-ink", title: `Connected store: ${data.shopName}` },
            h("span", { className: "h-2 w-2 shrink-0 rounded-full", style: { background: SHOPIFY_GREEN }, "aria-hidden": true }),
            h("span", { className: "truncate" }, data.shopName),
          )
        : null,
      h("div", { className: "ml-auto flex items-center gap-2" }, h("button", { type: "button", onClick: () => setLinking((open) => !open), "aria-expanded": linking, className: buttonClass }, "Product link")),
    ),
    linking ? h("div", { className: "mb-4 max-w-[700px]" }, h(ShopifyLinkCard, { key: productId, productId, onLinkChange: () => { setLinking(false); onScope("product"); onLinkChange(); } })) : null,
    body,
  );
}
