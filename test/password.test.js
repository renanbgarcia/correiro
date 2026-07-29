import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password.js";

test("hash de senha usa salt e valida somente a senha correta", async () => {
  const first = await hashPassword("SenhaSegura@123");
  const second = await hashPassword("SenhaSegura@123");

  assert.match(first, /^scrypt\$/);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("SenhaSegura@123", first), true);
  assert.equal(await verifyPassword("senha-incorreta", first), false);
});

test("senha curta é recusada", async () => {
  await assert.rejects(() => hashPassword("123"), /pelo menos 8/);
});
