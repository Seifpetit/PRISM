"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { api, type CsvImportRecord, type StoredProductSource } from "@/api/api";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { DataDropZone, useDataDrop } from "@/components/settings/data-drop-zone";
import { LibraryHeader, LibraryToolbar, matchesSearch, PagedLibrary } from "@/components/settings/library";
import { ImageEditorModal } from "@/components/settings/data-editors/image-editor";
import { LinkTrustModal } from "@/components/settings/data-editors/link-trust";
import { MediaEditorModal } from "@/components/settings/data-editors/media-editor";
import { CsvImportTableModal, TableEditorModal } from "@/components/settings/data-editors/table-editor";
import { TextEditorModal } from "@/components/settings/data-editors/text-editor";
import { MEDIA_KINDS, MediaPreview } from "@/components/settings/data-editors/media-preview";
import {
  Copy,
  Download,
  ItemMenu,
  KIND_META,
  KindIcon,
  Pencil,
  SquarePen,
  Trash2,
  extensionOf,
  type DataKind,
  type ItemMenuAction,
} from "@/components/settings/data-editors/shared";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";

const ALL = "";
const UNATTACHED = "__unattached";
const KIND_ORDER: DataKind[] = ["document", "note", "table", "import", "link", "image", "video", "audio"];

type DataEntry = {
  key: string;
  kind: DataKind;
  title: string;
  badge: string | null;
  bytes: number | null;
  createdAt: string;
  productIds: string[];
  source?: StoredProductSource;
  record?: CsvImportRecord;
};

function formatBytes(bytes: number | null) {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function hostOf(url: string | null) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : null;
  } catch {
    return url;
  }
}

function sourceEntry(source: StoredProductSource): DataEntry {
  const extension = extensionOf(source.filename);
  const title =
    source.kind === "link"
      ? source.label && source.label !== "Product page" ? source.label : (hostOf(source.url) ?? source.label)
      : source.kind === "note"
        ? (source.text?.split("\n").find((line) => line.trim())?.slice(0, 80) ?? source.label)
        : (source.filename || source.label);
  return {
    key: source.id,
    kind: source.kind,
    title,
    badge: source.kind === "link" ? "url" : extension ? extension.slice(0, 4) : null,
    bytes: source.sizeBytes,
    createdAt: source.createdAt,
    productIds: source.productId ? [source.productId] : [],
    source,
  };
}

function importEntry(record: CsvImportRecord): DataEntry {
  return { key: `import:${record.id}`, kind: "import", title: record.fileName, badge: "csv", bytes: null, createdAt: record.createdAt, productIds: record.productIds, record };
}

function subtitleOf(entry: DataEntry) {
  if (entry.record) return `${entry.record.rowsHeld.toLocaleString("en-US")} rows in use`;
  if (entry.kind === "link") return hostOf(entry.source?.url ?? null) ?? "Link";
  return [KIND_META[entry.kind].label, formatBytes(entry.bytes)].filter(Boolean).join(" · ");
}

/** One item on the shelf: its kind as a picture (media shows itself — a still, or a playable waveform), its name,
 * and where it belongs. The whole card opens the item; an audio card's play button sits above that. */
function DataTile({ entry, productName, onOpen }: { entry: DataEntry; productName: string; onOpen: () => void }) {
  const media = entry.source && MEDIA_KINDS.has(entry.kind) ? entry.source : null;
  return h(
    "div",
    {
      className:
        "relative z-0 flex h-full w-full flex-col rounded-2xl border border-[#E4E7EB] bg-white p-3.5 text-left transition duration-150 ease-out hover:z-10 hover:-translate-y-0.5 hover:border-[#C9CED5] hover:shadow-[0_8px_24px_rgba(21,23,26,.08)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    },
    h("button", {
      type: "button",
      onClick: onOpen,
      "aria-label": `${entry.title}, ${KIND_META[entry.kind].label}, ${productName}. Open.`,
      className: "absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
    }),
    media
      ? h(MediaPreview, { source: media, kind: entry.kind, badge: entry.badge, title: entry.title })
      : h(
          "div",
          { className: "pointer-events-none flex items-start justify-between gap-2" },
          h(KindIcon, { kind: entry.kind, size: 52, badge: entry.badge }),
          h("span", { className: "text-[10px] text-muted transition-opacity group-hover/tile:opacity-0" }, formatDate(entry.createdAt)),
        ),
    h(
      "p",
      {
        className: `pointer-events-none break-words text-[12.5px] font-semibold leading-[17px] text-ink ${media ? "mt-2.5 truncate" : "mt-4 line-clamp-2"}`,
        title: entry.title,
      },
      entry.title,
    ),
    h(
      "p",
      { className: "pointer-events-none mt-1 truncate text-[11px] text-muted" },
      media ? `${subtitleOf(entry)} · ${formatDate(entry.createdAt)}` : subtitleOf(entry),
    ),
    h(
      "span",
      { className: "pointer-events-none mt-auto max-w-full self-start truncate rounded-full border border-[#E1E4E8] px-2 py-0.5 text-[10px] font-semibold text-muted" },
      productName,
    ),
  );
}

/** Downloads a data item's stored bytes (or its text, for a note) as a real file, using whatever the editors
 * already read — no separate backend download route. */
async function downloadDataItem(id: string, fallbackName: string) {
  const item = await api.dataItem({ id });
  const blob = item.dataUrl ? await (await fetch(item.dataUrl)).blob() : new Blob([item.text ?? ""], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = item.filename ?? `${item.label || fallbackName}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** A name for one item, in a small dialog — used for Rename. */
function RenameDialog({ initialName, onCancel, onSubmit }: { initialName: string; onCancel: () => void; onSubmit: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => inputRef.current?.select(), []);
  return h(
    Modal,
    {
      open: true,
      onClose: onCancel,
      size: "md",
      title: "Rename",
      footer: h(
        "form",
        {
          className: "flex w-full items-center justify-end gap-2",
          onSubmit: (event: React.FormEvent) => {
            event.preventDefault();
            const clean = name.trim();
            if (!clean || busy) return;
            setBusy(true);
            onSubmit(clean);
          },
        },
        h("button", { type: "button", onClick: onCancel, className: "inline-flex h-9 items-center rounded-md px-3.5 text-xs font-semibold text-muted hover:bg-[#F6F7F9] hover:text-ink" }, "Cancel"),
        h(
          "button",
          { type: "submit", disabled: !name.trim() || busy, className: "inline-flex h-9 items-center rounded-md bg-ink px-3.5 text-xs font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40" },
          busy ? "Renaming…" : "Rename",
        ),
      ),
    },
    h(
      "div",
      { className: "p-5" },
      h("label", { htmlFor: "rename-item", className: "sr-only" }, "Name"),
      h("input", {
        id: "rename-item",
        ref: inputRef,
        value: name,
        autoFocus: true,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
        className: "h-10 w-full rounded-md border border-[#DDE0E4] bg-white px-3 text-sm text-ink outline-none focus:border-lineage focus:ring-2 focus:ring-lineage/20",
      }),
    ),
  );
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "size", label: "Largest first" },
];

export function DataSection() {
  const products = useAppStore((state) => state.products);
  const [sources, setSources] = useState<StoredProductSource[]>([]);
  const [imports, setImports] = useState<CsvImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");
  const [product, setProduct] = useState(ALL);
  const [sort, setSort] = useState("newest");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CsvImportRecord | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<DataEntry | null>(null);
  const [deleting, setDeleting] = useState<DataEntry | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextSources, nextImports] = await Promise.all([api.productSources(), api.csvImports({ limit: 50 }).catch(() => [] as CsvImportRecord[])]);
    setSources(nextSources);
    setImports(nextImports);
  }, []);

  async function renameEntry(entry: DataEntry, label: string) {
    try {
      await api.renameDataItem({ id: entry.key, label });
      setRenaming(null);
      await refresh();
    } catch (failure) {
      setItemError(failure instanceof Error ? failure.message : "Could not rename that item.");
      setRenaming(null);
    }
  }

  async function duplicateEntry(entry: DataEntry) {
    setItemError(null);
    try {
      await api.duplicateDataItem({ id: entry.key });
      await refresh();
    } catch (failure) {
      setItemError(failure instanceof Error ? failure.message : "Could not duplicate that item.");
    }
  }

  async function downloadEntry(entry: DataEntry) {
    setItemError(null);
    try {
      await downloadDataItem(entry.key, entry.title);
    } catch (failure) {
      setItemError(failure instanceof Error ? failure.message : "Could not download that item.");
    }
  }

  async function deleteEntry(entry: DataEntry) {
    try {
      await api.deleteDataItem({ id: entry.key });
      setSources((current) => current.filter((item) => item.id !== entry.key));
      setOpenKey((current) => (current === entry.key ? null : current));
    } catch (failure) {
      setItemError(failure instanceof Error ? failure.message : "Could not delete that item.");
    } finally {
      setDeleting(null);
    }
  }

  function menuActionsFor(entry: DataEntry): ItemMenuAction[] {
    if (entry.record) {
      return [
        { key: "edit", label: "View", icon: SquarePen, onSelect: () => setOpenKey(entry.key) },
        { key: "delete", label: "Delete", icon: Trash2, danger: true, onSelect: () => setRemoving(entry.record!) },
      ];
    }
    const actions: ItemMenuAction[] = [
      { key: "edit", label: "Edit", icon: SquarePen, onSelect: () => setOpenKey(entry.key) },
      { key: "rename", label: "Rename", icon: Pencil, onSelect: () => setRenaming(entry) },
      { key: "duplicate", label: "Duplicate", icon: Copy, onSelect: () => void duplicateEntry(entry) },
    ];
    if (entry.kind !== "link") actions.push({ key: "download", label: "Download", icon: Download, onSelect: () => void downloadEntry(entry) });
    actions.push({ key: "delete", label: "Delete", icon: Trash2, danger: true, onSelect: () => setDeleting(entry) });
    return actions;
  }

  useEffect(() => {
    let active = true;
    void refresh()
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refresh]);

  async function removeImport(record: CsvImportRecord) {
    setRemoveError(null);
    try {
      await api.deleteCsvImport({ id: record.id });
      setImports((current) => current.filter((item) => item.id !== record.id));
      setOpenKey(null);
    } catch (failure) {
      setRemoveError(failure instanceof Error ? failure.message : "Could not remove that import.");
    } finally {
      setRemoving(null);
    }
  }

  const productNames = useMemo(() => new Map(products.map((item) => [item.id, item.name])), [products]);
  const nameFor = (entry: DataEntry) =>
    entry.record ? entry.record.products.join(", ") || "No product" : entry.productIds[0] ? (productNames.get(entry.productIds[0]) ?? "Unknown product") : "Not attached";

  const entries = useMemo(() => [...sources.map(sourceEntry), ...imports.map(importEntry)], [sources, imports]);
  const byProduct = entries.filter((entry) =>
    product === ALL ? true : product === UNATTACHED ? entry.productIds.length === 0 && !entry.record : entry.productIds.includes(product),
  );

  const productOptions = useMemo(() => {
    const attached = new Set(entries.flatMap((entry) => entry.productIds));
    return [
      { value: ALL, label: "All products" },
      ...products.filter((item) => attached.has(item.id)).map((item) => ({ value: item.id, label: item.name })),
      ...(entries.some((entry) => !entry.productIds.length && !entry.record) ? [{ value: UNATTACHED, label: "Not attached" }] : []),
    ];
  }, [entries, products]);

  const chips = [
    { value: "all", label: "All", count: byProduct.length },
    ...KIND_ORDER.filter((kind) => byProduct.some((entry) => entry.kind === kind)).map((kind) => ({
      value: kind,
      label: KIND_META[kind].plural,
      count: byProduct.filter((entry) => entry.kind === kind).length,
    })),
  ];

  const visible = useMemo(() => {
    const filtered = byProduct.filter(
      (entry) =>
        (chip === "all" || entry.kind === chip) &&
        matchesSearch(search, [entry.title, entry.source?.filename, entry.source?.url, entry.source?.text, KIND_META[entry.kind].label, nameFor(entry)]),
    );
    return [...filtered].sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : sort === "size"
          ? (b.bytes ?? 0) - (a.bytes ?? 0)
          : sort === "oldest"
            ? a.createdAt.localeCompare(b.createdAt)
            : b.createdAt.localeCompare(a.createdAt),
    );
    // nameFor reads productNames, which is derived from products
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byProduct, chip, search, sort, productNames]);

  const storedTotal = byProduct.reduce((sum, entry) => sum + (entry.source?.storedBytes ?? 0), 0);
  const repeatBytes = byProduct
    .filter((entry) => entry.source?.type === "file" && (entry.source?.copies ?? 1) > 1)
    .reduce((sum, entry) => sum + (entry.source!.storedBytes * ((entry.source!.copies - 1) / entry.source!.copies)), 0);

  const drop = useDataDrop({
    // New items join the product the library is filtered to, so they don't vanish from view on arrival.
    productId: product !== ALL && product !== UNATTACHED ? product : null,
    onAdded: () => {
      setChip("all");
      setSearch("");
      setSort("newest");
      void refresh().catch(() => undefined);
    },
  });

  const open = entries.find((entry) => entry.key === openKey) ?? null;
  const close = () => setOpenKey(null);
  const onSaved = () => void refresh().catch(() => undefined);

  const editor = !open
    ? null
    : open.record
      ? h(CsvImportTableModal, { record: open.record, onClose: close, onRemove: () => setRemoving(open.record!) })
      : open.kind === "link"
        ? h(LinkTrustModal, { url: open.source?.url ?? "", label: open.title, onClose: close })
        : open.kind === "table"
          ? h(TableEditorModal, { id: open.key, onClose: close, onSaved })
          : open.kind === "image"
            ? h(ImageEditorModal, { id: open.key, onClose: close, onSaved })
            : open.kind === "audio" || open.kind === "video"
              ? h(MediaEditorModal, { id: open.key, onClose: close, onSaved })
              : h(TextEditorModal, { id: open.key, onClose: close, onSaved });

  return h(
    "section",
    { className: "flex h-full min-h-[480px] flex-col gap-4 px-5 py-6 sm:px-8 lg:px-10", "aria-labelledby": "data-settings-title", ...drop.dropHandlers },
    h(LibraryHeader, {
      eyebrow: "Data",
      title: "Your data",
      description: "Everything you've given Prism — product material and Performance imports. Open an item to read, edit, or play it.",
      aside: h(
        "p",
        {
          id: "data-settings-title",
          className: "text-xs text-muted",
          title: repeatBytes > 0 ? `Re-uploading the same file stores it again: about ${formatBytes(Math.round(repeatBytes))} here is identical repeats.` : undefined,
        },
        loading ? "Loading…" : `${byProduct.length} item${byProduct.length === 1 ? "" : "s"} · ${formatBytes(storedTotal) ?? "0 B"} stored${repeatBytes > 0 ? ` · ${formatBytes(Math.round(repeatBytes))} repeats` : ""}`,
      ),
    }),
    h(LibraryToolbar, {
      search,
      onSearch: setSearch,
      searchPlaceholder: "Search files, notes, links",
      chips,
      chip,
      onChip: setChip,
      sortOptions: SORT_OPTIONS,
      sort,
      onSort: setSort,
      extra:
        productOptions.length > 2
          ? h(Select, {
              ariaLabel: "Filter by product",
              value: product,
              onChange: (value: string) => {
                setProduct(value);
                setChip("all");
              },
              options: productOptions,
              align: "right",
              className: "h-8 max-w-[200px] rounded-full border border-[#DDE0E4] bg-white pl-3 pr-8 text-[11px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
            })
          : null,
    }),
    h(
      DataDropZone,
      { dragging: drop.dragging, busy: drop.busy, progress: drop.progress, onFiles: drop.addFiles },
      drop.errors.length
        ? h(
            "div",
            { role: "alert", className: "mb-3 flex shrink-0 items-start justify-between gap-3 text-xs", style: { color: "var(--status-error)" } },
            h("p", { className: "min-w-0" }, drop.errors.join(" ")),
            h("button", { type: "button", onClick: drop.clearErrors, className: "shrink-0 font-semibold underline-offset-2 hover:underline" }, "Dismiss"),
          )
        : null,
      loading
        ? h("div", { role: "status", className: "grid flex-1 place-items-center text-sm text-muted" }, "Loading your data…")
        : error
          ? h("div", { role: "alert", className: "grid flex-1 place-items-center text-sm", style: { color: "var(--status-error)" } }, "Couldn't load your data. Try again in a moment.")
          : h(PagedLibrary<DataEntry>, {
              items: visible,
              getKey: (entry) => entry.key,
              renderTile: (entry) =>
                h(
                  "div",
                  { className: "group/tile relative h-full" },
                  h(DataTile, { entry, productName: nameFor(entry), onOpen: () => setOpenKey(entry.key) }),
                  h(
                    "div",
                    {
                      className:
                        "absolute right-2 top-2 z-20 opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 [@media(hover:none)]:opacity-100",
                    },
                    h(ItemMenu, { actions: menuActionsFor(entry), label: `More actions for ${entry.title}` }),
                  ),
                ),
              tileMinWidth: 176,
              tileHeight: 188,
            // The box holds two rows of full-size cards, no more: the cards keep their size, the box is what fits.
            fixedRows: 2,
              gap: 14,
              resetKey: `${chip}|${search}|${sort}|${product}`,
              empty: entries.length
                ? search
                  ? `Nothing matches “${search}”.`
                  : "Nothing here with these filters."
                : "Nothing here yet. Drop files anywhere in this box, or add material when creating a product — CSV files you import in Performance appear here too.",
            }),
    ),
    removeError ? h("p", { role: "alert", className: "shrink-0 text-xs", style: { color: "var(--status-error)" } }, removeError) : null,
    itemError ? h("p", { role: "alert", className: "shrink-0 text-xs", style: { color: "var(--status-error)" } }, itemError) : null,
    editor,
    renaming ? h(RenameDialog, { initialName: renaming.title, onCancel: () => setRenaming(null), onSubmit: (name: string) => void renameEntry(renaming, name) }) : null,
    h(ConfirmationDialog, {
      open: Boolean(deleting),
      title: "Delete this item?",
      description: deleting ? `“${deleting.title}” is removed for good. This can't be undone.` : "",
      confirmLabel: "Delete",
      onCancel: () => setDeleting(null),
      onConfirm: () => (deleting ? void deleteEntry(deleting) : undefined),
    }),
    h(ConfirmationDialog, {
      open: Boolean(removing),
      title: "Remove this import?",
      description: removing
        ? `It removes the rows that ${removing.fileName} still provides to Performance. Rows a newer import replaced stay with that import. The file itself is not stored, so you would import it again to bring it back.`
        : "",
      confirmLabel: "Remove import",
      onCancel: () => setRemoving(null),
      onConfirm: () => (removing ? void removeImport(removing) : undefined),
    }),
  );
}
