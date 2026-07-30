import { Composio } from "@composio/core";
import { config } from "../config.js";

const TOOLKIT_BY_PLATFORM = Object.freeze({
  facebook: "facebook",
  instagram: "instagram"
});

const TOOL_VERSION_BY_PLATFORM = Object.freeze({
  facebook: config.composio.facebookVersion,
  instagram: config.composio.instagramVersion
});

let composioClient;

export class ComposioApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ComposioApiError";
    this.code = options.code || "composio_error";
    this.httpStatus = options.httpStatus || 502;
    this.temporary = Boolean(options.temporary);
    this.permission = Boolean(options.permission);
    this.connectionExpired = Boolean(options.connectionExpired);
    this.sanitizedResponse = options.sanitizedResponse || null;
  }
}

function getComposioClient() {
  if (!config.composio.apiKey) {
    throw new ComposioApiError(
      "Configure COMPOSIO_API_KEY para usar a conexão gerenciada.",
      { code: "composio_not_configured", httpStatus: 409 }
    );
  }
  if (!composioClient) {
    composioClient = new Composio({
      apiKey: config.composio.apiKey,
      ...(config.composio.baseUrl
        ? { baseURL: config.composio.baseUrl }
        : {}),
      allowTracking: false,
      toolkitVersions: {
        facebook: config.composio.facebookVersion,
        instagram: config.composio.instagramVersion
      }
    });
  }
  return composioClient;
}

function clientFrom(options = {}) {
  return options.client || getComposioClient();
}

export function composioUserId(workspaceId) {
  return `correiro-workspace-${workspaceId}`;
}

export function normalizeComposioValue(value, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return normalizeComposioValue(JSON.parse(trimmed), depth + 1);
      } catch {
        return value;
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeComposioValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeComposioValue(item, depth + 1)
      ])
    );
  }
  return value;
}

function walkValues(value, visitor, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return undefined;
  const result = visitor(value);
  if (result !== undefined) return result;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = walkValues(item, visitor, depth + 1);
      if (nested !== undefined) return nested;
    }
  } else if (typeof value === "object") {
    for (const item of Object.values(value)) {
      const nested = walkValues(item, visitor, depth + 1);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

export function parseFacebookPages(payload) {
  const normalized = normalizeComposioValue(payload);
  const pages =
    walkValues(normalized, (value) => {
      if (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every(
          (item) =>
            item &&
            typeof item === "object" &&
            (item.id || item.page_id) &&
            (item.name || item.page_name)
        )
      ) {
        return value;
      }
      return undefined;
    }) || [];

  return pages.map((page) => ({
    platform: "facebook",
    externalId: String(page.id || page.page_id),
    name: String(page.name || page.page_name),
    username: null,
    avatarUrl:
      page.picture?.data?.url ||
      page.picture?.url ||
      page.picture_url ||
      null,
    accountType: "page",
    associatedPageId: null,
    permissions: Array.isArray(page.tasks) ? page.tasks : []
  }));
}

export function parseInstagramAccount(payload) {
  const normalized = normalizeComposioValue(payload);
  const account = walkValues(normalized, (value) => {
    if (
      value &&
      !Array.isArray(value) &&
      typeof value === "object" &&
      (value.id || value.ig_user_id) &&
      (value.username || value.account_type || value.followers_count !== undefined)
    ) {
      return value;
    }
    return undefined;
  });
  if (!account) return null;
  const username = account.username ? String(account.username) : null;
  return {
    platform: "instagram",
    externalId: String(account.id || account.ig_user_id),
    name: String(account.name || username || "Conta do Instagram"),
    username,
    avatarUrl:
      account.profile_picture_url || account.profile_picture?.url || null,
    accountType: String(account.account_type || "professional").toLowerCase(),
    associatedPageId: null,
    permissions: ["instagram_basic", "instagram_content_publish"]
  };
}

function extractIdentifier(payload, preferredKeys = []) {
  const normalized = normalizeComposioValue(payload);
  for (const key of preferredKeys) {
    const value = walkValues(normalized, (item) => {
      if (
        item &&
        !Array.isArray(item) &&
        typeof item === "object" &&
        item[key] !== undefined &&
        item[key] !== null
      ) {
        return String(item[key]);
      }
      return undefined;
    });
    if (value) return value;
  }
  return null;
}

function sanitizedExecution(tool, result) {
  return {
    provider: "composio",
    tool,
    successful: Boolean(result?.successful),
    logId: result?.logId || null
  };
}

function mapSdkError(error, context = {}) {
  if (error instanceof ComposioApiError) return error;
  const message = error?.message || String(error);
  const chain = [];
  let current = error;
  while (current && chain.length < 4 && !chain.includes(current)) {
    chain.push(current);
    current = current.cause;
  }
  const lower = chain
    .map((item) => `${item?.name || ""} ${item?.message || ""}`)
    .join(" ")
    .toLowerCase();
  const status =
    chain
      .map((item) =>
        Number(item?.status || item?.statusCode || item?.httpStatus || 0)
      )
      .find((value) => Number.isFinite(value) && value > 0) || 0;
  const providerErrorCode = chain
    .map((item) => Number(item?.error?.error?.code || 0))
    .find((value) => Number.isFinite(value) && value > 0);
  const connectionExpired =
    status === 401 ||
    providerErrorCode === 1803 ||
    lower.includes("connectedaccountnotfound") ||
    lower.includes("connected account not found") ||
    lower.includes("connection request failed with status: expired") ||
    lower.includes("connection request failed with status: revoked") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication expired") ||
    lower.includes("credentials expired") ||
    lower.includes("credentials revoked");
  const permission =
    status === 403 ||
    lower.includes("permission") ||
    lower.includes("scope");
  const temporary =
    lower.includes("timeouterror") ||
    lower.includes("aborterror") ||
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    lower.includes("timeout") ||
    lower.includes("temporarily") ||
    lower.includes("rate limit");

  return new ComposioApiError(message, {
    code: connectionExpired
      ? "composio_connection_expired"
      : permission
        ? "composio_permission_denied"
        : temporary
          ? "composio_temporarily_unavailable"
          : "composio_request_failed",
    httpStatus: status || 502,
    connectionExpired,
    permission,
    temporary,
    sanitizedResponse: {
      provider: "composio",
      tool: context.tool || null,
      errorName: error?.name || "Error",
      status: status || null
    }
  });
}

async function executeTool(
  { platform, tool, connectionId, arguments: toolArguments, timeoutMs = 45_000 },
  options = {}
) {
  const client = clientFrom(options);
  try {
    const result = await client.tools.execute(
      tool,
      {
        connectedAccountId: connectionId,
        version: TOOL_VERSION_BY_PLATFORM[platform],
        arguments: toolArguments
      },
      { signal: AbortSignal.timeout(timeoutMs) }
    );
    const normalizedData = normalizeComposioValue(result?.data);
    const nestedError =
      normalizedData &&
      typeof normalizedData === "object" &&
      typeof normalizedData.error === "string" &&
      normalizedData.error
        ? normalizedData.error
        : null;
    const nestedFailure =
      normalizedData &&
      typeof normalizedData === "object" &&
      normalizedData.successful === false;
    if (!result?.successful || nestedFailure || nestedError) {
      throw new ComposioApiError(
        nestedError || result?.error || "O Composio recusou a operação.",
        {
          code: "composio_tool_rejected",
          temporary: false,
          sanitizedResponse: sanitizedExecution(tool, result)
        }
      );
    }
    return {
      payload: normalizedData,
      response: sanitizedExecution(tool, result)
    };
  } catch (error) {
    throw mapSdkError(error, { tool });
  }
}

async function managedAuthConfig(client, toolkit) {
  const listed = await client.authConfigs.list(
    {
      toolkit,
      isComposioManaged: true,
      showDisabled: false
    },
    { signal: AbortSignal.timeout(30_000) }
  );
  const existing = listed.items.find(
    (item) => item.status !== "DISABLED" && item.isDisabled !== true
  );
  if (existing) return existing.id;

  try {
    const created = await client.authConfigs.create(
      toolkit,
      {
        type: "use_composio_managed_auth",
        name: `Correiro ${toolkit}`
      },
      { signal: AbortSignal.timeout(30_000) }
    );
    return created.id;
  } catch (error) {
    const retried = await client.authConfigs.list(
      {
        toolkit,
        isComposioManaged: true,
        showDisabled: false
      },
      { signal: AbortSignal.timeout(30_000) }
    );
    const concurrent = retried.items.find(
      (item) => item.status !== "DISABLED" && item.isDisabled !== true
    );
    if (concurrent) return concurrent.id;
    throw error;
  }
}

export async function createComposioConnectLink(input, options = {}) {
  const platform = String(input.platform || "").toLowerCase();
  const toolkit = TOOLKIT_BY_PLATFORM[platform];
  if (!toolkit) {
    throw new ComposioApiError("Plataforma não suportada pelo Composio.", {
      code: "composio_platform_unsupported",
      httpStatus: 422
    });
  }
  const client = clientFrom(options);
  try {
    const authConfigId = await managedAuthConfig(client, toolkit);
    const request = await client.connectedAccounts.link(
      input.providerUserId,
      authConfigId,
      {
        callbackUrl: input.callbackUrl,
        allowMultiple: true,
        alias:
          input.alias ||
          `correiro-${platform}-${Date.now().toString(36)}`
      },
      { signal: AbortSignal.timeout(30_000) }
    );
    return {
      id: request.id,
      redirectUrl: request.redirectUrl,
      toolkit
    };
  } catch (error) {
    throw mapSdkError(error);
  }
}

export async function waitForComposioConnection(connectionId, options = {}) {
  try {
    return await clientFrom(options).connectedAccounts.waitForConnection(
      connectionId,
      options.timeoutMs || 15_000
    );
  } catch (error) {
    throw mapSdkError(error);
  }
}

export async function deleteComposioConnection(connectionId, options = {}) {
  if (!connectionId) return;
  try {
    await clientFrom(options).connectedAccounts.delete(connectionId, {
      signal: AbortSignal.timeout(20_000)
    });
  } catch (error) {
    throw mapSdkError(error);
  }
}

export async function discoverComposioChannels(input, options = {}) {
  if (input.platform === "facebook") {
    const result = await executeTool(
      {
        platform: "facebook",
        tool: "FACEBOOK_LIST_MANAGED_PAGES",
        connectionId: input.connectionId,
        arguments: {
          user_id: "me",
          limit: 100,
          fields: "id,name,picture{url},tasks"
        }
      },
      options
    );
    return parseFacebookPages(result.payload).map((channel) => ({
      ...channel,
      providerConnectionId: input.connectionId,
      providerToolkit: "facebook"
    }));
  }

  if (input.platform === "instagram") {
    const result = await executeTool(
      {
        platform: "instagram",
        tool: "INSTAGRAM_GET_USER_INFO",
        connectionId: input.connectionId,
        arguments: {
          ig_user_id: "me",
          graph_api_version: config.meta.graphVersion
        }
      },
      options
    );
    const account = parseInstagramAccount(result.payload);
    if (!account) return [];
    return [
      {
        ...account,
        providerConnectionId: input.connectionId,
        providerToolkit: "instagram"
      }
    ];
  }

  throw new ComposioApiError("Plataforma não suportada pelo Composio.", {
    code: "composio_platform_unsupported",
    httpStatus: 422
  });
}

async function publishFacebook(input, options) {
  const first = input.media[0];
  let tool = "FACEBOOK_CREATE_POST";
  let toolArguments = {
    page_id: input.channel.external_id,
    message: input.target.caption || "",
    published: true
  };

  if (first?.media_type === "image") {
    tool = "FACEBOOK_CREATE_PHOTO_POST";
    toolArguments = {
      page_id: input.channel.external_id,
      url: first.public_url,
      message: input.target.caption || "",
      published: true
    };
  } else if (first?.media_type === "video") {
    tool = "FACEBOOK_CREATE_VIDEO_POST";
    toolArguments = {
      page_id: input.channel.external_id,
      file_url: first.public_url,
      description: input.target.caption || "",
      published: true
    };
  }

  const result = await executeTool(
    {
      platform: "facebook",
      tool,
      connectionId: input.channel.provider_connection_id,
      arguments: toolArguments,
      timeoutMs: first?.media_type === "video" ? 150_000 : 60_000
    },
    options
  );
  const externalId = extractIdentifier(result.payload, ["post_id", "id"]);
  if (!externalId) {
    throw new ComposioApiError(
      "O Composio publicou, mas não retornou o identificador do post.",
      {
        code: "composio_missing_post_id",
        temporary: true,
        sanitizedResponse: result.response
      }
    );
  }
  return {
    externalId,
    externalUrl: `https://www.facebook.com/${externalId}`,
    response: result.response
  };
}

async function createInstagramContainer(input, mediaItem, options = {}) {
  const isVideo = mediaItem.media_type === "video";
  const result = await executeTool(
    {
      platform: "instagram",
      tool: "INSTAGRAM_POST_IG_USER_MEDIA",
      connectionId: input.channel.provider_connection_id,
      arguments: {
        ig_user_id: input.channel.external_id,
        ...(isVideo
          ? { video_url: mediaItem.public_url }
          : { image_url: mediaItem.public_url }),
        ...(input.isCarouselItem ? { is_carousel_item: true } : {}),
        ...(!input.isCarouselItem
          ? { caption: input.target.caption || "" }
          : {}),
        ...(isVideo && input.target.content_type === "reel"
          ? { media_type: "REELS", share_to_feed: true }
          : {}),
        graph_api_version: config.meta.graphVersion
      },
      timeoutMs: 150_000
    },
    options
  );
  const creationId = extractIdentifier(result.payload, [
    "creation_id",
    "container_id",
    "id"
  ]);
  if (!creationId) {
    throw new ComposioApiError(
      "O Composio não retornou o identificador do contêiner.",
      {
        code: "composio_missing_container_id",
        temporary: true,
        sanitizedResponse: result.response
      }
    );
  }
  return creationId;
}

async function instagramPermalink(input, externalId, options = {}) {
  try {
    const result = await clientFrom(options).tools.proxyExecute(
      {
        endpoint: `/${config.meta.graphVersion}/${externalId}`,
        method: "GET",
        connectedAccountId: input.channel.provider_connection_id,
        parameters: [
          { in: "query", name: "fields", value: "id,permalink" }
        ]
      },
      { signal: AbortSignal.timeout(30_000) }
    );
    return (
      walkValues(normalizeComposioValue(result?.data), (value) => {
        if (
          value &&
          !Array.isArray(value) &&
          typeof value === "object" &&
          typeof value.permalink === "string"
        ) {
          return value.permalink;
        }
        return undefined;
      }) || null
    );
  } catch {
    return null;
  }
}

async function publishInstagram(input, options) {
  if (!input.media.length) {
    throw new ComposioApiError("O Instagram exige uma imagem ou vídeo.", {
      code: "media_required",
      httpStatus: 422
    });
  }

  let creationId;
  if (input.media.length === 1) {
    creationId = await createInstagramContainer(
      { ...input, isCarouselItem: false },
      input.media[0],
      options
    );
  } else {
    const children = [];
    for (const mediaItem of input.media) {
      children.push(
        await createInstagramContainer(
          { ...input, isCarouselItem: true },
          mediaItem,
          options
        )
      );
    }
    const carousel = await executeTool(
      {
        platform: "instagram",
        tool: "INSTAGRAM_POST_IG_USER_MEDIA",
        connectionId: input.channel.provider_connection_id,
        arguments: {
          ig_user_id: input.channel.external_id,
          media_type: "CAROUSEL",
          children,
          caption: input.target.caption || "",
          graph_api_version: config.meta.graphVersion
        },
        timeoutMs: 150_000
      },
      options
    );
    creationId = extractIdentifier(carousel.payload, [
      "creation_id",
      "container_id",
      "id"
    ]);
  }

  if (!creationId) {
    throw new ComposioApiError(
      "O Composio não retornou o identificador do carrossel.",
      { code: "composio_missing_container_id", temporary: true }
    );
  }

  const published = await executeTool(
    {
      platform: "instagram",
      tool: "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
      connectionId: input.channel.provider_connection_id,
      arguments: {
        ig_user_id: input.channel.external_id,
        creation_id: creationId,
        max_wait_seconds: 120,
        poll_interval_seconds: 5,
        graph_api_version: config.meta.graphVersion
      },
      timeoutMs: 180_000
    },
    options
  );
  const externalId = extractIdentifier(published.payload, [
    "media_id",
    "post_id",
    "id"
  ]);
  if (!externalId) {
    throw new ComposioApiError(
      "O Composio publicou, mas não retornou o identificador da mídia.",
      {
        code: "composio_missing_post_id",
        temporary: true,
        sanitizedResponse: published.response
      }
    );
  }

  return {
    externalId,
    externalUrl: await instagramPermalink(input, externalId, options),
    response: published.response
  };
}

export async function publishToComposio(input, options = {}) {
  if (!input.channel.provider_connection_id) {
    throw new ComposioApiError("Conexão do Composio ausente.", {
      code: "composio_connection_missing",
      connectionExpired: true
    });
  }
  if (input.channel.platform === "facebook") {
    return publishFacebook(input, options);
  }
  if (input.channel.platform === "instagram") {
    return publishInstagram(input, options);
  }
  throw new ComposioApiError(
    `Plataforma não suportada: ${input.channel.platform}`,
    { code: "composio_platform_unsupported", httpStatus: 422 }
  );
}

export function classifyComposioError(error, platform) {
  const normalized = mapSdkError(error);
  if (normalized.connectionExpired) {
    return {
      temporary: false,
      code: "token_expired",
      friendlyMessage: `A conexão do ${
        platform === "instagram" ? "Instagram" : "Facebook"
      } no Composio expirou. Reconecte a conta.`,
      technicalMessage: normalized.message,
      sanitizedResponse: normalized.sanitizedResponse
    };
  }
  if (normalized.permission) {
    return {
      temporary: false,
      code: "permission_revoked",
      friendlyMessage:
        "O Composio não recebeu da Meta a permissão necessária para publicar.",
      technicalMessage: normalized.message,
      sanitizedResponse: normalized.sanitizedResponse
    };
  }
  if (normalized.temporary) {
    return {
      temporary: true,
      code: "composio_temporarily_unavailable",
      friendlyMessage:
        "O Composio ou a Meta está temporariamente indisponível. Tentaremos novamente.",
      technicalMessage: normalized.message,
      sanitizedResponse: normalized.sanitizedResponse
    };
  }
  return {
    temporary: false,
    code: normalized.code,
    friendlyMessage:
      "O Composio recusou esta publicação. Revise o conteúdo e tente novamente.",
    technicalMessage: normalized.message,
    sanitizedResponse: normalized.sanitizedResponse
  };
}
