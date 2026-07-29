import os from "node:os";
import { pool, query, withTransaction } from "../db.js";
import { config } from "../config.js";
import { createId } from "../lib/ids.js";
import { logger } from "../lib/logger.js";
import { buildPublicMediaUrl } from "../routes/media.js";
import {
  classifyMetaError,
  publishToMeta
} from "./meta.js";
import { createNotification } from "./notifications.js";
import { refreshPostStatus } from "./post-status.js";

const workerId = `${os.hostname()}:${process.pid}:${createId().slice(0, 8)}`;
let stopping = false;
let loopPromise;

export async function enqueueTarget(
  executor,
  targetId,
  runAt,
  reason = "publish"
) {
  const id = createId();
  await executor.execute(
    `INSERT INTO publication_jobs (
      id, target_id, idempotency_key, status, run_at, max_attempts
    ) VALUES (?, ?, ?, 'waiting', ?, ?)`,
    [
      id,
      targetId,
      `${targetId}:${reason}:${id}`,
      runAt,
      config.worker.maxAttempts
    ]
  );
  return id;
}

async function recoverStaleJobs() {
  await query(
    `UPDATE publication_jobs
     SET status = 'retry',
         locked_at = NULL,
         locked_by = NULL,
         run_at = UTC_TIMESTAMP(3),
         last_error_code = 'stale_lock_recovered',
         last_error_message = 'O worker anterior não concluiu o job.'
     WHERE status = 'locked'
       AND locked_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE)`
  );
}

async function claimJob() {
  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      `SELECT id
       FROM publication_jobs
       WHERE status IN ('waiting', 'retry')
         AND run_at <= UTC_TIMESTAMP(3)
       ORDER BY run_at, created_at
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );
    if (!rows[0]) return null;
    await connection.execute(
      `UPDATE publication_jobs
       SET status = 'locked', locked_at = UTC_TIMESTAMP(3), locked_by = ?
       WHERE id = ?`,
      [workerId, rows[0].id]
    );
    return rows[0].id;
  });
}

async function loadJob(jobId) {
  const rows = await query(
    `SELECT
       j.*,
       pt.post_id, pt.channel_id, pt.platform, pt.caption, pt.content_type,
       pt.status AS target_status, pt.external_post_id,
       pt.attempt_count AS target_attempt_count,
       p.workspace_id, p.author_id, p.status AS post_status,
       w.publishing_paused, w.time_zone,
       sc.external_id AS channel_external_id, sc.name AS channel_name,
       sc.encrypted_access_token, sc.status AS channel_status, sc.is_demo
     FROM publication_jobs j
     JOIN post_targets pt ON pt.id = j.target_id
     JOIN posts p ON p.id = pt.post_id
     JOIN workspaces w ON w.id = p.workspace_id
     JOIN social_channels sc ON sc.id = pt.channel_id
     WHERE j.id = :jobId
     LIMIT 1`,
    { jobId }
  );
  return rows[0] || null;
}

async function loadMedia(targetId) {
  const rows = await query(
    `SELECT ma.*, pm.position
     FROM post_media pm
     JOIN media_assets ma ON ma.id = pm.media_id
     WHERE pm.target_id = :targetId AND ma.deleted_at IS NULL
     ORDER BY pm.position`,
    { targetId }
  );
  return rows.map((row) => ({
    ...row,
    public_url: buildPublicMediaUrl(row.id)
  }));
}

function demoResult(job) {
  if (
    String(job.caption || "").toLowerCase().includes("#simularfalha") &&
    job.platform === "instagram" &&
    Number(job.target_attempt_count) === 0
  ) {
    const error = new Error("Falha simulada do Instagram.");
    error.code = "demo_media_rejected";
    error.permanent = true;
    throw error;
  }
  const externalId = `demo_${job.platform}_${createId().replaceAll("-", "")}`;
  return {
    externalId,
    externalUrl:
      job.platform === "facebook"
        ? `https://www.facebook.com/${externalId}`
        : `https://www.instagram.com/p/${externalId.slice(-11)}/`,
    response: { id: externalId, demo: true }
  };
}

function classifyError(error, platform) {
  if (error?.permanent) {
    return {
      temporary: false,
      code: error.code || "permanent_error",
      friendlyMessage:
        "Falha simulada no Instagram. Use Repetir para reenviar somente este canal.",
      technicalMessage: error.message
    };
  }
  return classifyMetaError(error, platform);
}

async function updateTerminalNotification(job, statusChange) {
  if (!statusChange || statusChange.previousStatus === statusChange.status) {
    return;
  }
  const terminal = new Set([
    "published",
    "partially_published",
    "failed"
  ]);
  if (!terminal.has(statusChange.status)) return;

  const messages = {
    published: {
      type: "published",
      title: "Publicação concluída",
      message: "Todos os canais publicaram o conteúdo com sucesso."
    },
    partially_published: {
      type: "partially_published",
      title: "Publicação parcialmente concluída",
      message:
        "Um canal publicou o conteúdo, mas outro precisa de atenção."
    },
    failed: {
      type: "failed",
      title: "Publicação não concluída",
      message:
        "A publicação falhou definitivamente. Veja o motivo e repita o canal."
    }
  };
  await createNotification({
    userId: job.author_id,
    workspaceId: job.workspace_id,
    ...messages[statusChange.status],
    relatedType: "post",
    relatedId: job.post_id
  });
}

async function saveDemoMetrics(targetId) {
  const seed = targetId
    .replaceAll("-", "")
    .slice(0, 8)
    .split("")
    .reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const values = {
    likes: 38 + (seed % 280),
    comments: 3 + (seed % 34),
    shares: 2 + (seed % 19),
    reach: 720 + (seed % 4200),
    impressions: 910 + (seed % 6100)
  };
  for (const [metricType, metricValue] of Object.entries(values)) {
    await query(
      `INSERT INTO metrics (
        id, target_id, metric_type, metric_value, collected_at
      ) VALUES (
        :id, :targetId, :metricType, :metricValue, UTC_TIMESTAMP(3)
      )`,
      {
        id: createId(),
        targetId,
        metricType,
        metricValue
      }
    );
  }
}

async function processClaimedJob(jobId) {
  const job = await loadJob(jobId);
  if (!job || job.status !== "locked") return;

  if (job.external_post_id || job.target_status === "published") {
    await query(
      `UPDATE publication_jobs
       SET status = 'completed', completed_at = UTC_TIMESTAMP(3),
           locked_at = NULL, locked_by = NULL
       WHERE id = :jobId`,
      { jobId }
    );
    return;
  }

  if (job.publishing_paused) {
    await query(
      `UPDATE publication_jobs
       SET status = 'retry',
           run_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 5 MINUTE),
           locked_at = NULL, locked_by = NULL,
           last_error_code = 'workspace_paused',
           last_error_message = 'A fila do workspace está pausada.'
       WHERE id = :jobId`,
      { jobId }
    );
    return;
  }

  if (job.channel_status !== "connected") {
    const error = new Error("Canal desconectado.");
    error.code = "channel_disconnected";
    error.permanent = true;
    await failJob(job, error);
    return;
  }

  const attemptNumber = Number(job.attempt_count) + 1;
  const attemptId = createId();
  await withTransaction(async (connection) => {
    await connection.execute(
      `UPDATE publication_jobs SET attempt_count = ? WHERE id = ?`,
      [attemptNumber, jobId]
    );
    await connection.execute(
      `UPDATE post_targets
       SET status = 'processing', attempt_count = ?, friendly_error = NULL
       WHERE id = ?`,
      [attemptNumber, job.target_id]
    );
    await connection.execute(
      `UPDATE posts SET status = 'processing' WHERE id = ?`,
      [job.post_id]
    );
    await connection.execute(
      `INSERT INTO publication_attempts (
        id, job_id, target_id, attempt_number, started_at
      ) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [attemptId, jobId, job.target_id, attemptNumber]
    );
  });

  try {
    const media = await loadMedia(job.target_id);
    const result = job.is_demo
      ? demoResult(job)
      : await publishToMeta({
          channel: {
            platform: job.platform,
            external_id: job.channel_external_id,
            encrypted_access_token: job.encrypted_access_token
          },
          target: {
            caption: job.caption,
            content_type: job.content_type
          },
          media
        });

    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE publication_attempts
         SET finished_at = UTC_TIMESTAMP(3), result = 'success',
             sanitized_response = ?
         WHERE id = ?`,
        [JSON.stringify(result.response || {}), attemptId]
      );
      await connection.execute(
        `UPDATE publication_jobs
         SET status = 'completed', completed_at = UTC_TIMESTAMP(3),
             locked_at = NULL, locked_by = NULL,
             last_error_code = NULL, last_error_message = NULL
         WHERE id = ?`,
        [jobId]
      );
      await connection.execute(
        `UPDATE post_targets
         SET status = 'published', published_at = UTC_TIMESTAMP(3),
             external_post_id = ?, external_url = ?,
             friendly_error = NULL, technical_error = NULL
         WHERE id = ?`,
        [result.externalId, result.externalUrl, job.target_id]
      );
    });
    // A agregação ocorre depois do commit. Jobs de canais diferentes podem
    // terminar ao mesmo tempo; fora do snapshot transacional, o último deles
    // sempre enxerga o resultado já confirmado dos demais destinos.
    const statusChange = await refreshPostStatus(job.post_id);
    if (job.is_demo) await saveDemoMetrics(job.target_id);
    await updateTerminalNotification(job, statusChange);
    logger.info("Publicação concluída", {
      jobId,
      postId: job.post_id,
      targetId: job.target_id,
      platform: job.platform,
      attempt: attemptNumber
    });
  } catch (error) {
    await failJob(job, error, { attemptId, attemptNumber });
  }
}

async function failJob(job, error, activeAttempt = null) {
  const attemptNumber =
    activeAttempt?.attemptNumber || Number(job.attempt_count) + 1;
  const attemptId = activeAttempt?.attemptId || createId();
  const failure = classifyError(error, job.platform);
  const canRetry =
    failure.temporary && attemptNumber < Number(job.max_attempts);
  const delaySeconds = Math.min(60 * 2 ** (attemptNumber - 1), 15 * 60);

  await withTransaction(async (connection) => {
    if (!activeAttempt) {
      await connection.execute(
        `INSERT INTO publication_attempts (
          id, job_id, target_id, attempt_number, started_at
        ) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [attemptId, job.id, job.target_id, attemptNumber]
      );
    }
    await connection.execute(
      `UPDATE publication_attempts
       SET finished_at = UTC_TIMESTAMP(3), result = ?,
           error_code = ?, friendly_error = ?, technical_error = ?,
           sanitized_response = ?
       WHERE id = ?`,
      [
        canRetry ? "temporary_failure" : "permanent_failure",
        failure.code,
        failure.friendlyMessage,
        String(failure.technicalMessage || "").slice(0, 10000),
        JSON.stringify(failure.sanitizedResponse || {}),
        attemptId
      ]
    );
    await connection.execute(
      `UPDATE publication_jobs
       SET status = ?,
           run_at = IF(?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND), run_at),
           attempt_count = ?,
           locked_at = NULL, locked_by = NULL,
           last_error_code = ?, last_error_message = ?
       WHERE id = ?`,
      [
        canRetry ? "retry" : "failed",
        canRetry,
        delaySeconds,
        attemptNumber,
        failure.code,
        failure.technicalMessage,
        job.id
      ]
    );
    await connection.execute(
      `UPDATE post_targets
       SET status = ?, attempt_count = ?,
           friendly_error = ?, technical_error = ?
       WHERE id = ?`,
      [
        canRetry ? "queued" : "failed",
        attemptNumber,
        failure.friendlyMessage,
        String(failure.technicalMessage || "").slice(0, 10000),
        job.target_id
      ]
    );
    if (failure.code === "token_expired") {
      await connection.execute(
        `UPDATE social_channels
         SET status = 'expired', status_message = ?
         WHERE id = ?`,
        [failure.friendlyMessage, job.channel_id]
      );
    } else if (failure.code === "permission_revoked") {
      await connection.execute(
        `UPDATE social_channels
         SET status = 'insufficient_permission', status_message = ?
         WHERE id = ?`,
        [failure.friendlyMessage, job.channel_id]
      );
    }
  });

  const statusChange = canRetry
    ? null
    : await refreshPostStatus(job.post_id);
  await updateTerminalNotification(job, statusChange);
  logger[canRetry ? "warn" : "error"]("Falha ao publicar", {
    jobId: job.id,
    postId: job.post_id,
    targetId: job.target_id,
    platform: job.platform,
    attempt: attemptNumber,
    retry: canRetry,
    code: failure.code,
    error: failure.technicalMessage
  });
}

async function workerLoop() {
  await recoverStaleJobs();
  logger.info("Worker iniciado", {
    workerId,
    concurrency: config.worker.concurrency
  });
  while (!stopping) {
    const jobIds = await Promise.all(
      Array.from({ length: config.worker.concurrency }, () => claimJob())
    );
    const available = jobIds.filter(Boolean);
    if (available.length) {
      await Promise.all(
        available.map((jobId) =>
          processClaimedJob(jobId).catch((error) =>
            logger.error("Erro não tratado no worker", {
              jobId,
              error: error.message,
              stack: error.stack
            })
          )
        )
      );
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, config.worker.pollMs));
  }
  logger.info("Worker finalizado", { workerId });
}

export function startWorker() {
  if (!loopPromise) {
    stopping = false;
    loopPromise = workerLoop().finally(() => {
      loopPromise = null;
    });
  }
  return loopPromise;
}

export async function stopWorker() {
  stopping = true;
  await loopPromise;
}

export async function runSingleWorkerCycle() {
  await recoverStaleJobs();
  const jobId = await claimJob();
  if (!jobId) return false;
  await processClaimedJob(jobId);
  return true;
}
