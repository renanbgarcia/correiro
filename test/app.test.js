import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

test("aplicação Express registra as rotas sem falhar", () => {
  const app = createApp();
  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
});
