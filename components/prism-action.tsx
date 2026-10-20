"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { h } from "@/lib/h";

export type PrismActionState = "ready" | "pending" | "success" | "error";

interface PrismActionProps {
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  pendingLabel?: ReactNode;
  state?: PrismActionState;
  /** Show the app-mark inside the button. Defaults to true; set false for compact/inline actions. */
  logo?: boolean;
}

/**
 * The reserved action treatment for a deliberate AI transformation or generation.
 * Utility actions intentionally continue to use ordinary buttons.
 */
export function PrismAction({
  className = "",
  children,
  disabled = false,
  onClick,
  pendingLabel = "Building product context",
  state = "ready",
  logo = true,
}: PrismActionProps) {
  const [committing, setCommitting] = useState(false);
  const timer = useRef<number | null>(null);
  const pending = state === "pending";
  const success = state === "success";
  const isDisabled = disabled || pending || committing;

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function commit() {
    if (isDisabled) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setCommitting(true);

    timer.current = window.setTimeout(
      () => {
        timer.current = null;
        // The commit flourish owns only the short pre-action delay. Release its
        // local lock before handing control to the external pending state so the
        // same mounted action can be reused for another selected graph node.
        setCommitting(false);
        onClick();
      },
      reducedMotion ? 0 : 230,
    );
  }

  const label = pending ? pendingLabel : children;

  return h(
    "button",
    {
      type: "button",
      disabled: isDisabled,
      onClick: commit,
      "aria-busy": pending || committing || undefined,
      className: [
        "prism-action relative flex w-full items-center justify-center gap-2 overflow-hidden",
        "rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-35",
        committing ? "is-committing" : "",
        pending ? "is-pending" : "",
        success ? "is-success" : "",
        className,
      ]
        .filter(Boolean)
        .join(" "),
    },
    h("span", { className: "prism-action-sweep", "aria-hidden": true }),
    h(
      "span",
      { className: "prism-action-burst", "aria-hidden": true },
      h("span", null),
      h("span", null),
      h("span", null),
      h("span", null),
      h("span", null),
      h("span", null),
    ),
    pending
      ? h(LoaderCircle, {
          size: 14,
          className: "relative z-10 animate-spin motion-reduce:animate-none",
          "aria-hidden": true,
        })
      : success
        ? h(Check, { size: 14, className: "relative z-10", "aria-hidden": true })
        : null,
    h("span", { className: "prism-action-label relative z-10" }, label),
    pending || success || !logo
      ? null
      : h(
          "span",
          { className: "prism-action-logo relative z-10", "aria-hidden": true },
          h("img", {
            src: "/landing/assets/logo.png",
            alt: "",
            className: "h-5 w-5 object-contain",
          }),
        ),
  );
}
