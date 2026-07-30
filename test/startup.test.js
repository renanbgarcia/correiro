import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import net from "node:net";
import path from "node:path";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function availablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  return port;
}

test(
  "entrypoint abre a porta antes de inicializar o banco",
  { timeout: 7_000 },
  async (context) => {
    const port = await availablePort();
    const startedAt = Date.now();
    const child = spawn(process.execPath, ["app.js"], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: String(port),
        MYSQL_HOST: "127.0.0.1",
        MYSQL_PORT: "1",
        WORKER_INLINE: "false"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    context.after(() => {
      if (child.exitCode === null) child.kill();
    });

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `O servidor não abriu a porta no prazo. ${stderr}`.trim()
          )
        );
      }, 3_000);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        if (chunk.includes("Servidor HTTP ouvindo")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child.once("exit", (code) => {
        if (code !== null && Date.now() - startedAt < 3_000) {
          clearTimeout(timeout);
          reject(
            new Error(
              `O processo encerrou antes de abrir a porta (${code}). ${stderr}`.trim()
            )
          );
        }
      });
    });

    assert.ok(
      Date.now() - startedAt < 3_000,
      "listen() deve ocorrer em menos de três segundos"
    );
  }
);
