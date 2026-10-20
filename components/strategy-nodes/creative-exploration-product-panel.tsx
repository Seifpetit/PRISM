"use client";

import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { api } from "@/api/api";
import { h } from "@/lib/h";
import { GenerationSetup } from "@/components/generation-setup/generation-setup";
import { useAppStore } from "@/store/use-app-store";
import type { ProductContext, ProductNode } from "@/types/strategy";

function clean(value?: string | null) {
  return value?.trim() ?? "";
}

function ContextList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return h(
    "div",
    null,
    h("p", { className: "mono text-[9px] font-semibold uppercase tracking-[.12em] text-muted" }, label),
    h(
      "ul",
      { className: "mt-1.5 space-y-1" },
      ...items.map((item, index) =>
        h(
          "li",
          { key: `${label}-${index}`, className: "border-l border-[#DDE0E4] pl-2 text-xs leading-5 text-ink" },
          item,
        ),
      ),
    ),
  );
}

function ProductContextBody({ productId }: { productId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [context, setContext] = useState<ProductContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api
      .productContext({ productId })
      .then((result) => {
        if (!active) return;
        setContext(result);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setError("Product context could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [productId]);

  return h(
    "section",
    {
      className:
        "max-h-[42%] shrink-0 space-y-3.5 overflow-y-auto rounded-lg border border-[#DDE0E4] bg-[#FAFBFC] px-3.5 py-3",
      "aria-label": "Product context",
    },
    error ? h("p", { className: "text-xs text-red-700" }, error) : null,
    !error && !loaded ? h("p", { className: "text-xs text-muted" }, "Loading product context…") : null,
    !error && loaded && !context
      ? h("p", { className: "text-xs text-muted" }, "No product context has been built for this product yet.")
      : null,
    !error && context
      ? h(
          "div",
          { className: "space-y-3.5" },
          clean(context.summary)
            ? h("p", { className: "text-xs leading-5 text-ink" }, clean(context.summary))
            : null,
          h(ContextList, { label: "Features", items: context.features }),
          h(ContextList, { label: "Mechanisms", items: context.mechanisms }),
          h(ContextList, { label: "Benefits", items: context.benefits }),
          h(ContextList, { label: "Proof points", items: context.proofPoints }),
          h(ContextList, { label: "Use cases", items: context.useCases }),
          h(ContextList, { label: "Claims", items: context.claims }),
          h(ContextList, { label: "Constraints", items: context.constraints }),
        )
      : null,
  );
}

export function CreativeExplorationProductPanel({
  product,
  onClose,
}: {
  product: ProductNode;
  onClose: () => void;
}) {
  const [contextOpen, setContextOpen] = useState(false);
  const generateAngles = useAppStore((state) => state.generateFromSelected);
  const generating = useAppStore((state) => state.generatingParentId !== null);
  const title = clean(product.workingLabel) || clean(product.name) || product.label;

  return h(
    "div",
    { className: "flex h-full min-h-0 flex-col" },
    h(
      "header",
      { className: "flex items-center gap-2 border-b border-[#E7E9EC] px-4 py-2.5" },
      h(
        "span",
        { className: "mono shrink-0 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" },
        "Product",
      ),
      h("h2", { className: "min-w-0 flex-1 truncate text-sm font-semibold text-ink", title }, title),
      h(
        "button",
        {
          type: "button",
          onClick: () => setContextOpen((current) => !current),
          "aria-expanded": contextOpen,
          title: "Product context",
          className: `inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
            contextOpen
              ? "border-lineage bg-canvas text-lineage"
              : "border-border-default bg-panel text-muted hover:bg-canvas hover:text-ink"
          }`,
        },
        h(FileText, { size: 13 }),
        "Context",
      ),
      h(
        "button",
        {
          type: "button",
          onClick: onClose,
          "aria-label": "Close inspector",
          className:
            "shrink-0 rounded p-1 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
        },
        h(X, { size: 16 }),
      ),
    ),
    contextOpen ? h("div", { className: "flex max-h-[42%] shrink-0 flex-col px-4 pt-4" }, h(ProductContextBody, { productId: product.productId })) : null,
    h(GenerationSetup, { key: product.productId, generator: "angles", productId: product.productId, onGenerate: () => void generateAngles(product.id), pending: generating }),
  );
}
