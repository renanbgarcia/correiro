import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import { config } from "../config.js";

function encryptionKey() {
  return createHash("sha256").update(config.encryptionKey).digest();
}

export function encryptSecret(value) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, encrypted]
    .map((part) =>
      typeof part === "string" ? part : part.toString("base64url")
    )
    .join(".");
}

export function decryptSecret(payload) {
  if (!payload) return null;
  const [version, encodedIv, encodedTag, encodedValue] = payload.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedValue) {
    throw new Error("Segredo criptografado inválido.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(encodedIv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encodedValue, "base64url")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

export function hashToken(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function signValue(value) {
  return createHmac("sha256", config.session.secret)
    .update(String(value))
    .digest("base64url");
}

export function verifySignature(value, signature) {
  if (!signature) return false;
  const expected = Buffer.from(signValue(value));
  const received = Buffer.from(String(signature));
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
