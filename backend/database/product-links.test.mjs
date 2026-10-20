import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function withFixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-links-"));
  const previous = {
    DATABASE_PATH: process.env.DATABASE_PATH,
    INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
    NODE_ENV: process.env.NODE_ENV,
    SHOPIFY_SHOP_DOMAIN: process.env.SHOPIFY_SHOP_DOMAIN,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
  };
  delete process.env.SHOPIFY_SHOP_DOMAIN;
  delete process.env.SHOPIFY_ACCESS_TOKEN;
  process.env.DATABASE_PATH = path.join(directory, "prism.db");
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const client = await import("./client.mjs");
  const auth = await import("./auth-repository.mjs");
  const data = await import("./workspace-data-repository.mjs");
  const connections = await import("./integration-connections-repository.mjs");
  const links = await import("./product-links-repository.mjs");
  try {
    const alpha = (await auth.signInWithoutPassword({ displayName: "A", email: "a@example.com" })).workspace.id;
    const beta = (await auth.signInWithoutPassword({ displayName: "B", email: "b@example.com" })).workspace.id;
    const product = await data.createWorkspaceProduct(alpha, { brandId: "brand-a", name: "Acme", description: "d" });
    await run({ client, data, connections, links, alpha, beta, product });
  } finally {
    await client.closeDatabasePool();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
}

test("product links are per workspace, replace on re-link, and follow the product's lifecycle", async () => {
  await withFixture(async ({ client, data, links, alpha, beta, product }) => {
    const first = links.saveProductLink(alpha, {
      productId: product.id,
      provider: "shopify",
      externalAccountId: "a.myshopify.com",
      externalId: "gid://shopify/Product/1",
      externalTitle: "Acme Plug",
    });
    assert.equal(first.title, "Acme Plug");
    assert.equal(first.storeDomain, "a.myshopify.com");

    links.saveProductLink(alpha, {
      productId: product.id,
      provider: "shopify",
      externalAccountId: "a.myshopify.com",
      externalId: "gid://shopify/Product/2",
      externalTitle: "Acme Plug v2",
    });
    const rows = client.getDatabasePool().query("select count(*) n from product_external_links").rows[0].n;
    assert.equal(rows, 1, "linking again replaces the link");
    assert.equal(links.getProductLink(alpha, product.id, "shopify").externalId, "gid://shopify/Product/2");

    assert.equal(links.getProductLink(beta, product.id, "shopify"), null, "another workspace can't see it");
    assert.equal(links.deleteProductLink(beta, product.id, "shopify"), false, "or remove it");
    assert.throws(
      () =>
        links.saveProductLink(beta, {
          productId: product.id,
          provider: "shopify",
          externalAccountId: "b.myshopify.com",
          externalId: "gid://shopify/Product/9",
          externalTitle: "Not mine",
        }),
      /FOREIGN KEY/i,
      "a workspace can't link a product it doesn't own",
    );

    client.getDatabasePool().query("delete from products where id = $1", [product.id]);
    assert.equal(
      client.getDatabasePool().query("select count(*) n from product_external_links").rows[0].n,
      0,
      "deleting the PRISM product removes its link",
    );
    assert.ok(data);
  });
});

test("Shopify product search is sanitised, capped, and mapped", async () => {
  await withFixture(async ({ connections, alpha }) => {
    const shopify = await import("../integrations/shopify.mjs");
    connections.saveIntegrationConnection(alpha, {
      provider: "shopify",
      externalAccountId: "a.myshopify.com",
      accessToken: "shpat_a",
    });

    const realFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      requests.push({ url: String(url), token: init.headers["X-Shopify-Access-Token"], variables: body.variables });
      if (body.query.includes("product(id:")) {
        return {
          ok: true,
          json: async () => ({
            data: { product: body.variables.id.endsWith("/404") ? null : { id: body.variables.id, title: "Found", handle: "found", status: "ACTIVE", featuredMedia: null } },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            products: {
              nodes: [
                { id: "gid://shopify/Product/1", title: "Acme Plug", handle: "acme-plug", status: "ACTIVE", featuredMedia: { preview: { image: { url: "https://cdn/x.png" } } } },
                { id: "gid://shopify/Product/2", title: "Other", handle: "other", status: "DRAFT", featuredMedia: null },
              ],
            },
          },
        }),
      };
    };
    try {
      const products = await shopify.fetchShopifyProducts(alpha, { search: "volt ix" });
      assert.deepEqual(products[0], {
        id: "gid://shopify/Product/1",
        title: "Acme Plug",
        handle: "acme-plug",
        status: "ACTIVE",
        imageUrl: "https://cdn/x.png",
      });
      assert.equal(products[1].imageUrl, null);
      assert.equal(requests[0].token, "shpat_a", "uses the workspace's own token");
      assert.match(requests[0].url, /^https:\/\/a\.myshopify\.com\//);
      assert.equal(requests[0].variables.query, "title:*volt* title:*ix*");

      await shopify.fetchShopifyProducts(alpha, { search: 'x" OR status:active' });
      assert.equal(
        requests[1].variables.query,
        "title:*x* title:*OR* title:*status* title:*active*",
        "quotes and colons can't inject search operators",
      );
      await shopify.fetchShopifyProducts(alpha, { search: "   " });
      assert.equal(requests[2].variables.query, null, "blank search means no filter");
      await shopify.fetchShopifyProducts(alpha, { limit: 5000 });
      assert.equal(requests[3].variables.first, 50, "page size is capped");

      assert.equal((await shopify.fetchShopifyProduct(alpha, "gid://shopify/Product/7")).title, "Found");
      assert.equal(await shopify.fetchShopifyProduct(alpha, "gid://shopify/Product/404"), null);
      await assert.rejects(() => shopify.fetchShopifyProduct(alpha, "1; drop"), /isn't a Shopify product id/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
