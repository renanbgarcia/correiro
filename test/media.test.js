import test from "node:test";
import assert from "node:assert/strict";
import { verifySignature } from "../src/lib/crypto.js";
import { buildPublicMediaUrl } from "../src/routes/media.js";

test("URL publica de midia assinada nao usa query string", () => {
  const mediaId = "media_123";
  const url = new URL(buildPublicMediaUrl(mediaId));
  const segments = url.pathname.split("/");
  const signature = decodeURIComponent(segments.at(-1));
  const expires = Number(segments.at(-2));

  assert.equal(url.search, "");
  assert.equal(segments.at(-3), mediaId);
  assert.ok(expires > Math.floor(Date.now() / 1000));
  assert.equal(verifySignature(`${mediaId}:${expires}`, signature), true);
});
