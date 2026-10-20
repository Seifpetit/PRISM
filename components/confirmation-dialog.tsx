"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";
import { h } from "@/lib/h";

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    confirmRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onCancel]);
  if (!open) return null;
  return createPortal(h("div", { className: "fixed inset-0 z-[150] grid place-items-center bg-[#15171A]/80 p-4 backdrop-blur-[1px]", role: "presentation", onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) onCancel(); } }, h("div", { role: "dialog", "aria-modal": true, className: "w-full max-w-sm rounded-xl border border-red-200 bg-panel p-5 shadow-[0_24px_60px_rgb(21_23_26/.24)]" }, h("div", { className: "flex items-start gap-3" }, h("div", { className: "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-700" }, h(AlertTriangle, { size: 18 })), h("div", null, h("h2", { className: "text-sm font-semibold text-ink" }, title), h("p", { className: "mt-1.5 text-xs leading-5 text-muted" }, description))), h("div", { className: "mt-5 flex justify-end gap-2" }, h("button", { type: "button", onClick: onCancel, className: "rounded-md border border-border-default px-3 py-2 text-xs font-semibold text-muted hover:bg-canvas hover:text-ink" }, "Cancel"), h("button", { ref: confirmRef, type: "button", onClick: onConfirm, className: "rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2" }, confirmLabel)))), document.body);
}
