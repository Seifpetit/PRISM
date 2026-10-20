// "Is the data up to date?" for the period chosen on Performance: does every stream (ad spend, and the orders that were
// fulfilled) have data for all of it, through yesterday? Live connections cover the range; a file covers the days it
// has. Days no source covers are the gaps, reported as date ranges, so the person can see from where and until when.
// Pure; only types are imported.

import type { Range, Reading } from "./business-figures";

export type StreamId = "spend" | "orders";

export interface Gap {
  from: string;
  to: string;
}

/** What one source has, as it would say it: its own first and last day. */
export interface Coverage {
  source: string;
  from: string;
  to: string;
  /** A single total over its days (a file with no per-day rows) rather than day by day. */
  whole: boolean;
}

export interface StreamCheck {
  id: StreamId;
  label: string;
  coverage: Coverage[];
  gaps: Gap[];
}

export interface SyncCheck {
  /** The days that must be covered: the chosen range, up to yesterday. Null when there is nothing to require. */
  window: Range | null;
  streams: StreamCheck[];
  /** At least one source exists for at least one stream. */
  hasAnything: boolean;
  /** Every stream has a source and no gaps. */
  ok: boolean;
}

const DAY_MS = 86_400_000;
const addDays = (iso: string, count: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10);

const STREAMS: Array<{ id: StreamId; label: string }> = [
  { id: "spend", label: "Ad spend" },
  { id: "orders", label: "Orders" },
];

/** The days of `window` that none of the intervals covers, as ranges of dates. */
function gapsIn(window: Range, intervals: Array<{ from: string; to: string }>): Gap[] {
  const gaps: Gap[] = [];
  let cursor = window.since;
  for (const interval of [...intervals].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))) {
    if (interval.to < cursor) continue;
    if (interval.from > window.until) break;
    if (interval.from > cursor) gaps.push({ from: cursor, to: addDays(interval.from, -1) });
    cursor = addDays(interval.to, 1) > cursor ? addDays(interval.to, 1) : cursor;
    if (cursor > window.until) break;
  }
  if (cursor <= window.until) gaps.push({ from: cursor, to: window.until });
  return gaps;
}

/**
 * @param readings  every reading from every source (Shopify, Meta Ads, imported files...); what an ad platform only
 *                  reports (`reported`) is not fulfilment and does not count as orders
 * @param range     the period chosen on the page
 * @param today     ISO date of today: data is required through yesterday, since an export is always of yesterday
 */
export function checkSync(readings: Reading[], range: Range, today: string): SyncCheck {
  const until = addDays(today, -1) < range.until ? addDays(today, -1) : range.until;
  const window: Range | null = until >= range.since ? { since: range.since, until } : null;

  const streams = STREAMS.map(({ id, label }): StreamCheck => {
    const coverage: Coverage[] = [];
    const intervals: Array<{ from: string; to: string }> = [];
    for (const reading of readings) {
      if (reading.reported || reading.kpi !== (id === "spend" ? "spend" : "orders")) continue;
      if (reading.daily?.length) {
        const dates = reading.daily.map((day) => day.date).sort();
        coverage.push({ source: reading.source, from: dates[0], to: dates[dates.length - 1], whole: false });
        intervals.push({ from: dates[0], to: dates[dates.length - 1] });
      } else if (reading.whole?.from && reading.whole.to) {
        coverage.push({ source: reading.source, from: reading.whole.from, to: reading.whole.to, whole: true });
        // Its first day is its first order, not a day it started looking: nothing is missing before it.
        intervals.push({ from: window && reading.whole.from > window.since ? window.since : reading.whole.from, to: reading.whole.to });
      }
    }
    return { id, label, coverage, gaps: window ? gapsIn(window, intervals) : [] };
  });

  const hasAnything = streams.some((stream) => stream.coverage.length > 0);
  return { window, streams, hasAnything, ok: hasAnything && streams.every((stream) => stream.coverage.length > 0 && stream.gaps.length === 0) };
}
