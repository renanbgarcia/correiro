import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { AppError } from "./lib/http.js";
import { logger } from "./lib/logger.js";
import {
  optionalAuth
} from "./middleware/auth.js";
import {
  csrfProtection,
  noStore,
  parseCookies,
  requestContext,
  requireJson
} from "./middleware/security.js";
import { adminRouter } from "./routes/admin.js";
import { analyticsRouter } from "./routes/analytics.js";
import { authRouter } from "./routes/auth.js";
import { channelRouter } from "./routes/channels.js";
import { mediaRouter } from "./routes/media.js";
import { notificationRouter } from "./routes/notifications.js";
import { postRouter } from "./routes/posts.js";
import { workspaceRouter } from "./routes/workspaces.js";
import { pingDatabase } from "./db.js";

export function createApp(options = {}) {
  const isReady = options.isReady || (() => true);
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      },
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(requestContext);
  app.use(parseCookies);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false, limit: "2mb" }));
  app.use(requireJson);
  app.use(optionalAuth);
  app.use(csrfProtection);

  app.get("/api/health", noStore, async (_request, response) => {
    if (!isReady()) {
      return response.status(503).json({
        ok: false,
        error: {
          code: "startup_in_progress",
          message: "A aplicação ainda está inicializando."
        }
      });
    }
    try {
      await pingDatabase();
      response.json({
        ok: true,
        data: {
          status: "healthy",
          database: "connected",
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      response.status(503).json({
        ok: false,
        error: {
          code: "database_unavailable",
          message: "Banco de dados indisponível."
        }
      });
    }
  });

  app.use("/api/auth", noStore, authRouter);
  app.use("/api/workspaces", noStore, workspaceRouter);
  app.use("/api/channels", noStore, channelRouter);
  app.use("/api/media", noStore, mediaRouter);
  app.use("/api/posts", noStore, postRouter);
  app.use("/api/notifications", noStore, notificationRouter);
  app.use("/api/analytics", noStore, analyticsRouter);
  app.use("/api/admin", noStore, adminRouter);

  app.use(
    express.static(config.publicDir, {
      maxAge: config.isProduction ? "1h" : 0,
      etag: true,
      index: "index.html"
    })
  );
  app.get("*splat", (_request, response) => {
    response.sendFile(`${config.publicDir}/index.html`);
  });

  app.use((error, request, response, _next) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      error = new AppError(
        413,
        "file_too_large",
        "O arquivo ultrapassa o limite permitido."
      );
    }
    const status =
      error instanceof AppError
        ? error.status
        : Number(error.status || error.statusCode) || 500;
    const code =
      error instanceof AppError ? error.code : "internal_server_error";
    const message =
      error instanceof AppError
        ? error.message
        : "Não foi possível concluir esta operação.";
    logger[status >= 500 ? "error" : "warn"]("Erro em requisição", {
      requestId: request.id,
      method: request.method,
      path: request.originalUrl,
      status,
      code,
      error: error.message,
      stack: status >= 500 ? error.stack : undefined
    });
    if (response.headersSent) return;
    response.status(status).json({
      ok: false,
      error: {
        code,
        message,
        ...(error.details ? { details: error.details } : {}),
        requestId: request.id
      }
    });
  });

  return app;
}
