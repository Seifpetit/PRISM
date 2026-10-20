import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ENV_KEYS = [
  "DATABASE_PATH",
  "INTEGRATION_ENCRYPTION_KEY",
  "SHOPIFY_APP_CLIENT_ID",
  "SHOPIFY_APP_CLIENT_SECRET",
  "SHOPIFY_OAUTH_REDIRECT_BASE",
  "SHOPIFY_SHOP_DOMAIN",
  "SHOPIFY_ACCESS_TOKEN",
  "META_ADS_ACCESS_TOKEN",
  "META_APP_ID",
  "META_APP_SECRET",
  "META_OAUTH_REDIRECT_BASE",
  "META_OAUTH_SCOPES",
  "META_LOGIN_CONFIG_ID",
  "NODE_ENV",
];

async function withFixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-integrations-"));
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.DATABASE_PATH = path.join(directory, "prism.db");
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const client = await import("./client.mjs");
  const auth = await import("./auth-repository.mjs");
  const repository = await import("./integration-connections-repository.mjs");
  try {
    const alpha = await auth.signInWithoutPassword({ displayName: "Alpha", email: "alpha@example.com" });
    const beta = await auth.signInWithoutPassword({ displayName: "Beta", email: "beta@example.com" });
    await run({ client, repository, alpha: alpha.workspace.id, beta: beta.workspace.id });
  } finally {
    await client.closeDatabasePool();
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    await rm(directory, { recursive: true, force: true });
  }
}

test("integration connections are workspace-scoped and tokens are encrypted at rest", async () => {
  await withFixture(async ({ client, repository, alpha, beta }) => {
    const saved = repository.saveIntegrationConnection(alpha, {
      provider: "shopify",
      externalAccountId: "alpha-store.myshopify.com",
      label: "Alpha Store",
      accessToken: "shpat_alpha_secret",
      scopes: "read_products",
    });
    assert.equal("accessToken" in saved, false, "metadata reads must not expose the token");
    assert.equal(
      repository.getIntegrationCredentials(alpha, "shopify").accessToken,
      "shpat_alpha_secret",
    );

    const raw = client
      .getDatabasePool()
      .query("select access_token_encrypted from integration_connections")
      .rows[0].access_token_encrypted;
    assert.ok(!raw.includes("shpat_alpha_secret"), "plaintext token must never be stored");

    assert.equal(repository.getIntegrationConnection(beta, "shopify"), null);
    assert.equal(repository.getIntegrationCredentials(beta, "shopify"), null);
    assert.equal(repository.listIntegrationConnections(beta).length, 0);
    assert.equal(
      repository.deleteIntegrationConnection(beta, "shopify", "alpha-store.myshopify.com"),
      false,
    );

    // Reconnecting the same store refreshes the token instead of adding a row.
    repository.saveIntegrationConnection(alpha, {
      provider: "shopify",
      externalAccountId: "alpha-store.myshopify.com",
      accessToken: "shpat_alpha_rotated",
    });
    assert.equal(repository.listIntegrationConnections(alpha, "shopify").length, 1);
    assert.equal(
      repository.getIntegrationCredentials(alpha, "shopify").accessToken,
      "shpat_alpha_rotated",
    );
  });
});

test("saving a token without an encryption key is refused", async () => {
  await withFixture(async ({ repository, alpha }) => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    assert.throws(
      () =>
        repository.saveIntegrationConnection(alpha, {
          provider: "shopify",
          externalAccountId: "a.myshopify.com",
          accessToken: "shpat_x",
        }),
      /INTEGRATION_ENCRYPTION_KEY/,
    );
    assert.equal(repository.listIntegrationConnections(alpha).length, 0);
  });
});

test("Shopify config prefers the workspace connection; env fallback is dev-only", async () => {
  await withFixture(async ({ repository, alpha, beta }) => {
    const { resolveShopifyConfig } = await import("../integrations/shopify.mjs");
    process.env.SHOPIFY_SHOP_DOMAIN = "dev-store.myshopify.com";
    process.env.SHOPIFY_ACCESS_TOKEN = "shpat_env";
    repository.saveIntegrationConnection(alpha, {
      provider: "shopify",
      externalAccountId: "alpha-store.myshopify.com",
      accessToken: "shpat_alpha",
    });

    assert.deepEqual(resolveShopifyConfig(alpha), {
      domain: "alpha-store.myshopify.com",
      token: "shpat_alpha",
      source: "workspace",
    });
    assert.equal(resolveShopifyConfig(beta).source, "env");

    process.env.NODE_ENV = "production";
    assert.equal(resolveShopifyConfig(beta), null, "production must not fall back to the env store");
    assert.equal(resolveShopifyConfig(alpha).source, "workspace");
  });
});

test("Shopify OAuth binds state to the workspace, verifies the signature, and stores the token", async () => {
  await withFixture(async ({ repository, alpha, beta }) => {
    process.env.SHOPIFY_APP_CLIENT_ID = "client-id";
    process.env.SHOPIFY_APP_CLIENT_SECRET = "client-secret";
    process.env.SHOPIFY_OAUTH_REDIRECT_BASE = "https://tunnel.example";
    const oauth = await import("../integrations/shopify-oauth.mjs");

    assert.equal(oauth.normalizeShopDomain(" Alpha-Store.myshopify.com "), "alpha-store.myshopify.com");
    assert.equal(oauth.normalizeShopDomain("evil.com/x.myshopify.com"), null);
    assert.equal(oauth.normalizeShopDomain("alpha.myshopify.com.evil.com"), null);
    assert.throws(() => oauth.startShopifyInstall({ workspaceId: alpha, shop: "evil.com" }), /valid store domain/);

    const sign = (params) => {
      const message = Object.entries(params)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, value]) => `${key}=${value}`)
        .join("&");
      const hmac = createHmac("sha256", "client-secret").update(message).digest("hex");
      return new URLSearchParams({ ...params, hmac });
    };
    const call = async (query) => {
      const res = { status: null, body: "", writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
      await oauth.handleShopifyCallback({ url: `/shopify/callback?${query}` }, res);
      return res;
    };
    const realFetch = globalThis.fetch;
    let exchanges = 0;
    globalThis.fetch = async () => {
      exchanges += 1;
      return { ok: true, json: async () => ({ access_token: "shpat_from_oauth", scope: "read_products" }) };
    };
    try {
      const install = oauth.startShopifyInstall({ workspaceId: alpha, shop: "alpha-store.myshopify.com" });
      const state = new URL(install.url).searchParams.get("state");
      const params = { code: "abc", shop: "alpha-store.myshopify.com", state, timestamp: "1" };

      const tampered = sign(params);
      tampered.set("code", "different");
      assert.equal((await call(tampered.toString())).status, 400, "bad signature is rejected");
      assert.equal(exchanges, 0);

      const wrongState = sign({ ...params, state: "not-a-real-state" });
      assert.equal((await call(wrongState.toString())).status, 400, "an unknown state is rejected");
      assert.equal(exchanges, 0);

      const ok = await call(sign(params).toString());
      assert.equal(ok.status, 200);
      assert.match(ok.body, /Connected alpha-store\.myshopify\.com/);
      assert.match(ok.body, /href="http:\/\/localhost:3000"/, "success page links back to the app");
      assert.equal(repository.getIntegrationCredentials(alpha, "shopify").accessToken, "shpat_from_oauth");
      assert.equal(repository.getIntegrationConnection(beta, "shopify"), null, "token lands only in the initiating workspace");

      assert.equal((await call(sign(params).toString())).status, 400, "state is single-use");

      // Shopify reports the canonical domain, which can differ from the alias that was requested.
      const aliasInstall = oauth.startShopifyInstall({ workspaceId: beta, shop: "old-alias.myshopify.com" });
      const aliasParams = {
        code: "def",
        shop: "canonical-store.myshopify.com",
        state: new URL(aliasInstall.url).searchParams.get("state"),
        timestamp: "2",
      };
      assert.equal((await call(sign(aliasParams).toString())).status, 200, "a signed callback for the canonical domain is accepted");
      assert.equal(repository.getIntegrationCredentials(beta, "shopify").externalAccountId, "canonical-store.myshopify.com");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test("Meta Ads connect names the connection after the ad account the token reaches", async () => {
  await withFixture(async ({ repository, alpha, beta }) => {
    const meta = await import("../integrations/meta-ads.mjs");
    const realFetch = globalThis.fetch;
    let accounts = { data: [{ name: "Northstar Ads", account_id: "111" }, { name: "Second", account_id: "222" }] };
    globalThis.fetch = async (url) =>
      String(url).includes("/me/adaccounts")
        ? { ok: true, json: async () => accounts }
        : { ok: true, json: async () => ({ id: "9001", name: "Mootaz" }) };
    try {
      assert.equal((await meta.connectMetaAds(alpha, "tok")).label, "Northstar Ads +1 more");
      assert.equal(repository.listIntegrationConnections(alpha)[0].externalAccountId, "act_111", "stored under the ad account id");
      assert.equal((await meta.getMetaAdsStatus(alpha)).label, "Northstar Ads +1 more", "status reads the saved name, not the token owner (Mootaz)");

      accounts = { data: [{ name: "  Solo Ads  ", account_id: "333" }] };
      assert.equal((await meta.connectMetaAds(alpha, "tok2")).label, "Solo Ads", "one account is named plainly, trimmed");

      // No ad account reachable (no ads_read, or none shared with the token): the token's owner names it.
      accounts = { data: [] };
      assert.equal((await meta.connectMetaAds(beta, "tok3")).label, "Mootaz");
      assert.equal(repository.listIntegrationConnections(beta)[0].externalAccountId, "9001");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test("Meta Ads connect validates the token with Meta, then stores it per workspace", async () => {
  await withFixture(async ({ repository, alpha, beta }) => {
    const meta = await import("../integrations/meta-ads.mjs");
    const realFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init) => {
      const token = init?.headers?.Authorization?.replace("Bearer ", "");
      seen.push({ url: String(url), token });
      return token === "good-token"
        ? { ok: true, json: async () => ({ id: "9001", name: "Alpha Ads" }) }
        : { ok: false, status: 400, json: async () => ({ error: { message: "Invalid OAuth access token." } }) };
    };
    try {
      await assert.rejects(() => meta.connectMetaAds(alpha, "bad-token"), /Invalid OAuth access token/);
      await assert.rejects(() => meta.connectMetaAds(alpha, "   "), /Paste a Meta access token/);
      assert.equal(repository.listIntegrationConnections(alpha).length, 0, "a rejected token is never stored");

      assert.deepEqual(await meta.connectMetaAds(alpha, " good-token "), {
        id: "meta-ads",
        connected: true,
        label: "Alpha Ads",
      });
      assert.ok(seen.every((call) => !call.url.includes("token")), "token is sent in a header, never the URL");
      assert.equal(repository.getIntegrationCredentials(alpha, "meta-ads").accessToken, "good-token");

      assert.equal((await meta.getMetaAdsStatus(alpha)).label, "Alpha Ads");
      assert.deepEqual(await meta.getMetaAdsStatus(beta), { id: "meta-ads", connected: false });

      process.env.META_ADS_ACCESS_TOKEN = "good-token";
      assert.equal((await meta.getMetaAdsStatus(beta)).connected, true, "dev env fallback outside production");
      process.env.NODE_ENV = "production";
      assert.equal((await meta.getMetaAdsStatus(beta)).connected, false, "no env fallback in production");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test("Shopify install reports missing app credentials clearly and falls back to the default store", async () => {
  await withFixture(async ({ alpha }) => {
    const oauth = await import("../integrations/shopify-oauth.mjs");
    assert.throws(
      () => oauth.startShopifyInstall({ workspaceId: alpha, shop: "a.myshopify.com" }),
      /Missing SHOPIFY_APP_CLIENT_ID/,
    );

    process.env.SHOPIFY_APP_CLIENT_ID = "client-id";
    process.env.SHOPIFY_APP_CLIENT_SECRET = "client-secret";
    process.env.SHOPIFY_OAUTH_REDIRECT_BASE = "https://tunnel.example";
    assert.throws(() => oauth.startShopifyInstall({ workspaceId: alpha }), /valid store domain/);

    process.env.SHOPIFY_SHOP_DOMAIN = "default-store.myshopify.com";
    const install = oauth.startShopifyInstall({ workspaceId: alpha });
    assert.equal(install.shop, "default-store.myshopify.com");
    const url = new URL(install.url);
    assert.equal(url.host, "default-store.myshopify.com");
    assert.equal(url.searchParams.get("redirect_uri"), "https://tunnel.example/shopify/callback");
    assert.equal(url.searchParams.get("scope"), "read_orders,read_products");
  });
});

test("the public tunnel host can only reach the Shopify callback, never the GraphQL API", async () => {
  await withFixture(async () => {
    const { isBlockedTunnelRequest } = await import("../integrations/shopify-oauth.mjs");
    const request = (host, url) => ({ headers: { host }, url });

    process.env.SHOPIFY_OAUTH_REDIRECT_BASE = "https://my-tunnel.loca.lt";
    assert.equal(isBlockedTunnelRequest(request("my-tunnel.loca.lt", "/graphql")), true);
    assert.equal(isBlockedTunnelRequest(request("MY-TUNNEL.loca.lt", "/")), true, "host match is case-insensitive");
    assert.equal(isBlockedTunnelRequest(request("my-tunnel.loca.lt", "/shopify/callback?code=x&shop=y")), false);
    assert.equal(isBlockedTunnelRequest(request("localhost:4000", "/graphql")), false, "local access is unaffected");
    assert.equal(isBlockedTunnelRequest(request("127.0.0.1:4000", "/graphql")), false);

    process.env.SHOPIFY_OAUTH_REDIRECT_BASE = "http://localhost:4000";
    assert.equal(isBlockedTunnelRequest(request("localhost:4000", "/graphql")), false, "a localhost redirect base must never block local traffic");
    assert.equal(isBlockedTunnelRequest(request("localhost:3000", "/graphql")), false);

    delete process.env.SHOPIFY_OAUTH_REDIRECT_BASE;
    assert.equal(isBlockedTunnelRequest(request("my-tunnel.loca.lt", "/graphql")), false, "no tunnel configured, no restriction");
  });
});

test("disconnect removes only the caller's connection and uninstalls the Shopify app", async () => {
  await withFixture(async ({ repository, alpha, beta }) => {
    const { disconnectIntegration } = await import("../integrations/disconnect.mjs");
    repository.saveIntegrationConnection(alpha, { provider: "shopify", externalAccountId: "a.myshopify.com", accessToken: "shpat_alpha" });
    repository.saveIntegrationConnection(beta, { provider: "shopify", externalAccountId: "b.myshopify.com", accessToken: "shpat_beta" });

    const realFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), token: init.headers["X-Shopify-Access-Token"], body: JSON.parse(init.body).query });
      return { ok: true, json: async () => ({ data: { appUninstall: { app: { id: "gid://shopify/App/1" }, userErrors: [] } } }) };
    };
    try {
      const result = await disconnectIntegration(alpha, "shopify");
      assert.deepEqual({ ...result, message: undefined }, { id: "shopify", disconnected: true, remoteRevoked: true, message: undefined });
      assert.match(result.message, /uninstalled the app from a\.myshopify\.com/);
      assert.equal(calls.length, 1);
      assert.match(calls[0].url, /^https:\/\/a\.myshopify\.com\/admin\/api\/.+\/graphql\.json$/);
      assert.equal(calls[0].token, "shpat_alpha", "uses the caller's own token");
      assert.match(calls[0].body, /appUninstall/);

      assert.equal(repository.listIntegrationConnections(alpha, "shopify").length, 0);
      assert.equal(repository.getIntegrationCredentials(beta, "shopify").accessToken, "shpat_beta", "another workspace is untouched");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test("disconnect still removes the local token when Shopify can't be reached or refuses", async () => {
  await withFixture(async ({ repository, alpha }) => {
    const { disconnectIntegration } = await import("../integrations/disconnect.mjs");
    const realFetch = globalThis.fetch;
    try {
      repository.saveIntegrationConnection(alpha, { provider: "shopify", externalAccountId: "a.myshopify.com", accessToken: "shpat_a" });
      globalThis.fetch = async () => {
        throw new Error("network down");
      };
      let result = await disconnectIntegration(alpha, "shopify");
      assert.equal(result.disconnected, true);
      assert.equal(result.remoteRevoked, false);
      assert.match(result.message, /Settings → Apps/);
      assert.match(result.message, /network down/);
      assert.equal(repository.listIntegrationConnections(alpha, "shopify").length, 0, "local token is gone regardless");

      repository.saveIntegrationConnection(alpha, { provider: "shopify", externalAccountId: "a.myshopify.com", accessToken: "shpat_a" });
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ data: { appUninstall: { app: null, userErrors: [{ field: null, message: "App already uninstalled" }] } } }),
      });
      result = await disconnectIntegration(alpha, "shopify");
      assert.equal(result.remoteRevoked, false);
      assert.match(result.message, /App already uninstalled/);
      assert.equal(repository.listIntegrationConnections(alpha, "shopify").length, 0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test("disconnect handles Meta locally, reports nothing to remove, and rejects unknown integrations", async () => {
  await withFixture(async ({ repository, alpha, beta }) => {
    const { disconnectIntegration } = await import("../integrations/disconnect.mjs");
    const realFetch = globalThis.fetch;
    let fetched = 0;
    globalThis.fetch = async () => {
      fetched += 1;
      throw new Error("Meta must not be called on disconnect");
    };
    try {
      repository.saveIntegrationConnection(alpha, { provider: "meta-ads", externalAccountId: "9001", accessToken: "meta_a" });
      repository.saveIntegrationConnection(beta, { provider: "meta-ads", externalAccountId: "9002", accessToken: "meta_b" });

      const result = await disconnectIntegration(alpha, "meta-ads");
      assert.equal(result.disconnected, true);
      assert.equal(result.remoteRevoked, null);
      assert.equal(fetched, 0);
      assert.equal(repository.listIntegrationConnections(beta, "meta-ads").length, 1, "other workspace untouched");

      const again = await disconnectIntegration(alpha, "meta-ads");
      assert.equal(again.disconnected, false);
      assert.match(again.message, /no saved connection/);

      await assert.rejects(() => disconnectIntegration(alpha, "tiktok-ads"), /Unknown integration/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test("Meta OAuth: login URL is built for the workspace and needs the app credentials", async () => {
  await withFixture(async ({ alpha }) => {
    const { startMetaInstall } = await import("../integrations/meta-oauth.mjs");
    assert.throws(() => startMetaInstall({ workspaceId: alpha }), /META_APP_ID/);

    process.env.META_APP_ID = "app-123";
    process.env.META_APP_SECRET = "app-secret";
    const url = new URL(startMetaInstall({ workspaceId: alpha }).url);
    assert.equal(url.host, "www.facebook.com");
    assert.match(url.pathname, /^\/v[\d.]+\/dialog\/oauth$/);
    assert.equal(url.searchParams.get("client_id"), "app-123");
    assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:4000/meta/callback");
    assert.equal(url.searchParams.get("scope"), "ads_read");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.ok(url.searchParams.get("state"));
    assert.ok(![...url.searchParams.values()].includes("app-secret"), "the app secret never appears in the login URL");

    process.env.META_OAUTH_REDIRECT_BASE = "https://example.test";
    assert.equal(
      new URL(startMetaInstall({ workspaceId: alpha }).url).searchParams.get("redirect_uri"),
      "https://example.test/meta/callback",
    );
  });
});

test("Meta OAuth: callback exchanges the code, stores a long-lived token with its expiry, and is single-use", async () => {
  await withFixture(async ({ repository, alpha, beta }) => {
    process.env.META_APP_ID = "app-123";
    process.env.META_APP_SECRET = "app-secret";
    const oauth = await import("../integrations/meta-oauth.mjs");
    const meta = await import("../integrations/meta-ads.mjs");

    const call = async (query) => {
      const res = { status: null, body: "", writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
      await oauth.handleMetaCallback({ url: `/meta/callback?${query}` }, res);
      return res;
    };
    const stateFor = (workspaceId) => new URL(oauth.startMetaInstall({ workspaceId }).url).searchParams.get("state");

    const realFetch = globalThis.fetch;
    const seen = [];
    let failExchange = false;
    globalThis.fetch = async (url, init = {}) => {
      const target = String(url);
      const body = init.body ? new URLSearchParams(String(init.body)) : null;
      seen.push({ target, method: init.method ?? "GET", body, auth: init.headers?.Authorization });
      if (target.includes("/oauth/access_token")) {
        if (failExchange) return { ok: false, status: 400, json: async () => ({ error: { message: "Invalid verification code format." } }) };
        return body.get("grant_type") === "fb_exchange_token"
          ? { ok: true, json: async () => ({ access_token: "LONG_TOKEN", expires_in: 5_184_000 }) }
          : { ok: true, json: async () => ({ access_token: "SHORT_TOKEN", expires_in: 3600 }) };
      }
      return { ok: true, json: async () => ({ id: "fb-777", name: "Ada Ads" }) };
    };
    try {
      const good = await call(`code=abc&state=${stateFor(alpha)}`);
      assert.equal(good.status, 200);
      assert.match(good.body, /Connected Ada Ads to PRISM/);

      const [shortCall, longCall, meCall] = seen;
      assert.equal(shortCall.method, "POST");
      assert.equal(shortCall.body.get("code"), "abc");
      assert.equal(shortCall.body.get("client_secret"), "app-secret");
      assert.equal(longCall.body.get("fb_exchange_token"), "SHORT_TOKEN", "the short token is upgraded");
      assert.equal(meCall.auth, "Bearer LONG_TOKEN");
      assert.ok(
        seen.every((entry) => !entry.target.includes("app-secret") && !entry.target.includes("SHORT_TOKEN") && !entry.target.includes("code=abc")),
        "secrets, codes and tokens travel in POST bodies or headers, never URLs",
      );

      const saved = repository.getIntegrationCredentials(alpha, "meta-ads");
      assert.equal(saved.accessToken, "LONG_TOKEN");
      assert.equal(saved.externalAccountId, "fb-777");
      assert.equal(saved.label, "Ada Ads");
      const days = (new Date(saved.expiresAt).getTime() - Date.now()) / 86_400_000;
      assert.ok(days > 59 && days < 61, `expiry is about 60 days out (got ${days.toFixed(1)})`);
      assert.equal(repository.getIntegrationConnection(beta, "meta-ads"), null, "only the initiating workspace");

      const status = await meta.getMetaAdsStatus(alpha);
      assert.equal(status.connected, true);
      assert.equal(status.expiresAt, saved.expiresAt, "status reports when the token expires");

      // Single use, unknown state, user pressing Cancel, and a failed exchange all save nothing new.
      const reused = await call(`code=abc&state=${new URL(oauth.startMetaInstall({ workspaceId: beta }).url).searchParams.get("state")}x`);
      assert.equal(reused.status, 400);
      const denied = await call(`error=access_denied&error_description=Cancelled&state=${stateFor(beta)}`);
      assert.equal(denied.status, 400);
      assert.match(denied.body, /Cancelled/);
      failExchange = true;
      const failed = await call(`code=bad&state=${stateFor(beta)}`);
      assert.equal(failed.status, 500);
      assert.equal(repository.getIntegrationConnection(beta, "meta-ads"), null, "nothing saved after any failure");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test("the tunnel guard lets Meta's callback through as well", async () => {
  await withFixture(async () => {
    const { isBlockedTunnelRequest } = await import("../integrations/shopify-oauth.mjs");
    process.env.SHOPIFY_OAUTH_REDIRECT_BASE = "https://my-tunnel.loca.lt";
    const request = (url) => ({ headers: { host: "my-tunnel.loca.lt" }, url });
    assert.equal(isBlockedTunnelRequest(request("/meta/callback?code=x")), false);
    assert.equal(isBlockedTunnelRequest(request("/graphql")), true);
    delete process.env.SHOPIFY_OAUTH_REDIRECT_BASE;
  });
});

test("Meta OAuth with Facebook Login for Business uses the configuration id instead of scopes", async () => {
  await withFixture(async ({ alpha }) => {
    const { startMetaInstall } = await import("../integrations/meta-oauth.mjs");
    process.env.META_APP_ID = "app-123";
    process.env.META_APP_SECRET = "app-secret";
    process.env.META_LOGIN_CONFIG_ID = "cfg-555";
    const url = new URL(startMetaInstall({ workspaceId: alpha }).url);
    assert.equal(url.searchParams.get("config_id"), "cfg-555");
    assert.equal(url.searchParams.get("override_default_response_type"), "true");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.has("scope"), false, "permissions come from the configuration, not the link");
  });
});

test("Meta OAuth accepts a non-expiring token that can't be upgraded, but refuses a short-lived one", async () => {
  await withFixture(async ({ repository, alpha, beta }) => {
    process.env.META_APP_ID = "app-123";
    process.env.META_APP_SECRET = "app-secret";
    const oauth = await import("../integrations/meta-oauth.mjs");
    const call = async (workspaceId) => {
      const state = new URL(oauth.startMetaInstall({ workspaceId }).url).searchParams.get("state");
      const res = { status: null, body: "", writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
      await oauth.handleMetaCallback({ url: `/meta/callback?code=abc&state=${state}` }, res);
      return res;
    };

    const realFetch = globalThis.fetch;
    let firstToken;
    globalThis.fetch = async (url, init = {}) => {
      if (String(url).includes("/oauth/access_token")) {
        const body = new URLSearchParams(String(init.body));
        return body.get("grant_type") === "fb_exchange_token"
          ? { ok: false, status: 400, json: async () => ({ error: { message: "Cannot exchange this token." } }) }
          : { ok: true, json: async () => firstToken };
      }
      return { ok: true, json: async () => ({ id: "sys-1", name: "System User" }) };
    };
    try {
      firstToken = { access_token: "SYSTEM_TOKEN" }; // no expires_in: does not expire
      const ok = await call(alpha);
      assert.equal(ok.status, 200);
      const saved = repository.getIntegrationCredentials(alpha, "meta-ads");
      assert.equal(saved.accessToken, "SYSTEM_TOKEN");
      assert.equal(saved.expiresAt, null, "a token with no expiry is stored as non-expiring");

      firstToken = { access_token: "SHORT_TOKEN", expires_in: 3600 };
      const refused = await call(beta);
      assert.equal(refused.status, 500);
      assert.equal(repository.getIntegrationConnection(beta, "meta-ads"), null, "an hour-long token is never saved as if it were fine");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
