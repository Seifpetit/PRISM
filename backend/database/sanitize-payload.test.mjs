import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeOperationPayload } from "./sanitize-payload.mjs";

test("operation payload sanitizer removes credentials before persistence", () => {
  const result = sanitizeOperationPayload({
    authorization: "Bearer secret",
    api_key: "secret",
    input_tokens: 42,
    nested: { password: "secret", label: "safe" },
  });
  assert.equal(result.content.authorization, "[REDACTED]");
  assert.equal(result.content.api_key, "[REDACTED]");
  assert.equal(result.content.input_tokens, 42);
  assert.equal(result.content.nested.password, "[REDACTED]");
  assert.equal(result.content.nested.label, "safe");
  assert.equal(result.redactionStatus, "redacted");
});

test("operation payload sanitizer strips signed URL credentials and binary data", () => {
  const result = sanitizeOperationPayload({
    url: "https://example.test/file?X-Amz-Signature=secret&part=1",
    image: "data:image/png;base64,abcdef",
  });
  assert.match(result.content.url, /X-Amz-Signature=%5BREDACTED%5D/i);
  assert.match(result.content.image, /^\[BINARY_DATA_REDACTED:/);
  assert.equal(result.redactionStatus, "redacted");
});
