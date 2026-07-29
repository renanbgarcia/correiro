import { closeDatabase, pingDatabase } from "./db.js";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./migrate.js";
import { startWorker, stopWorker } from "./services/jobs.js";

await runMigrations();
await pingDatabase();
startWorker().catch((error) => {
  logger.error("Worker interrompido", {
    error: error.message,
    stack: error.stack
  });
  process.exitCode = 1;
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("Encerrando worker", { signal });
  await stopWorker();
  await closeDatabase();
  process.exit();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
