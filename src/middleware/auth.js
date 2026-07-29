import { config } from "../config.js";
import { query } from "../db.js";
import { hashToken } from "../lib/crypto.js";
import { AppError } from "../lib/http.js";

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    emailNotificationsEnabled: Boolean(row.email_notifications_enabled),
    currentWorkspaceId: row.current_workspace_id,
    createdAt: row.created_at
  };
}

export async function optionalAuth(request, _response, next) {
  try {
    const token = request.cookies?.[config.session.cookieName];
    if (!token) return next();

    const rows = await query(
      `SELECT u.*, s.id AS session_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = :tokenHash
         AND s.expires_at > UTC_TIMESTAMP(3)
       LIMIT 1`,
      { tokenHash: hashToken(token) }
    );
    const row = rows[0];
    if (!row || row.status !== "active") return next();

    request.user = normalizeUser(row);
    request.sessionId = row.session_id;
    if (Math.random() < 0.05) {
      query(
        "UPDATE sessions SET last_seen_at = UTC_TIMESTAMP(3) WHERE id = :id",
        { id: row.session_id }
      ).catch(() => {});
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(request, _response, next) {
  if (!request.user) {
    return next(
      new AppError(
        401,
        "authentication_required",
        "Entre na sua conta para continuar."
      )
    );
  }
  next();
}

export async function requireWorkspace(request, _response, next) {
  try {
    if (!request.user) {
      throw new AppError(
        401,
        "authentication_required",
        "Entre na sua conta para continuar."
      );
    }
    if (!request.user.currentWorkspaceId) {
      throw new AppError(
        409,
        "workspace_required",
        "Crie ou selecione um workspace para continuar."
      );
    }

    const rows = await query(
      `SELECT w.*, wm.role AS member_role
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE w.id = :workspaceId AND wm.user_id = :userId
       LIMIT 1`,
      {
        workspaceId: request.user.currentWorkspaceId,
        userId: request.user.id
      }
    );
    if (!rows[0]) {
      throw new AppError(
        403,
        "workspace_forbidden",
        "Você não possui acesso a este workspace."
      );
    }
    request.workspace = {
      id: rows[0].id,
      name: rows[0].name,
      imageUrl: rows[0].image_url,
      timeZone: rows[0].time_zone,
      publishingPaused: Boolean(rows[0].publishing_paused),
      memberRole: rows[0].member_role,
      createdAt: rows[0].created_at
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(request, _response, next) {
  if (!request.user || request.user.role !== "admin") {
    return next(
      new AppError(
        403,
        "admin_required",
        "Esta área é restrita à administração."
      )
    );
  }
  next();
}
