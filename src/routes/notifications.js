import { Router } from "express";
import { query } from "../db.js";
import { asyncRoute, jsonData } from "../lib/http.js";
import { requireAuth, requireWorkspace } from "../middleware/auth.js";

export const notificationRouter = Router();

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedType: row.related_type,
    relatedId: row.related_id,
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

notificationRouter.get(
  "/",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const rows = await query(
      `SELECT *
       FROM notifications
       WHERE user_id = :userId AND workspace_id = :workspaceId
       ORDER BY created_at DESC
       LIMIT 100`,
      { userId: request.user.id, workspaceId: request.workspace.id }
    );
    const unread = rows.filter((row) => !row.read_at).length;
    jsonData(response, rows.map(serialize), 200, { unread });
  })
);

notificationRouter.patch(
  "/read-all",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, UTC_TIMESTAMP(3))
       WHERE user_id = :userId AND workspace_id = :workspaceId`,
      { userId: request.user.id, workspaceId: request.workspace.id }
    );
    jsonData(response, { unread: 0 });
  })
);

notificationRouter.patch(
  "/:id/read",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, UTC_TIMESTAMP(3))
       WHERE id = :id AND user_id = :userId AND workspace_id = :workspaceId`,
      {
        id: request.params.id,
        userId: request.user.id,
        workspaceId: request.workspace.id
      }
    );
    jsonData(response, { id: request.params.id, read: true });
  })
);
