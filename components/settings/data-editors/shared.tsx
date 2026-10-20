"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AudioLines,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  Info,
  Link2,
  Loader2,
  MoreVertical,
  Pencil,
  Save,
  SquarePen,
  StickyNote,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { api, type DataItemContent, type DataItemEdit, type DataItemKind } from "@/api/api";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { h } from "@/lib/h";

export type DataKind = DataItemKind | "import";

export const KIND_META: Record<DataKind, { label: string; plural: string; icon: LucideIcon; accent: string }> = {
  document: { label: "Document", plural: "Documents", icon: FileText, accent: "#2f6bff" },
  note: { label: "Note", plural: "Notes", icon: StickyNote, accent: "#d99a06" },
  table: { label: "Table", plural: "Tables", icon: FileSpreadsheet, accent: "#1f9d57" },
  import: { label: "Performance import", plural: "Imports", icon: FileSpreadsheet, accent: "#0f8a8a" },
  link: { label: "Link", plural: "Links", icon: Link2, accent: "#0d8fb3" },
  image: { label: "Image", plural: "Images", icon: ImageIcon, accent: "#7a4cff" },
  video: { label: "Video", plural: "Video", icon: Film, accent: "#e0457b" },
  audio: { label: "Audio", plural: "Audio", icon: AudioLines, accent: "#e8751a" },
};

/** The kind's icon on a tinted square — the tile's picture and the editor's title mark. Bold and saturated: this
 * is the one strongly colored element on an otherwise neutral card, so it should read at a glance. */
export function KindIcon({ kind, size = 40, badge }: { kind: DataKind; size?: number; badge?: string | null }) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return h(
    "span",
    {
      className: "relative grid shrink-0 place-items-center",
      style: {
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        color: meta.accent,
        background: `color-mix(in srgb, ${meta.accent} 22%, var(--bg-panel))`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${meta.accent} 45%, transparent)`,
      },
      "aria-hidden": true,
    },
    h(Icon, { size: Math.round(size * 0.5), strokeWidth: 2 }),
    badge
      ? h(
          "span",
          {
            className: "absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1 py-px text-[8px] font-bold uppercase tracking-[.04em] text-white",
            style: { background: meta.accent },
          },
          badge,
        )
      : null,
  );
}

export function extensionOf(filename?: string | null) {
  return /\.([a-z0-9]+)$/i.exec(filename ?? "")?.[1]?.toLowerCase() ?? "";
}

export function copyName(filename: string | null | undefined, fallback: string, extension?: string) {
  const ext = extension ?? extensionOf(filename);
  const base = (filename ?? "").replace(/\.[a-z0-9]+$/i, "") || fallback;
  return `${base} (copy)${ext ? `.${ext}` : ""}`;
}

export function useDataItem(id: string) {
  const [item, setItem] = useState<DataItemContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setItem(null);
    setError(null);
    void api
      .dataItem({ id })
      .then((result) => active && setItem(result))
      .catch((failure) => active && setError(failure instanceof Error ? failure.message : "This item couldn't be opened."));
    return () => {
      active = false;
    };
  }, [id]);
  return { item, setItem, error };
}

export type SaveOutcome = { kind: "saved" | "copied"; item: DataItemContent };

/** Save and Save as copy, with their busy and error states. `build` turns the editor's state into the edit. */
export function useSaveActions({
  item,
  build,
  onSaved,
}: {
  item: DataItemContent | null;
  build: () => Omit<DataItemEdit, "id"> | null;
  onSaved: (outcome: SaveOutcome) => void;
}) {
  const [busy, setBusy] = useState<"save" | "copy" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(mode: "save" | "copy", filename?: string) {
    if (!item) return;
    const edit = build();
    if (!edit) return;
    setBusy(mode);
    setError(null);
    try {
      const result =
        mode === "save"
          ? await api.saveDataItem({ id: item.id, ...edit })
          : await api.copyDataItem({ id: item.id, ...edit, ...(filename ? { filename } : {}) });
      onSaved({ kind: mode === "save" ? "saved" : "copied", item: result });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That couldn't be saved.");
    } finally {
      setBusy(null);
    }
  }

  return { busy, error, save: () => run("save"), saveCopy: (filename?: string) => run("copy", filename) };
}

/** The editor's footer: where things stand on the left; Save as copy (with a name) and Save on the right. */
export function EditorFooter({
  item,
  dirty,
  busy,
  error,
  status,
  copyAllowedClean = false,
  defaultCopyName,
  onSave,
  onSaveCopy,
  saveLabel = "Save",
}: {
  item: DataItemContent | null;
  dirty: boolean;
  busy: "save" | "copy" | null;
  error: string | null;
  status?: string | null;
  /** Allow a copy even without changes (a straight duplicate). */
  copyAllowedClean?: boolean;
  defaultCopyName: string | null;
  onSave: () => void;
  onSaveCopy: (filename?: string) => void;
  saveLabel?: string;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(defaultCopyName ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => setName(defaultCopyName ?? ""), [defaultCopyName]);
  useEffect(() => {
    if (naming) inputRef.current?.select();
  }, [naming]);

  if (!item || item.saveMode === "none") {
    return h("p", { className: "mr-auto text-[11px] text-muted" }, item ? "View only" : "");
  }
  const canSave = item.saveMode === "overwrite" && dirty && !busy;
  const canCopy = (dirty || copyAllowedClean) && !busy;
  const buttonBase = "inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-not-allowed disabled:opacity-40";

  return [
    h(
      "p",
      { key: "status", role: error ? "alert" : "status", className: "mr-auto min-w-0 truncate text-[11px]", style: { color: error ? "var(--status-error)" : undefined } },
      error ?? (busy ? (busy === "save" ? "Saving…" : "Saving a copy…") : (status ?? (dirty ? "Unsaved changes" : " "))),
    ),
    naming && defaultCopyName !== null
      ? h(
          "form",
          {
            key: "copy-form",
            className: "flex items-center gap-1.5",
            onSubmit: (event: React.FormEvent) => {
              event.preventDefault();
              setNaming(false);
              onSaveCopy(name.trim() || undefined);
            },
          },
          h("label", { htmlFor: "data-copy-name", className: "sr-only" }, "Copy name"),
          h("input", {
            id: "data-copy-name",
            ref: inputRef,
            value: name,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
            className: "h-9 w-[220px] rounded-md border border-[#DDE0E4] bg-white px-2.5 text-xs text-ink outline-none focus:border-lineage focus:ring-2 focus:ring-lineage/20",
          }),
          h("button", { type: "submit", className: `${buttonBase} border border-[#DDE0E4] text-ink hover:bg-[#F6F7F9]` }, "Save copy"),
          h("button", { type: "button", onClick: () => setNaming(false), className: `${buttonBase} text-muted hover:text-ink` }, "Cancel"),
        )
      : h(
          "button",
          {
            key: "copy",
            type: "button",
            disabled: !canCopy,
            onClick: () => (defaultCopyName === null ? onSaveCopy() : setNaming(true)),
            className: `${buttonBase} border border-[#DDE0E4] text-ink hover:bg-[#F6F7F9]`,
          },
          busy === "copy" ? h(Loader2, { size: 13, className: "animate-spin" }) : h(Copy, { size: 13 }),
          "Save as copy…",
        ),
    item.saveMode === "overwrite"
      ? h(
          "button",
          { key: "save", type: "button", disabled: !canSave, onClick: onSave, className: `${buttonBase} bg-ink text-white hover:bg-ink/90` },
          busy === "save" ? h(Loader2, { size: 13, className: "animate-spin" }) : h(Save, { size: 13 }),
          saveLabel,
        )
      : null,
  ];
}

export function NoticeBar({ notice }: { notice: string | null }) {
  if (!notice) return null;
  return h(
    "div",
    { className: "flex shrink-0 items-start gap-2 border-b border-[#ECEEF1] bg-[#FAFBFC] px-5 py-2.5 text-[11px] leading-4 text-muted" },
    h(Info, { size: 13, className: "mt-px shrink-0", "aria-hidden": true }),
    notice,
  );
}

export function LoadingBody({ error }: { error: string | null }) {
  return h(
    "div",
    { className: "grid flex-1 place-items-center p-10 text-sm", role: error ? "alert" : "status", style: { color: error ? "var(--status-error)" : "var(--text-muted)" } },
    error ?? h("span", { className: "inline-flex items-center gap-2" }, h(Loader2, { size: 15, className: "animate-spin" }), "Opening…"),
  );
}

/** Closing with unsaved edits asks first. */
export function useDiscardGuard(dirty: boolean, onClose: () => void) {
  const [asking, setAsking] = useState(false);
  const requestClose = () => (dirty ? setAsking(true) : onClose());
  const dialog = h(ConfirmationDialog, {
    open: asking,
    title: "Discard your changes?",
    description: "Closing now throws away the edits you haven't saved.",
    confirmLabel: "Discard changes",
    onCancel: () => setAsking(false),
    onConfirm: () => {
      setAsking(false);
      onClose();
    },
  });
  return { requestClose, dialog };
}

export const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const whole = Math.max(0, seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole - minutes * 60;
  return `${minutes}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}`;
};

export type ItemMenuAction = { key: string; label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean };

/**
 * A card's kebab menu: a small trigger button plus a dropdown portaled to <body>, so it is never clipped by a
 * scroll-clipped ancestor (the Data library's paged track, in particular). Positions itself under the trigger,
 * or above it when there isn't room below.
 */
const MENU_ROW_H = 32;

export function ItemMenu({ actions, label = "More actions" }: { actions: ItemMenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuWidth = 176;
  const menuHeight = MENU_ROW_H * actions.length;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function close() {
      setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current!.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const opensUp = rect.bottom + menuHeight + 8 > window.innerHeight;
    const top = opensUp ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6;
    setPos({ top, left });
    setOpen(true);
  }

  return [
    h(
      "button",
      {
        key: "trigger",
        ref: buttonRef,
        type: "button",
        onClick: toggle,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-label": label,
        title: label,
        className:
          "grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#DDE0E4] bg-panel text-muted shadow-sm " +
          "hover:border-[#B9C0C9] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
      },
      h(MoreVertical, { size: 13, strokeWidth: 2, "aria-hidden": true }),
    ),
    open && pos
      ? createPortal(
          // A full-viewport `fixed inset-0` layer, the same shape as the Modal backdrop elsewhere in Data — the
          // menu itself sits inside it as a normally-sized, normally-positioned (`absolute`) box, rather than
          // being `position: fixed` with a one-off custom size itself. `inset-0` never has to guess a height, so
          // it always sizes correctly; a `fixed` box with just `top`/`left` and its own explicit height is the
          // one combination that has misrendered full-height in testing, so this sidesteps it entirely.
          h(
            "div",
            { key: "menu-layer", style: { position: "fixed", inset: 0, pointerEvents: "none" }, className: "z-[160]" },
            h(
              "div",
              {
                ref: menuRef,
                role: "menu",
                "aria-label": label,
                // The height is exactly MENU_ROW_H * actions.length — no padding or border to account for: a
                // regular `border` is part of the box (border-box sizing eats into it), so the border is drawn as
                // an inset shadow instead, which paints over the content without taking any of its space.
                style: {
                  position: "absolute",
                  top: pos.top,
                  left: pos.left,
                  width: menuWidth,
                  height: menuHeight,
                  pointerEvents: "auto",
                  boxShadow: "inset 0 0 0 1px #DDE0E4, 0 12px 30px rgba(21,23,26,.18)",
                },
                className: "overflow-hidden rounded-lg bg-panel",
                onMouseDown: (event: React.MouseEvent) => event.stopPropagation(),
              },
              ...actions.map((action) =>
                h(
                  "button",
                  {
                    key: action.key,
                    type: "button",
                    role: "menuitem",
                    onClick: () => {
                      setOpen(false);
                      action.onSelect();
                    },
                    style: { height: MENU_ROW_H, minHeight: MENU_ROW_H, maxHeight: MENU_ROW_H },
                    className: `flex w-full shrink-0 items-center gap-2 px-2.5 text-left text-[11.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${
                      action.danger ? "text-red-700 hover:bg-red-50" : "text-ink hover:bg-canvas"
                    }`,
                  },
                  h(action.icon, { size: 13, className: action.danger ? "text-red-600" : "text-muted", "aria-hidden": true }),
                  action.label,
                ),
              ),
            ),
          ),
          document.body,
        )
      : null,
  ];
}

export { Copy, Download, Pencil, SquarePen, Trash2 };
