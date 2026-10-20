"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Columns3, Rows3, Trash2 } from "lucide-react";
import { api, type CsvImportRecord, type CsvImportTable } from "@/api/api";
import { Modal } from "@/components/ui/modal";
import { h } from "@/lib/h";
import { columnName, detectDelimiter, parseDelimited, readXlsxFirstSheet, serializeDelimited, type Grid } from "./grid-format";
import { EditorFooter, KindIcon, LoadingBody, NoticeBar, copyName, extensionOf, useDataItem, useDiscardGuard, useSaveActions, type SaveOutcome } from "./shared";

const ROW_H = 28;
const HEADER_H = 28;
const ROWNUM_W = 52;
const OVERSCAN = 8;

type Cell = { r: number; c: number };

function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * An Excel-like grid: column letters, row numbers, one selected cell. Arrow keys move; Enter, F2 or typing edits;
 * Enter/Tab commit and move on; Delete clears. Only the rows in view are rendered, so large files stay fast.
 */
function SpreadsheetGrid({
  grid,
  onChange,
  selected,
  onSelect,
  readOnly = false,
}: {
  grid: Grid;
  onChange?: (next: Grid) => void;
  selected: Cell | null;
  onSelect: (cell: Cell) => void;
  readOnly?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Keystrokes land in a transparent input on the selected cell, so typed text arrives as real input events —
  // which is how composed (IME) and inserted text arrive too, not only plain keydowns.
  const captureRef = useRef<HTMLInputElement | null>(null);
  const focusCapture = () => requestAnimationFrame(() => captureRef.current?.focus({ preventScroll: true }));
  const [viewport, setViewport] = useState({ top: 0, height: 600 });
  const [editing, setEditing] = useState<(Cell & { value: string }) | null>(null);
  const rowCount = grid.length;
  const colCount = grid[0]?.length ?? 0;

  const widths = useMemo(() => {
    const sample = grid.slice(0, 300);
    return Array.from({ length: colCount }, (_, c) => {
      const longest = sample.reduce((max, row) => Math.max(max, (row[c] ?? "").length), 0);
      return Math.max(84, Math.min(280, longest * 7 + 22));
    });
  }, [grid, colCount]);
  const offsets = useMemo(() => widths.reduce<number[]>((acc, width, index) => [...acc, (acc[index] ?? 0) + width], [0]), [widths]);
  const totalWidth = ROWNUM_W + (offsets[colCount] ?? 0);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewport((current) => ({ ...current, height: element.clientHeight })));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The rendered row window follows scrollTop every frame, not just on the browser's own "scroll" event: that
  // event can be throttled or coalesced by the browser, which otherwise left the visible rows stuck showing a
  // stale window while the scrollbar itself had already moved.
  useEffect(() => {
    let frame = requestAnimationFrame(function tick() {
      const element = scrollRef.current;
      if (element) {
        const top = element.scrollTop;
        setViewport((current) => (Math.abs(current.top - top) < ROW_H / 2 ? current : { ...current, top }));
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function ensureVisible(cell: Cell) {
    const element = scrollRef.current;
    if (!element) return;
    const top = HEADER_H + cell.r * ROW_H;
    if (top < element.scrollTop + HEADER_H) element.scrollTop = top - HEADER_H;
    else if (top + ROW_H > element.scrollTop + element.clientHeight) element.scrollTop = top + ROW_H - element.clientHeight;
    const left = ROWNUM_W + offsets[cell.c];
    const right = left + widths[cell.c];
    if (left < element.scrollLeft + ROWNUM_W) element.scrollLeft = left - ROWNUM_W;
    else if (right > element.scrollLeft + element.clientWidth) element.scrollLeft = right - element.clientWidth;
  }

  function move(cell: Cell) {
    const next = { r: Math.max(0, Math.min(rowCount - 1, cell.r)), c: Math.max(0, Math.min(colCount - 1, cell.c)) };
    onSelect(next);
    ensureVisible(next);
  }

  function setCell(cell: Cell, value: string) {
    if (!onChange || grid[cell.r]?.[cell.c] === value) return;
    const next = grid.slice();
    next[cell.r] = next[cell.r].slice();
    next[cell.r][cell.c] = value;
    onChange(next);
  }

  function commit(then?: Cell) {
    if (editing) setCell(editing, editing.value);
    setEditing(null);
    if (then) move(then);
    focusCapture();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (editing || !selected) return;
    const { r, c } = selected;
    const keyMoves: Record<string, Cell> = {
      ArrowUp: { r: r - 1, c },
      ArrowDown: { r: r + 1, c },
      ArrowLeft: { r, c: c - 1 },
      ArrowRight: { r, c: c + 1 },
      Tab: event.shiftKey ? { r, c: c - 1 } : { r, c: c + 1 },
    };
    if (keyMoves[event.key]) {
      event.preventDefault();
      move(keyMoves[event.key]);
    } else if (readOnly) {
      return;
    } else if (event.key === "Enter" || event.key === "F2") {
      event.preventDefault();
      setEditing({ r, c, value: grid[r][c] ?? "" });
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      setCell(selected, "");
    }
  }

  const first = Math.max(0, Math.floor(viewport.top / ROW_H) - OVERSCAN);
  const last = Math.min(rowCount, Math.ceil((viewport.top + viewport.height) / ROW_H) + OVERSCAN);
  const cellBase = "h-full truncate border-b border-r border-[#E7E9EC] px-2 text-[12px] leading-[27px]";
  const placed = "absolute top-0";
  const stickyBg = { background: "var(--bg-elevated)" };

  const rows = [];
  for (let r = first; r < last; r += 1) {
    const row = grid[r];
    rows.push(
      h(
        "div",
        { key: r, className: "absolute left-0", style: { top: HEADER_H + r * ROW_H, height: ROW_H, width: totalWidth } },
        h(
          "div",
          {
            className: `sticky left-0 z-[1] ${cellBase} text-right font-mono text-[10px] text-muted`,
            style: { ...stickyBg, width: ROWNUM_W, color: selected?.r === r ? "var(--text-primary)" : undefined },
          },
          r + 1,
        ),
        ...row.map((value, c) => {
          const isSelected = selected?.r === r && selected?.c === c;
          return h(
            "div",
            {
              key: c,
              role: "gridcell",
              "aria-selected": isSelected,
              title: value.length > 30 ? value : undefined,
              onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
                event.preventDefault();
                onSelect({ r, c });
                focusCapture();
              },
              onDoubleClick: () => !readOnly && setEditing({ r, c, value }),
              className: `${placed} ${cellBase} cursor-cell text-ink ${r === 0 ? "font-semibold" : ""}`,
              style: {
                left: ROWNUM_W + offsets[c],
                width: widths[c],
                background: isSelected ? "color-mix(in srgb, var(--lineage-selected) 10%, var(--bg-panel))" : undefined,
                boxShadow: isSelected ? "inset 0 0 0 2px var(--lineage-selected)" : undefined,
              },
            },
            value,
          );
        }),
      ),
    );
  }

  return h(
    "div",
    {
      ref: scrollRef,
      role: "grid",
      "aria-rowcount": rowCount,
      "aria-colcount": colCount,
      "aria-label": "Spreadsheet",
      onMouseDown: () => focusCapture(),
      onScroll: (event: React.UIEvent<HTMLDivElement>) => {
        const top = event.currentTarget.scrollTop;
        setViewport((current) => (Math.abs(current.top - top) < ROW_H / 2 ? current : { ...current, top }));
      },
      className: "relative min-h-0 flex-1 overflow-auto rounded-lg border border-[#DDE0E4] outline-none focus-within:ring-2 focus-within:ring-lineage/30",
      style: { background: "var(--bg-panel)" },
    },
    h(
      "div",
      { className: "relative", style: { width: totalWidth, height: HEADER_H + rowCount * ROW_H } },
      h(
        "div",
        { className: "sticky top-0 z-[2]", style: { height: HEADER_H, width: totalWidth } },
        h("div", { className: `sticky left-0 z-[3] ${cellBase}`, style: { ...stickyBg, width: ROWNUM_W } }),
        ...widths.map((width, c) =>
          h(
            "div",
            {
              key: c,
              className: `${placed} ${cellBase} text-center font-mono text-[10px] font-semibold text-muted`,
              style: { ...stickyBg, left: ROWNUM_W + offsets[c], width, color: selected?.c === c ? "var(--text-primary)" : undefined },
            },
            columnName(c),
          ),
        ),
      ),
      ...rows,
      selected && !editing
        ? h("input", {
            ref: captureRef,
            autoFocus: true,
            value: "",
            readOnly,
            "aria-label": `Cell ${columnName(selected.c)}${selected.r + 1}: ${grid[selected.r]?.[selected.c] ?? ""}`,
            onKeyDown,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              if (readOnly || !event.target.value) return;
              setEditing({ ...selected, value: event.target.value });
            },
            className: "absolute z-[4] opacity-0",
            style: { left: ROWNUM_W + (offsets[selected.c] ?? 0), top: HEADER_H + selected.r * ROW_H, width: widths[selected.c] ?? 80, height: ROW_H, caretColor: "transparent" },
          })
        : null,
      editing
        ? h("input", {
            autoFocus: true,
            value: editing.value,
            "aria-label": `Edit ${columnName(editing.c)}${editing.r + 1}`,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setEditing({ ...editing, value: event.target.value }),
            onBlur: () => commit(),
            onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit({ r: editing.r + 1, c: editing.c });
              } else if (event.key === "Tab") {
                event.preventDefault();
                commit({ r: editing.r, c: editing.c + (event.shiftKey ? -1 : 1) });
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setEditing(null);
                focusCapture();
              }
            },
            className: "absolute z-[4] border-2 border-lineage bg-white px-1.5 text-[12px] text-ink outline-none",
            style: { left: ROWNUM_W + offsets[editing.c], top: HEADER_H + editing.r * ROW_H, width: Math.max(widths[editing.c], 160), height: ROW_H },
          })
        : null,
    ),
  );
}

function GridToolbar({ grid, selected, onChange, onSelect }: { grid: Grid; selected: Cell | null; onChange: (next: Grid) => void; onSelect: (cell: Cell) => void }) {
  const cols = grid[0]?.length ?? 0;
  const at = selected ?? { r: grid.length - 1, c: cols - 1 };
  const button = "inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DDE0E4] px-2.5 text-[11px] font-semibold text-ink hover:bg-[#F6F7F9] disabled:cursor-not-allowed disabled:opacity-40";
  return h(
    "div",
    { className: "flex shrink-0 flex-wrap items-center gap-1.5" },
    h("span", { className: "mr-1 min-w-[64px] rounded-md border border-[#DDE0E4] px-2 py-1.5 text-center font-mono text-[11px] font-semibold text-ink" }, selected ? `${columnName(selected.c)}${selected.r + 1}` : "—"),
    h("button", { type: "button", className: button, onClick: () => { const next = grid.slice(); next.splice(at.r + 1, 0, Array(cols).fill("")); onChange(next); onSelect({ r: at.r + 1, c: at.c }); } }, h(Rows3, { size: 13 }), "Insert row"),
    h("button", { type: "button", className: button, onClick: () => { onChange(grid.map((row) => { const next = row.slice(); next.splice(at.c + 1, 0, ""); return next; })); onSelect({ r: at.r, c: at.c + 1 }); } }, h(Columns3, { size: 13 }), "Insert column"),
    h("button", { type: "button", className: button, disabled: !selected || grid.length <= 1, onClick: () => { if (!selected) return; onChange(grid.filter((_, index) => index !== selected.r)); onSelect({ r: Math.min(selected.r, grid.length - 2), c: selected.c }); } }, h(Trash2, { size: 13 }), "Delete row"),
    h("button", { type: "button", className: button, disabled: !selected || cols <= 1, onClick: () => { if (!selected) return; onChange(grid.map((row) => row.filter((_, index) => index !== selected.c))); onSelect({ r: selected.r, c: Math.min(selected.c, cols - 2) }); } }, h(Trash2, { size: 13 }), "Delete column"),
    h("span", { className: "ml-auto text-[11px] text-muted" }, `${grid.length.toLocaleString("en-US")} rows × ${cols} columns · no formulas`),
  );
}

/** CSV, TSV and the first sheet of a workbook, editable. */
export function TableEditorModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: (outcome: SaveOutcome) => void }) {
  const { item, setItem, error } = useDataItem(id);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [original, setOriginal] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Cell | null>({ r: 0, c: 0 });
  const [status, setStatus] = useState<string | null>(null);

  const extension = extensionOf(item?.filename);
  const delimiter = extension === "tsv" ? "\t" : item?.text ? detectDelimiter(item.text) : ",";

  useEffect(() => {
    if (!item) return;
    try {
      const parsed = item.text !== null ? parseDelimited(item.text, delimiter) : item.dataUrl ? readXlsxFirstSheet(dataUrlBytes(item.dataUrl)) : [[""]];
      const safe = parsed.length && parsed[0].length ? parsed : [[""]];
      setGrid(safe);
      setOriginal(serializeDelimited(safe, delimiter));
    } catch (failure) {
      setParseError(failure instanceof Error ? failure.message : "This table couldn't be read.");
    }
    // delimiter derives from item
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const serialized = grid ? serializeDelimited(grid, item?.saveMode === "copy-only" ? "," : delimiter) : "";
  const dirty = grid !== null && serializeDelimited(grid, delimiter) !== original;
  const { busy, error: saveError, save, saveCopy } = useSaveActions({
    item,
    build: () => (grid ? { text: serialized } : null),
    onSaved: (outcome) => {
      if (outcome.kind === "saved") {
        setItem(outcome.item);
        setStatus("Saved");
      } else setStatus(`Saved a copy: ${outcome.item.filename ?? outcome.item.label}`);
      onSaved(outcome);
    },
  });
  const { requestClose, dialog } = useDiscardGuard(dirty, onClose);

  return h(
    Modal,
    {
      open: true,
      onClose: requestClose,
      size: "xl",
      fill: true,
      icon: h(KindIcon, { kind: "table", size: 32 }),
      title: item?.filename ?? item?.label ?? "Opening…",
      subtitle: item ? `${extension ? extension.toUpperCase() : "Table"} · ${item.saveMode === "copy-only" ? "edits save as a CSV copy" : "edit cells directly"}` : undefined,
      footer: h(EditorFooter, {
        item,
        dirty,
        busy,
        error: saveError,
        status,
        copyAllowedClean: item?.saveMode === "copy-only",
        defaultCopyName: copyName(item?.filename, item?.label ?? "Table", item?.saveMode === "copy-only" ? "csv" : undefined),
        onSave: () => void save(),
        onSaveCopy: (filename?: string) => void saveCopy(filename),
      }),
    },
    !item || (!grid && !parseError)
      ? h(LoadingBody, { error })
      : [
          h(NoticeBar, { key: "notice", notice: parseError ?? item.notice }),
          grid
            ? h(
                "div",
                { key: "grid", className: "flex min-h-0 flex-1 flex-col gap-2.5 p-4" },
                item.saveMode === "none" ? null : h(GridToolbar, { grid, selected, onChange: (next: Grid) => { setGrid(next); setStatus(null); }, onSelect: setSelected }),
                h(SpreadsheetGrid, { grid, selected, onSelect: setSelected, onChange: (next: Grid) => { setGrid(next); setStatus(null); }, readOnly: item.saveMode === "none" }),
              )
            : null,
          h("span", { key: "dialog" }, dialog),
        ],
  );
}

/** A Performance CSV import: the rows it still provides, read-only (editing them would rewrite reported results). */
export function CsvImportTableModal({ record, onClose, onRemove }: { record: CsvImportRecord; onClose: () => void; onRemove: () => void }) {
  const [table, setTable] = useState<CsvImportTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Cell | null>({ r: 0, c: 0 });

  useEffect(() => {
    let active = true;
    void api
      .csvImportTable({ id: record.id })
      .then((result) => active && setTable(result))
      .catch((failure) => active && setError(failure instanceof Error ? failure.message : "This import couldn't be opened."));
    return () => {
      active = false;
    };
  }, [record.id]);

  const grid = useMemo(() => (table ? [table.columns, ...table.rows] : null), [table]);
  const notice = table
    ? `Read-only: these are the rows this import still provides to Performance${table.truncated ? ` (first ${table.rows.length.toLocaleString("en-US")} shown)` : ""}. Editing them would rewrite reported results, and the original file was never stored.`
    : null;

  return h(
    Modal,
    {
      open: true,
      onClose,
      size: "xl",
      fill: true,
      icon: h(KindIcon, { kind: "import", size: 32 }),
      title: record.fileName,
      subtitle: `${record.kind === "meta-ads-export" ? "Meta ad export" : "Converty ad summary"} · ${record.rowsHeld.toLocaleString("en-US")} rows in use`,
      footer: [
        h("p", { key: "note", className: "mr-auto text-[11px] text-muted" }, "View only"),
        h(
          "button",
          { key: "remove", type: "button", onClick: onRemove, className: "inline-flex h-9 items-center gap-1.5 rounded-md border border-red-200 px-3.5 text-xs font-semibold text-red-700 hover:bg-red-50" },
          h(Trash2, { size: 13 }),
          "Remove import",
        ),
      ],
    },
    !grid
      ? h(LoadingBody, { error })
      : [
          h(NoticeBar, { key: "notice", notice }),
          grid.length > 1 || grid[0].length
            ? h("div", { key: "grid", className: "flex min-h-0 flex-1 flex-col p-4" }, h(SpreadsheetGrid, { grid, selected, onSelect: setSelected, readOnly: true }))
            : h("div", { key: "empty", className: "grid flex-1 place-items-center text-sm text-muted" }, "No rows from this import are in use any more."),
        ],
  );
}
