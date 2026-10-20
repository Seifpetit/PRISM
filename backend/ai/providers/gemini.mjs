import { jsonHeaders, messageText, requestJson } from "./http.mjs";
import { modelOption } from "./model-metadata.mjs";
import { nativeJsonSchema } from "./structured-output.mjs";

export const name = "gemini";
export const apiKeyEnv = "GEMINI_API_KEY";
export const defaultModel = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

const apiBaseUrl = () =>
  process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";

function contentParts(content) {
  if (!Array.isArray(content)) return [{ text: messageText({ content }) }];
  return content.map((part) => {
    if (part?.type === "input_text") return { text: part.text };
    if (part?.type === "product_image" || part?.type === "product_document") {
      return { inlineData: { mimeType: part.mimeType, data: part.data } };
    }
    throw new TypeError(
      `gemini: unsupported product-context content part: ${part?.type ?? "unknown"}`,
    );
  });
}

export async function call({
  apiKey,
  model,
  messages,
  system,
  options = {},
  outputSchema,
  signal,
}) {
  const schema = nativeJsonSchema(outputSchema);
  const latestModel = model.startsWith("gemini-3.5-") || model.startsWith("gemini-3.6-");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: contentParts(message.content),
    }));

  const payload = await requestJson({
    url: `${apiBaseUrl()}/models/${encodeURIComponent(model)}:generateContent`,
    init: {
      method: "POST",
      headers: jsonHeaders({ "x-goog-api-key": apiKey }),
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          ...(latestModel || options.temperature === undefined
            ? {}
            : { temperature: options.temperature }),
          ...(latestModel || options.topP === undefined ? {} : { topP: options.topP }),
          ...(options.maxTokens === undefined ? {} : { maxOutputTokens: options.maxTokens }),
          ...(schema
            ? {
                responseMimeType: "application/json",
                responseJsonSchema: schema,
              }
            : {}),
        },
      }),
      signal,
    },
    provider: name,
  });

  const text =
    payload.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .find((part) => part.text)?.text ?? "";
  return {
    text,
    raw: payload,
    metadata: {
      inputTokens: payload.usageMetadata?.promptTokenCount ?? null,
      outputTokens: payload.usageMetadata?.candidatesTokenCount ?? null,
      providerRequestId: payload.responseId ?? null,
      structuredOutput: {
        requested: Boolean(outputSchema),
        applied: Boolean(schema),
        reason: schema ? null : "no_output_schema_requested",
      },
    },
  };
}

export async function listModels({ apiKey, signal }) {
  const models = [];
  let pageToken;
  do {
    const url = new URL(`${apiBaseUrl()}/models`);
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const payload = await requestJson({
      url: url.toString(),
      init: { method: "GET", headers: jsonHeaders(), signal },
      provider: name,
    });
    models.push(
      ...(payload.models ?? [])
        .map((model) => {
          if (!model?.supportedGenerationMethods?.includes("generateContent")) return null;
          const id = model.baseModelId ?? model.name?.replace(/^models\//, "");
          return id ? modelOption(id, model.displayName ?? id) : null;
        })
        .filter(Boolean),
    );
    pageToken = payload.nextPageToken;
  } while (pageToken);
  return models;
}
