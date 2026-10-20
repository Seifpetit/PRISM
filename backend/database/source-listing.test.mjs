import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("source listing returns metadata only, flags duplicate files, and stays workspace-scoped", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-sources-"));
  const previousPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(directory, "prism.db");
  const client = await import("./client.mjs");
  const auth = await import("./auth-repository.mjs");
  const data = await import("./workspace-data-repository.mjs");

  try {
    const alpha = (await auth.signInWithoutPassword({ displayName: "A", email: "a@example.com" })).workspace.id;
    const beta = (await auth.signInWithoutPassword({ displayName: "B", email: "b@example.com" })).workspace.id;
    const product = await data.createWorkspaceProduct(alpha, {
      brandId: "brand-a",
      name: "Alpha Product",
      description: "Owned by alpha.",
    });

    const payload = Buffer.from("x".repeat(3_000)).toString("base64");
    const file = (id) => ({
      id,
      type: "file",
      label: "Product document",
      filename: "brief.md",
      mimeType: "text/markdown",
      status: "ready",
      value: JSON.stringify({ version: 1, kind: "document", data: payload }),
    });
    data.persistProductSources(alpha, [file("f1"), file("f2")], product.id);
    data.persistProductSources(alpha, [
      { id: "t1", type: "text", label: "Note", value: "Sold mostly to night-shift workers.", status: "ready" },
      { id: "u1", type: "url", label: "Product page", value: "https://example.com/p", status: "ready" },
    ]);

    const listed = data.listWorkspaceSources(alpha);
    assert.equal(listed.length, 4);
    assert.equal(JSON.stringify(listed).includes(payload), false, "file contents must never be returned");

    const f1 = listed.find((entry) => entry.id === "f1");
    assert.equal(f1.copies, 2, "identical uploads are counted as copies");
    assert.equal(f1.sizeBytes, 3_000, "size is the decoded file size, not the base64 size");
    assert.ok(f1.storedBytes > f1.sizeBytes, "stored size includes base64 overhead");
    assert.equal(f1.productId, product.id);
    assert.equal(f1.text, null);

    const text = listed.find((entry) => entry.id === "t1");
    assert.equal(text.text, "Sold mostly to night-shift workers.");
    assert.equal(text.productId, null, "sources not yet attached to a product report null");
    assert.equal(listed.find((entry) => entry.id === "u1").url, "https://example.com/p");
    assert.match(f1.createdAt, /^\d{4}-\d{2}-\d{2}T[\d:]+Z$/);

    assert.equal(data.listWorkspaceSources(beta).length, 0, "another workspace sees nothing");
  } finally {
    await client.closeDatabasePool();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});
