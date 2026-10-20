import { strFromU8, unzipSync } from "fflate";

// Plain-text tables in and out of the spreadsheet editor, and the first sheet of an .xlsx read into the same shape.
// No formulas: a cell is its text.

export type Grid = string[][];

/** Tab if the first line has tabs, else semicolon when it outnumbers commas, else comma. */
export function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? undefined : text.indexOf("\n"));
  if (firstLine.includes("\t")) return "\t";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

/** RFC 4180-style: quoted fields may hold the delimiter, line breaks and doubled quotes. */
export function parseDelimited(text: string, delimiter = detectDelimiter(text)): Grid {
  const rows: Grid = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const width = rows.reduce((max, current) => Math.max(max, current.length), 0);
  return rows.map((current) => (current.length < width ? [...current, ...Array(width - current.length).fill("")] : current));
}

export function serializeDelimited(grid: Grid, delimiter = ","): string {
  const needsQuotes = (value: string) => value.includes(delimiter) || value.includes('"') || value.includes("\n") || value.includes("\r") || /^\s|\s$/.test(value);
  return grid
    .map((row) => row.map((value) => (needsQuotes(value) ? `"${value.replace(/"/g, '""')}"` : value)).join(delimiter))
    .join("\n");
}

/** "A", "B", … "Z", "AA", … — spreadsheet column names. */
export function columnName(index: number): string {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? "A";
  return [...letters].reduce((total, letter) => total * 26 + (letter.charCodeAt(0) - 64), 0) - 1;
}

/** The first worksheet of an .xlsx as text cells. Shared strings, inline strings and plain values; no formulas. */
export function readXlsxFirstSheet(bytes: Uint8Array): Grid {
  const files = unzipSync(bytes);
  const parser = new DOMParser();
  const xml = (path: string) => (files[path] ? parser.parseFromString(strFromU8(files[path]), "application/xml") : null);

  const shared = xml("xl/sharedStrings.xml");
  const strings = shared ? [...shared.getElementsByTagName("si")].map((item) => [...item.getElementsByTagName("t")].map((node) => node.textContent ?? "").join("")) : [];

  const workbook = xml("xl/workbook.xml");
  const relations = xml("xl/_rels/workbook.xml.rels");
  const firstSheetRelation = workbook?.getElementsByTagName("sheet")[0]?.getAttribute("r:id");
  const target = firstSheetRelation
    ? [...(relations?.getElementsByTagName("Relationship") ?? [])].find((relation) => relation.getAttribute("Id") === firstSheetRelation)?.getAttribute("Target")
    : null;
  const sheetPath = target ? `xl/${target.replace(/^\/?xl\//, "")}` : "xl/worksheets/sheet1.xml";
  const sheet = xml(sheetPath) ?? xml("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("This workbook has no readable sheet.");

  const grid: Grid = [];
  for (const rowNode of [...sheet.getElementsByTagName("row")]) {
    const rowIndex = Number(rowNode.getAttribute("r") ?? grid.length + 1) - 1;
    const cells: string[] = [];
    for (const cell of [...rowNode.getElementsByTagName("c")]) {
      const column = columnIndex(cell.getAttribute("r") ?? columnName(cells.length));
      const type = cell.getAttribute("t");
      const raw = cell.getElementsByTagName("v")[0]?.textContent ?? "";
      const value =
        type === "s" ? (strings[Number(raw)] ?? "") : type === "inlineStr" ? [...cell.getElementsByTagName("t")].map((node) => node.textContent ?? "").join("") : raw;
      while (cells.length < column) cells.push("");
      cells[column] = value;
    }
    while (grid.length < rowIndex) grid.push([]);
    grid[rowIndex] = cells;
  }
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  return grid.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
}
