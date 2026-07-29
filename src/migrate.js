import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

export async function runMigrations() {
  const connection = await mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    multipleStatements: true,
    charset: "utf8mb4",
    timezone: "Z"
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const migrationsDir = path.join(config.rootDir, "migrations");
    const files = (await fs.readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const [rows] = await connection.execute(
        "SELECT version FROM schema_migrations WHERE version = ?",
        [file]
      );
      if (rows.length) continue;

      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      logger.info("Aplicando migração", { migration: file });
      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.execute(
          "INSERT INTO schema_migrations (version) VALUES (?)",
          [file]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    await connection.end();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  runMigrations()
    .then(() => logger.info("Migrações concluídas."))
    .catch((error) => {
      logger.error("Falha ao executar migrações", {
        error: error.message,
        stack: error.stack
      });
      process.exitCode = 1;
    });
}
