import { Router } from "express";
import { query } from "../db.js";
import { asyncRoute, assert, jsonData } from "../lib/http.js";
import { requireAuth, requireWorkspace } from "../middleware/auth.js";

export const analyticsRouter = Router();

function parseRange(request) {
  const preset = ["7d", "30d", "custom"].includes(request.query.period)
    ? request.query.period
    : "30d";
  let from;
  let to = new Date();
  if (preset === "custom") {
    from = new Date(request.query.from);
    to = new Date(request.query.to);
    assert(
      Number.isFinite(from.getTime()) &&
        Number.isFinite(to.getTime()) &&
        from <= to,
      422,
      "invalid_period",
      "Informe um período válido."
    );
  } else {
    const days = preset === "7d" ? 7 : 30;
    from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
  return { preset, from, to };
}

analyticsRouter.get(
  "/summary",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const { preset, from, to } = parseRange(request);
    const platform = ["facebook", "instagram"].includes(request.query.platform)
      ? request.query.platform
      : null;
    const params = {
      workspaceId: request.workspace.id,
      from,
      to,
      platform
    };
    const targetFilter = platform ? "AND pt.platform = :platform" : "";

    const [statusRows, metricRows, platformRows, topRows, syncRows] =
      await Promise.all([
        query(
          `SELECT
             COUNT(DISTINCT p.id) AS total,
             COUNT(DISTINCT CASE WHEN p.status = 'published' THEN p.id END) AS published,
             COUNT(DISTINCT CASE WHEN p.status = 'partially_published' THEN p.id END) AS partial,
             COUNT(DISTINCT CASE WHEN p.status = 'failed' THEN p.id END) AS failed
           FROM posts p
           LEFT JOIN post_targets pt ON pt.post_id = p.id
           WHERE p.workspace_id = :workspaceId
             AND p.deleted_at IS NULL
             AND p.created_at BETWEEN :from AND :to
             ${targetFilter}`,
          params
        ),
        query(
          `SELECT m.metric_type, SUM(m.metric_value) AS total
           FROM metrics m
           JOIN post_targets pt ON pt.id = m.target_id
           JOIN posts p ON p.id = pt.post_id
           WHERE p.workspace_id = :workspaceId
             AND m.collected_at BETWEEN :from AND :to
             ${targetFilter}
           GROUP BY m.metric_type`,
          params
        ),
        query(
          `SELECT pt.platform,
                  COUNT(*) AS destinations,
                  SUM(pt.status = 'published') AS published,
                  SUM(pt.status = 'failed') AS failed,
                  COALESCE(SUM(CASE WHEN m.metric_type = 'reach' THEN m.metric_value ELSE 0 END), 0) AS reach,
                  COALESCE(SUM(CASE WHEN m.metric_type IN ('likes', 'comments', 'shares') THEN m.metric_value ELSE 0 END), 0) AS engagement
           FROM post_targets pt
           JOIN posts p ON p.id = pt.post_id
           LEFT JOIN metrics m ON m.target_id = pt.id
           WHERE p.workspace_id = :workspaceId
             AND p.created_at BETWEEN :from AND :to
             ${targetFilter}
           GROUP BY pt.platform`,
          params
        ),
        query(
          `SELECT p.id, p.base_caption, p.published_at, pt.platform,
                  sc.name AS channel_name,
                  COALESCE(SUM(CASE WHEN m.metric_type = 'reach' THEN m.metric_value ELSE 0 END), 0) AS reach,
                  COALESCE(SUM(CASE WHEN m.metric_type IN ('likes', 'comments', 'shares') THEN m.metric_value ELSE 0 END), 0) AS engagement
           FROM posts p
           JOIN post_targets pt ON pt.post_id = p.id
           JOIN social_channels sc ON sc.id = pt.channel_id
           LEFT JOIN metrics m ON m.target_id = pt.id
           WHERE p.workspace_id = :workspaceId
             AND pt.status = 'published'
             AND p.published_at BETWEEN :from AND :to
             ${targetFilter}
           GROUP BY p.id, p.base_caption, p.published_at, pt.platform, sc.name
           ORDER BY engagement DESC, reach DESC
           LIMIT 5`,
          params
        ),
        query(
          `SELECT MAX(m.collected_at) AS last_synced_at
           FROM metrics m
           JOIN post_targets pt ON pt.id = m.target_id
           JOIN posts p ON p.id = pt.post_id
           WHERE p.workspace_id = :workspaceId`,
          { workspaceId: request.workspace.id }
        )
      ]);

    const metrics = Object.fromEntries(
      metricRows.map((row) => [row.metric_type, Number(row.total)])
    );
    const status = statusRows[0] || {};
    jsonData(response, {
      period: { preset, from, to },
      totals: {
        posts: Number(status.total || 0),
        published: Number(status.published || 0),
        partial: Number(status.partial || 0),
        failed: Number(status.failed || 0),
        reach: metrics.reach || 0,
        impressions: metrics.impressions || 0,
        engagement:
          (metrics.likes || 0) +
          (metrics.comments || 0) +
          (metrics.shares || 0),
        likes: metrics.likes || 0,
        comments: metrics.comments || 0,
        shares: metrics.shares || 0,
        videoViews: metrics.video_views || 0
      },
      byPlatform: platformRows.map((row) => ({
        platform: row.platform,
        destinations: Number(row.destinations || 0),
        published: Number(row.published || 0),
        failed: Number(row.failed || 0),
        reach: Number(row.reach || 0),
        engagement: Number(row.engagement || 0)
      })),
      topPosts: topRows.map((row) => ({
        id: row.id,
        caption: row.base_caption || "",
        publishedAt: row.published_at,
        platform: row.platform,
        channelName: row.channel_name,
        reach: Number(row.reach || 0),
        engagement: Number(row.engagement || 0)
      })),
      lastSyncedAt: syncRows[0]?.last_synced_at || null,
      notice:
        "As métricas disponíveis variam por plataforma e pelas permissões concedidas à Meta."
    });
  })
);
