"use client";

import { h } from "@/lib/h";

const TONE: Record<string, string> = {
  ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  PAUSED: "border-[#DDE0E4] text-muted",
};

/** A Meta campaign's delivery status: active, paused, or something that needs a look (issues, archived...). */
export function StatusPill({ status }: { status: string }) {
  const tone = TONE[status] ?? "border-amber-500/40 bg-amber-500/10 text-amber-600";
  return h("span", { className: `shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[.06em] ${tone}` }, status.replace(/_/g, " ").toLowerCase());
}
