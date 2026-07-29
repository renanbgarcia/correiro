import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { AppError, asyncRoute, assert, jsonData, parsePagination } from "../lib/http.js";
import { createId } from "../lib/ids.js";
import { isValidTimeZone, zonedDateTimeToUtc } from "../lib/time.js";
import {
  arrayValue,
  enumValue,
  optionalString
} from "../lib/validation.js";
import { requireAuth, requireWorkspace } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { enqueueTarget } from "../services/jobs.js";
import { createNotification } from "../services/notifications.js";

export const postRouter = Router();

const POST_STATUSES = [
  "draft",
  "scheduled",
  "processing",
  "published",
  "partially_published",
  "failed",
  "cancelled"
];
const MODES = ["draft", "schedule", "now"];

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function serializeMedia(row) {
  return {
    id: row.id,
    targetId: row.target_id,
    mediaType: row.media_type,
    mimeType: row.mime_type,
    originalName: row.original_name,
    sizeBytes: Number(row.size_bytes),
    width: row.width,
    height: row.height,
    durationSeconds: row.duration_seconds,
    position: row.position,
    fileUrl: `/api/media/${row.id}/file`,
    thumbnailUrl: row.thumbnail_path
      ? `/api/media/${row.id}/thumbnail`
      : `/api/media/${row.id}/file`
  };
}

function serializeTarget(row, media = []) {
  return {
    id: row.id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    channelAvatarUrl: row.channel_avatar_url,
    channelStatus: row.channel_status,
    platform: row.platform,
    caption: row.caption || "",
    contentType: row.content_type,
    status: row.status,
    publishedAt: row.published_at,
    externalPostId: row.external_post_id,
    externalUrl: row.external_url,
    friendlyError: row.friendly_error,
    attemptCount: row.attempt_count,
    media
  };
}

function serializePost(row, targets = []) {
  return {
    id: row.id,
    baseCaption: row.base_caption || "",
    status: row.status,
    scheduledAt: row.scheduled_at,
    scheduledTimeZone: row.scheduled_time_zone,
    publishedAt: row.published_at,
    lastErrorMessage: row.last_error_message,
    author: {
      id: row.author_id,
      name: row.author_name || ""
    },
    targets,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function hydratePosts(postRows) {
  if (!postRows.length) return [];
  const placeholders = postRows.map(() => "?").join(",");
  const ids = postRows.map((post) => post.id);
  const targetRows = await query(
    `SELECT pt.*, sc.name AS channel_name,
            sc.avatar_url AS channel_avatar_url,
            sc.status AS channel_status
     FROM post_targets pt
     JOIN social_channels sc ON sc.id = pt.channel_id
     WHERE pt.post_id IN (${placeholders})
     ORDER BY pt.created_at`,
    ids
  );
  const targetIds = targetRows.map((target) => target.id);
  let mediaRows = [];
  if (targetIds.length) {
    const mediaPlaceholders = targetIds.map(() => "?").join(",");
    mediaRows = await query(
      `SELECT pm.target_id, pm.position, ma.*
       FROM post_media pm
       JOIN media_assets ma ON ma.id = pm.media_id
       WHERE pm.target_id IN (${mediaPlaceholders})
       ORDER BY pm.target_id, pm.position`,
      targetIds
    );
  }
  const mediaByTarget = new Map();
  for (const row of mediaRows) {
    const list = mediaByTarget.get(row.target_id) || [];
    list.push(serializeMedia(row));
    mediaByTarget.set(row.target_id, list);
  }
  const targetsByPost = new Map();
  for (const row of targetRows) {
    const list = targetsByPost.get(row.post_id) || [];
    list.push(serializeTarget(row, mediaByTarget.get(row.id) || []));
    targetsByPost.set(row.post_id, list);
  }
  return postRows.map((post) =>
    serializePost(post, targetsByPost.get(post.id) || [])
  );
}

async function findPost(postId, workspaceId) {
  const rows = await query(
    `SELECT p.*, u.name AS author_name
     FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE p.id = :postId
       AND p.workspace_id = :workspaceId
       AND p.deleted_at IS NULL
     LIMIT 1`,
    { postId, workspaceId }
  );
  const hydrated = await hydratePosts(rows);
  return hydrated[0] || null;
}

function parseSchedule(body, mode, defaultTimeZone) {
  const timeZone = String(
    body.timeZone || body.scheduledTimeZone || defaultTimeZone
  );
  assert(
    isValidTimeZone(timeZone),
    422,
    "invalid_timezone",
    "Selecione um fuso horário válido."
  );
  if (mode === "draft") return { scheduledAt: null, timeZone };
  if (mode === "now") return { scheduledAt: new Date(), timeZone };

  let scheduledAt;
  if (body.scheduledLocal) {
    try {
      scheduledAt = zonedDateTimeToUtc(body.scheduledLocal, timeZone);
    } catch (error) {
      throw new AppError(422, "invalid_schedule", error.message);
    }
  } else {
    scheduledAt = new Date(body.scheduledAt);
  }
  assert(
    Number.isFinite(scheduledAt.getTime()),
    422,
    "invalid_schedule",
    "Informe uma data e horário válidos."
  );
  assert(
    scheduledAt.getTime() > Date.now() + 5_000,
    422,
    "schedule_in_past",
    "O agendamento precisa estar no futuro."
  );
  return { scheduledAt, timeZone };
}

async function normalizeTargets(workspaceId, rawTargets, mode) {
  const targets = arrayValue(rawTargets || [], "Canais", {
    min: mode === "draft" ? 0 : 1,
    max: 20
  });
  const channelIds = [...new Set(targets.map((target) => target.channelId))];
  assert(
    channelIds.length === targets.length,
    422,
    "duplicate_channel",
    "Cada canal pode ser selecionado apenas uma vez."
  );

  const channels = channelIds.length
    ? await query(
        `SELECT * FROM social_channels
         WHERE workspace_id = ? AND id IN (${channelIds
           .map(() => "?")
           .join(",")})`,
        [workspaceId, ...channelIds]
      )
    : [];
  const channelsById = new Map(channels.map((channel) => [channel.id, channel]));
  assert(
    channels.length === channelIds.length,
    422,
    "invalid_channel",
    "Um dos canais selecionados não pertence a este workspace."
  );

  const allMediaIds = [
    ...new Set(
      targets.flatMap((target) =>
        Array.isArray(target.mediaIds) ? target.mediaIds : []
      )
    )
  ];
  const mediaRows = allMediaIds.length
    ? await query(
        `SELECT * FROM media_assets
         WHERE workspace_id = ?
           AND deleted_at IS NULL
           AND processing_status = 'ready'
           AND id IN (${allMediaIds.map(() => "?").join(",")})`,
        [workspaceId, ...allMediaIds]
      )
    : [];
  const mediaById = new Map(mediaRows.map((media) => [media.id, media]));
  assert(
    mediaRows.length === allMediaIds.length,
    422,
    "invalid_media",
    "Uma das mídias não está pronta ou não pertence a este workspace."
  );

  return targets.map((rawTarget) => {
    const channel = channelsById.get(rawTarget.channelId);
    if (mode !== "draft") {
      assert(
        channel.status === "connected",
        422,
        "channel_disconnected",
        `${channel.name} precisa ser reconectado antes do agendamento.`
      );
    }
    const caption = optionalString(rawTarget.caption, "Legenda", {
      max: channel.platform === "instagram" ? 2200 : 63206
    }) || "";
    const mediaIds = arrayValue(rawTarget.mediaIds || [], "Mídias", {
      min: 0,
      max: channel.platform === "instagram" ? 10 : 1
    });
    const media = mediaIds.map((id) => mediaById.get(id));

    if (mode !== "draft") {
      assert(
        caption || media.length,
        422,
        "empty_post",
        "Adicione uma legenda ou mídia antes de publicar."
      );
      if (channel.platform === "instagram") {
        assert(
          media.length > 0,
          422,
          "instagram_media_required",
          "O Instagram exige pelo menos uma imagem ou vídeo."
        );
      }
    }

    let contentType = "text";
    if (media.length > 1) contentType = "carousel";
    else if (media[0]?.media_type === "video") {
      contentType =
        channel.platform === "instagram" &&
        rawTarget.contentType === "reel"
          ? "reel"
          : "video";
    } else if (media.length === 1) contentType = "image";

    if (contentType === "carousel" && mode !== "draft") {
      assert(
        media.length >= 2,
        422,
        "carousel_media_count",
        "Um carrossel precisa de pelo menos duas mídias."
      );
    }
    return {
      channel,
      caption,
      mediaIds,
      media,
      contentType
    };
  });
}

async function writePost({
  request,
  postId,
  baseCaption,
  mode,
  scheduledAt,
  timeZone,
  targets,
  update = false
}) {
  const status = mode === "draft" ? "draft" : "scheduled";
  return withTransaction(async (connection) => {
    if (update) {
      await connection.execute(
        `UPDATE posts
         SET base_caption = ?, status = ?, scheduled_at = ?,
             scheduled_time_zone = ?, last_error_message = NULL
         WHERE id = ?`,
        [baseCaption, status, scheduledAt, timeZone, postId]
      );
      await connection.execute(
        "DELETE FROM post_targets WHERE post_id = ?",
        [postId]
      );
    } else {
      await connection.execute(
        `INSERT INTO posts (
          id, workspace_id, author_id, base_caption, status,
          scheduled_at, scheduled_time_zone
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          postId,
          request.workspace.id,
          request.user.id,
          baseCaption,
          status,
          scheduledAt,
          timeZone
        ]
      );
    }

    for (const target of targets) {
      const targetId = createId();
      await connection.execute(
        `INSERT INTO post_targets (
          id, post_id, channel_id, platform, caption, content_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          targetId,
          postId,
          target.channel.id,
          target.channel.platform,
          target.caption,
          target.contentType,
          status
        ]
      );
      for (const [position, mediaId] of target.mediaIds.entries()) {
        await connection.execute(
          `INSERT INTO post_media (target_id, media_id, position)
           VALUES (?, ?, ?)`,
          [targetId, mediaId, position]
        );
      }
      if (mode !== "draft") {
        await enqueueTarget(
          connection,
          targetId,
          scheduledAt,
          mode === "now" ? "publish-now" : "schedule"
        );
      }
    }
    return postId;
  });
}

postRouter.get(
  "/",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const { page, limit, offset } = parsePagination(request, {
      limit: 25,
      maxLimit: 100
    });
    const status = POST_STATUSES.includes(request.query.status)
      ? request.query.status
      : null;
    const platform = ["facebook", "instagram"].includes(request.query.platform)
      ? request.query.platform
      : null;
    const search = String(request.query.search || "").trim();
    const from = request.query.from ? new Date(request.query.from) : null;
    const to = request.query.to ? new Date(request.query.to) : null;
    const conditions = [
      "p.workspace_id = :workspaceId",
      "p.deleted_at IS NULL"
    ];
    const params = {
      workspaceId: request.workspace.id,
      status,
      search: `%${search}%`,
      from,
      to,
      platform,
      limit,
      offset
    };
    if (status) conditions.push("p.status = :status");
    if (search) conditions.push("p.base_caption LIKE :search");
    if (from && Number.isFinite(from.getTime())) {
      conditions.push("p.scheduled_at >= :from");
    }
    if (to && Number.isFinite(to.getTime())) {
      conditions.push("p.scheduled_at <= :to");
    }
    if (platform) {
      conditions.push(
        "EXISTS (SELECT 1 FROM post_targets ptx WHERE ptx.post_id = p.id AND ptx.platform = :platform)"
      );
    }
    const where = conditions.join(" AND ");
    const [rows, counts] = await Promise.all([
      query(
        `SELECT p.*, u.name AS author_name
         FROM posts p
         JOIN users u ON u.id = p.author_id
         WHERE ${where}
         ORDER BY COALESCE(p.scheduled_at, p.updated_at) DESC
         LIMIT :limit OFFSET :offset`,
        params
      ),
      query(`SELECT COUNT(*) AS total FROM posts p WHERE ${where}`, params)
    ]);
    jsonData(response, await hydratePosts(rows), 200, {
      page,
      limit,
      total: Number(counts[0].total),
      pages: Math.ceil(Number(counts[0].total) / limit)
    });
  })
);

postRouter.get(
  "/dashboard",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const [summaryRows, upcomingRows, failureRows, channelRows] =
      await Promise.all([
        query(
          `SELECT
             COUNT(*) AS total,
             SUM(status = 'published') AS published,
             SUM(status = 'scheduled') AS scheduled,
             SUM(status = 'failed') AS failed,
             SUM(status = 'partially_published') AS partial
           FROM posts
           WHERE workspace_id = :workspaceId
             AND deleted_at IS NULL
             AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 30 DAY)`,
          { workspaceId: request.workspace.id }
        ),
        query(
          `SELECT p.*, u.name AS author_name
           FROM posts p
           JOIN users u ON u.id = p.author_id
           WHERE p.workspace_id = :workspaceId
             AND p.deleted_at IS NULL
             AND p.status = 'scheduled'
             AND p.scheduled_at >= UTC_TIMESTAMP(3)
           ORDER BY p.scheduled_at
           LIMIT 5`,
          { workspaceId: request.workspace.id }
        ),
        query(
          `SELECT p.*, u.name AS author_name
           FROM posts p
           JOIN users u ON u.id = p.author_id
           WHERE p.workspace_id = :workspaceId
             AND p.deleted_at IS NULL
             AND p.status IN ('failed', 'partially_published')
           ORDER BY p.updated_at DESC
           LIMIT 4`,
          { workspaceId: request.workspace.id }
        ),
        query(
          `SELECT status, COUNT(*) AS total
           FROM social_channels
           WHERE workspace_id = :workspaceId
           GROUP BY status`,
          { workspaceId: request.workspace.id }
        )
      ]);
    const summary = summaryRows[0] || {};
    jsonData(response, {
      summary: {
        total: Number(summary.total || 0),
        published: Number(summary.published || 0),
        scheduled: Number(summary.scheduled || 0),
        failed: Number(summary.failed || 0),
        partial: Number(summary.partial || 0)
      },
      upcoming: await hydratePosts(upcomingRows),
      failures: await hydratePosts(failureRows),
      channels: Object.fromEntries(
        channelRows.map((row) => [row.status, Number(row.total)])
      )
    });
  })
);

postRouter.post(
  "/",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const mode = enumValue(request.body.mode || "draft", "Modo", MODES);
    const baseCaption =
      optionalString(request.body.baseCaption, "Legenda principal", {
        max: 63206
      }) || "";
    const schedule = parseSchedule(
      request.body,
      mode,
      request.workspace.timeZone
    );
    const targets = await normalizeTargets(
      request.workspace.id,
      request.body.targets,
      mode
    );
    const postId = createId();
    await writePost({
      request,
      postId,
      baseCaption,
      mode,
      scheduledAt: schedule.scheduledAt,
      timeZone: schedule.timeZone,
      targets
    });
    await audit(
      request,
      mode === "draft" ? "post.draft_created" : "post.scheduled",
      { type: "post", id: postId },
      {
        mode,
        scheduledAt: schedule.scheduledAt?.toISOString() || null,
        targetCount: targets.length
      }
    );
    jsonData(response, await findPost(postId, request.workspace.id), 201);
  })
);

postRouter.get(
  "/:id",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const post = await findPost(request.params.id, request.workspace.id);
    assert(post, 404, "post_not_found", "Publicação não encontrada.");
    const attempts = await query(
      `SELECT pa.id, pa.target_id, pa.attempt_number, pa.started_at,
              pa.finished_at, pa.result, pa.error_code, pa.friendly_error,
              pa.sanitized_response
       FROM publication_attempts pa
       JOIN post_targets pt ON pt.id = pa.target_id
       WHERE pt.post_id = :postId
       ORDER BY pa.started_at DESC`,
      { postId: post.id }
    );
    jsonData(response, {
      ...post,
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        targetId: attempt.target_id,
        attemptNumber: attempt.attempt_number,
        startedAt: attempt.started_at,
        finishedAt: attempt.finished_at,
        result: attempt.result,
        errorCode: attempt.error_code,
        friendlyError: attempt.friendly_error,
        response: parseJson(attempt.sanitized_response, {})
      }))
    });
  })
);

postRouter.put(
  "/:id",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const existing = await findPost(request.params.id, request.workspace.id);
    assert(existing, 404, "post_not_found", "Publicação não encontrada.");
    assert(
      ["draft", "scheduled", "failed", "cancelled"].includes(existing.status),
      409,
      "post_not_editable",
      "Uma publicação em processamento ou já publicada não pode ser editada."
    );
    const mode = enumValue(request.body.mode || "draft", "Modo", MODES);
    const baseCaption =
      optionalString(request.body.baseCaption, "Legenda principal", {
        max: 63206
      }) || "";
    const schedule = parseSchedule(
      request.body,
      mode,
      request.workspace.timeZone
    );
    const targets = await normalizeTargets(
      request.workspace.id,
      request.body.targets,
      mode
    );
    await writePost({
      request,
      postId: existing.id,
      baseCaption,
      mode,
      scheduledAt: schedule.scheduledAt,
      timeZone: schedule.timeZone,
      targets,
      update: true
    });
    await audit(request, "post.updated", {
      type: "post",
      id: existing.id
    }, { mode });
    jsonData(response, await findPost(existing.id, request.workspace.id));
  })
);

postRouter.patch(
  "/:id/reschedule",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const existing = await findPost(request.params.id, request.workspace.id);
    assert(existing, 404, "post_not_found", "Publicação não encontrada.");
    assert(
      ["draft", "scheduled", "failed", "cancelled"].includes(existing.status),
      409,
      "post_not_reschedulable",
      "Esta publicação não pode ser reagendada."
    );
    assert(
      existing.targets.length > 0,
      422,
      "target_required",
      "Selecione pelo menos um canal."
    );
    const schedule = parseSchedule(
      request.body,
      "schedule",
      request.workspace.timeZone
    );
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE posts
         SET status = 'scheduled', scheduled_at = ?,
             scheduled_time_zone = ?, last_error_message = NULL
         WHERE id = ?`,
        [schedule.scheduledAt, schedule.timeZone, existing.id]
      );
      await connection.execute(
        `UPDATE publication_jobs pj
         JOIN post_targets pt ON pt.id = pj.target_id
         SET pj.status = 'cancelled'
         WHERE pt.post_id = ? AND pj.status IN ('waiting', 'retry', 'failed')`,
        [existing.id]
      );
      for (const target of existing.targets) {
        assert(
          target.channelStatus === "connected",
          422,
          "channel_disconnected",
          `${target.channelName} precisa ser reconectado.`
        );
        await connection.execute(
          `UPDATE post_targets
           SET status = 'scheduled', friendly_error = NULL, technical_error = NULL
           WHERE id = ?`,
          [target.id]
        );
        await enqueueTarget(
          connection,
          target.id,
          schedule.scheduledAt,
          "reschedule"
        );
      }
    });
    await audit(
      request,
      "post.rescheduled",
      { type: "post", id: existing.id },
      { scheduledAt: schedule.scheduledAt.toISOString() }
    );
    jsonData(response, await findPost(existing.id, request.workspace.id));
  })
);

postRouter.post(
  "/:id/publish-now",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const existing = await findPost(request.params.id, request.workspace.id);
    assert(existing, 404, "post_not_found", "Publicação não encontrada.");
    assert(
      ["draft", "scheduled", "failed", "cancelled"].includes(existing.status),
      409,
      "post_not_publishable",
      "Esta publicação não pode ser enviada agora."
    );
    assert(
      existing.targets.length > 0,
      422,
      "target_required",
      "Selecione pelo menos um canal."
    );
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE publication_jobs pj
         JOIN post_targets pt ON pt.id = pj.target_id
         SET pj.status = 'cancelled'
         WHERE pt.post_id = ? AND pj.status IN ('waiting', 'retry', 'failed')`,
        [existing.id]
      );
      await connection.execute(
        `UPDATE posts
         SET status = 'scheduled', scheduled_at = UTC_TIMESTAMP(3),
             scheduled_time_zone = ?
         WHERE id = ?`,
        [request.workspace.timeZone, existing.id]
      );
      for (const target of existing.targets) {
        assert(
          target.channelStatus === "connected",
          422,
          "channel_disconnected",
          `${target.channelName} precisa ser reconectado.`
        );
        assert(
          target.caption || target.media.length,
          422,
          "empty_post",
          "Adicione conteúdo antes de publicar."
        );
        if (target.platform === "instagram") {
          assert(
            target.media.length > 0,
            422,
            "instagram_media_required",
            "O Instagram exige uma imagem ou vídeo."
          );
        }
        await connection.execute(
          `UPDATE post_targets
           SET status = 'scheduled', friendly_error = NULL, technical_error = NULL
           WHERE id = ?`,
          [target.id]
        );
        await enqueueTarget(
          connection,
          target.id,
          new Date(),
          "publish-now"
        );
      }
    });
    await audit(request, "post.publish_now", {
      type: "post",
      id: existing.id
    });
    jsonData(response, {
      message: "Publicação enviada para processamento.",
      post: await findPost(existing.id, request.workspace.id)
    });
  })
);

postRouter.post(
  "/:id/cancel",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const existing = await findPost(request.params.id, request.workspace.id);
    assert(existing, 404, "post_not_found", "Publicação não encontrada.");
    assert(
      ["draft", "scheduled", "failed"].includes(existing.status),
      409,
      "post_not_cancellable",
      "Esta publicação não pode ser cancelada."
    );
    await withTransaction(async (connection) => {
      await connection.execute(
        "UPDATE posts SET status = 'cancelled' WHERE id = ?",
        [existing.id]
      );
      await connection.execute(
        `UPDATE post_targets
         SET status = IF(status = 'published', status, 'cancelled')
         WHERE post_id = ?`,
        [existing.id]
      );
      await connection.execute(
        `UPDATE publication_jobs pj
         JOIN post_targets pt ON pt.id = pj.target_id
         SET pj.status = 'cancelled'
         WHERE pt.post_id = ? AND pj.status IN ('waiting', 'retry')`,
        [existing.id]
      );
    });
    await createNotification({
      userId: request.user.id,
      workspaceId: request.workspace.id,
      type: "schedule_cancelled",
      title: "Agendamento cancelado",
      message: "A publicação foi removida da fila.",
      relatedType: "post",
      relatedId: existing.id
    });
    await audit(request, "post.cancelled", {
      type: "post",
      id: existing.id
    });
    jsonData(response, await findPost(existing.id, request.workspace.id));
  })
);

postRouter.post(
  "/:id/retry/:targetId",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const existing = await findPost(request.params.id, request.workspace.id);
    assert(existing, 404, "post_not_found", "Publicação não encontrada.");
    const target = existing.targets.find(
      (item) => item.id === request.params.targetId
    );
    assert(target, 404, "target_not_found", "Destino não encontrado.");
    assert(
      target.status === "failed",
      409,
      "target_not_failed",
      "Somente um canal com falha pode ser repetido."
    );
    assert(
      target.channelStatus === "connected",
      422,
      "channel_disconnected",
      "Reconecte o canal antes de repetir."
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
        [existing.id]
      );
      await enqueueTarget(connection, target.id, new Date(), "manual-retry");
    });
    await audit(
      request,
      "post.target_retried",
      { type: "post", id: existing.id },
      { targetId: target.id, platform: target.platform }
    );
    jsonData(response, {
      message: `${target.channelName} foi reenviado para a fila.`
    });
  })
);

postRouter.post(
  "/:id/duplicate",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const existing = await findPost(request.params.id, request.workspace.id);
    assert(existing, 404, "post_not_found", "Publicação não encontrada.");
    const newPostId = createId();
    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO posts (
          id, workspace_id, author_id, base_caption, status,
          scheduled_time_zone
        ) VALUES (?, ?, ?, ?, 'draft', ?)`,
        [
          newPostId,
          request.workspace.id,
          request.user.id,
          existing.baseCaption,
          request.workspace.timeZone
        ]
      );
      for (const target of existing.targets) {
        const targetId = createId();
        await connection.execute(
          `INSERT INTO post_targets (
            id, post_id, channel_id, platform, caption, content_type, status
          ) VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
          [
            targetId,
            newPostId,
            target.channelId,
            target.platform,
            target.caption,
            target.contentType
          ]
        );
        for (const [position, media] of target.media.entries()) {
          await connection.execute(
            `INSERT INTO post_media (target_id, media_id, position)
             VALUES (?, ?, ?)`,
            [targetId, media.id, position]
          );
        }
      }
    });
    await audit(
      request,
      "post.duplicated",
      { type: "post", id: newPostId },
      { sourcePostId: existing.id }
    );
    jsonData(response, await findPost(newPostId, request.workspace.id), 201);
  })
);

postRouter.delete(
  "/:id",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const existing = await findPost(request.params.id, request.workspace.id);
    assert(existing, 404, "post_not_found", "Publicação não encontrada.");
    assert(
      existing.status !== "processing",
      409,
      "post_processing",
      "Aguarde o processamento terminar antes de excluir."
    );
    await withTransaction(async (connection) => {
      await connection.execute(
        "UPDATE posts SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?",
        [existing.id]
      );
      await connection.execute(
        `UPDATE publication_jobs pj
         JOIN post_targets pt ON pt.id = pj.target_id
         SET pj.status = 'cancelled'
         WHERE pt.post_id = ? AND pj.status IN ('waiting', 'retry')`,
        [existing.id]
      );
    });
    await audit(request, "post.deleted", {
      type: "post",
      id: existing.id
    });
    jsonData(response, { message: "Publicação excluída." });
  })
);
