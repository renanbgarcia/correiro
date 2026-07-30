import { Router } from "express";
import { config } from "../config.js";
import { query } from "../db.js";
import {
  createOpaqueToken,
  encryptSecret,
  hashToken
} from "../lib/crypto.js";
import { AppError, asyncRoute, assert, jsonData } from "../lib/http.js";
import { createId } from "../lib/ids.js";
import { logger } from "../lib/logger.js";
import { requireAuth, requireWorkspace } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import {
  composioUserId,
  createComposioConnectLink,
  deleteComposioConnection,
  discoverComposioChannels,
  waitForComposioConnection
} from "../services/composio.js";
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
    connectionProvider:
      row.connection_provider || (row.is_demo ? "demo" : "direct"),
    providerToolkit: row.provider_toolkit,
    isDemo: Boolean(row.is_demo),
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at
  };
}

function callbackErrorMessage(error) {
  if (error instanceof AppError) return error.message;
  const messages = {
    composio_connection_expired:
      "A autorização expirou antes de ser concluída. Tente conectar novamente.",
    composio_permission_denied:
      "A Meta não concedeu as permissões necessárias ao Composio.",
    composio_temporarily_unavailable:
      "O Composio está temporariamente indisponível. Tente novamente.",
    composio_tool_rejected:
      "A conta foi conectada, mas o Composio não conseguiu listar os canais.",
    composio_request_failed:
      "Não foi possível concluir a conexão pelo Composio."
  };
  return (
    messages[error?.code] ||
    "Não foi possível concluir a conexão pelo Composio. Tente novamente."
  );
}

function composioRouteError(error) {
  const status = Number(error?.httpStatus);
  return new AppError(
    status >= 400 && status <= 599 ? status : 502,
    error?.code || "composio_request_failed",
    callbackErrorMessage(error)
  );
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
         AND connection_provider = 'direct'
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
  "/providers",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (_request, response) => {
    jsonData(response, {
      composio: {
        configured: Boolean(config.composio.apiKey),
        label: "Composio",
        description:
          "OAuth gerenciado, sem App ID ou App Secret da Meta no Correiro.",
        platforms: ["facebook", "instagram"]
      },
      direct: {
        configured: Boolean(config.meta.appId && config.meta.appSecret),
        label: "Meta direta",
        description:
          "Integração avançada usando seu próprio aplicativo da Meta.",
        platforms: ["facebook", "instagram"]
      },
      demo: {
        configured: config.meta.demoMode,
        label: "Demonstração",
        description: "Canais fictícios para validar o fluxo de publicação.",
        platforms: ["facebook", "instagram"]
      }
    });
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
          account_type, connection_provider, provider_connection_id,
          provider_toolkit, associated_page_id, encrypted_access_token,
          token_expires_at, permissions, status, is_demo, last_synced_at
        ) VALUES (
          :id, :workspaceId, :platform, :externalId, :name, :username, :avatarUrl,
          :accountType, 'direct', NULL, NULL, :associatedPageId, :accessToken,
          :expiresAt, :permissions, 'connected', FALSE, UTC_TIMESTAMP(3)
        )
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          username = VALUES(username),
          avatar_url = VALUES(avatar_url),
          account_type = VALUES(account_type),
          connection_provider = 'direct',
          provider_connection_id = NULL,
          provider_toolkit = NULL,
          associated_page_id = VALUES(associated_page_id),
          encrypted_access_token = VALUES(encrypted_access_token),
          encrypted_refresh_token = NULL,
          token_expires_at = VALUES(token_expires_at),
          permissions = VALUES(permissions),
          status = 'connected',
          status_message = NULL,
          is_demo = FALSE,
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

channelRouter.get(
  "/composio/url",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    assert(
      config.composio.apiKey,
      409,
      "composio_not_configured",
      "Configure COMPOSIO_API_KEY para usar a conexão gerenciada."
    );
    const platform = String(request.query.platform || "").toLowerCase();
    assert(
      ["facebook", "instagram"].includes(platform),
      422,
      "invalid_platform",
      "Escolha Facebook ou Instagram."
    );

    const state = createOpaqueToken();
    let callbackUrl;
    try {
      callbackUrl = new URL(config.composio.callbackUrl);
    } catch {
      throw new AppError(
        500,
        "invalid_composio_callback_url",
        "COMPOSIO_CALLBACK_URL não contém uma URL válida."
      );
    }
    callbackUrl.searchParams.set("state", state);
    const providerUserId = composioUserId(request.workspace.id);
    let connection;
    try {
      connection = await createComposioConnectLink({
        platform,
        providerUserId,
        callbackUrl: callbackUrl.toString(),
        alias: `correiro-${platform}-${request.workspace.id}-${Date.now().toString(36)}`
      });
    } catch (error) {
      throw composioRouteError(error);
    }
    assert(
      connection.id && connection.redirectUrl,
      502,
      "invalid_composio_response",
      "O Composio não retornou um link de autorização válido."
    );

    await query(
      `INSERT INTO provider_connection_requests (
        id, workspace_id, user_id, provider, platform, state_hash,
        provider_user_id, provider_connection_id, expires_at
      ) VALUES (
        :id, :workspaceId, :userId, 'composio', :platform, :stateHash,
        :providerUserId, :providerConnectionId,
        DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE)
      )`,
      {
        id: createId(),
        workspaceId: request.workspace.id,
        userId: request.user.id,
        platform,
        stateHash: hashToken(state),
        providerUserId,
        providerConnectionId: connection.id
      }
    );
    await audit(
      request,
      "channels.composio_connection_started",
      { type: "workspace", id: request.workspace.id },
      { platform }
    );
    jsonData(response, { url: connection.redirectUrl });
  })
);

channelRouter.get(
  "/composio/callback",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    try {
      const state = String(request.query.state || "");
      assert(
        state,
        400,
        "invalid_composio_callback",
        "O retorno do Composio está incompleto."
      );
      const states = await query(
        `SELECT *
         FROM provider_connection_requests
         WHERE state_hash = :stateHash
           AND workspace_id = :workspaceId
           AND user_id = :userId
           AND provider = 'composio'
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
        "invalid_composio_state",
        "A tentativa de conexão expirou. Inicie novamente."
      );
      const connectionRequest = states[0];
      await query(
        `UPDATE provider_connection_requests
         SET used_at = UTC_TIMESTAMP(3)
         WHERE id = :id`,
        { id: connectionRequest.id }
      );

      const callbackStatus = String(request.query.status || "").toLowerCase();
      assert(
        !callbackStatus || callbackStatus === "success",
        400,
        "composio_authorization_cancelled",
        "A autorização foi cancelada ou recusada."
      );

      const connectedAccount = await waitForComposioConnection(
        connectionRequest.provider_connection_id,
        { timeoutMs: 30_000 }
      );
      assert(
        connectedAccount?.status === "ACTIVE",
        409,
        "composio_connection_inactive",
        "A conexão não ficou ativa no Composio."
      );
      assert(
        connectedAccount?.authConfig?.isComposioManaged === true,
        400,
        "composio_auth_config_mismatch",
        "A conexão não usa a autenticação gerenciada do Composio."
      );
      assert(
        connectedAccount?.toolkit?.slug === connectionRequest.platform,
        400,
        "composio_toolkit_mismatch",
        "A conta autorizada não corresponde à rede social escolhida."
      );

      const discovered = await discoverComposioChannels({
        platform: connectionRequest.platform,
        connectionId: connectionRequest.provider_connection_id,
        providerUserId: connectionRequest.provider_user_id
      });
      assert(
        discovered.length,
        422,
        "composio_channels_not_found",
        connectionRequest.platform === "instagram"
          ? "Nenhuma conta profissional do Instagram foi encontrada."
          : "Nenhuma Página do Facebook administrada por esta conta foi encontrada."
      );

      for (const channel of discovered) {
        await query(
          `INSERT INTO social_channels (
            id, workspace_id, platform, external_id, name, username, avatar_url,
            account_type, connection_provider, provider_connection_id,
            provider_toolkit, associated_page_id, encrypted_access_token,
            encrypted_refresh_token, token_expires_at, permissions, status,
            is_demo, last_synced_at
          ) VALUES (
            :id, :workspaceId, :platform, :externalId, :name, :username,
            :avatarUrl, :accountType, 'composio', :providerConnectionId,
            :providerToolkit, :associatedPageId, NULL, NULL, NULL,
            :permissions, 'connected', FALSE, UTC_TIMESTAMP(3)
          )
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            username = VALUES(username),
            avatar_url = VALUES(avatar_url),
            account_type = VALUES(account_type),
            connection_provider = 'composio',
            provider_connection_id = VALUES(provider_connection_id),
            provider_toolkit = VALUES(provider_toolkit),
            associated_page_id = VALUES(associated_page_id),
            encrypted_access_token = NULL,
            encrypted_refresh_token = NULL,
            token_expires_at = NULL,
            permissions = VALUES(permissions),
            status = 'connected',
            status_message = NULL,
            is_demo = FALSE,
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
            providerConnectionId: channel.providerConnectionId,
            providerToolkit: channel.providerToolkit,
            associatedPageId: channel.associatedPageId,
            permissions: JSON.stringify(channel.permissions || [])
          }
        );
      }

      await audit(
        request,
        "channels.composio_connected",
        { type: "workspace", id: request.workspace.id },
        {
          platform: connectionRequest.platform,
          channelsFound: discovered.length
        }
      );
      return response.redirect(
        `/?route=channels&composio=connected&platform=${encodeURIComponent(
          connectionRequest.platform
        )}&count=${discovered.length}`
      );
    } catch (error) {
      const expected =
        error instanceof AppError ||
        String(error?.code || "").startsWith("composio_");
      logger[expected ? "warn" : "error"](
        "Falha no retorno de conexão do Composio",
        {
          workspaceId: request.workspace.id,
          code: error?.code || error?.name,
          error: expected ? callbackErrorMessage(error) : error?.message
        }
      );
      return response.redirect(
        `/?route=channels&composio=error&message=${encodeURIComponent(
          callbackErrorMessage(error)
        )}`
      );
    }
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
          account_type, connection_provider, provider_toolkit,
          encrypted_access_token, permissions, status, is_demo, last_synced_at
        ) VALUES (
          :id, :workspaceId, :platform, :externalId, :name, :username, :avatarUrl,
          :accountType, 'demo', :platform, :accessToken, :permissions,
          'connected', TRUE, UTC_TIMESTAMP(3)
        )
        ON DUPLICATE KEY UPDATE
          connection_provider = 'demo',
          provider_connection_id = NULL,
          provider_toolkit = VALUES(provider_toolkit),
          status = 'connected',
          status_message = NULL,
          is_demo = TRUE,
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
    const channels = await query(
      `SELECT platform, connection_provider, is_demo
       FROM social_channels
       WHERE id = :id AND workspace_id = :workspaceId
       LIMIT 1`,
      { id: request.params.id, workspaceId: request.workspace.id }
    );
    assert(
      channels[0],
      404,
      "channel_not_found",
      "Canal não encontrado."
    );
    const channel = channels[0];
    const result = await query(
      `UPDATE social_channels
       SET status = IF(is_demo, 'connected', 'review'),
           status_message = IF(
             is_demo,
             NULL,
             'Conclua novamente a autorização do provedor.'
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
      message: channel.is_demo
        ? "Canal de demonstração reconectado."
        : "Conclua novamente a autorização do provedor.",
      connectionProvider:
        channel.connection_provider || (channel.is_demo ? "demo" : "direct"),
      platform: channel.platform,
      requiresAuthorization: !channel.is_demo
    });
  })
);

channelRouter.delete(
  "/:id",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const channels = await query(
      `SELECT id, connection_provider, provider_connection_id
       FROM social_channels
       WHERE id = :id AND workspace_id = :workspaceId
       LIMIT 1`,
      { id: request.params.id, workspaceId: request.workspace.id }
    );
    assert(
      channels[0],
      404,
      "channel_not_found",
      "Canal não encontrado."
    );
    const channel = channels[0];
    const result = await query(
      `UPDATE social_channels
       SET encrypted_access_token = NULL,
           encrypted_refresh_token = NULL,
           token_expires_at = NULL,
           provider_connection_id = NULL,
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

    if (
      channel.connection_provider === "composio" &&
      channel.provider_connection_id
    ) {
      const references = await query(
        `SELECT COUNT(*) AS total
         FROM social_channels
         WHERE workspace_id = :workspaceId
           AND id <> :id
           AND connection_provider = 'composio'
           AND provider_connection_id = :providerConnectionId
           AND status <> 'disconnected'`,
        {
          workspaceId: request.workspace.id,
          id: request.params.id,
          providerConnectionId: channel.provider_connection_id
        }
      );
      if (Number(references[0]?.total || 0) === 0) {
        try {
          await deleteComposioConnection(channel.provider_connection_id);
        } catch (error) {
          logger.warn(
            "Canal desconectado localmente, mas a revogação no Composio falhou",
            {
              channelId: request.params.id,
              code: error?.code || error?.name
            }
          );
        }
      }
    }

    await audit(request, "channel.disconnected", {
      type: "channel",
      id: request.params.id
    });
    jsonData(response, { message: "Canal desconectado." });
  })
);
