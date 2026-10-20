"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/api/api";
import { useRemote } from "@/components/performance/use-remote";
import { Select } from "@/components/ui/select";
import { h } from "@/lib/h";
import type { Product } from "@/types/strategy";
import type {
  OperationAttempt,
  OperationError,
  OperationFlag,
  OperationLog,
  OperationLogStatus,
  OperationPayload,
} from "@/types/operation-log";

/* ---------------------------------------------------------------- formatting */

const operationLabels: Record<string, string> = {
  product_context_building: "Product context",
  audience_generation: "Audiences",
  angle_generation: "Angles",
  creative_type_generation: "Creative types",
  execution_generation: "Executions",
  creative_generation: "Creatives",
};

const readable = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
// Unlisted types read as their subject alone ("creative_exploration_offer_generation" -> "Offer").
const operationLabel = (value: string) =>
  operationLabels[value] ?? readable(value.replace(/^creative_exploration_/, "").replace(/_generation$/, ""));
const count = (value: number) => new Intl.NumberFormat("en-US").format(Math.round(value));

function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function money(value: number | null, currency = "USD") {
  if (value === null || !Number.isFinite(value)) return "—";
  const digits = value > 0 && value < 0.01 ? 4 : 2;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function duration(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(value < 10_000 ? 2 : 1)} s`;
}

function stamp(value?: string | null, long = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", long
    ? { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

/* ---------------------------------------------------------------- derived figures */

const STATUS: Record<OperationLogStatus, { label: string; color: string }> = {
  success: { label: "Succeeded", color: "#2FA36B" },
  error: { label: "Failed", color: "#DB5A54" },
  running: { label: "Running", color: "#4C7DFF" },
  cancelled: { label: "Cancelled", color: "#8A93A0" },
  untraced: { label: "Untraced", color: "#D9A23B" },
};
const statusOf = (status: OperationLogStatus) => STATUS[status] ?? STATUS.untraced;

const costOf = (log: OperationLog) => (log.totalCostUsd === null || log.totalCostUsd === undefined ? null : Number(log.totalCostUsd));

function tokensOf(log: OperationLog) {
  let input = 0;
  let output = 0;
  for (const attempt of log.attempts) {
    const usage = attempt.usage ?? {};
    if (typeof usage.inputTokens === "number") input += usage.inputTokens;
    if (typeof usage.outputTokens === "number") output += usage.outputTokens;
  }
  return { input, output, total: input + output };
}

const lastAttempt = (log: OperationLog) => log.attempts[log.attempts.length - 1];
const modelOf = (log: OperationLog) => lastAttempt(log)?.model ?? lastAttempt(log)?.service ?? "—";
const providerOf = (log: OperationLog) => lastAttempt(log)?.provider ?? "—";

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function sumBy<T>(items: T[], key: (item: T) => string, value: (item: T) => number) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(key(item), (totals.get(key(item)) ?? 0) + value(item));
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

/* ---------------------------------------------------------------- small visuals */

function Dot({ color }: { color: string }) {
  return h("span", { className: "inline-block h-2 w-2 shrink-0 rounded-full", style: { background: color }, "aria-hidden": true });
}

function StatusChip({ status }: { status: OperationLogStatus }) {
  const meta = statusOf(status);
  return h(
    "span",
    { className: "inline-flex items-center gap-1.5 rounded-full border border-border-default px-2 py-0.5 text-[11px] font-semibold text-ink" },
    h(Dot, { color: meta.color }),
    meta.label,
  );
}

/** A value with a bar behind its scale: the row's share of the largest row on screen. */
function BarCell({ value, max, color, children }: { value: number; max: number; color: string; children?: ReactNode }) {
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return h(
    "div",
    { className: "relative flex h-7 items-center overflow-hidden rounded-md bg-canvas px-2" },
    h("span", { className: "absolute inset-y-0 left-0 rounded-md", style: { width: `${share * 100}%`, background: color, opacity: 0.22 }, "aria-hidden": true }),
    h("span", { className: "relative text-[12px] font-semibold tabular-nums text-ink" }, children),
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return h("div", { className: "h-8" });
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${28 - ((value - min) / span) * 24}`).join(" ");
  return h(
    "svg",
    { viewBox: "0 0 100 32", preserveAspectRatio: "none", className: "h-8 w-full", "aria-hidden": true },
    h("polyline", { points, fill: "none", stroke: color, strokeWidth: 2, vectorEffect: "non-scaling-stroke", strokeLinejoin: "round" }),
  );
}

function Card({ title, width, children, aside }: { title: string; width: number; children?: ReactNode; aside?: ReactNode }) {
  return h(
    "div",
    { className: "flex h-[132px] shrink-0 flex-col rounded-xl border border-border-default bg-panel px-3.5 py-3", style: { width } },
    h(
      "div",
      { className: "flex items-center justify-between gap-2" },
      h("span", { className: "text-[10px] font-bold uppercase tracking-[.1em] text-muted" }, title),
      aside ?? null,
    ),
    h("div", { className: "mt-2 flex min-h-0 flex-1 flex-col" }, children),
  );
}

function Kpi({ title, value, sub, spark, color }: { title: string; value: string; sub?: string; spark?: number[]; color: string }) {
  return h(
    Card,
    { title, width: 168 },
    h("p", { className: "text-[26px] font-semibold leading-none tracking-[-.03em] tabular-nums text-ink" }, value),
    sub ? h("p", { className: "mt-1 text-[11px] text-muted" }, sub) : null,
    h("div", { className: "mt-auto" }, spark ? h(Spark, { values: spark, color }) : null),
  );
}

function Bars({ items }: { items: Array<{ value: number; color: string; title: string }> }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return h(
    "div",
    { className: "flex min-h-0 flex-1 items-end gap-[2px]" },
    ...items.map((item, index) =>
      h("div", {
        key: index,
        title: item.title,
        className: "min-w-[3px] flex-1 rounded-t-[2px]",
        style: { height: `${Math.max(4, (item.value / max) * 100)}%`, background: item.color },
      }),
    ),
  );
}

function HBars({ rows, format, color }: { rows: Array<[string, number]>; format: (value: number) => string; color: string }) {
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return h(
    "div",
    { className: "flex min-h-0 flex-1 flex-col justify-between" },
    ...rows.map(([label, value]) =>
      h(
        "div",
        { key: label, className: "grid grid-cols-[92px_1fr_52px] items-center gap-2 text-[11px]" },
        h("span", { className: "truncate text-muted", title: label }, label),
        h("span", { className: "h-2 overflow-hidden rounded-full bg-canvas" }, h("span", { className: "block h-full rounded-full", style: { width: `${(value / max) * 100}%`, background: color } })),
        h("span", { className: "text-right font-semibold tabular-nums text-ink" }, format(value)),
      ),
    ),
  );
}

function Ring({ share, color }: { share: number; color: string }) {
  const radius = 15;
  const length = 2 * Math.PI * radius;
  return h(
    "svg",
    { viewBox: "0 0 40 40", className: "h-9 w-9 -rotate-90", "aria-hidden": true },
    h("circle", { cx: 20, cy: 20, r: radius, fill: "none", strokeWidth: 5, stroke: "var(--border-default)" }),
    h("circle", { cx: 20, cy: 20, r: radius, fill: "none", strokeWidth: 5, stroke: color, strokeLinecap: "round", strokeDasharray: `${share * length} ${length}` }),
  );
}

/* ---------------------------------------------------------------- detail panel */

function Fact({ label, children }: { label: string; children?: ReactNode }) {
  return h(
    "div",
    { className: "min-w-0 rounded-lg border border-border-default bg-canvas px-3 py-2" },
    h("dt", { className: "text-[10px] font-bold uppercase tracking-[.08em] text-muted" }, label),
    h("dd", { className: "mt-0.5 break-words text-[13px] font-semibold text-ink" }, children),
  );
}

function Mono({ children }: { children: ReactNode }) {
  return h("span", { className: "font-mono text-[11px]" }, children);
}

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined) return h("p", { className: "text-[12px] text-muted" }, "Not captured");
  return h(
    "pre",
    { className: "max-h-[46vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border-default bg-canvas p-3 font-mono text-[11.5px] leading-5 text-ink" },
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
  );
}

function Payload({ payload }: { payload?: OperationPayload | null }) {
  if (!payload || payload.traceStatus === "untraced" || payload.content === null) {
    return h("p", { className: "inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted" }, h(Dot, { color: STATUS.untraced.color }), "Untraced");
  }
  return h(
    "div",
    { className: "space-y-2" },
    h(
      "div",
      { className: "flex flex-wrap gap-1.5 text-[10.5px] font-semibold text-muted" },
      h("span", { className: "rounded-full border border-border-default px-2 py-0.5" }, readable(payload.representation)),
      payload.redactionStatus === "redacted" ? h("span", { className: "rounded-full border border-border-default px-2 py-0.5" }, "Redacted") : null,
      payload.byteSize ? h("span", { className: "rounded-full border border-border-default px-2 py-0.5" }, `${count(payload.byteSize)} B`) : null,
    ),
    h(Json, { value: payload.content }),
  );
}

function ErrorBox({ error }: { error?: OperationError | null }) {
  if (!error?.message) return null;
  return h(
    "div",
    { role: "alert", className: "rounded-lg border px-3 py-2.5 text-[12.5px]", style: { borderColor: "#DB5A54", background: "color-mix(in srgb, #DB5A54 9%, transparent)" } },
    h("p", { className: "font-semibold text-ink" }, error.message),
    error.stage || error.code ? h("p", { className: "mt-1 text-[11px] text-muted" }, [error.stage && readable(error.stage), error.code].filter(Boolean).join(" · ")) : null,
  );
}

function Flags({ flags }: { flags?: OperationFlag[] | null }) {
  if (!flags?.length) return null;
  return h(
    "ul",
    { className: "flex flex-wrap gap-1.5" },
    ...flags.map((flag) =>
      h("li", { key: flag.id, className: "rounded-full border border-border-default px-2.5 py-1 text-[11px] font-semibold text-ink" }, flag.label, flag.detail ? ` · ${flag.detail}` : null),
    ),
  );
}

function Fold({ title, children, open = false }: { title: string; children?: ReactNode; open?: boolean }) {
  return h(
    "details",
    { open, className: "group rounded-lg border border-border-default" },
    h(
      "summary",
      { className: "flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[12px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lineage [&::-webkit-details-marker]:hidden" },
      title,
      h("span", { className: "text-muted transition-transform group-open:rotate-90", "aria-hidden": true }, "›"),
    ),
    h("div", { className: "border-t border-border-default p-3" }, children),
  );
}

function Attempt({ attempt }: { attempt: OperationAttempt }) {
  const usage = attempt.usage ?? {};
  const num = (key: string) => (typeof usage[key] === "number" ? count(usage[key] as number) : "—");
  return h(
    "article",
    { className: "space-y-3 rounded-xl border border-border-default p-3" },
    h(
      "div",
      { className: "flex flex-wrap items-center gap-2" },
      h("span", { className: "text-[13px] font-semibold text-ink" }, `#${attempt.attemptNumber}`),
      h(StatusChip, { status: attempt.status }),
      h("span", { className: "text-[12px] text-muted" }, `${attempt.provider ?? "—"} · ${attempt.model ?? attempt.service ?? "—"}`),
      h("span", { className: "ml-auto text-[13px] font-semibold tabular-nums text-ink" }, money(attempt.cost?.usd === null || attempt.cost?.usd === undefined ? null : Number(attempt.cost.usd), attempt.cost?.currency)),
      h("span", { className: "text-[12px] tabular-nums text-muted" }, duration(attempt.durationMs)),
    ),
    h(
      "dl",
      { className: "grid grid-cols-3 gap-2 sm:grid-cols-6" },
      h(Fact, { label: "In" }, num("inputTokens")),
      h(Fact, { label: "Cached" }, num("cachedInputTokens")),
      h(Fact, { label: "Cache write" }, num("cacheWriteTokens")),
      h(Fact, { label: "Out" }, num("outputTokens")),
      h(Fact, { label: "Reasoning" }, num("reasoningTokens")),
      h(Fact, { label: "Pricing" }, attempt.cost ? readable(attempt.cost.status) : "—"),
    ),
    h(ErrorBox, { error: attempt.error }),
    h(Flags, { flags: attempt.flags }),
    h(Fold, { title: "Request" }, h(Payload, { payload: attempt.request })),
    h(Fold, { title: "Response" }, h(Payload, { payload: attempt.response })),
    attempt.rawResponse ? h(Fold, { title: "Raw response" }, h(Payload, { payload: attempt.rawResponse })) : null,
    attempt.cost?.breakdown ? h(Fold, { title: "Cost breakdown" }, h(Json, { value: attempt.cost.breakdown })) : null,
    attempt.providerRequestId ? h("p", { className: "text-[11px] text-muted" }, "Provider ID ", h(Mono, null, attempt.providerRequestId)) : null,
  );
}

function GenerationContext({ generationId }: { generationId: string }) {
  const { data } = useRemote(`provenance:${generationId}`, () => api.generationProvenance({ generationId }));
  if (!data) return null;
  return h(
    "div",
    { className: "space-y-2" },
    h(
      "dl",
      { className: "grid grid-cols-3 gap-2" },
      h(Fact, { label: "Template" }, data.templateVersion === 0 ? "Default" : `v${data.templateVersion}`),
      h(Fact, { label: "Sources" }, data.sources.length ? String(data.sources.length) : "None"),
      h(Fact, { label: "Text sent" }, data.sources.length ? `${count(data.contextChars)} ch` : "—"),
    ),
    data.instructions ? h(Fold, { title: "Run instructions" }, h("p", { className: "whitespace-pre-wrap text-[12.5px] text-ink" }, data.instructions)) : null,
    data.sources.length
      ? h(
          "ul",
          { className: "space-y-1" },
          ...data.sources.map((source) =>
            h(
              "li",
              { key: source.id, className: "flex flex-wrap items-center gap-2 rounded-lg border border-border-default px-3 py-1.5 text-[12px]" },
              h("span", { className: "font-semibold text-ink" }, source.name),
              h("span", { className: "text-muted" }, `${source.kind.toUpperCase()} v${source.version}`),
              h("span", { className: "ml-auto tabular-nums text-muted" }, source.truncated ? `${count(source.includedChars)}/${count(source.availableChars)} ch` : `${count(source.availableChars)} ch`),
            ),
          ),
        )
      : null,
  );
}

type Tab = "overview" | "input" | "attempts" | "output";

function DetailPanel({ log, productName, onClose }: { log: OperationLog; productName: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const tokens = tokensOf(log);
  const related = Object.entries(log.related).filter(([, value]) => Boolean(value));
  const tabs: Array<[Tab, string]> = [["overview", "Overview"], ["input", "Input"], ["attempts", `Attempts · ${log.attempts.length}`], ["output", "Output"]];
  return h(
    "aside",
    { "aria-label": "Operation detail", className: "absolute inset-y-0 right-0 z-20 flex w-[min(620px,100%)] flex-col border-l border-border-default bg-panel shadow-[-18px_0_40px_rgb(21_23_26/.16)]" },
    h(
      "header",
      { className: "flex items-start gap-3 border-b border-border-default px-5 py-4" },
      h(
        "div",
        { className: "min-w-0 flex-1" },
        h("h2", { className: "truncate text-[16px] font-semibold tracking-[-.01em] text-ink" }, `${productName} · ${operationLabel(log.operationType)}`),
        h("div", { className: "mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted" }, h(StatusChip, { status: log.status }), stamp(log.startedAt, true)),
      ),
      h("button", { type: "button", onClick: onClose, "aria-label": "Close detail", className: "grid h-8 w-8 place-items-center rounded-lg border border-border-default text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" }, h(X, { size: 15 })),
    ),
    h(
      "div",
      { role: "tablist", className: "flex gap-1 border-b border-border-default px-4 pt-2" },
      ...tabs.map(([id, label]) =>
        h(
          "button",
          {
            key: id,
            type: "button",
            role: "tab",
            "aria-selected": tab === id,
            onClick: () => setTab(id),
            className: `-mb-px border-b-2 px-3 py-2 text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${tab === id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`,
          },
          label,
        ),
      ),
    ),
    h(
      "div",
      { className: "min-h-0 flex-1 space-y-3 overflow-y-auto p-5" },
      tab === "overview"
        ? h(
            "div",
            { className: "space-y-3" },
            h(
              "dl",
              { className: "grid grid-cols-2 gap-2 sm:grid-cols-3" },
              h(Fact, { label: "Cost" }, money(costOf(log))),
              h(Fact, { label: "Duration" }, duration(log.durationMs)),
              h(Fact, { label: "Attempts" }, String(log.attempts.length)),
              h(Fact, { label: "Tokens in" }, tokens.input ? count(tokens.input) : "—"),
              h(Fact, { label: "Tokens out" }, tokens.output ? count(tokens.output) : "—"),
              h(Fact, { label: "Completed" }, stamp(log.completedAt)),
            ),
            h(ErrorBox, { error: log.error }),
            log.related.generationId ? h(GenerationContext, { generationId: log.related.generationId }) : null,
            related.length
              ? h(
                  "dl",
                  { className: "grid grid-cols-1 gap-2" },
                  ...related.map(([key, value]) => h(Fact, { key, label: readable(key) }, h(Mono, null, String(value)))),
                )
              : null,
          )
        : tab === "input"
          ? h(Payload, { payload: log.input })
          : tab === "output"
            ? h(Payload, { payload: log.output })
            : log.attempts.length
              ? h("div", { className: "space-y-3" }, ...log.attempts.map((attempt) => h(Attempt, { key: attempt.id, attempt })))
              : h("p", { className: "text-[12px] text-muted" }, "No attempts recorded"),
    ),
  );
}

/* ---------------------------------------------------------------- page */

const COLUMNS: Array<{ label: string; width: number; align?: "right" }> = [
  { label: "Time", width: 130 },
  { label: "Operation", width: 170 },
  { label: "Product", width: 150 },
  { label: "Status", width: 118 },
  { label: "Provider · model", width: 230 },
  { label: "Tries", width: 56, align: "right" },
  { label: "Duration", width: 128 },
  { label: "Tokens in / out", width: 190 },
  { label: "Cost", width: 118 },
];
const GRID = COLUMNS.map((column) => `${column.width}px`).join(" ");

export function OperationsLogsSection({
  logs,
  products,
  loading = false,
  error = false,
}: {
  logs: OperationLog[];
  products: Product[];
  loading?: boolean;
  error?: boolean;
}) {
  const [provider, setProvider] = useState("all");
  const [operation, setOperation] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const providerOptions = useMemo(() => [...new Set(logs.flatMap((log) => log.attempts.map((attempt) => attempt.provider)).filter(Boolean) as string[])].sort(), [logs]);
  const operationOptions = useMemo(() => [...new Set(logs.map((log) => log.operationType))].sort((a, b) => operationLabel(a).localeCompare(operationLabel(b))), [logs]);
  const visible = useMemo(
    () =>
      logs.filter(
        (log) =>
          (provider === "all" || log.attempts.some((attempt) => attempt.provider === provider)) &&
          (operation === "all" || log.operationType === operation) &&
          (status === "all" || log.status === status),
      ),
    [logs, operation, provider, status],
  );
  const productNames = useMemo(() => new Map(products.map((product) => [product.id, product.name])), [products]);
  const productName = (log: OperationLog) => productNames.get(log.related.productId ?? "") ?? "—";
  const opened = visible.find((log) => log.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const figures = useMemo(() => {
    const chronological = [...visible].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const recent = chronological.slice(-48);
    const costs = visible.map(costOf).filter((value): value is number => value !== null);
    const durations = visible.map((log) => log.durationMs).filter((value): value is number => typeof value === "number");
    const tokens = visible.reduce((sum, log) => sum + tokensOf(log).total, 0);
    const settled = visible.filter((log) => log.status === "success" || log.status === "error");
    const succeeded = settled.filter((log) => log.status === "success").length;
    return {
      recent,
      spend: costs.reduce((sum, value) => sum + value, 0),
      priced: costs.length,
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      tokens,
      successShare: settled.length ? succeeded / settled.length : null,
      settled: settled.length,
      byOperation: sumBy(visible, (log) => operationLabel(log.operationType), (log) => costOf(log) ?? 0).slice(0, 5),
      byModel: sumBy(visible, (log) => modelOf(log), (log) => costOf(log) ?? 0).slice(0, 5),
      byStatus: sumBy(visible, (log) => log.status, () => 1),
      maxDuration: Math.max(0, ...durations),
      maxCost: Math.max(0, ...costs),
      maxTokens: Math.max(0, ...visible.map((log) => tokensOf(log).total)),
    };
  }, [visible]);

  const select = (label: string, value: string, onChange: (value: string) => void, options: Array<[string, string]>) =>
    h(Select, {
      ariaLabel: label,
      value,
      onChange,
      options: options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel })),
      className: "h-8 rounded-lg border border-border-default bg-panel pl-3 pr-8 text-[12px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
    });

  const message = (text: string, alert = false) =>
    h("div", { role: alert ? "alert" : "status", className: "grid flex-1 place-items-center text-[13px] text-muted" }, text);

  const spendBars = figures.recent.map((log) => ({ value: costOf(log) ?? 0, color: statusOf(log.status).color, title: `${operationLabel(log.operationType)} · ${money(costOf(log))}` }));
  const latencyBars = figures.recent.map((log) => ({ value: log.durationMs ?? 0, color: statusOf(log.status).color, title: `${operationLabel(log.operationType)} · ${duration(log.durationMs)}` }));

  return h(
    "section",
    { className: "relative flex h-full min-h-[560px] flex-col gap-3 overflow-hidden px-5 py-4", "aria-labelledby": "operations-logs-title" },
    h(
      "header",
      { className: "flex shrink-0 flex-wrap items-center gap-3" },
      h("h1", { id: "operations-logs-title", className: "text-xl font-semibold tracking-[-.02em] text-ink" }, "Operations logs"),
      h("span", { className: "rounded-full border border-border-default px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted", "aria-live": "polite" }, `${visible.length} / ${logs.length}`),
      h(
        "div",
        { className: "ml-auto flex flex-wrap items-center gap-2", "aria-label": "Operations log filters" },
        select("Provider", provider, setProvider, [["all", "All providers"], ...providerOptions.map((value) => [value, value] as [string, string])]),
        select("Operation", operation, setOperation, [["all", "All operations"], ...operationOptions.map((value) => [value, operationLabel(value)] as [string, string])]),
        select("Status", status, setStatus, [["all", "All statuses"], ...(Object.keys(STATUS) as OperationLogStatus[]).map((value) => [value, STATUS[value].label] as [string, string])]),
      ),
    ),
    loading
      ? message("Loading…")
      : error
        ? message("Operation recorder unavailable", true)
        : logs.length === 0
          ? message("No operations recorded yet")
          : h(
              "div",
              { className: "flex min-h-0 flex-1 flex-col gap-3" },
              // KPIs and charts: one strip that scrolls sideways.
              h(
                "div",
                { className: "flex shrink-0 gap-3 overflow-x-auto pb-1", tabIndex: 0, "aria-label": "Summary charts" },
                h(Kpi, { title: "Spend", value: money(figures.spend), sub: `${figures.priced} priced`, spark: figures.recent.map((log) => costOf(log) ?? 0), color: "#7A4CFF" }),
                h(
                  Card,
                  { title: "Success", width: 168 },
                  h(
                    "div",
                    { className: "flex items-center gap-3" },
                    h(Ring, { share: figures.successShare ?? 0, color: STATUS.success.color }),
                    h("p", { className: "text-[26px] font-semibold leading-none tracking-[-.03em] tabular-nums text-ink" }, figures.successShare === null ? "—" : `${Math.round(figures.successShare * 100)}%`),
                  ),
                  h("p", { className: "mt-auto text-[11px] text-muted" }, `${figures.settled} settled`),
                ),
                h(Kpi, { title: "Latency p50", value: duration(figures.p50), sub: `p95 ${duration(figures.p95)}`, spark: figures.recent.map((log) => log.durationMs ?? 0), color: "#4C7DFF" }),
                h(Kpi, { title: "Tokens", value: compact(figures.tokens), sub: `${visible.length} ops`, spark: figures.recent.map((log) => tokensOf(log).total), color: "#E0559B" }),
                h(Card, { title: "Spend per operation", width: 320 }, h(Bars, { items: spendBars })),
                h(Card, { title: "Latency per operation", width: 320 }, h(Bars, { items: latencyBars })),
                h(Card, { title: "Spend by operation", width: 320 }, h(HBars, { rows: figures.byOperation, format: (value) => money(value), color: "#7A4CFF" })),
                h(Card, { title: "Spend by model", width: 320 }, h(HBars, { rows: figures.byModel, format: (value) => money(value), color: "#E0559B" })),
                h(
                  Card,
                  { title: "Status mix", width: 260 },
                  h(
                    "div",
                    { className: "flex h-3 overflow-hidden rounded-full bg-canvas" },
                    ...figures.byStatus.map(([key, value]) => h("span", { key, title: `${statusOf(key as OperationLogStatus).label} · ${value}`, style: { width: `${(value / Math.max(1, visible.length)) * 100}%`, background: statusOf(key as OperationLogStatus).color } })),
                  ),
                  h(
                    "ul",
                    { className: "mt-auto grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted" },
                    ...figures.byStatus.map(([key, value]) => h("li", { key, className: "flex items-center gap-1.5" }, h(Dot, { color: statusOf(key as OperationLogStatus).color }), `${statusOf(key as OperationLogStatus).label} `, h("b", { className: "tabular-nums text-ink" }, String(value)))),
                  ),
                ),
              ),
              // The operations: one dense grid, scrolling both ways under a sticky header.
              visible.length
                ? h(
                    "div",
                    { className: "min-h-0 flex-1 overflow-auto rounded-xl border border-border-default bg-panel", tabIndex: 0, role: "table", "aria-label": "Operations" },
                    h(
                      "div",
                      { className: "w-max min-w-full" },
                      h(
                        "div",
                        { role: "row", className: "sticky top-0 z-10 grid gap-3 border-b border-border-default bg-panel px-4 py-2.5", style: { gridTemplateColumns: GRID } },
                        ...COLUMNS.map((column) => h("span", { key: column.label, role: "columnheader", className: `text-[10px] font-bold uppercase tracking-[.1em] text-muted ${column.align === "right" ? "text-right" : ""}` }, column.label)),
                      ),
                      ...visible.map((log) => {
                        const tokens = tokensOf(log);
                        const cost = costOf(log);
                        const active = log.id === openId;
                        return h(
                          "div",
                          {
                            key: log.id,
                            role: "row",
                            tabIndex: 0,
                            "aria-selected": active,
                            onClick: () => setOpenId(active ? null : log.id),
                            onKeyDown: (event: React.KeyboardEvent) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setOpenId(active ? null : log.id);
                              }
                            },
                            className: `grid cursor-pointer items-center gap-3 border-b border-border-default px-4 py-2 text-[12.5px] last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lineage ${active ? "bg-canvas" : "hover:bg-canvas"}`,
                            style: { gridTemplateColumns: GRID },
                          },
                          h("span", { role: "cell", className: "whitespace-nowrap text-muted" }, stamp(log.startedAt)),
                          h("span", { role: "cell", className: "truncate font-semibold text-ink" }, operationLabel(log.operationType)),
                          h("span", { role: "cell", className: "truncate text-ink" }, productName(log)),
                          h("span", { role: "cell" }, h(StatusChip, { status: log.status })),
                          h("span", { role: "cell", className: "truncate text-muted", title: `${providerOf(log)} · ${modelOf(log)}` }, `${providerOf(log)} · ${modelOf(log)}`),
                          h("span", { role: "cell", className: "text-right tabular-nums text-ink" }, String(log.attempts.length)),
                          h("span", { role: "cell" }, log.durationMs === null || log.durationMs === undefined ? h("span", { className: "text-muted" }, "—") : h(BarCell, { value: log.durationMs, max: figures.maxDuration, color: "#4C7DFF" }, duration(log.durationMs))),
                          h(
                            "span",
                            { role: "cell" },
                            tokens.total
                              ? h(BarCell, { value: tokens.total, max: figures.maxTokens, color: "#E0559B" }, `${compact(tokens.input)} / ${compact(tokens.output)}`)
                              : h("span", { className: "text-muted" }, "—"),
                          ),
                          h("span", { role: "cell" }, cost === null ? h("span", { className: "text-muted" }, "—") : h(BarCell, { value: cost, max: figures.maxCost, color: "#7A4CFF" }, money(cost))),
                        );
                      }),
                    ),
                  )
                : message("No operations match"),
            ),
    opened
      ? h(DetailPanel, { key: opened.id, log: opened, productName: productName(opened), onClose: () => setOpenId(null) })
      : null,
  );
}
