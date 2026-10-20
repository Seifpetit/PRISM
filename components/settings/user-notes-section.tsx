"use client";

import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";
import { PageHeader } from "@/components/settings/library";
import { h } from "@/lib/h";
import { api, type UserNote } from "@/api/api";

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (sameDay) return `Today · ${time}`;
  return `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date)} · ${time}`;
}

export function UserNotesSection() {
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void api
      .userNotes({})
      .then((result) => {
        if (active) setNotes(result);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return h(
    "section",
    { className: "px-5 py-10 sm:px-8 lg:px-12", "aria-labelledby": "user-notes-title" },
    h(
      "div",
      { className: "mx-auto max-w-[820px]" },
      h(PageHeader, {
        eyebrow: "Development feedback",
        title: "User notes",
        titleId: "user-notes-title",
        description: "Freeform remarks left via the Notes button, shared across every account. Not tied to who wrote them.",
        divider: true,
      }),
      loading
        ? h("div", { role: "status", className: "py-16 text-center text-sm text-muted" }, "Loading notes…")
        : error
          ? h(
              "div",
              { role: "alert", className: "mt-7 rounded-xl border border-[#DDE0E4] bg-white px-6 py-14 text-center" },
              h("h2", { className: "text-sm font-semibold text-ink" }, "Notes unavailable"),
              h(
                "p",
                { className: "mx-auto mt-2 max-w-md text-xs leading-5 text-muted" },
                "Prism could not read the notes database. Check that the GraphQL backend is running and try again.",
              ),
            )
          : notes.length === 0
            ? h(
                "div",
                {
                  role: "status",
                  "aria-live": "polite",
                  className: "mt-7 rounded-xl border border-[#DDE0E4] bg-white px-6 py-14 text-center",
                },
                h(
                  "div",
                  { className: "mx-auto grid h-10 w-10 place-items-center rounded-full border border-[#DDE0E4] bg-[#F7F8FA] text-muted" },
                  h(StickyNote, { size: 17 }),
                ),
                h("h2", { className: "mt-4 text-sm font-semibold text-ink" }, "No notes yet"),
                h(
                  "p",
                  { className: "mx-auto mt-2 max-w-md text-xs leading-5 text-muted" },
                  "Notes left from the header's Notes button will show up here for everyone.",
                ),
              )
            : h(
                "ol",
                { className: "mt-7 divide-y divide-[#E5E8EC] border-y border-[#E0E3E7]" },
                ...notes.map((entry) =>
                  h(
                    "li",
                    { key: entry.id, className: "py-4" },
                    h("p", { className: "whitespace-pre-wrap text-sm leading-6 text-ink" }, entry.note),
                    h("p", { className: "mt-1.5 text-[11px] text-muted" }, formatTimestamp(entry.createdAt)),
                  ),
                ),
              ),
    ),
  );
}
