import { createServer } from "node:http";
import { createApp } from "./app.js";
import { closeDatabase, pingDatabase } from "./db.js";
import { config, validateProductionConfig } from "./config.js";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./migrate.js";
import { startWorker, stopWorker } from "./services/jobs.js";

const configurationErrors = validateProductionConfig();
if (configurationErrors.length) {
  for (const message of configurationErrors) {
    logger.error("Configuração de produção inválida", { error: message });
  }
  process.exit(1);
}

await runMigrations();
await pingDatabase();

const app = createApp();
const server = createServer(app);
server.listen(config.port, () => {
  logger.info("Correiro iniciado", {
    port: config.port,
    environment: config.nodeEnv,
    url: config.appUrl,
    inlineWorker: config.worker.inline,
    metaDemoMode: config.meta.demoMode,
    composioConfigured: Boolean(config.composio.apiKey)
  });
});

if (config.worker.inline) {
  startWorker().catch((error) => {
    logger.error("Worker interrompido", {
      error: error.message,
      stack: error.stack
    });
    process.exitCode = 1;
  });
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("Encerrando aplicação", { signal });
  server.close();
  if (config.worker.inline) await stopWorker();
  await closeDatabase();
  process.exit();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  logger.error("Promise rejeitada sem tratamento", {
    error: error?.message || String(error),
    stack: error?.stack
  });
});
