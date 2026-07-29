import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { asyncRoute, assert, jsonData, parsePagination } from "../lib/http.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { enqueueTarget } from "../services/jobs.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  "/overview",
  asyncRoute(async (_request, response) => {
    const [userRows, postRows, jobRows, successRows, tokenRows] =
      await Promise.all([
        query(
          `SELECT
             COUNT(*) AS total,
             SUM(status = 'active') AS active,
             SUM(status = 'suspended') AS suspended
           FROM users WHERE status <> 'deleted'`
        ),
        query(
          `SELECT
             COUNT(*) AS total,
             SUM(status = 'published') AS published,
             SUM(status = 'failed') AS failed,
             SUM(status = 'partially_published') AS partial
           FROM posts WHERE deleted_at IS NULL`
        ),
        query(
          `SELECT status, COUNT(*) AS total,
                  MIN(run_at) AS oldest_run_at
           FROM publication_jobs
           GROUP BY status`
        ),
        query(
          `SELECT pt.platform,
                  COUNT(*) AS attempts,
                  SUM(pa.result = 'success') AS successes,
                  AVG(TIMESTAMPDIFF(MICROSECOND, pa.started_at, pa.finished_at) / 1000000) AS avg_seconds
           FROM publication_attempts pa
           JOIN post_targets pt ON pt.id = pa.target_id
           WHERE pa.created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 DAY)
             AND pa.result <> 'processing'
           GROUP BY pt.platform`
        ),
        query(
          `SELECT COUNT(*) AS total
           FROM social_channels
           WHERE status IN ('expiring', 'expired')
              OR token_expires_at <= DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 7 DAY)`
        )
      ]);
    jsonData(response, {
      users: {
        total: Number(userRows[0].total || 0),
        active: Number(userRows[0].active || 0),
        suspended: Number(userRows[0].suspended || 0)
      },
      posts: {
        total: Number(postRows[0].total || 0),
        published: Number(postRows[0].published || 0),
        failed: Number(postRows[0].failed || 0),
        partial: Number(postRows[0].partial || 0)
      },
      queue: Object.fromEntries(
        jobRows.map((row) => [
          row.status,
          { total: Number(row.total), oldestRunAt: row.oldest_run_at }
        ])
      ),
      providers: successRows.map((row) => ({
        platform: row.platform,
        attempts: Number(row.attempts),
        successes: Number(row.successes),
        successRate: row.attempts
          ? Math.round((Number(row.successes) / Number(row.attempts)) * 1000) /
            10
          : 0,
        averageSeconds: Number(row.avg_seconds || 0)
      })),
      tokensRequiringAttention: Number(tokenRows[0].total || 0)
    });
  })
);

adminRouter.get(
  "/users",
  asyncRoute(async (request, response) => {
    const { page, limit, offset } = parsePagination(request, {
      limit: 25,
      maxLimit: 100
    });
    const search = String(request.query.search || "").trim();
    const params = { search: `%${search}%`, limit, offset };
    const where =
      "u.status <> 'deleted' AND (:search = '%%' OR u.name LIKE :search OR u.email LIKE :search)";
    const [rows, counts] = await Promise.all([
      query(
        `SELECT u.id, u.name, u.email, u.role, u.status, u.email_verified_at,
                u.created_at, w.id AS workspace_id, w.name AS workspace_name,
                COUNT(DISTINCT sc.id) AS channel_count
         FROM users u
         LEFT JOIN workspaces w ON w.id = u.current_workspace_id
         LEFT JOIN social_channels sc ON sc.workspace_id = w.id
         WHERE ${where}
         GROUP BY u.id, u.name, u.email, u.role, u.status,
                  u.email_verified_at, u.created_at, w.id, w.name
         ORDER BY u.created_at DESC
         LIMIT :limit OFFSET :offset`,
        params
      ),
      query(`SELECT COUNT(*) AS total FROM users u WHERE ${where}`, params)
    ]);
    jsonData(
      response,
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        status: row.status,
        emailVerifiedAt: row.email_verified_at,
        createdAt: row.created_at,
        workspace: row.workspace_id
          ? { id: row.workspace_id, name: row.workspace_name }
          : null,
        channelCount: Number(row.channel_count)
      })),
      200,
      {
        page,
        limit,
        total: Number(counts[0].total),
        pages: Math.ceil(Number(counts[0].total) / limit)
      }
    );
  })
);

adminRouter.patch(
  "/users/:id/status",
  asyncRoute(async (request, response) => {
    assert(
      ["active", "suspended"].includes(request.body.status),
      422,
      "invalid_status",
      "Use o estado ativo ou suspenso."
    );
    assert(
      request.params.id !== request.user.id ||
        request.body.status !== "suspended",
      422,
      "cannot_suspend_self",
      "Você não pode suspender a própria conta."
    );
    const result = await query(
      `UPDATE users SET status = :status
       WHERE id = :id AND status <> 'deleted'`,
      { id: request.params.id, status: request.body.status }
    );
    assert(
      result.affectedRows,
      404,
      "user_not_found",
      "Usuário não encontrado."
    );
    if (request.body.status === "suspended") {
      await query("DELETE FROM sessions WHERE user_id = :id", {
        id: request.params.id
      });
    }
    await audit(
      request,
      `admin.user_${request.body.status}`,
      { type: "user", id: request.params.id }
    );
    jsonData(response, { id: request.params.id, status: request.body.status });
  })
);

adminRouter.get(
  "/posts",
  asyncRoute(async (request, response) => {
    const { page, limit, offset } = parsePagination(request, {
      limit: 25,
      maxLimit: 100
    });
    const search = String(request.query.search || "").trim();
    const rows = await query(
      `SELECT p.id, p.base_caption, p.status, p.scheduled_at, p.published_at,
              p.created_at, w.name AS workspace_name, u.name AS author_name,
              COUNT(DISTINCT pt.id) AS target_count,
              SUM(pt.status = 'failed') AS failed_targets,
              SUM(pt.attempt_count) AS attempts
       FROM posts p
       JOIN workspaces w ON w.id = p.workspace_id
       JOIN users u ON u.id = p.author_id
       LEFT JOIN post_targets pt ON pt.post_id = p.id
       WHERE p.deleted_at IS NULL
         AND (:search = '%%' OR p.id LIKE :search OR p.base_caption LIKE :search)
       GROUP BY p.id, p.base_caption, p.status, p.scheduled_at, p.published_at,
                p.created_at, w.name, u.name
       ORDER BY p.updated_at DESC
       LIMIT :limit OFFSET :offset`,
      { search: `%${search}%`, limit, offset }
    );
    jsonData(
      response,
      rows.map((row) => ({
        id: row.id,
        caption: row.base_caption || "",
        status: row.status,
        scheduledAt: row.scheduled_at,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        workspaceName: row.workspace_name,
        authorName: row.author_name,
        targetCount: Number(row.target_count),
        failedTargets: Number(row.failed_targets),
        attempts: Number(row.attempts)
      })),
      200,
      { page, limit }
    );
  })
);

adminRouter.get(
  "/posts/:id",
  asyncRoute(async (request, response) => {
    const [postRows, targetRows, attemptRows] = await Promise.all([
      query(
        `SELECT p.*, w.name AS workspace_name, u.name AS author_name
         FROM posts p
         JOIN workspaces w ON w.id = p.workspace_id
         JOIN users u ON u.id = p.author_id
         WHERE p.id = :id LIMIT 1`,
        { id: request.params.id }
      ),
      query(
        `SELECT pt.id, pt.platform, pt.caption, pt.content_type, pt.status,
                pt.external_post_id, pt.external_url, pt.friendly_error,
                pt.technical_error, pt.attempt_count, sc.name AS channel_name,
                sc.status AS channel_status
         FROM post_targets pt
         JOIN social_channels sc ON sc.id = pt.channel_id
         WHERE pt.post_id = :id`,
        { id: request.params.id }
      ),
      query(
        `SELECT pa.id, pa.target_id, pa.attempt_number, pa.started_at,
                pa.finished_at, pa.result, pa.error_code, pa.friendly_error,
                pa.technical_error, pa.sanitized_response
         FROM publication_attempts pa
         JOIN post_targets pt ON pt.id = pa.target_id
         WHERE pt.post_id = :id
         ORDER BY pa.started_at DESC`,
        { id: request.params.id }
      )
    ]);
    assert(
      postRows[0],
      404,
      "post_not_found",
      "Publicação não encontrada."
    );
    jsonData(response, {
      post: postRows[0],
      targets: targetRows,
      attempts: attemptRows
    });
  })
);

adminRouter.post(
  "/targets/:id/reprocess",
  asyncRoute(async (request, response) => {
    const rows = await query(
      `SELECT pt.id, pt.status, pt.post_id, p.workspace_id,
              sc.status AS channel_status
       FROM post_targets pt
       JOIN posts p ON p.id = pt.post_id
       JOIN social_channels sc ON sc.id = pt.channel_id
       WHERE pt.id = :id LIMIT 1`,
      { id: request.params.id }
    );
    const target = rows[0];
    assert(target, 404, "target_not_found", "Destino não encontrado.");
    assert(
      target.status === "failed",
      409,
      "target_not_failed",
      "Somente destinos com falha podem ser reprocessados."
    );
    assert(
      target.channel_status === "connected",
      409,
      "channel_disconnected",
      "O canal precisa ser reconectado."
    );
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE post_targets
         SET status = 'scheduled', friendly_error = NULL, technical_error = NULL
         WHERE id = ?`,
        [target.id]
      );
      await connection.execute(
        "UPDATE posts SET status = 'processing' WHERE id = ?",
        [target.post_id]
      );
      await enqueueTarget(connection, target.id, new Date(), "admin-reprocess");
    });
    await audit(
      request,
      "admin.target_reprocessed",
      { type: "post", id: target.post_id },
      { targetId: target.id, workspaceId: target.workspace_id }
    );
    jsonData(response, { message: "Destino reenviado para a fila." });
  })
);

adminRouter.get(
  "/audit",
  asyncRoute(async (request, response) => {
    const rows = await query(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.metadata,
              al.created_at, u.name AS actor_name, w.name AS workspace_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       LEFT JOIN workspaces w ON w.id = al.workspace_id
       ORDER BY al.created_at DESC
       LIMIT 200`
    );
    jsonData(response, rows);
  })
);
