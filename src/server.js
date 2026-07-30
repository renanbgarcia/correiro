import "dotenv/config";
import { createServer } from "node:http";

const configuredPort = Number(process.env.PORT);
const port =
  Number.isInteger(configuredPort) && configuredPort >= 0
    ? configuredPort
    : 3000;

let applicationReady = false;
let shuttingDown = false;
let workerStarted = false;
let closeDatabase = async () => {};
let stopWorker = async () => {};

function fallbackLog(level, message, context = {}) {
  const output = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  });
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}

let runtimeLogger = {
  info: (message, context) => fallbackLog("info", message, context),
  warn: (message, context) => fallbackLog("warn", message, context),
  error: (message, context) => fallbackLog("error", message, context)
};

let requestHandler = (request, response) => {
  const isHealthCheck = request.url?.startsWith("/api/health");
  response.statusCode = isHealthCheck ? 503 : 200;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(
    JSON.stringify(
      isHealthCheck
        ? {
            ok: false,
            error: {
              code: "startup_in_progress",
              message: "A aplicação ainda está inicializando."
            }
          }
        : {
            ok: true,
            data: { status: "starting" }
          }
    )
  );
};

const server = createServer((request, response) => {
  requestHandler(request, response);
});

async function initializeApplication() {
  const [
    { createApp },
    databaseModule,
    { config, validateProductionConfig },
    { logger },
    { runMigrations },
    jobsModule
  ] = await Promise.all([
    import("./http-app.js"),
    import("./db.js"),
    import("./config.js"),
    import("./lib/logger.js"),
    import("./migrate.js"),
    import("./services/jobs.js")
  ]);

  runtimeLogger = logger;
  closeDatabase = databaseModule.closeDatabase;
  stopWorker = jobsModule.stopWorker;

  const configurationErrors = validateProductionConfig();
  if (configurationErrors.length) {
    for (const message of configurationErrors) {
      logger.error("Configuração de produção inválida", { error: message });
    }
    const error = new Error(
      "A configuração de produção contém valores inválidos."
    );
    error.code = "invalid_production_config";
    throw error;
  }

  requestHandler = createApp({
    isReady: () => applicationReady
  });

  await runMigrations();
  await databaseModule.pingDatabase();
  if (shuttingDown) return;

  applicationReady = true;
  logger.info("Correiro pronto", {
    port,
    environment: config.nodeEnv,
    url: config.appUrl,
    inlineWorker: config.worker.inline,
    metaDemoMode: config.meta.demoMode,
    composioConfigured: Boolean(config.composio.apiKey)
  });

  if (config.worker.inline) {
    workerStarted = true;
    jobsModule.startWorker().catch((error) => {
      applicationReady = false;
      logger.error("Worker interrompido", {
        error: error.message,
        stack: error.stack
      });
      process.exitCode = 1;
    });
  }
}

async function failStartup(error) {
  if (shuttingDown) return;
  shuttingDown = true;
  applicationReady = false;
  runtimeLogger.error("Falha ao inicializar a aplicação", {
    code: error?.code || error?.name,
    error: error?.message || String(error),
    stack: error?.stack
  });
  process.exitCode = 1;
  server.close();
  await closeDatabase().catch(() => {});
  process.exit(1);
}

server.on("error", (error) => {
  void failStartup(error);
});

server.listen(port, () => {
  runtimeLogger.info("Servidor HTTP ouvindo", {
    port,
    initialization: "pending"
  });
  void initializeApplication().catch(failStartup);
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  applicationReady = false;
  runtimeLogger.info("Encerrando aplicação", { signal });
  server.close();
  if (workerStarted) await stopWorker();
  await closeDatabase();
  process.exit();
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("unhandledRejection", (error) => {
  runtimeLogger.error("Promise rejeitada sem tratamento", {
    error: error?.message || String(error),
    stack: error?.stack
  });
});
