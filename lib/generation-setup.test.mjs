import assert from "node:assert/strict";
import test from "node:test";
import { contextRequest, fileKindOf, fileProblem, MAX_SOURCES, setupSummary, toggled, usableSelection } from "./generation-setup.ts";

const source = (id, status = "ready") => ({ id, status });

test("nothing chosen sends nothing, so a generation with no extra context is the request it always was", () => {
  assert.equal(contextRequest([], ""), undefined);
  assert.equal(contextRequest([], "   \n "), undefined);
});

test("chosen sources and trimmed instructions are sent; instructions can go without sources and the reverse", () => {
  assert.deepEqual(contextRequest(["a", "b"], "  Focus on Madrid.\r\n"), { sourceIds: ["a", "b"], instructions: "Focus on Madrid." });
  assert.deepEqual(contextRequest(["a"], ""), { sourceIds: ["a"] });
  assert.deepEqual(contextRequest([], "Only this"), { sourceIds: [], instructions: "Only this" });
});

test("a saved selection is cleaned against the library: deleted, failed and unprocessed sources drop out", () => {
  const library = [source("a"), source("b", "failed"), source("c", "processing"), source("d")];
  assert.deepEqual(usableSelection(["a", "b", "c", "d", "gone", "a"], library), ["a", "d"]);
  assert.deepEqual(usableSelection([], library), []);
});

test("toggling selects and deselects, and the selection is capped at what one generation can take", () => {
  assert.deepEqual(toggled(["a"], "b"), ["a", "b"]);
  assert.deepEqual(toggled(["a", "b"], "a"), ["b"]);
  const full = Array.from({ length: MAX_SOURCES }, (_, i) => `s${i}`);
  assert.deepEqual(toggled(full, "extra"), full, "a ninth source is not added");
  assert.equal(toggled(full, "s0").length, MAX_SOURCES - 1, "but one can always be removed");
});

test("the footer says exactly what the run will use", () => {
  assert.equal(setupSummary(0, false), "Product Context");
  assert.equal(setupSummary(1, false), "Product Context + 1 source");
  assert.equal(setupSummary(3, true), "Product Context + 3 sources + run instructions");
});

test("only PDF, TXT, Markdown and CSV are offered, and a file's problem is named before it is sent", () => {
  assert.deepEqual(["a.PDF", "b.csv", "c.md", "d.txt", "e.docx", "f"].map(fileKindOf), ["pdf", "csv", "text", "text", null, null]);
  assert.match(fileProblem({ name: "deck.pptx", size: 10 }), /PDF, TXT, Markdown or CSV/);
  assert.match(fileProblem({ name: "big.pdf", size: 11 * 1024 * 1024 }), /over 10 MB/);
  assert.match(fileProblem({ name: "big.csv", size: 6 * 1024 * 1024 }), /over 5 MB/);
  assert.match(fileProblem({ name: "empty.txt", size: 0 }), /is empty/);
  assert.equal(fileProblem({ name: "ok.pdf", size: 1000 }), null);
});
