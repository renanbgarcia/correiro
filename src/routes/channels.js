import { Router } from "express";
import { config } from "../config.js";
import { query } from "../db.js";
import {
  createOpaqueToken,
  encryptSecret,
  hashToken
} from "../lib/crypto.js";
import { asyncRoute, assert, jsonData } from "../lib/http.js";
import { createId } from "../lib/ids.js";
import { requireAuth, requireWorkspace } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import {
  discoverMetaChannels,
  exchangeAuthorizationCode,
  getMetaAuthorizationUrl
} from "../services/meta.js";

export const channelRouter = Router();

function serializeChannel(row) {
  const permissions =
    typeof row.permissions === "string"
      ? JSON.parse(row.permissions)
      : row.permissions || [];
  return {
    id: row.id,
    platform: row.platform,
    externalId: row.external_id,
    name: row.name,
    username: row.username,
    avatarUrl: row.avatar_url,
    accountType: row.account_type,
    associatedPageId: row.associated_page_id,
    tokenExpiresAt: row.token_expires_at,
    permissions,
    status: row.status,
    statusMessage: row.status_message,
    isDemo: Boolean(row.is_demo),
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at
  };
}

channelRouter.get(
  "/",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    await query(
      `UPDATE social_channels
       SET status = CASE
         WHEN token_expires_at <= UTC_TIMESTAMP(3) THEN 'expired'
         WHEN token_expires_at <= DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 7 DAY) THEN 'expiring'
         ELSE status
       END
       WHERE workspace_id = :workspaceId
         AND status IN ('connected', 'expiring')
         AND token_expires_at IS NOT NULL`,
      { workspaceId: request.workspace.id }
    );
    const channels = await query(
      `SELECT * FROM social_channels
       WHERE workspace_id = :workspaceId
       ORDER BY platform, name`,
      { workspaceId: request.workspace.id }
    );
    jsonData(response, channels.map(serializeChannel));
  })
);

channelRouter.get(
  "/meta/url",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    assert(
      config.meta.appId && config.meta.appSecret,
      409,
      "meta_not_configured",
      "Configure META_APP_ID e META_APP_SECRET para conectar contas reais."
    );
    const state = createOpaqueToken();
    await query(
      `INSERT INTO oauth_states (
        id, workspace_id, user_id, state_hash, expires_at
      ) VALUES (
        :id, :workspaceId, :userId, :stateHash,
        DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE)
      )`,
      {
        id: createId(),
        workspaceId: request.workspace.id,
        userId: request.user.id,
        stateHash: hashToken(state)
      }
    );
    jsonData(response, { url: getMetaAuthorizationUrl(state) });
  })
);

channelRouter.get(
  "/meta/callback",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    if (request.query.error) {
      return response.redirect(
        `/?route=channels&meta=error&message=${encodeURIComponent(
          request.query.error_description || "A conexão foi cancelada."
        )}`
      );
    }
    const state = String(request.query.state || "");
    const code = String(request.query.code || "");
    assert(
      state && code,
      400,
      "invalid_oauth_callback",
      "O retorno da Meta está incompleto."
    );
    const states = await query(
      `SELECT id FROM oauth_states
       WHERE state_hash = :stateHash
         AND workspace_id = :workspaceId
         AND user_id = :userId
         AND used_at IS NULL
         AND expires_at > UTC_TIMESTAMP(3)
       LIMIT 1`,
      {
        stateHash: hashToken(state),
        workspaceId: request.workspace.id,
        userId: request.user.id
      }
    );
    assert(
      states[0],
      400,
      "invalid_oauth_state",
      "A tentativa de conexão expirou. Inicie novamente."
    );
    await query(
      "UPDATE oauth_states SET used_at = UTC_TIMESTAMP(3) WHERE id = :id",
      { id: states[0].id }
    );

    const credentials = await exchangeAuthorizationCode(code);
    const discovered = await discoverMetaChannels(credentials.accessToken);
    const expiresAt = credentials.expiresIn
      ? new Date(Date.now() + credentials.expiresIn * 1000)
      : null;

    for (const channel of discovered) {
      await query(
        `INSERT INTO social_channels (
          id, workspace_id, platform, external_id, name, username, avatar_url,
          account_type, associated_page_id, encrypted_access_token,
          token_expires_at, permissions, status, is_demo, last_synced_at
        ) VALUES (
          :id, :workspaceId, :platform, :externalId, :name, :username, :avatarUrl,
          :accountType, :associatedPageId, :accessToken,
          :expiresAt, :permissions, 'connected', FALSE, UTC_TIMESTAMP(3)
        )
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          username = VALUES(username),
          avatar_url = VALUES(avatar_url),
          account_type = VALUES(account_type),
          associated_page_id = VALUES(associated_page_id),
          encrypted_access_token = VALUES(encrypted_access_token),
          token_expires_at = VALUES(token_expires_at),
          permissions = VALUES(permissions),
          status = 'connected',
          status_message = NULL,
          disconnected_at = NULL,
          last_synced_at = UTC_TIMESTAMP(3)`,
        {
          id: createId(),
          workspaceId: request.workspace.id,
          platform: channel.platform,
          externalId: channel.externalId,
          name: channel.name,
          username: channel.username,
          avatarUrl: channel.avatarUrl,
          accountType: channel.accountType,
          associatedPageId: channel.associatedPageId,
          accessToken: encryptSecret(channel.accessToken),
          expiresAt,
          permissions: JSON.stringify(channel.permissions)
        }
      );
    }
    await audit(
      request,
      "channels.meta_connected",
      { type: "workspace", id: request.workspace.id },
      { channelsFound: discovered.length }
    );
    response.redirect(
      `/?route=channels&meta=connected&count=${discovered.length}`
    );
  })
);

channelRouter.post(
  "/demo",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    assert(
      config.meta.demoMode,
      403,
      "demo_disabled",
      "O modo de demonstração está desativado."
    );
    const demoChannels = [
      {
        platform: "facebook",
        externalId: `demo-facebook-${request.workspace.id}`,
        name: "Café Aurora",
        username: null,
        avatarUrl: "/assets/channel-aurora.svg",
        accountType: "page",
        permissions: [
          "pages_show_list",
          "pages_manage_posts",
          "pages_read_engagement"
        ]
      },
      {
        platform: "instagram",
        externalId: `demo-instagram-${request.workspace.id}`,
        name: "Café Aurora",
        username: "cafeaurora",
        avatarUrl: "/assets/channel-aurora.svg",
        accountType: "business",
        permissions: ["instagram_basic", "instagram_content_publish"]
      }
    ];
    for (const channel of demoChannels) {
      await query(
        `INSERT INTO social_channels (
          id, workspace_id, platform, external_id, name, username, avatar_url,
          account_type, encrypted_access_token, permissions, status, is_demo,
          last_synced_at
        ) VALUES (
          :id, :workspaceId, :platform, :externalId, :name, :username, :avatarUrl,
          :accountType, :accessToken, :permissions, 'connected', TRUE,
          UTC_TIMESTAMP(3)
        )
        ON DUPLICATE KEY UPDATE
          status = 'connected',
          status_message = NULL,
          disconnected_at = NULL,
          last_synced_at = UTC_TIMESTAMP(3)`,
        {
          id: createId(),
          workspaceId: request.workspace.id,
          platform: channel.platform,
          externalId: channel.externalId,
          name: channel.name,
          username: channel.username,
          avatarUrl: channel.avatarUrl,
          accountType: channel.accountType,
          accessToken: encryptSecret(`demo-token-${channel.platform}`),
          permissions: JSON.stringify(channel.permissions)
        }
      );
    }
    await audit(
      request,
      "channels.demo_connected",
      { type: "workspace", id: request.workspace.id },
      { platforms: ["facebook", "instagram"] }
    );
    const rows = await query(
      `SELECT * FROM social_channels
       WHERE workspace_id = :workspaceId AND is_demo = TRUE`,
      { workspaceId: request.workspace.id }
    );
    jsonData(response, rows.map(serializeChannel), 201);
  })
);

channelRouter.post(
  "/:id/reconnect",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const result = await query(
      `UPDATE social_channels
       SET status = IF(is_demo, 'connected', 'review'),
           status_message = IF(
             is_demo,
             NULL,
             'Conclua novamente a autorização com a Meta.'
           ),
           disconnected_at = NULL
       WHERE id = :id AND workspace_id = :workspaceId`,
      { id: request.params.id, workspaceId: request.workspace.id }
    );
    assert(
      result.affectedRows,
      404,
      "channel_not_found",
      "Canal não encontrado."
    );
    await audit(request, "channel.reconnect_requested", {
      type: "channel",
      id: request.params.id
    });
    jsonData(response, {
      message:
        "Reconexão iniciada. Contas reais devem concluir a autorização da Meta."
    });
  })
);

channelRouter.delete(
  "/:id",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const result = await query(
      `UPDATE social_channels
       SET encrypted_access_token = NULL,
           encrypted_refresh_token = NULL,
           status = 'disconnected',
           status_message = 'Canal desconectado pelo usuário.',
           disconnected_at = UTC_TIMESTAMP(3)
       WHERE id = :id AND workspace_id = :workspaceId`,
      { id: request.params.id, workspaceId: request.workspace.id }
    );
    assert(
      result.affectedRows,
      404,
      "channel_not_found",
      "Canal não encontrado."
    );
    await audit(request, "channel.disconnected", {
      type: "channel",
      id: request.params.id
    });
    jsonData(response, { message: "Canal desconectado." });
  })
);
