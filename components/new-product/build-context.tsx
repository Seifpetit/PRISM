"use client";

import { useEffect, useState } from "react";
import {
  AlignLeft,
  ArrowRight,
  Check,
  FileText,
  Image,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  Video,
} from "lucide-react";
import type { AiModelInput } from "@/api/api";
import { h } from "@/lib/h";
import { buildProductContext } from "@/services/products";
import { useAppStore } from "@/store/use-app-store";
import {
  AI_MODEL_OPTIONS,
  type AiProvider,
  type ProductContext,
  type ProductSource,
  type ProductSourceType,
} from "@/types/strategy";
import { PrismAction } from "@/components/prism-action";
import { GenerationControl } from "@/components/generation-control";
import { TestingAndIntegrations } from "@/components/new-product/testing-and-integrations";

export type ProductContextFlowState = "intake" | "building" | "ready" | "error";

type ActiveProductContextFlowState = Exclude<ProductContextFlowState, "intake">;
type ContextListField = keyof Pick<
  ProductContext,
  "features" | "mechanisms" | "benefits" | "proofPoints" | "useCases" | "claims" | "constraints"
>;

interface BuildContextProps {
  ai: AiModelInput;
  onBackToIntake: () => void;
  onFlowStateChange: (state: ActiveProductContextFlowState) => void;
  simulateError: boolean;
  sources: ProductSource[];
  /** TEMPORARY (dev-only): skip straight to the post-review testing/integrations step. */
  devStartAtExtras?: boolean;
}

const structuringFields: Array<{ field: ContextListField; label: string }> = [
  { field: "features", label: "Features" },
  { field: "mechanisms", label: "Mechanisms" },
  { field: "benefits", label: "Benefits" },
  { field: "proofPoints", label: "Proof points" },
  { field: "useCases", label: "Use cases" },
  { field: "claims", label: "Claims" },
  { field: "constraints", label: "Constraints" },
];

const contextGroups: Array<{
  label: string;
  fields: Array<{ field: ContextListField; label: string }>;
}> = [
  {
    label: "Product",
    fields: [
      { field: "features", label: "Features" },
      { field: "mechanisms", label: "Mechanisms" },
    ],
  },
  {
    label: "Value",
    fields: [
      { field: "benefits", label: "Benefits" },
      { field: "useCases", label: "Use cases" },
    ],
  },
  {
    label: "Evidence",
    fields: [
      { field: "proofPoints", label: "Proof points" },
      { field: "claims", label: "Claims" },
    ],
  },
  { label: "Guardrails", fields: [{ field: "constraints", label: "Constraints" }] },
];

type ProductIdentityStatus = "confirmed" | "likely" | "uncertain";

const sourceIcons: Record<ProductSourceType, typeof Link2> = {
  url: Link2,
  file: FileText,
  image: Image,
  video: Video,
  text: AlignLeft,
};

function cn(...classNames: string[]) {
  return classNames.join(" ");
}

function sourceName(source: ProductSource) {
  if (source.type === "url") return source.value ?? source.label;
  return source.filename ?? source.label;
}

function sourcePreviewUrl(sources: ProductSource[]) {
  // A video's first extracted frame is a real screenshot and just as valid a
  // preview as an uploaded image — don't skip it in favor of a bare icon.
  const visualSource = sources.find(
    (source) => (source.type === "image" || source.type === "video") && source.previewUrl,
  );
  if (visualSource?.previewUrl) return visualSource.previewUrl;
  const inspectedSource = sources.find((source) =>
    source.inspection?.candidates.some((candidate) => candidate.imageUrl),
  );
  return (
    inspectedSource?.inspection?.candidates.find((candidate) => candidate.imageUrl)?.imageUrl ??
    null
  );
}

function previewIconCaption(type?: ProductSourceType) {
  if (type === "url") return "From link";
  if (type === "file") return "From file";
  if (type === "video") return "From video";
  if (type === "image") return "From image";
  return "From notes";
}

function sourceProcessingLabel(source: ProductSource) {
  if (source.type === "url") return `${source.label} received`;
  if (source.type === "file") return `${source.filename ?? "Product document"} attached`;
  if (source.type === "image") return `${source.filename ?? "Product image"} attached`;
  if (source.type === "video") return `${source.filename ?? "Product video"} sampled`;
  return "Product notes included";
}

function contextValues(context: ProductContext, field: ContextListField): string[] {
  const values = context[field];
  return Array.isArray(values) ? values : [];
}

function UtilityHeading({ children }: { children: string }) {
  return h(
    "p",
    {
      className: cn("mono text-[9px] font-semibold uppercase tracking-[.16em]", "text-muted"),
    },
    children,
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return h(
    "button",
    {
      type: "button",
      onClick,
      className: cn(
        "rounded px-1.5 py-1 text-[10px] font-semibold text-lineage",
        "opacity-0 transition-opacity hover:bg-[#EEF4FF] hover:text-ink group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-lineage",
      ),
      "aria-label": `Edit ${label}`,
    },
    "Edit",
  );
}

function EditableText({
  label,
  multiline = false,
  onSave,
  value,
}: {
  label: string;
  multiline?: boolean;
  onSave: (value: string) => void;
  value: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputId = `product-context-${label.toLowerCase().replace(/\s+/g, "-")}`;

  function startEditing() {
    setDraft(value);
    setEditing(true);
  }

  function save() {
    const next = draft.trim();
    if (next) onSave(next);
    setEditing(false);
  }

  return h(
    "section",
    { className: "group border-b border-[#E5E7EB] py-5 first:pt-0" },
    h(
      "div",
      { className: "flex items-center justify-between gap-3" },
      h(UtilityHeading, null, label),
      editing ? null : h(EditButton, { label, onClick: startEditing }),
    ),
    editing
      ? h(
          "div",
          { className: "mt-3" },
          h("label", { htmlFor: inputId, className: "sr-only" }, label),
          multiline
            ? h("textarea", {
                id: inputId,
                value: draft,
                rows: 3,
                onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setDraft(event.target.value);
                },
                className: cn(
                  "w-full resize-y rounded-md border border-[#BFC5CD] bg-white px-3 py-2",
                  "text-sm leading-6 outline-none focus:border-lineage",
                ),
              })
            : h("input", {
                id: inputId,
                value: draft,
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                  setDraft(event.target.value);
                },
                className: cn(
                  "h-10 w-full rounded-md border border-[#BFC5CD] bg-white px-3",
                  "text-lg font-semibold outline-none focus:border-lineage",
                ),
              }),
          h(
            "div",
            { className: "mt-2 flex gap-2" },
            h(
              "button",
              {
                type: "button",
                onClick: save,
                className: cn(
                  "rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white",
                  "hover:bg-lineage focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-lineage",
                ),
              },
              "Save",
            ),
            h(
              "button",
              {
                type: "button",
                onClick: () => setEditing(false),
                className: cn(
                  "rounded-md border border-[#DDE0E4] px-2.5 py-1.5 text-[11px]",
                  "font-semibold text-muted hover:bg-canvas focus-visible:outline-none",
                  "focus-visible:ring-2 focus-visible:ring-lineage",
                ),
              },
              "Cancel",
            ),
          ),
        )
      : multiline
        ? h("p", { className: "mt-2 max-w-3xl text-sm leading-6 text-muted" }, value)
        : h("h2", { className: "mt-2 text-2xl font-semibold tracking-[-.03em]" }, value),
  );
}

function EditableListSection({
  field,
  label,
  onSave,
  values,
}: {
  field: ContextListField;
  label: string;
  onSave: (field: ContextListField, values: string[]) => void;
  values: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState(values);

  function startEditing() {
    setDraftItems(values);
    setEditing(true);
  }

  function updateItem(index: number, value: string) {
    setDraftItems((items) =>
      items.map((item, itemIndex) => {
        return itemIndex === index ? value : item;
      }),
    );
  }

  function save() {
    onSave(field, draftItems.map((item) => item.trim()).filter(Boolean));
    setEditing(false);
  }

  return h(
    "section",
    {
      className: cn(
        "group border-t border-[#E5E7EB] py-5 first:border-t-0 first:pt-0",
        "sm:odd:pr-6 sm:even:border-l sm:even:border-[#E5E7EB] sm:even:pl-6",
      ),
    },
    h(
      "div",
      { className: "flex items-center justify-between gap-3" },
      h(UtilityHeading, null, label),
      editing ? null : h(EditButton, { label, onClick: startEditing }),
    ),
    editing
      ? h(
          "div",
          { className: "mt-3 space-y-2" },
          ...draftItems.map((item, index) =>
            h(
              "div",
              { key: `${field}-${index}`, className: "flex items-center gap-2" },
              h("input", {
                value: item,
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                  updateItem(index, event.target.value);
                },
                className: cn(
                  "h-9 min-w-0 flex-1 rounded-md border border-[#DDE0E4] bg-white px-2.5",
                  "text-xs outline-none focus:border-lineage",
                ),
                "aria-label": `${label} item ${index + 1}`,
              }),
              h(
                "button",
                {
                  type: "button",
                  onClick: () =>
                    setDraftItems((items) =>
                      items.filter((_item, itemIndex) => {
                        return itemIndex !== index;
                      }),
                    ),
                  className: cn(
                    "rounded p-1.5 text-muted hover:bg-canvas hover:text-ink",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
                  ),
                  "aria-label": `Remove ${label} item ${index + 1}`,
                },
                h(Trash2, { size: 13 }),
              ),
            ),
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => setDraftItems((items) => [...items, ""]),
              className: cn(
                "flex items-center gap-1.5 py-1 text-[11px] font-semibold text-lineage",
                "hover:text-ink focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-lineage",
              ),
            },
            h(Plus, { size: 13 }),
            "Add item",
          ),
          h(
            "div",
            { className: "flex gap-2 pt-1" },
            h(
              "button",
              {
                type: "button",
                onClick: save,
                className: cn(
                  "rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white",
                  "hover:bg-lineage focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-lineage",
                ),
              },
              "Save",
            ),
            h(
              "button",
              {
                type: "button",
                onClick: () => setEditing(false),
                className: cn(
                  "rounded-md border border-[#DDE0E4] px-2.5 py-1.5 text-[11px]",
                  "font-semibold text-muted hover:bg-canvas focus-visible:outline-none",
                  "focus-visible:ring-2 focus-visible:ring-lineage",
                ),
              },
              "Cancel",
            ),
          ),
        )
      : values.length
        ? h(
            "ul",
            { className: "mt-3 space-y-2" },
            ...values.map((value, index) =>
              h(
                "li",
                {
                  key: `${field}-${value}-${index}`,
                  className: "flex gap-2 text-xs leading-5 text-ink",
                },
                h(Check, { size: 13, className: "mt-1 shrink-0 text-lineage" }),
                value,
              ),
            ),
          )
        : h("p", { className: "mt-3 text-xs leading-5 text-muted" }, "No evidence yet."),
  );
}

function BuildingProductContext({
  ai,
  processingStep,
  sources,
}: {
  ai: AiModelInput;
  processingStep: number;
  sources: ProductSource[];
}) {
  const sourceRows = sources.map((source) => ({
    id: source.id,
    label: sourceProcessingLabel(source),
    helper: "Source received and validated",
  }));
  const processingRows = [
    ...sourceRows,
    {
      id: "normalize",
      label: "Normalizing product evidence",
      helper: "Cleaning and standardizing extracted information",
    },
    {
      id: "extract",
      label: "Extracting features and mechanisms",
      helper: "Identifying what the product is and how it works",
    },
    {
      id: "claims",
      label: "Separating claims from proof",
      helper: "Distinguishing facts from marketing claims",
    },
    {
      id: "use-cases",
      label: "Building use cases and constraints",
      helper: "Mapping applications and limitations",
    },
    {
      id: "synthesize",
      label: "Synthesizing product context",
      helper: "Structuring the complete product model",
    },
    {
      id: "finalize",
      label: "Finalizing for review",
      helper: "Preparing the model for user feedback",
    },
  ];
  const activeProcessingIndex = Math.min(processingStep, processingRows.length - 1);
  const activeRow = processingRows[activeProcessingIndex];

  return h(
    "div",
    {
      className: "mx-auto max-w-lg py-6 text-center",
      "aria-busy": true,
      "aria-describedby": "product-context-build-status",
    },
    h(
      "p",
      { className: "mono text-[10px] font-semibold uppercase tracking-[.16em] text-muted" },
      "Product synthesis",
    ),
    h(
      "h1",
      { className: "mt-2 text-3xl font-semibold tracking-[-.04em]" },
      "Building product context",
    ),
    h(
      "p",
      { className: "mx-auto mt-2 max-w-sm text-sm leading-6 text-muted" },
      `Turning ${sources.length} source${sources.length === 1 ? "" : "s"} into a structured product model.`,
    ),
    h(
      "p",
      { id: "product-context-build-status", className: "sr-only", "aria-live": "polite" },
      `${Math.min(processingStep, processingRows.length)} of ${processingRows.length} product context checks complete. Currently: ${activeRow?.label ?? "finishing up"}.`,
    ),
    h(
      "div",
      {
        className:
          "mt-8 rounded-xl border border-border-default bg-panel px-5 py-6 text-left",
      },
      h(
        "div",
        { className: "flex items-center gap-3" },
        h(LoaderCircle, {
          size: 18,
          className: "shrink-0 animate-spin text-lineage",
          "aria-hidden": true,
        }),
        h(
          "div",
          { className: "min-w-0" },
          h("p", { className: "truncate text-sm font-semibold text-ink" }, activeRow?.label ?? "Finalizing for review"),
          h("p", { className: "mt-0.5 truncate text-xs text-muted" }, activeRow?.helper ?? "Preparing the model for user feedback"),
        ),
      ),
      h(
        "div",
        { className: "mt-5 flex items-center gap-1.5", role: "list", "aria-label": "Progress" },
        ...processingRows.map((row, index) =>
          h("span", {
            key: row.id,
            role: "listitem",
            "aria-current": index === activeProcessingIndex ? "step" : undefined,
            className: cn(
              "h-1.5 flex-1 rounded-full",
              index < processingStep
                ? "bg-lineage"
                : index === activeProcessingIndex
                  ? "bg-lineage/40"
                  : "bg-border-default",
            ),
          }),
        ),
      ),
    ),
  );
}

function ProductContextReady({
  context,
  onContextChange,
  onBuildStrategy,
  sources,
  strategyLoading,
}: {
  context: ProductContext;
  onContextChange: (context: ProductContext) => void;
  onBuildStrategy: () => void;
  sources: ProductSource[];
  strategyLoading: boolean;
}) {
  function saveText(field: "name" | "summary", value: string) {
    onContextChange({ ...context, [field]: value });
  }

  function saveList(field: ContextListField, values: string[]) {
    onContextChange({ ...context, [field]: values });
  }

  return h(
    "main",
    {
      className: cn("min-h-[calc(100vh-64px)] w-full px-5 py-10", "sm:px-8 sm:py-14"),
    },
    h(
      "div",
      { className: "max-w-3xl" },
      h(
        "p",
        {
          className: cn("mono text-[9px] font-semibold uppercase tracking-[.17em] text-lineage"),
        },
        "Product context ready",
      ),
      h(
        "h1",
        { className: "mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl" },
        "Product context ready",
      ),
      h(
        "p",
        { className: "mt-3 text-sm leading-6 text-muted" },
        "Review the structured product model before it becomes the root of your strategy.",
      ),
    ),
    h(
      "div",
      { className: "mt-10" },
      h(EditableText, {
        label: "Product name",
        onSave: (value) => saveText("name", value),
        value: context.name,
      }),
      h(EditableText, {
        label: "Product summary",
        multiline: true,
        onSave: (value) => saveText("summary", value),
        value: context.summary,
      }),
    ),
    h(
      "div",
      { className: "mt-8 grid gap-x-0 sm:grid-cols-2" },
      ...structuringFields.map(({ field, label }) =>
        h(EditableListSection, {
          key: field,
          field,
          label,
          onSave: saveList,
          values: contextValues(context, field),
        }),
      ),
    ),
    h(
      "section",
      {
        className: "mt-10 border-t border-[#DDE0E4] pt-6",
        "aria-label": "Product context provenance",
      },
      h(UtilityHeading, null, "Built from"),
      h(
        "p",
        { className: "mt-2 text-sm font-semibold" },
        `${sources.length} source${sources.length === 1 ? "" : "s"}`,
      ),
      h(
        "ul",
        { className: "mt-4 grid gap-2 sm:grid-cols-2" },
        ...sources.map((source) => {
          const Icon = sourceIcons[source.type];
          return h(
            "li",
            { key: source.id, className: "flex min-w-0 items-center gap-2 text-xs text-muted" },
            h(Icon, { size: 14, className: "shrink-0 text-lineage", "aria-hidden": true }),
            h("span", { className: "truncate" }, sourceName(source)),
          );
        }),
      ),
    ),
    h(
      "section",
      { className: "mt-10 border-t border-[#DDE0E4] pt-6" },
      h(UtilityHeading, null, "This context becomes the root of your strategy"),
      h(
        "p",
        { className: "mt-3 text-sm leading-6 text-ink" },
        "Product ",
        h("span", { className: "text-lineage" }, "→"),
        " Audience ",
        h("span", { className: "text-lineage" }, "→"),
        " Angle ",
        h("span", { className: "text-lineage" }, "→"),
        " Creative type ",
        h("span", { className: "text-lineage" }, "→"),
        " Execution ",
        h("span", { className: "text-lineage" }, "→"),
        " Creative",
      ),
      h(
        "div",
        { className: "mt-6" },
        h(
          "button",
          {
            type: "button",
            disabled: strategyLoading,
            onClick: onBuildStrategy,
            className: cn(
              "flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3",
              "text-xs font-semibold text-white hover:bg-lineage disabled:opacity-60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
              "sm:w-auto",
            ),
          },
          strategyLoading ? "Opening strategy…" : "Build strategy",
          strategyLoading ? null : h(ArrowRight, { size: 14 }),
        ),
      ),
    ),
  );
}

function ProductIdentity({
  context,
  onContextChange,
  onStatusChange,
  sources,
  status,
  ai,
}: {
  ai: AiModelInput;
  context: ProductContext;
  onContextChange: (context: ProductContext) => void;
  onStatusChange: (status: ProductIdentityStatus) => void;
  sources: ProductSource[];
  status: ProductIdentityStatus;
}) {
  const [fixing, setFixing] = useState(false);
  const [nameDraft, setNameDraft] = useState(context.name);
  const [urlDraft, setUrlDraft] = useState("");
  const [updateProvider, setUpdateProvider] = useState<AiProvider>(
    (ai.provider as AiProvider) ?? "openai",
  );
  const [updateModel, setUpdateModel] = useState(ai.model ?? AI_MODEL_OPTIONS.openai[1].id);
  const previewUrl = sourcePreviewUrl(sources);
  const previewSource =
    sources.find((source) => source.previewUrl === previewUrl) ??
    sources.find((source) =>
      source.inspection?.candidates.some((candidate) => candidate.imageUrl === previewUrl),
    );
  // No real preview image exists — show an icon matching what was actually
  // provided (a note, a link, a document) rather than a generic picture icon
  // that reads as a broken/missing image.
  const PreviewIcon = sourceIcons[previewSource?.type ?? sources[0]?.type ?? "text"];
  const statusCopy =
    status === "confirmed"
      ? "Product confirmed"
      : status === "uncertain"
        ? "We may have the wrong product"
        : "Looks right, but check it";

  function startFixing() {
    setNameDraft(context.name);
    setFixing(true);
    onStatusChange("likely");
  }

  function updateIdentity() {
    const nextName = nameDraft.trim();
    if (nextName) onContextChange({ ...context, name: nextName });
    // TODO GraphQL: rebuild ProductContext with corrected product identity/source.
    void urlDraft;
    setFixing(false);
  }

  return h(
    "section",
    {
      className: cn("prism-context-identity", status === "confirmed" ? "is-confirmed" : ""),
      "aria-label": "Product identity verification",
    },
    h(UtilityHeading, null, "Product identity"),
    h(
      "div",
      { className: "mt-3 grid gap-4 sm:grid-cols-[104px_minmax(0,1fr)] sm:items-start" },
      previewUrl
        ? h("img", {
            src: previewUrl,
            alt: `Source preview for ${context.name}`,
            className:
              "h-28 w-full rounded-md border border-[#DDE0E4] object-cover sm:h-[104px] sm:w-[104px]",
          })
        : h(
            "div",
            {
              className:
                "flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-[#DDE0E4] bg-[#FAFAFB] text-muted sm:h-[104px] sm:w-[104px]",
            },
            h(PreviewIcon, { size: 22, "aria-hidden": true }),
            h(
              "span",
              { className: "mono text-[8px] font-semibold uppercase tracking-[.1em]" },
              previewIconCaption(previewSource?.type ?? sources[0]?.type),
            ),
          ),
      h(
        "div",
        { className: "min-w-0" },
        fixing
          ? h(
              "div",
              { className: "space-y-3" },
              h(
                "label",
                { className: "block" },
                h(
                  "span",
                  {
                    className:
                      "mono text-[9px] font-semibold uppercase tracking-[.14em] text-muted",
                  },
                  "What's the product?",
                ),
                h("input", {
                  value: nameDraft,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    setNameDraft(event.target.value),
                  className:
                    "mt-2 h-10 w-full rounded-md border border-[#BFC5CD] bg-white px-3 text-base font-semibold outline-none focus:border-lineage",
                }),
              ),
              h(
                "label",
                { className: "block" },
                h(
                  "span",
                  {
                    className:
                      "mono text-[9px] font-semibold uppercase tracking-[.14em] text-muted",
                  },
                  "Product page URL (optional)",
                ),
                h("input", {
                  type: "url",
                  value: urlDraft,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    setUrlDraft(event.target.value),
                  placeholder: "https://",
                  className:
                    "mt-2 h-10 w-full rounded-md border border-[#DDE0E4] bg-white px-3 text-sm outline-none focus:border-lineage",
                }),
              ),
              h(
                "div",
                { className: "pt-1" },
                h(GenerationControl, {
                  provider: updateProvider,
                  model: updateModel,
                  title: "Generation model",
                  description: "Choose a model to update product context.",
                  actionLabel: "Update context",
                  actionClassName: "onboarding-confirm-button",
                  operation: "product_context_update",
                  variant: "drawer",
                  onProviderChange: (provider: AiProvider) => {
                    setUpdateProvider(provider);
                    setUpdateModel(AI_MODEL_OPTIONS[provider][0]?.id ?? "");
                  },
                  onModelChange: setUpdateModel,
                  onGenerate: updateIdentity,
                }),
              ),
              h(
                "div",
                { className: "mt-2 flex flex-wrap gap-2" },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: () => setFixing(false),
                    className:
                      "rounded-md border border-[#DDE0E4] px-3 py-2.5 text-xs font-semibold text-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
                  },
                  "Cancel",
                ),
              ),
            )
          : h(
              "div",
              null,
              h(
                "h2",
                {
                  className:
                    "relative inline-block text-xl font-semibold tracking-[-.035em] sm:text-2xl",
                },
                context.workingLabel?.trim() || context.name,
                h("span", { className: "prism-context-name-baseline", "aria-hidden": true }),
              ),
              context.category?.trim()
                ? h(
                    "p",
                    {
                      className:
                        "mono mt-1 text-[9px] font-semibold uppercase tracking-[.14em] text-muted",
                    },
                    context.category.trim(),
                  )
                : null,
              h("p", { className: "mt-2 max-w-2xl text-sm leading-5 text-muted" }, context.name),
              h("p", { className: "mt-2 max-w-2xl text-sm leading-5 text-ink" }, context.summary),
              h(
                "div",
                { className: "prism-context-verification mt-3 flex items-center gap-2" },
                status === "confirmed"
                  ? h(Check, { size: 14, "aria-hidden": true })
                  : h("span", {
                      className: "h-2 w-2 rounded-full bg-current",
                      "aria-hidden": true,
                    }),
                h("p", { className: "text-xs font-semibold", "aria-live": "polite" }, statusCopy),
              ),
              status === "confirmed"
                ? h(
                    "p",
                    { className: "mt-1 text-xs text-muted" },
                    "Confirmed by you. This is the root of your strategy.",
                  )
                : h(
                    "p",
                    { className: "mt-1 text-xs text-muted" },
                    "Check that we got the product right.",
                  ),
              h(
                "div",
                { className: "mt-3 flex flex-wrap gap-2" },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: startFixing,
                    className:
                      "rounded-md border border-[#DDE0E4] px-3 py-2 text-xs font-semibold text-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
                  },
                  status === "confirmed" ? "Change" : "Fix product",
                ),
                status === "confirmed"
                  ? null
                  : h(
                      "button",
                      {
                        type: "button",
                        onClick: () => onStatusChange("confirmed"),
                        className:
                          "onboarding-confirm-button px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
                      },
                      "Yes, this is it",
                    ),
              ),
            ),
      ),
    ),
  );
}

function ProductContextReviewLegacy({
  ai,
  context,
  onContextChange,
  onBuildStrategy,
  sources,
  strategyLoading,
}: {
  ai: AiModelInput;
  context: ProductContext;
  onContextChange: (context: ProductContext) => void;
  onBuildStrategy: () => void;
  sources: ProductSource[];
  strategyLoading: boolean;
}) {
  // TODO GraphQL: persist ProductIdentity confidence/status with ProductContext.
  const [identityStatus, setIdentityStatus] = useState<ProductIdentityStatus>("likely");
  const confirmed = identityStatus === "confirmed";

  function saveList(field: ContextListField, values: string[]) {
    onContextChange({ ...context, [field]: values });
  }

  return h(
    "main",
    { className: cn("min-h-[calc(100vh-64px)] w-full px-5 py-10", "sm:px-8 sm:py-14") },
    h(
      "div",
      { className: "max-w-3xl" },
      h(
        "p",
        { className: "mono text-[9px] font-semibold uppercase tracking-[.17em] text-lineage" },
        "Product context ready",
      ),
      h(
        "h1",
        { className: "mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl" },
        "Review product context",
      ),
      h(
        "p",
        { className: "mt-3 text-sm leading-6 text-muted" },
        "Check what Prism found before it becomes the root of your strategy.",
      ),
    ),
    h(
      "div",
      { className: "prism-context-artifact relative mt-10 pl-6 sm:pl-9" },
      h(ProductIdentity, {
        ai,
        context,
        onContextChange,
        onStatusChange: setIdentityStatus,
        sources,
        status: identityStatus,
      }),
      h(
        "div",
        { className: "mt-10 space-y-10" },
        ...contextGroups.map(({ label, fields }) =>
          h(
            "section",
            { key: label, className: "prism-context-group" },
            h(UtilityHeading, null, label),
            h(
              "div",
              { className: "mt-3 grid gap-x-0 sm:grid-cols-2" },
              ...fields.map(({ field, label: fieldLabel }) =>
                h(EditableListSection, {
                  key: field,
                  field,
                  label: fieldLabel,
                  onSave: saveList,
                  values: contextValues(context, field),
                }),
              ),
            ),
          ),
        ),
      ),
      h(
        "section",
        {
          className: "mt-10 border-t border-[#DDE0E4] pt-6",
          "aria-label": "Product context provenance",
        },
        h(UtilityHeading, null, "Built from"),
        h(
          "p",
          { className: "mt-2 text-sm font-semibold" },
          `${sources.length} source${sources.length === 1 ? "" : "s"}`,
        ),
        h(
          "ul",
          { className: "mt-4 grid gap-2 sm:grid-cols-2" },
          ...sources.map((source) => {
            const Icon = sourceIcons[source.type];
            return h(
              "li",
              { key: source.id, className: "flex min-w-0 items-center gap-2 text-xs text-muted" },
              h(Icon, { size: 14, className: "shrink-0 text-lineage", "aria-hidden": true }),
              h("span", { className: "truncate" }, sourceName(source)),
            );
          }),
        ),
      ),
      h(
        "section",
        { className: "mt-10 border-t border-[#DDE0E4] pt-6" },
        h(UtilityHeading, null, "Ready for strategy"),
        h(
          "p",
          { className: "mt-3 text-sm leading-6 text-muted" },
          "This product context becomes the root of your strategy.",
        ),
        h(
          "p",
          { className: "mt-3 text-sm leading-6 text-ink" },
          "Product ",
          h("span", { className: "text-lineage" }, "→"),
          " Audience ",
          h("span", { className: "text-lineage" }, "→"),
          " Angle ",
          h("span", { className: "text-lineage" }, "→"),
          " Creative type ",
          h("span", { className: "text-lineage" }, "→"),
          " Execution ",
          h("span", { className: "text-lineage" }, "→"),
          " Creative",
        ),
        confirmed
          ? null
          : h(
              "p",
              { id: "strategy-confirmation-hint", className: "mt-4 text-xs text-muted" },
              "Confirm product identity to explore audiences.",
            ),
        h(
          "div",
          { className: "mt-6 max-w-xs" },
          h(
            PrismAction,
            {
              disabled: !confirmed || strategyLoading,
              onClick: onBuildStrategy,
              pendingLabel: "Opening strategy",
              className: "onboarding-confirm-button",
            },
            "Explore audiences →",
          ),
        ),
      ),
    ),
  );
}

function ProductContextReview({
  ai,
  context,
  onContextChange,
  onBuildStrategy,
  sources,
  strategyLoading,
}: {
  ai: AiModelInput;
  context: ProductContext;
  onContextChange: (context: ProductContext) => void;
  onBuildStrategy: () => void;
  sources: ProductSource[];
  strategyLoading: boolean;
}) {
  // TODO GraphQL: persist ProductIdentity confidence/status with ProductContext.
  const [identityStatus, setIdentityStatus] = useState<ProductIdentityStatus>("likely");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const confirmed = identityStatus === "confirmed";

  function saveList(field: ContextListField, values: string[]) {
    onContextChange({ ...context, [field]: values });
  }

  const strategyAction = h(
    PrismAction,
    {
      disabled: !confirmed || strategyLoading,
      onClick: onBuildStrategy,
      pendingLabel: "Opening strategy",
      className: "onboarding-confirm-button",
    },
    "Explore",
  );

  const findingsCount = (
    ["features", "useCases", "proofPoints", "constraints"] as ContextListField[]
  ).reduce((sum, field) => sum + contextValues(context, field).length, 0);

  return h(
    "main",
    {
      className: "mx-auto w-full max-w-lg px-5 py-7 text-center sm:px-8 sm:py-8",
    },
    h(
      "p",
      { className: "mono text-[10px] font-semibold uppercase tracking-[.16em] text-muted" },
      "Product context ready",
    ),
    h(
      "h1",
      { className: "mt-2 text-3xl font-semibold tracking-[-.04em]" },
      "Is this the right product?",
    ),
    h(
      "div",
      { className: "mt-7 text-left" },
      h(ProductIdentity, {
        ai,
        context,
        onContextChange,
        onStatusChange: setIdentityStatus,
        sources,
        status: identityStatus,
      }),
      // Sits right under the "Yes, this is it" confirm so the cursor barely moves.
      h(
        "div",
        { className: "mt-4" },
        strategyAction,
        confirmed
          ? null
          : h(
              "p",
              { id: "strategy-confirmation-hint", className: "mt-2 text-center text-xs text-muted" },
              "Confirm the product above to continue.",
            ),
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () => setDetailsOpen((open) => !open),
          "aria-expanded": detailsOpen,
          "aria-controls": "product-context-full-details",
          className:
            "mt-4 flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
        },
        detailsOpen
          ? "Hide details ↑"
          : `Prism found ${findingsCount} thing${findingsCount === 1 ? "" : "s"} worth checking — details ↓`,
      ),
      detailsOpen
        ? h(
            "section",
            {
              id: "product-context-full-details",
              className: "mt-5 border-t border-[#DDE0E4] pt-5",
              "aria-label": "Full product context details",
            },
            h(
              "div",
              { className: "space-y-8" },
              ...contextGroups.map(({ label, fields }) =>
                h(
                  "section",
                  { key: label, className: "prism-context-group" },
                  h(UtilityHeading, null, label),
                  h(
                    "div",
                    { className: "mt-3 grid gap-x-0 sm:grid-cols-2" },
                    ...fields.map(({ field, label: fieldLabel }) =>
                      h(EditableListSection, {
                        key: field,
                        field,
                        label: fieldLabel,
                        onSave: saveList,
                        values: contextValues(context, field),
                      }),
                    ),
                  ),
                ),
              ),
            ),
            h(
              "section",
              {
                className: "mt-8 border-t border-[#DDE0E4] pt-5",
                "aria-label": "Product context provenance",
              },
              h(UtilityHeading, null, "Built from"),
              h(
                "p",
                { className: "mt-2 text-sm font-semibold" },
                `${sources.length} source${sources.length === 1 ? "" : "s"}`,
              ),
              h(
                "ul",
                { className: "mt-3 grid gap-2 sm:grid-cols-2" },
                ...sources.map((source) => {
                  const Icon = sourceIcons[source.type];
                  return h(
                    "li",
                    {
                      key: source.id,
                      className: "flex min-w-0 items-center gap-2 text-xs text-muted",
                    },
                    h(Icon, { size: 14, className: "shrink-0 text-lineage", "aria-hidden": true }),
                    h("span", { className: "truncate" }, sourceName(source)),
                  );
                }),
              ),
            ),
          )
        : null,
    ),
  );
}

function ProductContextError({
  error,
  onBackToIntake,
  onRetry,
}: {
  error: string | null;
  onBackToIntake: () => void;
  onRetry: () => void;
}) {
  return h(
    "main",
    { className: "grid min-h-screen w-full px-5 py-10 sm:px-8 sm:py-14" },
    h(
      "section",
      { className: "max-w-xl self-center", role: "alert", "aria-live": "assertive" },
      h(
        "p",
        {
          className: cn("mono text-[9px] font-semibold uppercase tracking-[.17em] text-lineage"),
        },
        "Product synthesis",
      ),
      h(
        "h1",
        { className: "mt-2 text-3xl font-semibold tracking-[-.04em]" },
        "We couldn't build product context.",
      ),
      h(
        "p",
        { className: "mt-3 text-sm leading-6 text-muted" },
        error ?? "Your product material is still available. Try again or return to it.",
      ),
      h(
        "div",
        { className: "mt-6 flex flex-wrap gap-2" },
        h(
          "button",
          {
            type: "button",
            onClick: onRetry,
            className: cn(
              "flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white",
              "hover:bg-lineage focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-lineage",
            ),
          },
          h(RefreshCw, { size: 13 }),
          "Try again",
        ),
        h(
          "button",
          {
            type: "button",
            onClick: onBackToIntake,
            className: cn(
              "rounded-md border border-[#DDE0E4] px-3 py-2 text-xs font-semibold text-muted",
              "hover:bg-canvas hover:text-ink focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-lineage",
            ),
          },
          "Back to product material",
        ),
      ),
    ),
  );
}

/** Owns the explicit post-intake ProductContext flow and preserves raw sources. */
export function BuildContext({
  ai,
  onBackToIntake,
  onFlowStateChange,
  simulateError,
  sources,
  devStartAtExtras = false,
}: BuildContextProps) {
  const [flowState, setFlowState] = useState<ActiveProductContextFlowState>("building");
  const [processingStep, setProcessingStep] = useState(0);
  const [context, setContext] = useState<ProductContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [readyStage, setReadyStage] = useState<"review" | "extras">(
    devStartAtExtras ? "extras" : "review",
  );
  const createProductFromContext = useAppStore((state) => state.createProductFromContext);

  useEffect(() => {
    onFlowStateChange(flowState);
  }, [flowState, onFlowStateChange]);

  useEffect(() => {
    let active = true;
    const totalSteps = sources.length + 6;

    setFlowState("building");
    setError(null);
    setProcessingStep(0);

    const timer = window.setInterval(() => {
      setProcessingStep((step) => Math.min(step + 1, totalSteps));
    }, 360);

    async function build() {
      try {
        if (simulateError) {
          throw new Error(
            "The product material could not be structured. Your sources are still saved.",
          );
        }

        const nextContext = await buildProductContext(sources, ai);
        if (!active) return;

        setContext(nextContext);
        setProcessingStep(totalSteps);
        setFlowState("ready");
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Could not build product context.");
        setFlowState("error");
      } finally {
        window.clearInterval(timer);
      }
    }

    void build();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [ai, attempt, simulateError, sources]);

  async function buildStrategy() {
    if (!context || strategyLoading) return;

    setStrategyLoading(true);
    try {
      // TODO GraphQL mutation: persist ProductContext edits, then generateAudiences after confirmation.
      // The same preview already shown on the identity-confirmation step becomes the product's own photo.
      await createProductFromContext(context, sourcePreviewUrl(sources));
    } finally {
      setStrategyLoading(false);
    }
  }

  if (flowState === "ready" && context) {
    if (readyStage === "extras") {
      return h(TestingAndIntegrations, { onDone: () => void buildStrategy(), pending: strategyLoading });
    }
    return h(ProductContextReview, {
      ai,
      context,
      onContextChange: setContext,
      onBuildStrategy: () => setReadyStage("extras"),
      sources,
      strategyLoading,
    });
  }

  if (flowState === "error") {
    return h(ProductContextError, {
      error,
      onBackToIntake,
      onRetry: () => setAttempt((current) => current + 1),
    });
  }

  return h(BuildingProductContext, { ai, processingStep, sources });
}
