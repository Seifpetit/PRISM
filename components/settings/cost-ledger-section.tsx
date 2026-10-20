"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, ReceiptText, X } from "lucide-react";
import { PageHeader } from "@/components/settings/library";
import { h } from "@/lib/h";
import type { CostLedgerRecord } from "@/types/cost-ledger";

// The cost ledger as one screen: choose a period and a measure, see spend over time, click a bar or a row to focus
// on it, and read the recent calls along the bottom. Personal choices (period, measure, grouping, monthly budget)
// are remembered in this browser.

type Period = "today" | "7d" | "30d" | "all";
type Metric = "cost" | "calls" | "tokens";
type GroupBy = "provider" | "operation" | "model";
type Prefs = { period: Period; metric: Metric; groupBy: GroupBy; budget: number | null };
type Focus = { dim: GroupBy; id: string; label: string };

const PREFS_KEY = "prism-cost-ledger:v1";
const DEFAULT_PREFS: Prefs = { period: "30d", metric: "cost", groupBy: "operation", budget: null };

const operationLabels: Record<string, string> = {
  product_context_building: "Product context",
  audience_generation: "Audience exploration",
  generate_audiences: "Audience exploration",
  angle_generation: "Angle exploration",
  generate_angles: "Angle exploration",
  creative_type_generation: "Creative type exploration",
  generate_creative_types: "Creative type exploration",
  execution_generation: "Execution exploration",
  generate_executions: "Execution exploration",
  creative_generation: "Creative generation",
  generate_creatives: "Creative generation",
};

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];
const METRICS: Array<{ value: Metric; label: string }> = [
  { value: "cost", label: "Spend" },
  { value: "calls", label: "Calls" },
  { value: "tokens", label: "Tokens" },
];
const GROUPS: Array<{ value: GroupBy; label: string }> = [
  { value: "operation", label: "Operation" },
  { value: "provider", label: "Provider" },
  { value: "model", label: "Model" },
];

const readableIdentifier = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const operationLabel = (operation: string) => operationLabels[operation] ?? readableIdentifier(operation);

function numericCost(record: CostLedgerRecord) {
  if (record.cost.usd === null) return null;
  const value = Number(record.cost.usd);
  return Number.isFinite(value) ? value : null;
}

function formatMoney(value: number | null, precise = false) {
  if (value === null) return "Unpriced";
  const digits = precise || (value > 0 && value < 0.01) ? 4 : value >= 100 ? 0 : 2;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

const formatCount = (value: number) => new Intl.NumberFormat("en-US").format(value);
const formatCompact = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);

function formatMetric(metric: Metric, value: number, hasPrice = true) {
  if (metric === "cost") return hasPrice ? formatMoney(value) : "Unpriced";
  return metric === "tokens" ? formatCompact(value) : formatCount(value);
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(date);
  return sameDay ? `Today · ${time}` : `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)} · ${time}`;
}

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (time: number) => {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

function periodStart(period: Period, now: number) {
  if (period === "all") return null;
  if (period === "today") return startOfDay(now);
  return startOfDay(now) - ((period === "7d" ? 7 : 30) - 1) * DAY;
}

const metricOf = (record: CostLedgerRecord, metric: Metric) => (metric === "cost" ? (numericCost(record) ?? 0) : metric === "calls" ? 1 : (record.usage.total ?? 0));

const groupKey = (record: CostLedgerRecord, dim: GroupBy) =>
  dim === "provider" ? record.provider.id : dim === "operation" ? record.operation : `${record.provider.id}:${record.service.id}`;
const groupLabel = (record: CostLedgerRecord, dim: GroupBy) =>
  dim === "provider" ? record.provider.label : dim === "operation" ? operationLabel(record.operation) : record.service.label;

type Bucket = { start: number; end: number; label: string; long: string };

/** The slots of the time chart: hours for today, days for a week or a month, and days (or weeks, past two months) for all time. */
function makeBuckets(period: Period, records: CostLedgerRecord[], now: number): Bucket[] {
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  if (period === "today") {
    const start = startOfDay(now);
    return Array.from({ length: 24 }, (_, hour) => {
      const from = start + hour * 3_600_000;
      const label = new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(from);
      return { start: from, end: from + 3_600_000, label, long: `Today · ${label}` };
    });
  }
  const times = records.map((record) => new Date(record.occurredAt).getTime()).filter((time) => !Number.isNaN(time));
  const first = period === "all" ? (times.length ? startOfDay(Math.min(...times)) : startOfDay(now)) : (periodStart(period, now) as number);
  const days = Math.max(1, Math.round((startOfDay(now) - first) / DAY) + 1);
  const step = period === "all" && days > 60 ? 7 : 1;
  const count = Math.ceil(days / step);
  return Array.from({ length: count }, (_, index) => {
    const from = first + index * step * DAY;
    const to = from + step * DAY;
    return { start: from, end: to, label: day.format(from), long: step === 1 ? day.format(from) : `${day.format(from)} – ${day.format(to - DAY)}` };
  });
}

function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "null") as Partial<Prefs> | null;
      if (saved) {
        setPrefs({
          period: PERIODS.some((item) => item.value === saved.period) ? (saved.period as Period) : DEFAULT_PREFS.period,
          metric: METRICS.some((item) => item.value === saved.metric) ? (saved.metric as Metric) : DEFAULT_PREFS.metric,
          groupBy: GROUPS.some((item) => item.value === saved.groupBy) ? (saved.groupBy as GroupBy) : DEFAULT_PREFS.groupBy,
          budget: typeof saved.budget === "number" && saved.budget > 0 ? saved.budget : null,
        });
      }
    } catch {
      // Storage can be blocked or hold something old; the defaults are fine.
    }
  }, []);
  function update(patch: Partial<Prefs>) {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // Not remembered, but the choice still applies.
      }
      return next;
    });
  }
  return [prefs, update] as const;
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return h(
    "div",
    { role: "group", "aria-label": label, className: "inline-flex shrink-0 rounded-full border border-[#DDE0E4] bg-white p-0.5" },
    ...options.map((option) =>
      h(
        "button",
        {
          key: option.value,
          type: "button",
          onClick: () => onChange(option.value),
          "aria-pressed": option.value === value,
          className: `h-7 rounded-full px-3 text-[11.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${option.value === value ? "bg-ink text-white" : "text-muted hover:text-ink"}`,
        },
        option.label,
      ),
    ),
  );
}

function Panel({ title, aside, children, className = "" }: { title: string; aside?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return h(
    "section",
    { className: `flex min-h-0 flex-col rounded-2xl border border-[#DDE0E4] bg-white p-4 ${className}` },
    h("div", { className: "mb-3 flex shrink-0 items-center justify-between gap-3" }, h("h2", { className: "text-[13px] font-semibold text-ink" }, title), aside ?? null),
    children,
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return h(
    "div",
    { className: "flex min-w-[168px] flex-1 snap-start flex-col justify-between rounded-2xl border border-[#DDE0E4] bg-white px-4 py-3" },
    h("p", { className: "text-[11px] text-muted" }, label),
    h("p", { className: "mt-1 truncate text-[22px] font-semibold leading-7 tracking-[-.02em] text-ink", title: value }, value),
    h("p", { className: "mt-0.5 h-4 truncate text-[10.5px] text-muted", title: note }, note ?? ""),
  );
}

/** The monthly budget: spend so far this calendar month against a number the person sets, and edits in place. */
function BudgetCard({ spent, budget, onChange }: { spent: number; budget: number | null; onChange: (budget: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const share = budget ? spent / budget : 0;
  const tone = share >= 1 ? "var(--status-error)" : share >= 0.8 ? "var(--status-warning)" : "var(--control-accent, #2864DC)";

  function save() {
    const value = Number(draft.replace(/[^0-9.]/g, ""));
    onChange(Number.isFinite(value) && value > 0 ? value : null);
    setEditing(false);
  }

  return h(
    "div",
    { className: "flex min-w-[220px] flex-1 snap-start flex-col justify-between rounded-2xl border border-[#DDE0E4] bg-white px-4 py-3" },
    h(
      "div",
      { className: "flex items-center justify-between gap-2" },
      h("p", { className: "text-[11px] text-muted" }, "Monthly budget"),
      budget && !editing
        ? h(
            "button",
            { type: "button", "aria-label": "Edit budget", onClick: () => (setDraft(String(budget)), setEditing(true)), className: "text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" },
            h(Pencil, { size: 12 }),
          )
        : null,
    ),
    editing || !budget
      ? h(
          "form",
          {
            className: "mt-1 flex items-center gap-1.5",
            onSubmit: (event: React.FormEvent) => {
              event.preventDefault();
              save();
            },
          },
          h("span", { className: "text-sm font-semibold text-muted" }, "$"),
          h("input", {
            value: draft,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
            inputMode: "decimal",
            placeholder: "e.g. 25",
            "aria-label": "Monthly budget in US dollars",
            autoFocus: editing,
            className: "h-8 w-full min-w-0 rounded-md border border-[#DDE0E4] bg-white px-2 text-sm text-ink outline-none focus:border-[var(--control-accent,#2864DC)]",
          }),
          h("button", { type: "submit", disabled: !draft.trim(), className: "h-8 shrink-0 rounded-md bg-ink px-2.5 text-[11px] font-semibold text-white disabled:opacity-40" }, "Set"),
          budget ? h("button", { type: "button", "aria-label": "Remove budget", onClick: () => (onChange(null), setEditing(false)), className: "grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:text-ink" }, h(X, { size: 14 })) : null,
        )
      : h(
          "div",
          { className: "mt-1" },
          h("p", { className: "truncate text-[22px] font-semibold leading-7 tracking-[-.02em] text-ink" }, `${formatMoney(spent)}`, h("span", { className: "text-[13px] font-medium text-muted" }, ` of ${formatMoney(budget)}`)),
          h(
            "div",
            { className: "mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF0F3]", role: "progressbar", "aria-valuenow": Math.round(share * 100), "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": "Budget used" },
            h("div", { className: "h-full rounded-full transition-[width] duration-300", style: { width: `${Math.min(100, share * 100)}%`, background: tone } }),
          ),
        ),
    h("p", { className: "mt-0.5 h-4 truncate text-[10.5px] text-muted" }, budget && !editing ? `${Math.round(share * 100)}% used this month` : "This calendar month, all providers"),
  );
}

export function CostLedgerSection({ records, loading = false, error = false }: { records: CostLedgerRecord[]; loading?: boolean; error?: boolean }) {
  const [prefs, update] = usePrefs();
  const [focus, setFocus] = useState<Focus | null>(null);
  const [bucketIndex, setBucketIndex] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setNow(Date.now()), [records]);

  const { period, metric, groupBy } = prefs;
  const start = periodStart(period, now);
  const inPeriod = useMemo(
    () =>
      records.filter((record) => {
        const time = new Date(record.occurredAt).getTime();
        return !Number.isNaN(time) && (start === null || time >= start);
      }),
    [records, start],
  );
  const buckets = useMemo(() => makeBuckets(period, inPeriod, now), [period, inPeriod, now]);
  const bucketOf = (record: CostLedgerRecord) => {
    const time = new Date(record.occurredAt).getTime();
    return buckets.findIndex((bucket) => time >= bucket.start && time < bucket.end);
  };
  const onFocus = (record: CostLedgerRecord) => !focus || groupKey(record, focus.dim) === focus.id;
  const inBucket = (record: CostLedgerRecord) => bucketIndex === null || bucketOf(record) === bucketIndex;

  // The chart ignores the chosen bar, the breakdown ignores the chosen row; everything else honours both.
  const chartRecords = inPeriod.filter(onFocus);
  const breakdownRecords = inPeriod.filter(inBucket);
  const scoped = inPeriod.filter((record) => onFocus(record) && inBucket(record));

  const series = useMemo(() => {
    const values = buckets.map(() => ({ value: 0, calls: 0 }));
    chartRecords.forEach((record) => {
      const index = bucketOf(record);
      if (index >= 0) {
        values[index].value += metricOf(record, metric);
        values[index].calls += 1;
      }
    });
    return values;
    // bucketOf reads buckets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets, chartRecords, metric]);
  const peak = Math.max(...series.map((item) => item.value), 0);

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; label: string; value: number; calls: number; priced: number }>();
    breakdownRecords.forEach((record) => {
      const id = groupKey(record, groupBy);
      const current = map.get(id) ?? { id, label: groupLabel(record, groupBy), value: 0, calls: 0, priced: 0 };
      current.value += metricOf(record, metric);
      current.calls += 1;
      if (numericCost(record) !== null) current.priced += 1;
      map.set(id, current);
    });
    return [...map.values()].sort((a, b) => b.value - a.value || b.calls - a.calls);
  }, [breakdownRecords, groupBy, metric]);
  const groupTotal = groups.reduce((sum, group) => sum + group.value, 0);

  const priced = scoped.map(numericCost).filter((cost): cost is number => cost !== null);
  const totalCost = priced.length ? priced.reduce((sum, cost) => sum + cost, 0) : null;
  const tokens = scoped.reduce((sum, record) => sum + (record.usage.total ?? 0), 0);
  const unpriced = scoped.length - priced.length;
  const topOperation = useMemo(() => {
    const totals = new Map<string, number>();
    scoped.forEach((record) => totals.set(record.operation, (totals.get(record.operation) ?? 0) + (numericCost(record) ?? 0)));
    const best = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? { label: operationLabel(best[0]), value: best[1] } : null;
  }, [scoped]);

  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const monthSpend = records.reduce((sum, record) => (new Date(record.occurredAt).getTime() >= monthStart ? sum + (numericCost(record) ?? 0) : sum), 0);

  const recent = [...scoped].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 40);
  const shown = hover ?? bucketIndex;
  const metricName = METRICS.find((item) => item.value === metric)!.label;

  const changePeriod = (value: Period) => {
    update({ period: value });
    setBucketIndex(null);
    setHover(null);
  };
  const chooseFocus = (group: { id: string; label: string }) =>
    setFocus((current) => (current && current.dim === groupBy && current.id === group.id ? null : { dim: groupBy, id: group.id, label: group.label }));
  const filtered = Boolean(focus) || bucketIndex !== null;

  const body =
    loading
      ? h("div", { role: "status", className: "grid flex-1 place-items-center text-sm text-muted" }, "Loading cost ledger…")
      : error
        ? h(
            "div",
            { role: "alert", className: "grid flex-1 place-items-center text-center" },
            h("div", null, h("h2", { className: "text-sm font-semibold text-ink" }, "Cost ledger unavailable"), h("p", { className: "mx-auto mt-2 max-w-md text-xs leading-5 text-muted" }, "Prism could not read the local cost ledger. Check that the GraphQL backend is running and try again.")),
          )
        : records.length === 0
          ? h(
              "div",
              { role: "status", className: "grid flex-1 place-items-center text-center" },
              h(
                "div",
                null,
                h("div", { className: "mx-auto grid h-10 w-10 place-items-center rounded-full border border-[#DDE0E4] bg-[#F7F8FA] text-muted" }, h(ReceiptText, { size: 17 })),
                h("h2", { className: "mt-4 text-sm font-semibold text-ink" }, "No usage yet"),
                h("p", { className: "mx-auto mt-2 max-w-md text-xs leading-5 text-muted" }, "Prism will track model costs here as you build product context and explore strategy."),
              ),
            )
          : [
              h(
                "div",
                { key: "toolbar", className: "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2" },
                h(Segmented<Period>, { label: "Period", value: period, options: PERIODS, onChange: changePeriod }),
                h(Segmented<Metric>, { label: "Measure", value: metric, options: METRICS, onChange: (value: Metric) => update({ metric: value }) }),
                focus
                  ? h(
                      "button",
                      { type: "button", onClick: () => setFocus(null), "aria-label": `Clear focus on ${focus.label}`, className: "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage", style: { borderColor: "var(--control-accent)", background: "color-mix(in srgb, var(--control-accent) 10%, transparent)" } },
                      h("span", { className: "text-muted" }, `${GROUPS.find((item) => item.value === focus.dim)?.label}:`),
                      focus.label,
                      h(X, { size: 12, "aria-hidden": true }),
                    )
                  : null,
                filtered
                  ? h("button", { type: "button", onClick: () => (setFocus(null), setBucketIndex(null)), className: "text-[11.5px] font-semibold text-muted hover:text-ink" }, "Reset view")
                  : null,
              ),
              h(
                "div",
                { key: "kpis", className: "flex shrink-0 snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]", role: "list", "aria-label": "Summary" },
                h(Kpi, { label: "Spend", value: formatMoney(totalCost), note: unpriced ? `${unpriced} unpriced call${unpriced === 1 ? "" : "s"} left out` : `${PERIODS.find((item) => item.value === period)?.label}` }),
                h(Kpi, { label: "AI calls", value: formatCount(scoped.length), note: priced.length && totalCost !== null ? `${formatMoney(totalCost / priced.length, true)} avg per priced call` : undefined }),
                h(Kpi, { label: "Tokens", value: formatCompact(tokens), note: scoped.length ? `${formatCompact(tokens / scoped.length)} per call` : undefined }),
                h(Kpi, { label: "Biggest spender", value: topOperation?.label ?? "—", note: topOperation ? formatMoney(topOperation.value) : "Nothing priced yet" }),
                h(BudgetCard, { spent: monthSpend, budget: prefs.budget, onChange: (budget: number | null) => update({ budget }) }),
              ),
              h(
                "div",
                { key: "main", className: "grid min-h-[260px] flex-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" },
                h(
                  Panel,
                  {
                    title: `${metricName} over time`,
                    aside: h(
                      "p",
                      { className: "truncate text-[11.5px] text-muted", "aria-live": "polite" },
                      shown !== null && buckets[shown]
                        ? `${buckets[shown].long} · ${formatMetric(metric, series[shown].value)} · ${formatCount(series[shown].calls)} call${series[shown].calls === 1 ? "" : "s"}`
                        : "Click a bar to focus on that time",
                    ),
                  },
                  h(
                    "div",
                    { className: "flex min-h-[120px] flex-1 items-end gap-[3px]", onMouseLeave: () => setHover(null) },
                    ...series.map((item, index) =>
                      h(
                        "button",
                        {
                          key: buckets[index].start,
                          type: "button",
                          onClick: () => setBucketIndex((current) => (current === index ? null : index)),
                          onMouseEnter: () => setHover(index),
                          onFocus: () => setHover(index),
                          onBlur: () => setHover(null),
                          "aria-pressed": bucketIndex === index,
                          "aria-label": `${buckets[index].long}: ${formatMetric(metric, item.value)}`,
                          className: "group relative flex h-full min-w-0 flex-1 items-end outline-none",
                        },
                        h("span", {
                          className: "block w-full rounded-t-[3px] transition-[height,background-color] duration-200 group-focus-visible:ring-2 group-focus-visible:ring-lineage motion-reduce:transition-none",
                          style: {
                            height: peak > 0 ? `${Math.max(item.value > 0 ? 3 : 1, (item.value / peak) * 100)}%` : "1px",
                            background:
                              bucketIndex === index || hover === index
                                ? "var(--control-accent, #2864DC)"
                                : item.value > 0
                                  ? "color-mix(in srgb, var(--control-accent, #2864DC) 38%, var(--bg-panel))"
                                  : "var(--border-default, #DDE0E4)",
                            opacity: bucketIndex !== null && bucketIndex !== index && hover !== index ? 0.55 : 1,
                          },
                        }),
                      ),
                    ),
                  ),
                  h(
                    "div",
                    { className: "mt-2 flex shrink-0 justify-between text-[10.5px] text-muted", "aria-hidden": true },
                    h("span", null, buckets[0]?.label),
                    buckets.length > 2 ? h("span", null, buckets[Math.floor(buckets.length / 2)].label) : null,
                    h("span", null, buckets[buckets.length - 1]?.label),
                  ),
                ),
                h(
                  Panel,
                  { title: "Breakdown", aside: h(Segmented<GroupBy>, { label: "Group by", value: groupBy, options: GROUPS, onChange: (value: GroupBy) => update({ groupBy: value }) }) },
                  groups.length === 0
                    ? h("p", { className: "grid flex-1 place-items-center text-xs text-muted" }, "No usage here.")
                    : h(
                        "ul",
                        { className: "-mr-1 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" },
                        ...groups.map((group) => {
                          const active = focus?.dim === groupBy && focus.id === group.id;
                          const share = groupTotal > 0 ? group.value / groupTotal : 0;
                          return h(
                            "li",
                            { key: group.id },
                            h(
                              "button",
                              {
                                type: "button",
                                onClick: () => chooseFocus(group),
                                "aria-pressed": active,
                                title: active ? "Click to clear focus" : `Focus on ${group.label}`,
                                className: `relative block w-full overflow-hidden rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-lineage ${active ? "ring-1" : "hover:bg-[#F6F7F9]"}`,
                                style: active ? { ["--tw-ring-color" as string]: "var(--control-accent)", background: "color-mix(in srgb, var(--control-accent) 8%, transparent)" } : undefined,
                              },
                              h("span", { "aria-hidden": true, className: "absolute inset-y-0 left-0 opacity-[0.13]", style: { width: `${share * 100}%`, background: "var(--control-accent, #2864DC)" } }),
                              h(
                                "span",
                                { className: "relative flex items-center justify-between gap-3 text-xs" },
                                h("span", { className: "min-w-0 truncate font-medium text-ink" }, group.label),
                                h(
                                  "span",
                                  { className: "flex shrink-0 items-baseline gap-2" },
                                  h("span", { className: "text-[10.5px] tabular-nums text-muted" }, `${Math.round(share * 100)}%`),
                                  h("span", { className: "min-w-[52px] text-right font-semibold tabular-nums text-ink" }, formatMetric(metric, group.value, group.priced > 0)),
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                ),
              ),
              h(
                "section",
                { key: "recent", className: "shrink-0", "aria-labelledby": "recent-calls-heading" },
                h(
                  "div",
                  { className: "mb-2 flex items-baseline justify-between" },
                  h("h2", { id: "recent-calls-heading", className: "text-[13px] font-semibold text-ink" }, "Recent calls"),
                  h("p", { className: "text-[11px] text-muted" }, recent.length ? `${recent.length} of ${formatCount(scoped.length)} · scroll sideways` : ""),
                ),
                recent.length === 0
                  ? h("p", { className: "rounded-2xl border border-dashed border-[#DDE0E4] py-6 text-center text-xs text-muted" }, "No calls match this view.")
                  : h(
                      "ol",
                      { className: "flex snap-x gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]", tabIndex: 0, "aria-label": "Recent calls, scrolls sideways" },
                      ...recent.map((record) =>
                        h(
                          "li",
                          { key: record.id, className: "w-[216px] shrink-0 snap-start rounded-xl border border-[#DDE0E4] bg-white px-3.5 py-2.5" },
                          h(
                            "div",
                            { className: "flex items-baseline justify-between gap-2" },
                            h("p", { className: "min-w-0 truncate text-xs font-semibold text-ink", title: operationLabel(record.operation) }, operationLabel(record.operation)),
                            h("p", { className: "shrink-0 text-xs font-semibold tabular-nums text-ink" }, formatMoney(numericCost(record))),
                          ),
                          h("p", { className: "mt-0.5 truncate text-[11px] text-muted" }, `${record.provider.label} · ${record.service.label}`),
                          h("p", { className: "mt-0.5 truncate text-[10.5px] text-muted" }, `${record.usage.total === null ? "Usage unavailable" : `${formatCount(record.usage.total)} ${record.usage.unit}`} · ${formatTimestamp(record.occurredAt)}`),
                        ),
                      ),
                    ),
              ),
            ];

  return h(
    "section",
    { className: "flex h-full min-h-[600px] flex-col gap-3.5 px-5 py-6 sm:px-8 lg:px-10", "aria-labelledby": "cost-ledger-title" },
    h(PageHeader, {
      eyebrow: "Cost control",
      title: "Cost ledger",
      titleId: "cost-ledger-title",
      description: "What Prism spends across models and providers. Click a bar or a row to focus on it.",
    }),
    body,
  );
}
