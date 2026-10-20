import assert from "node:assert/strict";
import test from "node:test";
import { productContextOutputSchema } from "../ai/output-schemas/product-context.schema.mjs";
import { AI_OPERATIONS } from "../ai/workflow-operations.mjs";
import * as deepseek from "../ai/providers/deepseek.mjs";
import * as gemini from "../ai/providers/gemini.mjs";
import * as openai from "../ai/providers/openai.mjs";
import * as perplexity from "../ai/providers/perplexity.mjs";
import { buildProductContextArtifact } from "./service.mjs";

const textSource = {
  id: "notes-1",
  type: "text",
  label: "Product notes",
  value: "A cooling pillow with an adjustable fill and washable cover.",
  status: "ready",
};

function semanticOutput(overrides = {}) {
  return {
    name: "Cloud Pillow",
    workingLabel: "Adjustable cooling pillow",
    category: "Pillow",
    summary: "A cooling, adjustable pillow for side sleepers.",
    features: ["Perforated memory foam", "Adjustable fill"],
    mechanisms: ["Perforations increase airflow", "Removable fill changes loft"],
    benefits: ["Sleeps cooler", "More adjustable support"],
    proofPoints: ["Washable cover"],
    useCases: ["Side sleeping"],
    claims: ["Temperature-regulating"],
    constraints: ["Do not make medical claims"],
    ...overrides,
  };
}

function inspection(classification, status = "SUCCESS") {
  return {
    fetch: {
      status,
      requestedUrl: "https://shop.example/product",
      finalUrl: "https://shop.example/product",
    },
    classification,
    listingScope: null,
    confidence: 0.8,
    signals: {},
    candidates: [],
    evidence: { title: "Cloud Pillow" },
    classificationPolicyVersion: "page-classifier-v1",
  };
}

function testServices(outputs, overrides = {}) {
  const calls = [];
  const persisted = [];
  const traces = [];
  const sourceUpdates = [];
  const queue = [...outputs];
  const dependencies = {
    callAiModel: async (request) => {
      calls.push(request);
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return {
        text: next,
        provider: "openai",
        model: "gpt-5-mini",
        metadata: {
          inputTokens: 100,
          outputTokens: 200,
          providerRequestId: "resp-test",
          structuredOutput: { requested: true, applied: true, reason: null },
        },
      };
    },
    inspectProductUrl: async () => inspection("PRODUCT"),
    persist: (artifact) => {
      const stored = { ...artifact, id: "context-server", createdAt: "2026-08-11T00:00:00Z" };
      persisted.push(stored);
      return stored;
    },
    recordGeneration: (trace) => traces.push(trace),
    updateStoredSource: (sourceId, source) => sourceUpdates.push({ sourceId, source }),
    ...overrides,
  };
  return { calls, persisted, traces, sourceUpdates, dependencies };
}

async function build(sources, services) {
  return buildProductContextArtifact({
    sources,
    ai: { provider: "openai", model: "gpt-5-mini" },
    dependencies: services,
  });
}

test("valid model output validates and persists server-owned metadata", async () => {
  const services = testServices([JSON.stringify(semanticOutput())]);
  const context = await build([textSource], services.dependencies);

  assert.equal(context.id, "context-server");
  assert.equal(context.createdAt, "2026-08-11T00:00:00Z");
  assert.deepEqual(context.sourceIds, [textSource.id]);
  assert.equal(services.persisted.length, 1);
  assert.equal(services.traces[0].status, "SUCCEEDED");
  assert.equal(services.calls[0].outputSchema, productContextOutputSchema);
  assert.equal(services.calls[0].operation, AI_OPERATIONS.PRODUCT_CONTEXT_BUILDING);
  assert.equal(services.calls[0].attempt, 1);
});

test("missing features fails validation and never persists", async () => {
  const invalid = JSON.stringify(semanticOutput({ features: undefined }));
  const services = testServices([invalid, invalid]);

  await assert.rejects(
    () => build([textSource], services.dependencies),
    (error) => {
      assert.equal(error.code, "PRODUCT_CONTEXT_VALIDATION_FAILED");
      return true;
    },
  );
  assert.equal(services.persisted.length, 0);
  assert.equal(services.calls.length, 2);
});

test("a scalar benefits value fails validation", async () => {
  const invalid = JSON.stringify(semanticOutput({ benefits: "Sleeps cooler" }));
  const services = testServices([invalid, invalid]);

  await assert.rejects(
    () => build([textSource], services.dependencies),
    (error) => {
      assert.equal(error.code, "PRODUCT_CONTEXT_VALIDATION_FAILED");
      return true;
    },
  );
  assert.equal(services.persisted.length, 0);
});

test("malformed JSON returns a clean domain failure", async () => {
  const services = testServices(["not JSON", "not JSON"]);

  await assert.rejects(
    () => build([textSource], services.dependencies),
    (error) => {
      assert.equal(error.code, "PRODUCT_CONTEXT_VALIDATION_FAILED");
      assert.equal(error.message.includes("Try again"), true);
      return true;
    },
  );
  assert.equal(services.traces[0].status, "FAILED");
});

test("one invalid response is retried once and can succeed", async () => {
  const invalid = JSON.stringify(semanticOutput({ features: undefined }));
  const services = testServices([invalid, JSON.stringify(semanticOutput())]);
  const context = await build([textSource], services.dependencies);

  assert.equal(context.name, "Cloud Pillow");
  assert.equal(services.calls.length, 2);
  assert.match(services.calls[1].system, /previous response did not match/i);
  assert.equal(services.calls[1].operation, AI_OPERATIONS.PRODUCT_CONTEXT_BUILDING);
  assert.equal(services.calls[1].parentGenerationId, services.calls[0].parentGenerationId);
  assert.deepEqual(
    services.calls.map((call) => call.attempt),
    [1, 2],
  );
  assert.equal(services.traces[0].attempts, 2);
});

test("two invalid responses fail and no artifact is persisted", async () => {
  const invalid = JSON.stringify(semanticOutput({ constraints: "Unknown" }));
  const services = testServices([invalid, invalid]);

  await assert.rejects(
    () => build([textSource], services.dependencies),
    (error) => {
      assert.equal(error.code, "PRODUCT_CONTEXT_VALIDATION_FAILED");
      return true;
    },
  );
  assert.equal(services.persisted.length, 0);
  assert.equal(services.traces[0].attempts, 2);
});

test("listing URLs block product context until a product is selected", async () => {
  const urlSource = {
    id: "url-listing",
    type: "url",
    label: "Shop all",
    value: "https://shop.example/collections/all",
    status: "ready",
  };
  const services = testServices([], {
    inspectProductUrl: async () => inspection("LISTING"),
  });

  await assert.rejects(
    () => build([urlSource], services.dependencies),
    (error) => {
      assert.equal(error.code, "URL_REQUIRES_PRODUCT_SELECTION");
      return true;
    },
  );
  assert.equal(services.calls.length, 0);
});

test("an unreachable URL does not block valid notes", async () => {
  const urlSource = {
    id: "url-failed",
    type: "url",
    label: "Product page",
    value: "https://blocked.example",
    status: "ready",
  };
  const services = testServices([JSON.stringify(semanticOutput())], {
    inspectProductUrl: async () => inspection(null, "UNREACHABLE"),
  });
  const context = await build([urlSource, textSource], services.dependencies);

  assert.deepEqual(context.sourceIds, [textSource.id]);
  assert.equal(services.sourceUpdates[0].source.status, "error");
  assert.equal(services.calls.length, 1);
});

test("unknown URL evidence remains usable with valid text material", async () => {
  const urlSource = {
    id: "url-unknown",
    type: "url",
    label: "Brand page",
    value: "https://shop.example/about",
    status: "ready",
  };
  const services = testServices([JSON.stringify(semanticOutput())], {
    inspectProductUrl: async () => inspection("UNKNOWN"),
  });
  const context = await build([urlSource, textSource], services.dependencies);

  assert.deepEqual(context.sourceIds, [urlSource.id, textSource.id]);
  assert.equal(services.calls.length, 1);
});

test("no usable material avoids calling the model", async () => {
  const emptyText = { ...textSource, value: "   " };
  const services = testServices([]);

  await assert.rejects(
    () => build([emptyText], services.dependencies),
    (error) => {
      assert.equal(error.code, "PRODUCT_CONTEXT_NO_USABLE_SOURCES");
      return true;
    },
  );
  assert.equal(services.calls.length, 0);
});

test("uploaded documents, images, and sampled video frames are fed to OpenAI as multimodal evidence", async () => {
  const documentSource = {
    id: "document-1",
    type: "file",
    label: "Product document",
    filename: "specification.pdf",
    mimeType: "application/pdf",
    value: JSON.stringify({ version: 1, kind: "document", data: "cGRmLWJ5dGVz" }),
    status: "ready",
  };
  const imageSource = {
    id: "image-1",
    type: "image",
    label: "Product image",
    filename: "pillow.png",
    mimeType: "image/png",
    value: JSON.stringify({ version: 1, kind: "image", dataUrl: "data:image/png;base64,aW1hZ2U=" }),
    status: "ready",
  };
  const videoSource = {
    id: "video-1",
    type: "video",
    label: "Product video",
    filename: "demo.mp4",
    mimeType: "video/mp4",
    value: JSON.stringify({
      version: 1,
      kind: "video_frames",
      frames: [
        "data:image/jpeg;base64,ZnJhbWUtMQ==",
        "data:image/jpeg;base64,ZnJhbWUtMg==",
        "data:image/jpeg;base64,ZnJhbWUtMw==",
      ],
    }),
    status: "ready",
  };
  const services = testServices([JSON.stringify(semanticOutput())]);
  const context = await build([documentSource, imageSource, videoSource], services.dependencies);

  const content = services.calls[0].messages[0].content;
  assert.equal(content[0].type, "input_text");
  assert.deepEqual(content.slice(1), [
    {
      type: "product_document",
      kind: "document",
      data: "cGRmLWJ5dGVz",
      mimeType: "application/pdf",
      filename: "specification.pdf",
    },
    {
      type: "product_image",
      kind: "image",
      data: "aW1hZ2U=",
      dataUrl: "data:image/png;base64,aW1hZ2U=",
      mimeType: "image/png",
      filename: "pillow.png",
    },
    {
      type: "product_image",
      kind: "image",
      data: "ZnJhbWUtMQ==",
      dataUrl: "data:image/jpeg;base64,ZnJhbWUtMQ==",
      mimeType: "image/jpeg",
      filename: "demo.mp4 frame 1",
    },
    {
      type: "product_image",
      kind: "image",
      data: "ZnJhbWUtMg==",
      dataUrl: "data:image/jpeg;base64,ZnJhbWUtMg==",
      mimeType: "image/jpeg",
      filename: "demo.mp4 frame 2",
    },
    {
      type: "product_image",
      kind: "image",
      data: "ZnJhbWUtMw==",
      dataUrl: "data:image/jpeg;base64,ZnJhbWUtMw==",
      mimeType: "image/jpeg",
      filename: "demo.mp4 frame 3",
    },
  ]);
  assert.deepEqual(context.sourceIds, ["document-1", "image-1", "video-1"]);
  assert.equal(content[0].text.includes("cGRmLWJ5dGVz"), false);
});

test("media intake rejects formats unsupported by the selected provider", async () => {
  const documentSource = {
    id: "document-1",
    type: "file",
    label: "Product document",
    filename: "deck.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    value: JSON.stringify({ version: 1, kind: "document", data: "cGRmLWJ5dGVz" }),
    status: "ready",
  };
  const services = testServices([]);
  await assert.rejects(
    () =>
      buildProductContextArtifact({
        sources: [documentSource],
        ai: { provider: "anthropic", model: "claude-sonnet-5" },
        dependencies: services.dependencies,
      }),
    (error) => {
      assert.equal(error.code, "AI_PROVIDER_UNSUPPORTED_MEDIA");
      return true;
    },
  );
  assert.equal(services.calls.length, 0);
});

test("o3-mini rejects image product material before an OpenAI request", async () => {
  const imageSource = {
    id: "image-1",
    type: "image",
    label: "Product image",
    filename: "pillow.webp",
    mimeType: "image/webp",
    value: JSON.stringify({
      version: 1,
      kind: "image",
      dataUrl: "data:image/webp;base64,aW1hZ2U=",
    }),
    status: "ready",
  };
  const services = testServices([]);

  await assert.rejects(
    () =>
      buildProductContextArtifact({
        sources: [imageSource],
        ai: { provider: "openai", model: "o3-mini" },
        dependencies: services.dependencies,
      }),
    (error) => {
      assert.equal(error.code, "AI_PROVIDER_UNSUPPORTED_MEDIA");
      return true;
    },
  );
  assert.equal(services.calls.length, 0);
});

test("gpt-3.5-turbo rejects product context before an OpenAI request because it lacks structured outputs", async () => {
  const services = testServices([]);
  await assert.rejects(
    () =>
      buildProductContextArtifact({
        sources: [textSource],
        ai: { provider: "openai", model: "gpt-3.5-turbo" },
        dependencies: services.dependencies,
      }),
    (error) => {
      assert.equal(error.code, "AI_PROVIDER_UNSUPPORTED_PRODUCT_CONTEXT_CONTRACT");
      return true;
    },
  );
  assert.equal(services.calls.length, 0);
});

test("legacy gpt-4-0613 rejects product context before an OpenAI request because it lacks structured outputs", async () => {
  const services = testServices([]);
  await assert.rejects(
    () =>
      buildProductContextArtifact({
        sources: [textSource],
        ai: { provider: "openai", model: "gpt-4-0613" },
        dependencies: services.dependencies,
      }),
    (error) => {
      assert.equal(error.code, "AI_PROVIDER_UNSUPPORTED_PRODUCT_CONTEXT_CONTRACT");
      return true;
    },
  );
  assert.equal(services.calls.length, 0);
});

test("retired Gemini 2.5 models reject product context before any provider request", async () => {
  const services = testServices([]);
  await assert.rejects(
    () =>
      buildProductContextArtifact({
        sources: [textSource],
        ai: { provider: "gemini", model: "gemini-2.5-flash" },
        dependencies: services.dependencies,
      }),
    (error) => {
      assert.equal(error.code, "AI_PROVIDER_UNSUPPORTED_PRODUCT_CONTEXT_CONTRACT");
      return true;
    },
  );
  assert.equal(services.calls.length, 0);
});

test("DeepSeek rejects image product material before any provider request", async () => {
  const imageSource = {
    id: "image-1",
    type: "image",
    label: "Product image",
    filename: "pillow.webp",
    mimeType: "image/webp",
    value: JSON.stringify({
      version: 1,
      kind: "image",
      dataUrl: "data:image/webp;base64,aW1hZ2U=",
    }),
    status: "ready",
  };
  const services = testServices([]);
  await assert.rejects(
    () =>
      buildProductContextArtifact({
        sources: [imageSource],
        ai: { provider: "deepseek", model: "deepseek-v4-flash" },
        dependencies: services.dependencies,
      }),
    (error) => {
      assert.equal(error.code, "AI_PROVIDER_UNSUPPORTED_MEDIA");
      return true;
    },
  );
  assert.equal(services.calls.length, 0);
});

test("model attempts to set server-owned IDs are rejected", async () => {
  const invalid = JSON.stringify(semanticOutput({ id: "model-id", sourceIds: ["model-source"] }));
  const services = testServices([invalid, invalid]);

  await assert.rejects(
    () => build([textSource], services.dependencies),
    (error) => {
      assert.equal(error.code, "PRODUCT_CONTEXT_VALIDATION_FAILED");
      return true;
    },
  );
  assert.equal(services.persisted.length, 0);
});

test("OpenAI adapter translates the neutral schema into strict structured output", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        id: "resp-native-schema",
        output_text: JSON.stringify(semanticOutput()),
        usage: { input_tokens: 11, output_tokens: 22 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const response = await openai.call({
      apiKey: "test-key",
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "Build context" }],
      outputSchema: productContextOutputSchema,
    });
    assert.equal(request.text.format.type, "json_schema");
    assert.equal(request.text.format.strict, true);
    assert.ok(request.text.format.schema.properties.features);
    assert.equal(response.metadata.structuredOutput.applied, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAI adapter preserves structured image and file input blocks", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        id: "resp-multimodal",
        output_text: JSON.stringify(semanticOutput()),
        usage: { input_tokens: 11, output_tokens: 22 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    await openai.call({
      apiKey: "test-key",
      model: "gpt-5-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Build context" },
            { type: "input_file", file_data: "cGRmLWJ5dGVz", filename: "spec.pdf" },
            { type: "input_image", image_url: "data:image/png;base64,aW1hZ2U=", detail: "auto" },
          ],
        },
      ],
      outputSchema: productContextOutputSchema,
    });
    assert.deepEqual(request.input[0].content, [
      { type: "input_text", text: "Build context" },
      { type: "input_file", file_data: "cGRmLWJ5dGVz", filename: "spec.pdf" },
      { type: "input_image", image_url: "data:image/png;base64,aW1hZ2U=", detail: "auto" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini adapter maps neutral product material into native inline data parts", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        responseId: "gemini-multimodal",
        candidates: [{ content: { parts: [{ text: JSON.stringify(semanticOutput()) }] } }],
        usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 22, totalTokenCount: 33 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const response = await gemini.call({
      apiKey: "test-key",
      model: "gemini-3.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Build context" },
            {
              type: "product_document",
              kind: "document",
              mimeType: "application/pdf",
              data: "cGRmLWJ5dGVz",
              filename: "spec.pdf",
            },
            {
              type: "product_image",
              kind: "image",
              mimeType: "image/webp",
              data: "aW1hZ2U=",
              filename: "pillow.webp",
            },
          ],
        },
      ],
      outputSchema: productContextOutputSchema,
      options: { temperature: 0.2, topP: 0.9 },
    });
    assert.deepEqual(request.contents[0].parts, [
      { text: "Build context" },
      { inlineData: { mimeType: "application/pdf", data: "cGRmLWJ5dGVz" } },
      { inlineData: { mimeType: "image/webp", data: "aW1hZ2U=" } },
    ]);
    assert.equal(response.metadata.providerRequestId, "gemini-multimodal");
    assert.equal("temperature" in request.generationConfig, false);
    assert.equal("topP" in request.generationConfig, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Anthropic adapter maps product images and PDFs to documented message blocks", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        id: "msg-multimodal",
        content: [{ type: "text", text: JSON.stringify(semanticOutput()) }],
        usage: { input_tokens: 11, output_tokens: 22 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const response = await (
      await import("../ai/providers/anthropic.mjs")
    ).call({
      apiKey: "test-key",
      model: "claude-sonnet-5",
      messages: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Build context" },
            {
              type: "product_document",
              kind: "document",
              mimeType: "application/pdf",
              data: "cGRmLWJ5dGVz",
              filename: "spec.pdf",
            },
            {
              type: "product_image",
              kind: "image",
              mimeType: "image/png",
              data: "aW1hZ2U=",
              dataUrl: "data:image/png;base64,aW1hZ2U=",
              filename: "pillow.png",
            },
          ],
        },
      ],
    });
    assert.deepEqual(request.messages[0].content, [
      { type: "text", text: "Build context" },
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: "cGRmLWJ5dGVz" },
      },
      { type: "image", source: { type: "base64", media_type: "image/png", data: "aW1hZ2U=" } },
    ]);
    assert.equal(response.metadata.providerRequestId, "msg-multimodal");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Perplexity adapter translates the neutral schema into structured output", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        id: "pplx-native-schema",
        choices: [{ message: { content: JSON.stringify(semanticOutput()) } }],
        usage: { prompt_tokens: 11, completion_tokens: 22 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const response = await perplexity.call({
      apiKey: "test-key",
      model: "sonar",
      messages: [{ role: "user", content: "Build context" }],
      outputSchema: productContextOutputSchema,
    });
    assert.equal(request.response_format.type, "json_schema");
    assert.ok(request.response_format.json_schema.schema.properties.features);
    assert.match(request.response_format.json_schema.name, /^[a-zA-Z0-9]{1,64}$/);
    assert.equal(response.metadata.structuredOutput.applied, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DeepSeek adapter uses its OpenAI-compatible JSON Output mode", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        id: "deepseek-json-output",
        choices: [{ message: { content: JSON.stringify(semanticOutput()) } }],
        usage: { prompt_tokens: 11, completion_tokens: 22 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const response = await deepseek.call({
      apiKey: "test-key",
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "Build context" }],
      outputSchema: productContextOutputSchema,
    });
    assert.deepEqual(request.response_format, { type: "json_object" });
    assert.equal(request.model, "deepseek-v4-flash");
    assert.equal(response.metadata.structuredOutput.mode, "json_object");
    assert.equal(response.metadata.inputTokens, 11);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
