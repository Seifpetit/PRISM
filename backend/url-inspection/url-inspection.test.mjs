import assert from "node:assert/strict";
import test from "node:test";
import { inspectProductUrl } from "./inspect-product-url.mjs";
import { FetchStatus } from "./types.mjs";
import { htmlFixtures, pageForFixture } from "./fixtures.mjs";
import { inspectFetchedPage } from "./inspect-product-url.mjs";

for (const fixture of htmlFixtures) {
  test(fixture.name, () => {
    const result = inspectFetchedPage(pageForFixture(fixture));
    assert.equal(result.fetch.status, FetchStatus.SUCCESS);
    assert.equal(result.classification, fixture.expected);
    if (fixture.expectedListingScope) {
      assert.equal(result.listingScope, fixture.expectedListingScope);
    }
    assert.equal(result.classificationPolicyVersion, "page-classifier-v1");
  });
}

test("unreachable 403 URL is not classified as UNKNOWN", async () => {
  const result = await inspectProductUrl("https://blocked.example/products/pillow", {
    resolveHostname: async () => [{ address: "93.184.216.34" }],
    fetchImpl: async () => new Response("Blocked", { status: 403 }),
  });
  assert.equal(result.fetch.status, FetchStatus.UNREACHABLE);
  assert.equal(result.fetch.failureReason, "BLOCKED");
  assert.equal(result.classification, null);
});

test("rendered DOM can replace an otherwise unknown static inspection", async () => {
  const staticFixture = htmlFixtures.find((fixture) => fixture.name === "brand about page");
  const productFixture = htmlFixtures.find(
    (fixture) => fixture.name === "clear Shopify-like product page",
  );
  const staticPage = pageForFixture(staticFixture);
  const result = await inspectProductUrl(staticPage.requestedUrl, {
    resolveHostname: async () => [{ address: "93.184.216.34" }],
    fetchImpl: async () =>
      new Response(staticPage.html, {
        headers: { "content-type": staticPage.contentType },
      }),
    renderPage: async (page) => ({
      ...page,
      html: productFixture.html,
      renderMode: "RENDERED_DOM",
    }),
  });
  assert.equal(result.classification, "PRODUCT");
  assert.equal(result.fetch.renderMode, "RENDERED_DOM");
});

test("application JSON state contributes deterministic purchase evidence", () => {
  const fixture = htmlFixtures.find(
    (item) => item.name === "rendered single-product landing page without structured data",
  );
  const result = inspectFetchedPage(pageForFixture(fixture));
  assert.equal(result.classification, "PRODUCT");
  assert.equal(result.signals.hasPurchaseAction, true);
  assert.ok(result.evidence.applicationStateTextLength > 0);
});

test("dominant hero product remains materially more dominant than a collection", () => {
  const hero = inspectFetchedPage(pageForFixture(htmlFixtures.at(-1)));
  const collectionFixture = htmlFixtures.find(
    (fixture) => fixture.name === "collection page with 12 products",
  );
  const collection = inspectFetchedPage(pageForFixture(collectionFixture));
  assert.ok(hero.signals.dominantProductScore >= 0.75);
  assert.ok(collection.signals.dominantProductScore < 0.5);
});
