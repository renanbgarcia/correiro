export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function assert(condition, status, code, message, details) {
  if (!condition) throw new AppError(status, code, message, details);
}

export function parsePagination(request, defaults = {}) {
  const fallbackLimit = defaults.limit || 25;
  const maxLimit = defaults.maxLimit || 100;
  const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number.parseInt(request.query.limit, 10) || fallbackLimit)
  );
  return { page, limit, offset: (page - 1) * limit };
}

export function jsonData(response, data, status = 200, meta = undefined) {
  return response.status(status).json({
    ok: true,
    data,
    ...(meta ? { meta } : {})
  });
}
