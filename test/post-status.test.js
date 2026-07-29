import test from "node:test";
import assert from "node:assert/strict";
import { aggregatePostStatus } from "../src/services/post-status.js";

test("agrega sucesso total", () => {
  assert.equal(
    aggregatePostStatus(["published", "published"], "processing"),
    "published"
  );
});

test("agrega publicação parcial sem esconder a falha", () => {
  assert.equal(
    aggregatePostStatus(["published", "failed"], "processing"),
    "partially_published"
  );
});

test("mantém processamento enquanto algum destino está na fila", () => {
  assert.equal(
    aggregatePostStatus(["published", "queued"], "scheduled"),
    "processing"
  );
});

test("agrega falha total", () => {
  assert.equal(
    aggregatePostStatus(["failed", "failed"], "processing"),
    "failed"
  );
});
