import test from "node:test";
import assert from "node:assert/strict";
import {
  decryptSecret,
  encryptSecret,
  signValue,
  verifySignature
} from "../src/lib/crypto.js";

test("tokens sociais são cifrados com autenticação", () => {
  const original = "EAAB-token-super-secreto";
  const encrypted = encryptSecret(original);

  assert.notEqual(encrypted, original);
  assert.equal(encrypted.includes(original), false);
  assert.equal(decryptSecret(encrypted), original);
});

test("assinatura de URL pública detecta alteração", () => {
  const value = "media-id:2000000000";
  const signature = signValue(value);

  assert.equal(verifySignature(value, signature), true);
  assert.equal(verifySignature(`${value}x`, signature), false);
});
