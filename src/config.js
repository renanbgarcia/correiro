import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function booleanFromEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const nodeEnv = process.env.NODE_ENV || "development";
const sessionSecret =
  process.env.SESSION_SECRET || "dev-only-correiro-session-secret-change-me";
const tokenEncryptionKey =
  process.env.TOKEN_ENCRYPTION_KEY ||
  "dev-only-correiro-token-encryption-key-change-me";

export const config = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: numberFromEnv("PORT", 3000),
  appUrl: process.env.APP_URL || "http://localhost:3000",
  rootDir,
  publicDir: path.join(rootDir, "public"),
  storageDir: path.resolve(rootDir, process.env.STORAGE_DIR || "storage"),
  database: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: numberFromEnv("MYSQL_PORT", 3306),
    database: process.env.MYSQL_DATABASE || "correiro",
    user: process.env.MYSQL_USER || "correiro",
    password: process.env.MYSQL_PASSWORD || "correiro_local",
    connectionLimit: numberFromEnv("MYSQL_CONNECTION_LIMIT", 10)
  },
  session: {
    secret: sessionSecret,
    ttlDays: numberFromEnv("SESSION_TTL_DAYS", 30),
    cookieName: "correiro_session",
    csrfCookieName: "correiro_csrf"
  },
  encryptionKey: tokenEncryptionKey,
  meta: {
    appId: process.env.META_APP_ID || "",
    appSecret: process.env.META_APP_SECRET || "",
    graphVersion: process.env.META_GRAPH_VERSION || "v23.0",
    redirectUri:
      process.env.META_REDIRECT_URI ||
      "http://localhost:3000/api/channels/meta/callback",
    demoMode: booleanFromEnv("META_DEMO_MODE", nodeEnv !== "production")
  },
  composio: {
    apiKey: process.env.COMPOSIO_API_KEY || "",
    baseUrl: process.env.COMPOSIO_BASE_URL || "",
    callbackUrl:
      process.env.COMPOSIO_CALLBACK_URL ||
      `${process.env.APP_URL || "http://localhost:3000"}/api/channels/composio/callback`,
    facebookVersion:
      process.env.COMPOSIO_FACEBOOK_VERSION || "20260721_00",
    instagramVersion:
      process.env.COMPOSIO_INSTAGRAM_VERSION || "20260721_00"
  },
  uploads: {
    maxImageBytes: numberFromEnv("MAX_IMAGE_MB", 20) * 1024 * 1024,
    maxVideoBytes: numberFromEnv("MAX_VIDEO_MB", 100) * 1024 * 1024
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: numberFromEnv("SMTP_PORT", 587),
    secure: booleanFromEnv("SMTP_SECURE", false),
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    from:
      process.env.SMTP_FROM ||
      "Correiro <nao-responda@correiro.local>"
  },
  worker: {
    pollMs: numberFromEnv("WORKER_POLL_MS", 3000),
    concurrency: numberFromEnv("WORKER_CONCURRENCY", 3),
    maxAttempts: numberFromEnv("WORKER_MAX_ATTEMPTS", 4),
    inline: booleanFromEnv("WORKER_INLINE", true)
  },
  logLevel: process.env.LOG_LEVEL || "info"
});

export function validateProductionConfig() {
  const errors = [];

  if (!config.isProduction) return errors;
  if (sessionSecret.includes("dev-only") || sessionSecret.length < 32) {
    errors.push("SESSION_SECRET deve ter pelo menos 32 caracteres.");
  }
  if (
    tokenEncryptionKey.includes("dev-only") ||
    tokenEncryptionKey.length < 32
  ) {
    errors.push("TOKEN_ENCRYPTION_KEY deve ter pelo menos 32 caracteres.");
  }
  if (config.meta.demoMode) {
    errors.push("META_DEMO_MODE deve estar desativado em produção.");
  }
  return errors;
}
