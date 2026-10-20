"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { h } from "@/lib/h";
import { EditorFooter, KindIcon, LoadingBody, NoticeBar, copyName, extensionOf, useDataItem, useDiscardGuard, useSaveActions, type SaveOutcome } from "./shared";

/** Notes and text documents (Markdown, TXT, JSON, and the text read out of a PDF). */
export function TextEditorModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: (outcome: SaveOutcome) => void }) {
  const { item, setItem, error } = useDataItem(id);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    if (item) setDraft(item.text ?? "");
  }, [item]);

  const dirty = item !== null && item.text !== null && draft !== item.text;
  const { busy, error: saveError, save, saveCopy } = useSaveActions({
    item,
    build: () => ({ text: draft }),
    onSaved: (outcome) => {
      if (outcome.kind === "saved") {
        setItem(outcome.item);
        setStatus("Saved");
      } else {
        setStatus(`Saved a copy: ${outcome.item.filename ?? outcome.item.label}`);
      }
      onSaved(outcome);
    },
  });
  const { requestClose, dialog } = useDiscardGuard(dirty, onClose);

  const isPdf = extensionOf(item?.filename) === "pdf" || item?.mimeType === "application/pdf";
  const defaultCopyName = item?.kind === "note" ? null : copyName(item?.filename, item?.label ?? "Document", isPdf ? "md" : undefined);
  const lines = draft ? draft.split("\n").length : 0;
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const editable = item !== null && item.text !== null && item.saveMode !== "none";

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (item?.saveMode === "overwrite" && dirty) void save();
    }
  }

  return h(
    Modal,
    {
      open: true,
      onClose: requestClose,
      size: "xl",
      fill: true,
      icon: item ? h(KindIcon, { kind: item.kind, size: 32 }) : null,
      title: item?.filename ?? item?.label ?? "Opening…",
      subtitle: item ? `${item.kind === "note" ? "Note" : "Text"} · ${lines.toLocaleString("en-US")} lines · ${words.toLocaleString("en-US")} words` : undefined,
      footer: h(EditorFooter, {
        item,
        dirty,
        busy,
        error: saveError,
        status,
        copyAllowedClean: item?.saveMode === "copy-only",
        defaultCopyName,
        onSave: () => void save(),
        onSaveCopy: (filename?: string) => void saveCopy(filename),
      }),
    },
    !item
      ? h(LoadingBody, { error })
      : [
          h(NoticeBar, { key: "notice", notice: item.notice }),
          item.text === null
            ? h("div", { key: "empty", className: "grid flex-1 place-items-center p-10 text-center text-sm text-muted" }, "There's no text to show for this file.")
            : h(
                "div",
                { key: "editor", className: "flex min-h-0 flex-1 flex-col p-4" },
                h("label", { htmlFor: "data-text-editor", className: "sr-only" }, "Text"),
                h("textarea", {
                  id: "data-text-editor",
                  value: draft,
                  readOnly: !editable,
                  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setDraft(event.target.value);
                    setStatus(null);
                  },
                  onKeyDown,
                  spellCheck: item.kind === "note",
                  className:
                    "min-h-0 w-full flex-1 resize-none rounded-lg border border-[#DDE0E4] bg-[#FAFBFC] p-4 text-[13px] leading-[1.7] text-ink outline-none focus:border-lineage focus:ring-2 focus:ring-lineage/20 " +
                    (["md", "markdown", "json", "csv", "html", "xml", "yaml", "yml"].includes(extensionOf(item.filename)) ? "font-mono text-[12.5px]" : ""),
                }),
              ),
          h("span", { key: "dialog" }, dialog),
        ],
  );
}
