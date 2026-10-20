import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { columnName, detectDelimiter, parseDelimited, readXlsxFirstSheet, serializeDelimited } from "./grid-format";

describe("grid-format", () => {
  it("parses quoted fields with delimiters, quotes and line breaks", () => {
    const text = 'name,note\n"Acme, box","says ""hi""\nsecond line"\nplain,x';
    expect(parseDelimited(text)).toEqual([
      ["name", "note"],
      ["Acme, box", 'says "hi"\nsecond line'],
      ["plain", "x"],
    ]);
  });

  it("round-trips through serialize", () => {
    const grid = [["a", "b,c"], ['q"t', " lead"], ["", "last"]];
    expect(parseDelimited(serializeDelimited(grid))).toEqual(grid);
  });

  it("pads ragged rows and handles CRLF and a BOM", () => {
    expect(parseDelimited("﻿a,b,c\r\n1\r\n")).toEqual([
      ["a", "b", "c"],
      ["1", "", ""],
    ]);
  });

  it("detects tabs and semicolons", () => {
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a,b\n1,2")).toBe(",");
  });

  it("names columns like a spreadsheet", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("reads the first sheet of an xlsx, including gaps and shared strings", () => {
    const workbook = zipSync({
      "xl/workbook.xml": strToU8('<workbook xmlns:r="r"><sheets><sheet name="S" r:id="rId1"/></sheets></workbook>'),
      "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
      "xl/sharedStrings.xml": strToU8("<sst><si><t>Ad</t></si><si><t>Spend</t></si></sst>"),
      "xl/worksheets/sheet1.xml": strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Hook</t></is></c><c r="C3"><v>12.5</v></c></row></sheetData></worksheet>',
      ),
    });
    expect(readXlsxFirstSheet(workbook)).toEqual([
      ["Ad", "", "Spend"],
      ["", "", ""],
      ["Hook", "", "12.5"],
    ]);
  });
});
