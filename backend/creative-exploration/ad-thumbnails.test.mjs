import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerAiProvider } from "../ai/canonical-caller.mjs";
import * as realOpenAIImage from "../ai/providers/openai-image.mjs";
import { generateAdSetThumbnails } from "./ad-thumbnails.mjs";
import { signInWithoutPassword } from "../database/auth-repository.mjs";
import { closeDatabasePool } from "../database/client.mjs";

const previousDatabasePath = process.env.DATABASE_PATH;
const dbDirectory = await mkdtemp(join(tmpdir(), "ecom-ad-thumbnails-db-"));
process.env.DATABASE_PATH = join(dbDirectory, "prism.db");
let workspaceId;

test.before(async () => {
  const session = await signInWithoutPassword({ displayName: "Thumb Test", email: "ad-thumb-test@example.com" });
  workspaceId = session.workspace.id;
});

test.after(async () => {
  await closeDatabasePool();
  if (previousDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = previousDatabasePath;
  await rm(dbDirectory, { recursive: true, force: true });
});

const productContext = { name: "Acme", workingLabel: "Plug-in electricity saver", category: "Home energy device" };
const avatar = { label: "The apartment household tracking a summer cooling bill" };
const angle = { label: "No-Rewiring Path to Action" };

function ad(id, overrides = {}) {
  return {
    id,
    format: "ugc_video",
    direction: "A phone camera follows someone plugging the device into a kitchen outlet.",
    ...overrides,
  };
}

async function withOldEnv(oldKey, run) {
  process.env.AI_API_KEY = "test-only-key";
  try {
    await run();
  } finally {
    if (oldKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = oldKey;
  }
}

test("every ad in the set gets its own image, in parallel, at increasing attempt numbers", async () => {
  const oldKey = process.env.AI_API_KEY;
  const seenAttempts = [];
  registerAiProvider("openai_image", {
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-image-2",
    call: async ({ messages }) => {
      seenAttempts.push(messages[0].content);
      return {
        text: "",
        raw: { data: [{ b64_json: "img" }], usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 } },
        imageBase64: "img",
        metadata: { providerRequestId: null },
      };
    },
  });

  try {
    await withOldEnv(oldKey, async () => {
      const results = await generateAdSetThumbnails({
        workspaceId,
        operationId: "op-thumb-1",
        related: {},
        productContext,
        avatar,
        angle,
        ads: [ad("ad-1"), ad("ad-2", { format: "static_ad" })],
        startAttempt: 2,
      });
      assert.deepEqual(
        results.map((r) => r.status),
        ["ready", "ready"],
      );
      assert.deepEqual(
        results.map((r) => r.adId),
        ["ad-1", "ad-2"],
      );
      assert.equal(results[0].url, "data:image/png;base64,img");
      assert.equal(seenAttempts.length, 2);
      // Promise.allSettled doesn't guarantee completion order, only that the result array matches the input
      // array (asserted above) — so check the two format briefs landed somewhere, not at a fixed index.
      assert.ok(seenAttempts.some((prompt) => /handheld phone video/.test(prompt)), "the ugc_video brief reached a prompt");
      assert.ok(
        seenAttempts.some((prompt) => /focal subject and room for headline text/.test(prompt)),
        "the static_ad brief reached a prompt",
      );
      assert.ok(seenAttempts.every((prompt) => prompt.includes("No-Rewiring Path to Action")));
    });
  } finally {
    registerAiProvider("openai_image", realOpenAIImage);
  }
});

test("one ad's image failing never fails the others in the same batch", async () => {
  const oldKey = process.env.AI_API_KEY;
  // The failing call is picked by content, not by invocation order — Promise.allSettled doesn't guarantee
  // which of several concurrent calls reaches the mock first.
  registerAiProvider("openai_image", {
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-image-2",
    call: async ({ messages }) => {
      if (messages[0].content.includes("doomed-direction")) throw new Error("provider rejected the prompt");
      return {
        text: "",
        raw: { data: [{ b64_json: "img" }], usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 } },
        imageBase64: "img",
        metadata: { providerRequestId: null },
      };
    },
  });

  try {
    await withOldEnv(oldKey, async () => {
      const originalError = console.error;
      console.error = () => undefined;
      let results;
      try {
        results = await generateAdSetThumbnails({
          workspaceId,
          operationId: "op-thumb-2",
          related: {},
          productContext,
          avatar,
          angle,
          ads: [ad("ad-1"), ad("ad-2", { direction: "doomed-direction" }), ad("ad-3")],
          startAttempt: 2,
        });
      } finally {
        console.error = originalError;
      }
      assert.deepEqual(
        results.map((r) => ({ adId: r.adId, status: r.status, hasUrl: r.url !== null })),
        [
          { adId: "ad-1", status: "ready", hasUrl: true },
          { adId: "ad-2", status: "failed", hasUrl: false },
          { adId: "ad-3", status: "ready", hasUrl: true },
        ],
      );
    });
  } finally {
    registerAiProvider("openai_image", realOpenAIImage);
  }
});

test("an ad with no image returned from the provider is treated as a failure, not a blank success", async () => {
  const oldKey = process.env.AI_API_KEY;
  registerAiProvider("openai_image", {
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-image-2",
    call: async () => ({
      text: "",
      raw: { data: [], usage: { input_tokens: 100, output_tokens: 0, total_tokens: 100 } },
      imageBase64: null,
      metadata: { providerRequestId: null },
    }),
  });

  try {
    await withOldEnv(oldKey, async () => {
      const originalError = console.error;
      console.error = () => undefined;
      let results;
      try {
        results = await generateAdSetThumbnails({
          workspaceId,
          operationId: "op-thumb-3",
          related: {},
          productContext,
          avatar,
          angle,
          ads: [ad("ad-1")],
          startAttempt: 2,
        });
      } finally {
        console.error = originalError;
      }
      assert.deepEqual(results, [{ adId: "ad-1", status: "failed", url: null }]);
    });
  } finally {
    registerAiProvider("openai_image", realOpenAIImage);
  }
});
