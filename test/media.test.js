import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { config } from "../src/config.js";
import { verifySignature } from "../src/lib/crypto.js";
import {
  buildPublicMediaUrl,
  resolveMediaStoragePath
} from "../src/routes/media.js";

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

test("caminho de mídia usa o diretório da implantação atual", () => {
  const resolved = resolveMediaStoragePath({
    id: "media_123",
    storage_name: "media_123.jpg",
    storage_path: "/home/usuario/implantacao-antiga/uploads/media_123.jpg"
  });

  assert.equal(
    resolved,
    path.resolve(config.storageDir, "uploads", "media_123.jpg")
  );
});

test("nome de arquivo de mídia não permite sair do storage", () => {
  assert.throws(
    () =>
      resolveMediaStoragePath({
        id: "media_123",
        storage_name: "../fora.jpg"
      }),
    /Caminho de mídia inválido/
  );
});
