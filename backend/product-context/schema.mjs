import Ajv2020 from "ajv/dist/2020.js";
import { productContextOutputSchema } from "../ai/output-schemas/product-context.schema.mjs";
import { ProductContextValidationError } from "./errors.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(productContextOutputSchema);
const textFields = new Set(["name", "workingLabel", "category", "summary"]);
const listFields = new Set([
  "features",
  "mechanisms",
  "benefits",
  "proofPoints",
  "useCases",
  "claims",
  "constraints",
]);

function normalizeCandidate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => {
      if (textFields.has(key) && typeof fieldValue === "string") {
        return [key, fieldValue.trim()];
      }
      if (listFields.has(key) && Array.isArray(fieldValue)) {
        return [key, fieldValue.map((item) => (typeof item === "string" ? item.trim() : item))];
      }
      return [key, fieldValue];
    }),
  );
}

function validationIssues() {
  return (validateSchema.errors ?? []).map((issue) => ({
    path: issue.instancePath || "/",
    message: issue.message ?? "Invalid value.",
  }));
}

export function parseProductContextJson(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new ProductContextValidationError([{ path: "/", message: "Response is empty." }]);
  }

  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(normalized);
  } catch {
    throw new ProductContextValidationError([
      { path: "/", message: "Response is not valid JSON." },
    ]);
  }
}

export function validateProductContextOutput(value) {
  const normalized = normalizeCandidate(value);
  if (!validateSchema(normalized)) {
    throw new ProductContextValidationError(validationIssues());
  }
  return normalized;
}
