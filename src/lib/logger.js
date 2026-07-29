import { config } from "../config.js";

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = levels[config.logLevel] || levels.info;

function sanitize(value) {
  if (!value || typeof value !== "object") return value;
  const blocked = new Set([
    "access_token",
    "accessToken",
    "refresh_token",
    "refreshToken",
    "password",
    "token"
  ]);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      blocked.has(key)
        ? "[redacted]"
        : typeof item === "object"
          ? sanitize(item)
          : item
    ])
  );
}

function write(level, message, context = {}) {
  if (levels[level] < threshold) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitize(context)
  };
  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}

export const logger = {
  debug: (message, context) => write("debug", message, context),
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context)
};
