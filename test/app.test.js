import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";

test("aplicação Express registra as rotas sem falhar", () => {
  const app = createApp();
  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
});

test("health informa inicialização sem consultar o banco antes da migração", async (context) => {
  const app = createApp({ isReady: () => false });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      })
  );

  const address = server.address();
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/health`
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, "startup_in_progress");
});
