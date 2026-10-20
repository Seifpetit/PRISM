"use client";

import { ExternalLink, ShieldAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { h } from "@/lib/h";
import { KindIcon } from "./shared";

function parse(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

/** Before a stored link opens, the person sees exactly where it goes and says whether they trust it. */
export function LinkTrustModal({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const parsed = parse(url);
  const open = () => {
    if (!parsed) return;
    window.open(parsed.href, "_blank", "noopener,noreferrer");
    onClose();
  };
  const button = "inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage";

  return h(
    Modal,
    {
      open: true,
      onClose,
      size: "md",
      icon: h(KindIcon, { kind: "link", size: 32 }),
      title: "Do you trust this link?",
      subtitle: label,
      footer: parsed
        ? [
            h("button", { key: "no", type: "button", onClick: onClose, className: `${button} border border-[#DDE0E4] text-ink hover:bg-[#F6F7F9]` }, "No, stay here"),
            h("button", { key: "yes", type: "button", onClick: open, autoFocus: true, className: `${button} bg-ink text-white hover:bg-ink/90` }, h(ExternalLink, { size: 13 }), "Yes, open it"),
          ]
        : h("button", { type: "button", onClick: onClose, className: `${button} border border-[#DDE0E4] text-ink hover:bg-[#F6F7F9]` }, "Close"),
    },
    h(
      "div",
      { className: "p-5" },
      parsed
        ? [
            h("p", { key: "lead", className: "text-xs leading-5 text-muted" }, "It opens in a new tab, on this site:"),
            h(
              "p",
              { key: "host", className: "mt-3 flex items-center gap-2 text-lg font-semibold tracking-[-.01em] text-ink" },
              parsed.protocol === "http:" ? h(ShieldAlert, { size: 16, style: { color: "var(--status-warning)" }, "aria-label": "Not encrypted" }) : null,
              parsed.hostname,
            ),
            h("p", { key: "full", className: "mt-1.5 break-all rounded-md border border-[#ECEEF1] bg-[#FAFBFC] px-3 py-2 font-mono text-[11px] leading-4 text-muted" }, parsed.href),
            parsed.protocol === "http:"
              ? h("p", { key: "http", className: "mt-3 text-[11px] leading-4", style: { color: "var(--status-warning)" } }, "This address isn't encrypted (http). Only open it if you know the site.")
              : null,
          ]
        : h("p", { className: "text-sm leading-6 text-muted" }, `“${url}” isn't a web address Prism can open.`),
    ),
  );
}
