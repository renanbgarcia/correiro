import mysql from "mysql2/promise";
import { config } from "./config.js";

export const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: config.database.password,
  connectionLimit: config.database.connectionLimit,
  timezone: "Z",
  charset: "utf8mb4",
  decimalNumbers: true,
  supportBigNumbers: true,
  namedPlaceholders: true
});

export async function query(sql, params = {}) {
  // `query` mantém escaping de parâmetros e também aceita LIMIT/OFFSET e
  // verificações opcionais com NULL, combinações que variam entre versões do
  // protocolo de prepared statements do MySQL. Escritas transacionais críticas
  // continuam usando `execute` diretamente na conexão.
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function pingDatabase() {
  await query("SELECT 1 AS ok");
  return true;
}

export async function closeDatabase() {
  await pool.end();
}
