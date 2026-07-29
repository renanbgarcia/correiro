import { query } from "../db.js";
import { createId } from "../lib/ids.js";

export async function audit(request, action, entity = {}, metadata = {}) {
  const workspaceId =
    request.workspace?.id || request.user?.currentWorkspaceId || null;
  await query(
    `INSERT INTO audit_logs (
      id, workspace_id, actor_user_id, action, entity_type, entity_id,
      ip_address, user_agent, metadata
    ) VALUES (
      :id, :workspaceId, :actorId, :action, :entityType, :entityId,
      :ipAddress, :userAgent, :metadata
    )`,
    {
      id: createId(),
      workspaceId,
      actorId: request.user?.id || null,
      action,
      entityType: entity.type || null,
      entityId: entity.id || null,
      ipAddress: request.ip || null,
      userAgent: String(request.headers["user-agent"] || "").slice(0, 500),
      metadata: JSON.stringify(metadata || {})
    }
  );
}
