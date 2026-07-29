import { createId } from "../lib/ids.js";
import { AppError } from "../lib/http.js";
import { config } from "../config.js";

const rateBuckets = new Map();

export function parseCookies(request, _response, next) {
  request.cookies = Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf("=");
        if (separator === -1) return [item, ""];
        return [
          decodeURIComponent(item.slice(0, separator)),
          decodeURIComponent(item.slice(separator + 1))
        ];
      })
  );
  next();
}

export function requestContext(request, response, next) {
  request.id = request.headers["x-request-id"] || createId();
  response.setHeader("x-request-id", request.id);
  next();
}

export function requireJson(request, _response, next) {
  const hasBody =
    Number(request.headers["content-length"] || 0) > 0 ||
    Boolean(request.headers["transfer-encoding"]);
  if (
    ["POST", "PUT", "PATCH"].includes(request.method) &&
    hasBody &&
    !request.is("application/json") &&
    !request.is("multipart/form-data")
  ) {
    return next(
      new AppError(
        415,
        "unsupported_media_type",
        "Envie os dados como JSON ou formulário de arquivo."
      )
    );
  }
  next();
}

export function csrfProtection(request, _response, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
  if (
    request.path === "/api/auth/login" ||
    request.path === "/api/auth/register" ||
    request.path === "/api/auth/forgot-password" ||
    request.path === "/api/auth/reset-password" ||
    request.path === "/api/auth/verify-email"
  ) {
    return next();
  }

  const cookie = request.cookies?.[config.session.csrfCookieName];
  const header = request.headers["x-csrf-token"];
  if (!cookie || !header || cookie !== header) {
    return next(
      new AppError(
        403,
        "invalid_csrf",
        "A sessão de segurança expirou. Atualize a página e tente novamente."
      )
    );
  }
  next();
}

export function rateLimit({
  windowMs = 15 * 60 * 1000,
  max = 10,
  keyPrefix = "default"
} = {}) {
  return (request, response, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${request.ip}`;
    const current = rateBuckets.get(key);
    const bucket =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    response.setHeader(
      "RateLimit-Reset",
      Math.ceil(bucket.resetAt / 1000).toString()
    );
    if (bucket.count > max) {
      return next(
        new AppError(
          429,
          "rate_limit",
          "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        )
      );
    }
    next();
  };
}

export function noStore(_request, response, next) {
  response.setHeader("Cache-Control", "no-store");
  next();
}
