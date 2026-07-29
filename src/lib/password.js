import {
  randomBytes,
  scrypt as callbackScrypt,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(callbackScrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("A senha deve ter pelo menos 8 caracteres.");
  }

  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${derivedKey.toString(
    "base64url"
  )}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash?.startsWith("scrypt$")) return false;
  const [, encodedSalt, encodedHash] = storedHash.split("$");
  if (!encodedSalt || !encodedHash) return false;

  const salt = Buffer.from(encodedSalt, "base64url");
  const expected = Buffer.from(encodedHash, "base64url");
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
