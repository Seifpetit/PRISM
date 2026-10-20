import { bearerHeaders, requestJson } from "./http.mjs";
import { modelOption } from "./model-metadata.mjs";
import { nativeJsonSchema, structuredOutputName } from "./structured-output.mjs";

export const name = "openai";
export const apiKeyEnv = "OPENAI_API_KEY";
export const defaultModel = process.env.OPENAI_MODEL ?? "gpt-5-mini";

const apiBaseUrl = () => process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1";

function responseContent(content) {
  if (!Array.isArray(content)) return content;
  return content.map((part) => {
    if (part.type === "product_document") {
      return {
        type: "input_file",
        file_data: `data:${part.mimeType};base64,${part.data}`,
        filename: part.filename,
      };
    }
    if (part.type === "product_image") {
      return { type: "input_image", image_url: part.dataUrl, detail: "auto" };
    }
    return part;
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
  const serviceTier =
    options.serviceMode === "flex"
      ? "flex"
      : options.serviceMode === "fast"
        ? "priority"
        : undefined;
  const payload = await requestJson({
    url: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/responses",
    init: {
      method: "POST",
      headers: bearerHeaders(apiKey),
      body: JSON.stringify({
        model,
        ...(serviceTier ? { service_tier: serviceTier } : {}),
        ...(system ? { instructions: system } : {}),
        // Responses accepts a string or structured multimodal content here.
        // Preserve structured input_file/input_image blocks for product intake.
        input: messages.map((message) => ({
          role: message.role,
          content: responseContent(message.content),
        })),
        ...(options.maxTokens === undefined ? {} : { max_output_tokens: options.maxTokens }),
        ...(schema
          ? {
              text: {
                format: {
                  type: "json_schema",
                  name: structuredOutputName(outputSchema),
                  schema,
                  strict: true,
                },
              },
            }
          : {}),
      }),
      signal,
    },
    provider: name,
  });

  const text =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? []).find((item) => item.text)?.text;
  return {
    text: text ?? "",
    raw: payload,
    metadata: {
      inputTokens: payload.usage?.input_tokens ?? null,
      outputTokens: payload.usage?.output_tokens ?? null,
      providerRequestId: payload.id ?? null,
      structuredOutput: {
        requested: Boolean(outputSchema),
        applied: Boolean(schema),
        reason: schema ? null : "no_output_schema_requested",
      },
    },
  };
}

export async function listModels({ apiKey, signal }) {
  const payload = await requestJson({
    url: process.env.OPENAI_MODELS_URL ?? `${apiBaseUrl()}/models`,
    init: { method: "GET", headers: bearerHeaders(apiKey), signal },
    provider: name,
  });
  const nonTextModel =
    /image|realtime|audio|transcribe|tts|whisper|embedding|moderation|sora|search|computer-use/i;
  return (payload.data ?? [])
    .filter((model) => model?.id && !nonTextModel.test(model.id))
    .map((model) => modelOption(model.id, model.id));
}
