"use client";

import { useEffect, useState } from "react";
import { api, type ProductLink, type ShopifyProduct } from "@/api/api";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";

type Connection = "loading" | "connected" | "disconnected";

const buttonClass =
  "shrink-0 rounded-md border border-[#DDE0E4] px-3 py-1.5 text-[11px] font-semibold text-ink " +
  "hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage " +
  "disabled:cursor-not-allowed disabled:opacity-40";

function ProductRow({
  product,
  linked,
  busy,
  onLink,
}: {
  product: ShopifyProduct;
  linked: boolean;
  busy: boolean;
  onLink: () => void;
}) {
  return h(
    "li",
    { className: "flex items-center gap-3 py-3" },
    product.imageUrl
      ? h("img", {
          src: product.imageUrl,
          alt: "",
          className: "h-10 w-10 shrink-0 rounded-md border border-[#DDE0E4] object-cover",
        })
      : h("span", { className: "h-10 w-10 shrink-0 rounded-md border border-[#DDE0E4] bg-[#F6F7F9]", "aria-hidden": true }),
    h(
      "div",
      { className: "min-w-0 flex-1" },
      h("p", { className: "truncate text-sm font-semibold text-ink" }, product.title),
      h("p", { className: "mt-0.5 text-[11px] uppercase tracking-wide text-muted" }, product.status.toLowerCase()),
    ),
    h(
      "button",
      { type: "button", onClick: onLink, disabled: busy || linked, className: buttonClass },
      linked ? "Linked" : "Link",
    ),
  );
}

/** Links this PRISM product to its product in the connected Shopify store, so sales can be looked up later. */
export function ShopifyLinkCard({ productId, onLinkChange }: { productId: string; onLinkChange?: () => void }) {
  const openSettings = useAppStore((state) => state.openSettings);
  const [connection, setConnection] = useState<Connection>("loading");
  const [link, setLink] = useState<ProductLink | null>(null);
  const [changing, setChanging] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ShopifyProduct[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([api.integrationStatus(), api.shopifyProductLink({ productId })])
      .then(([statuses, existing]) => {
        if (!active) return;
        setConnection(statuses.find((status) => status.id === "shopify")?.connected ? "connected" : "disconnected");
        setLink(existing);
      })
      .catch(() => {
        if (active) setConnection("disconnected");
      });
    return () => {
      active = false;
    };
  }, [productId]);

  const picking = connection === "connected" && (!link || changing);
  useEffect(() => {
    if (!picking) return;
    let active = true;
    const timer = setTimeout(() => {
      api
        .shopifyProducts({ search })
        .then((products) => {
          if (active) {
            setResults(products);
            setError(null);
          }
        })
        .catch((failure: unknown) => {
          if (active) setError(failure instanceof Error ? failure.message : "Could not load Shopify products.");
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [picking, search]);

  async function linkTo(product: ShopifyProduct) {
    setBusy(true);
    setError(null);
    try {
      setLink(await api.linkShopifyProduct({ productId, shopifyProductId: product.id }));
      setChanging(false);
      onLinkChange?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not link the product.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError(null);
    try {
      await api.unlinkShopifyProduct({ productId });
      setLink(null);
      setChanging(false);
      onLinkChange?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not unlink the product.");
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (connection === "loading") {
    body = h("p", { role: "status", className: "text-sm text-muted" }, "Checking Shopify…");
  } else if (connection === "disconnected") {
    body = h(
      "div",
      { className: "flex flex-wrap items-center justify-between gap-3" },
      h(
        "p",
        { className: "text-sm text-muted" },
        link
          ? `Linked to “${link.title}”, but Shopify isn't connected right now.`
          : "Shopify isn't connected yet. Connect your store to link this product.",
      ),
      h("button", { type: "button", onClick: () => openSettings("integrations"), className: buttonClass }, "Open Integrations"),
    );
  } else if (link && !changing) {
    body = h(
      "div",
      { className: "flex flex-wrap items-center justify-between gap-3" },
      h(
        "div",
        { className: "min-w-0" },
        h("p", { className: "truncate text-sm font-semibold text-ink" }, link.title),
        h("p", { className: "mt-0.5 text-xs text-muted" }, `Linked to ${link.storeDomain}`),
      ),
      h(
        "div",
        { className: "flex gap-2" },
        h("button", { type: "button", onClick: () => setChanging(true), disabled: busy, className: buttonClass }, "Change"),
        h("button", { type: "button", onClick: () => void unlink(), disabled: busy, className: `${buttonClass} text-red-700` }, "Unlink"),
      ),
    );
  } else {
    body = h(
      "div",
      null,
      h("label", { htmlFor: "shopify-product-search", className: "sr-only" }, "Search your Shopify products"),
      h("input", {
        id: "shopify-product-search",
        type: "search",
        value: search,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
        placeholder: "Search your Shopify products",
        autoComplete: "off",
        className:
          "h-10 w-full rounded-md border border-[#BFC5CD] bg-white px-3 text-sm text-ink outline-none focus:border-lineage",
      }),
      results === null
        ? h("p", { role: "status", className: "mt-4 text-sm text-muted" }, "Loading products…")
        : results.length
          ? h(
              "ul",
              { className: "mt-2 divide-y divide-[#ECEEF1]" },
              ...results.map((product) =>
                h(ProductRow, { key: product.id, product, linked: product.id === link?.externalId, busy, onLink: () => void linkTo(product) }),
              ),
            )
          : h(
              "p",
              { className: "mt-4 text-sm text-muted" },
              search.trim()
                ? "No products match that search."
                : "This store has no products yet. Add one in your Shopify admin, then come back.",
            ),
      changing
        ? h("div", { className: "mt-3" }, h("button", { type: "button", onClick: () => setChanging(false), className: buttonClass }, "Cancel"))
        : null,
    );
  }

  return h(
    "section",
    {
      className: "rounded-xl border border-[#DDE0E4] bg-white p-5 shadow-[0_1px_2px_rgb(21_23_26/.04)] sm:p-7",
      "aria-labelledby": "shopify-link-title",
    },
    h("h2", { id: "shopify-link-title", className: "text-sm font-semibold text-ink" }, "Shopify product"),
    h("p", { className: "mb-4 mt-1 text-xs leading-5 text-muted" }, "The store product whose sales PRISM will look up for this product."),
    body,
    error ? h("p", { role: "alert", className: "mt-3 text-xs text-red-600" }, error) : null,
  );
}

