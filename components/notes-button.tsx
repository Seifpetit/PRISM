"use client";

import { useEffect, useRef, useState } from "react";
import { Check, StickyNote, X } from "lucide-react";
import { createPortal } from "react-dom";
import { api } from "@/api/api";
import { h } from "@/lib/h";

function NotesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setStatus("idle");
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    if (!note.trim()) return;
    setStatus("submitting");
    try {
      await api.submitUserNote({ note: note.trim() });
      setStatus("submitted");
      window.setTimeout(() => onClose(), 900);
    } catch {
      setStatus("error");
    }
  }

  return createPortal(
    h(
      "div",
      {
        className: "fixed inset-0 z-[150] grid place-items-center bg-[#15171A]/80 p-4 backdrop-blur-[1px]",
        role: "presentation",
        onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
          if (event.target === event.currentTarget) onClose();
        },
      },
      h(
        "div",
        {
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": "notes-modal-title",
          className: "w-full max-w-md rounded-xl border border-amber-200 bg-panel p-5 shadow-[0_24px_60px_rgb(21_23_26/.24)]",
        },
        h(
          "div",
          { className: "flex items-start gap-3" },
          h(
            "div",
            { className: "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600" },
            h(StickyNote, { size: 17 }),
          ),
          h(
            "div",
            { className: "min-w-0 flex-1" },
            h("h2", { id: "notes-modal-title", className: "text-sm font-semibold text-ink" }, "Notes"),
            h(
              "p",
              { className: "mt-1 text-xs leading-5 text-muted" },
              "What did you notice worth noting?",
            ),
          ),
          h(
            "button",
            {
              type: "button",
              onClick: onClose,
              "aria-label": "Close",
              className: "shrink-0 rounded p-1 text-muted hover:bg-canvas hover:text-ink",
            },
            h(X, { size: 16 }),
          ),
        ),
        h("textarea", {
          ref: textareaRef,
          value: note,
          onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value),
          disabled: status === "submitting" || status === "submitted",
          placeholder: "Type your remark…",
          rows: 5,
          className:
            "mt-4 w-full resize-none rounded-md border border-border-default bg-bg-input p-3 text-sm leading-5 text-ink outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 disabled:opacity-60",
        }),
        status === "error"
          ? h("p", { role: "alert", className: "mt-2 text-xs font-medium text-red-700" }, "Could not save the note. Try again.")
          : null,
        h(
          "div",
          { className: "mt-4 flex justify-end gap-2" },
          h(
            "button",
            {
              type: "button",
              onClick: onClose,
              className: "rounded-md border border-border-default px-3 py-2 text-xs font-semibold text-muted hover:bg-canvas hover:text-ink",
            },
            "Cancel",
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => void submit(),
              disabled: !note.trim() || status === "submitting" || status === "submitted",
              className:
                "inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2",
            },
            status === "submitted" ? h(Check, { size: 14 }) : null,
            status === "submitting" ? "Saving…" : status === "submitted" ? "Noted" : "Submit",
          ),
        ),
      ),
    ),
    document.body,
  );
}

export function NotesButton() {
  const [open, setOpen] = useState(false);
  return h(
    "div",
    null,
    h(
      "button",
      {
        type: "button",
        onClick: () => setOpen(true),
        "aria-label": "Notes",
        title: "Leave a development note",
        className:
          "header-notes-button grid h-9 w-9 shrink-0 place-items-center rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1",
      },
      h(StickyNote, { size: 16, "aria-hidden": true }),
    ),
    h(NotesModal, { open, onClose: () => setOpen(false) }),
  );
}
