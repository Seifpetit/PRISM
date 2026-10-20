"use client";

import { Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  MorphingDialogDescription,
  MorphingDialogTitle,
} from "@/components/motion-primitives/morphing-dialog";
import { h } from "@/lib/h";
import type { AudienceAwarenessLevel, AudienceNode, StrategyNode } from "@/types/strategy";

const awarenessLabels: Record<AudienceAwarenessLevel, string> = {
  unaware: "Unaware",
  problem_aware: "Problem aware",
  solution_aware: "Solution aware",
  product_aware: "Product aware",
  most_aware: "Most aware",
};

function text(value?: string | null) {
  return value?.trim() || null;
}

function Section({ label, children }: { label: string; children?: ReactNode }) {
  return h(
    "section",
    { className: "border-t border-[#E4E6E9] pt-5" },
    h(
      "h3",
      { className: "mono text-[9px] font-semibold uppercase tracking-[.18em] text-muted" },
      label,
    ),
    h("div", { className: "mt-3" }, children),
  );
}

export function AudienceNodeCompact({
  node,
  selected,
  sharedLayout = true,
}: {
  node: AudienceNode;
  selected: boolean;
  sharedLayout?: boolean;
}) {
  const awareness = node.awarenessLevel ? awarenessLabels[node.awarenessLevel] : null;
  return h(
    "div",
    null,
    h(
      "div",
      { className: "flex items-start justify-between gap-3" },
      h(
        "p",
        { className: "mono text-[9px] font-semibold uppercase tracking-[.16em] text-muted" },
        "Audience",
      ),
      h(
        "span",
        {
          className: `audience-focus-affordance pointer-events-none flex items-center gap-1 text-[9px] font-medium text-lineage ${selected ? "is-ready" : ""}`,
          "aria-hidden": true,
        },
        "Focus",
        h(Maximize2, { size: 9 }),
      ),
    ),
    h(
      MorphingDialogTitle,
      {
        asDialogTitle: false,
        sharedLayout,
        className: "mt-2 pr-3 text-[14px] font-semibold leading-[1.4] text-ink",
      },
      node.label,
    ),
    awareness
      ? h(
          "span",
          {
            className:
              "mono mt-2 inline-flex rounded-full border border-[#DDE0E4] bg-[#FAFBFC] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[.1em] text-muted",
          },
          awareness,
        )
      : null,
    text(node.definingNeed)
      ? h(
          "p",
          { className: "mt-2 line-clamp-3 text-[12px] leading-[1.45] text-muted" },
          text(node.definingNeed),
        )
      : null,
  );
}

export function AudienceNodeExpanded({
  node,
  lineage,
  sharedLayout = true,
}: {
  node: AudienceNode;
  lineage: StrategyNode[];
  sharedLayout?: boolean;
}) {
  const awareness = node.awarenessLevel ? awarenessLabels[node.awarenessLevel] : null;
  const product = lineage.find((item) => item.type === "product");
  const productTitle =
    product?.type === "product"
      ? (text(product.workingLabel) ?? text(product.name) ?? product.label)
      : null;
  const strategyExists =
    awareness || text(node.messagingImplication) || text(node.awarenessRationale);
  const evidence = (node.supportedBy ?? []).map((item) => item.trim()).filter(Boolean);

  return h(
    "div",
    { className: "max-h-[78vh] overflow-y-auto px-6 pb-7 pt-6 sm:px-8 sm:pb-8 sm:pt-8" },
    h(
      "header",
      { className: "pr-12" },
      h(
        "p",
        { className: "mono text-[9px] font-semibold uppercase tracking-[.18em] text-muted" },
        "Audience",
      ),
      h(
        MorphingDialogTitle,
        {
          sharedLayout,
          className:
            "mt-3 max-w-[560px] text-[23px] font-semibold leading-[1.28] tracking-[-.02em] text-ink sm:text-[27px]",
        },
        node.label,
      ),
      awareness
        ? h(
            "span",
            {
              className:
                "mono mt-4 inline-flex rounded-full border border-[#D6D9DE] bg-[#FAFBFC] px-2 py-1 text-[9px] font-semibold uppercase tracking-[.12em] text-[#5D6470]",
            },
            awareness,
          )
        : null,
    ),
    h(
      MorphingDialogDescription,
      { className: "mt-6 space-y-5 text-[13px] leading-[1.62] text-[#4F5661]" },
      text(node.definingNeed)
        ? h(Section, { label: "Defining need" }, h("p", null, text(node.definingNeed)))
        : null,
      text(node.context)
        ? h(Section, { label: "Context" }, h("p", null, text(node.context)))
        : null,
      text(node.productRelevance)
        ? h(
            Section,
            { label: productTitle ? `Why ${productTitle}` : "Product relevance" },
            h("p", null, text(node.productRelevance)),
          )
        : null,
      strategyExists
        ? h(
            Section,
            { label: "Strategy" },
            h(
              "dl",
              { className: "grid gap-4 sm:grid-cols-[150px_1fr]" },
              awareness
                ? h(
                    "div",
                    null,
                    h("dt", { className: "text-[10px] font-medium text-muted" }, "Awareness"),
                    h("dd", { className: "mt-1 font-medium text-ink" }, awareness),
                  )
                : null,
              text(node.messagingImplication)
                ? h(
                    "div",
                    null,
                    h(
                      "dt",
                      { className: "text-[10px] font-medium text-muted" },
                      "Messaging direction",
                    ),
                    h("dd", { className: "mt-1 text-ink" }, text(node.messagingImplication)),
                  )
                : null,
              text(node.awarenessRationale)
                ? h(
                    "div",
                    { className: "sm:col-start-2" },
                    h(
                      "dt",
                      { className: "text-[10px] font-medium text-muted" },
                      "Why this awareness",
                    ),
                    h("dd", { className: "mt-1" }, text(node.awarenessRationale)),
                  )
                : null,
            ),
          )
        : null,
      evidence.length
        ? h(
            Section,
            { label: "Supported by" },
            h(
              "ul",
              { className: "space-y-2" },
              ...evidence.map((item) =>
                h(
                  "li",
                  { key: item, className: "flex gap-2" },
                  h("span", { className: "mt-[.15em] text-lineage", "aria-hidden": true }, "•"),
                  h("span", null, item),
                ),
              ),
            ),
          )
        : null,
      lineage.length > 1
        ? h(
            Section,
            { label: "Lineage" },
            h(
              "ol",
              { className: "flex flex-wrap items-center gap-2 text-[12px] font-medium text-ink" },
              ...lineage.map((item, index) =>
                h(
                  "li",
                  { key: item.id, className: "flex items-center gap-2" },
                  h("span", null, item.type === "product" ? productTitle : item.label),
                  index < lineage.length - 1
                    ? h("span", { className: "text-lineage", "aria-hidden": true }, "→")
                    : null,
                ),
              ),
            ),
          )
        : null,
    ),
  );
}
