import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidTimeZone,
  zonedDateTimeToUtc
} from "../src/lib/time.js";

test("converte horário do workspace para UTC", () => {
  const utc = zonedDateTimeToUtc(
    "2026-07-29T10:30",
    "America/Sao_Paulo"
  );
  assert.equal(utc.toISOString(), "2026-07-29T13:30:00.000Z");
});

test("valida identificadores IANA", () => {
  assert.equal(isValidTimeZone("America/Sao_Paulo"), true);
  assert.equal(isValidTimeZone("Planeta/Inexistente"), false);
});
