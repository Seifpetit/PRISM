import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts provider access tokens before they are written to the database.
// Key: INTEGRATION_ENCRYPTION_KEY, 32 random bytes as base64. Generate with:
//   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"

const VERSION = "v1";

function encryptionKey() {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) throw new Error("INTEGRATION_ENCRYPTION_KEY is not set; refusing to store an access token.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("INTEGRATION_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  return key;
}

export function encryptToken(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), encrypted].map((part) => (typeof part === "string" ? part : part.toString("base64"))).join(":");
}

export function decryptToken(stored) {
  const [version, iv, tag, encrypted] = String(stored).split(":");
  if (version !== VERSION || !iv || !tag || !encrypted) throw new Error("Unrecognized stored token format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}
