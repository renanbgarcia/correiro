import { config } from "../config.js";
import { decryptSecret } from "../lib/crypto.js";

export class MetaApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "MetaApiError";
    this.code = options.code || "meta_error";
    this.subcode = options.subcode || null;
    this.httpStatus = options.httpStatus || 502;
    this.temporary = Boolean(options.temporary);
    this.permission = Boolean(options.permission);
    this.tokenExpired = Boolean(options.tokenExpired);
    this.sanitizedResponse = options.sanitizedResponse || null;
  }
}

function graphUrl(pathname, query = {}) {
  const url = new URL(
    `https://graph.facebook.com/${config.meta.graphVersion}/${pathname.replace(
      /^\//,
      ""
    )}`
  );
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

function sanitizeMetaPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      key.toLowerCase().includes("token")
        ? "[redacted]"
        : typeof value === "object"
          ? sanitizeMetaPayload(value)
          : value
    ])
  );
}

async function metaRequest(pathname, options = {}) {
  const method = options.method || "GET";
  const query = { ...(options.query || {}) };
  const body = options.body ? new URLSearchParams(options.body) : undefined;
  const url = graphUrl(pathname, query);
  const response = await fetch(url, {
    method,
    body,
    headers: body
      ? { "content-type": "application/x-www-form-urlencoded" }
      : undefined,
    signal: AbortSignal.timeout(options.timeoutMs || 30_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    const metaError = payload.error || {};
    const code = Number(metaError.code);
    const subcode = Number(metaError.error_subcode);
    const tokenExpired =
      code === 190 && [458, 459, 460, 463, 464, 467].includes(subcode);
    const permission = code === 10 || code === 200;
    const temporary =
      response.status >= 500 ||
      [1, 2, 4, 17, 32, 341, 613].includes(code) ||
      Boolean(metaError.is_transient);
    throw new MetaApiError(
      metaError.message || "A API da Meta recusou a solicitação.",
      {
        code: metaError.type || `meta_${code || response.status}`,
        subcode: subcode || null,
        httpStatus: response.status,
        temporary,
        permission,
        tokenExpired,
        sanitizedResponse: sanitizeMetaPayload(payload)
      }
    );
  }
  return payload;
}

export function getMetaAuthorizationUrl(state) {
  const url = new URL(
    `https://www.facebook.com/${config.meta.graphVersion}/dialog/oauth`
  );
  url.searchParams.set("client_id", config.meta.appId);
  url.searchParams.set("redirect_uri", config.meta.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    [
      "pages_show_list",
      "pages_manage_posts",
      "pages_read_engagement",
      "read_insights",
      "instagram_basic",
      "instagram_content_publish"
    ].join(",")
  );
  return url.toString();
}

export async function exchangeAuthorizationCode(code) {
  const shortLived = await metaRequest("oauth/access_token", {
    query: {
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: config.meta.redirectUri,
      code
    }
  });

  try {
    const longLived = await metaRequest("oauth/access_token", {
      query: {
        grant_type: "fb_exchange_token",
        client_id: config.meta.appId,
        client_secret: config.meta.appSecret,
        fb_exchange_token: shortLived.access_token
      }
    });
    return {
      accessToken: longLived.access_token,
      expiresIn: longLived.expires_in || shortLived.expires_in || null
    };
  } catch {
    return {
      accessToken: shortLived.access_token,
      expiresIn: shortLived.expires_in || null
    };
  }
}

export async function discoverMetaChannels(userAccessToken) {
  const payload = await metaRequest("me/accounts", {
    query: {
      access_token: userAccessToken,
      fields:
        "id,name,picture{url},access_token,tasks,instagram_business_account{id,username,profile_picture_url}"
    }
  });
  const channels = [];

  for (const page of payload.data || []) {
    channels.push({
      platform: "facebook",
      externalId: page.id,
      name: page.name,
      username: null,
      avatarUrl: page.picture?.data?.url || null,
      accountType: "page",
      associatedPageId: null,
      accessToken: page.access_token || userAccessToken,
      permissions: page.tasks || []
    });
    if (page.instagram_business_account) {
      channels.push({
        platform: "instagram",
        externalId: page.instagram_business_account.id,
        name:
          page.instagram_business_account.username ||
          `Instagram de ${page.name}`,
        username: page.instagram_business_account.username || null,
        avatarUrl:
          page.instagram_business_account.profile_picture_url || null,
        accountType: "professional",
        associatedPageId: page.id,
        accessToken: page.access_token || userAccessToken,
        permissions: ["instagram_basic", "instagram_content_publish"]
      });
    }
  }
  return channels;
}

export function classifyMetaError(error, platform) {
  if (error instanceof MetaApiError) {
    if (error.tokenExpired) {
      return {
        temporary: false,
        code: "token_expired",
        friendlyMessage: `A conexão com o ${
          platform === "instagram" ? "Instagram" : "Facebook"
        } expirou. Reconecte a conta.`,
        technicalMessage: error.message,
        sanitizedResponse: error.sanitizedResponse
      };
    }
    if (error.permission) {
      return {
        temporary: false,
        code: "permission_revoked",
        friendlyMessage:
          platform === "instagram"
            ? "O Instagram não concedeu permissão para publicar."
            : "A Página do Facebook não concedeu permissão para publicar.",
        technicalMessage: error.message,
        sanitizedResponse: error.sanitizedResponse
      };
    }
    if (error.temporary) {
      return {
        temporary: true,
        code: "meta_temporarily_unavailable",
        friendlyMessage:
          "O serviço da Meta está temporariamente indisponível. Tentaremos novamente.",
        technicalMessage: error.message,
        sanitizedResponse: error.sanitizedResponse
      };
    }
    return {
      temporary: false,
      code: error.code,
      friendlyMessage:
        "A Meta recusou esta publicação. Revise o conteúdo e tente novamente.",
      technicalMessage: error.message,
      sanitizedResponse: error.sanitizedResponse
    };
  }
  if (
    error?.name === "TimeoutError" ||
    error?.name === "AbortError" ||
    error?.code === "UND_ERR_CONNECT_TIMEOUT"
  ) {
    return {
      temporary: true,
      code: "timeout",
      friendlyMessage:
        "A Meta demorou para responder. Tentaremos novamente automaticamente.",
      technicalMessage: error.message
    };
  }
  return {
    temporary: true,
    code: "unexpected_provider_error",
    friendlyMessage:
      "Não foi possível concluir a publicação. Tentaremos novamente.",
    technicalMessage: error?.message || String(error)
  };
}

async function publishFacebook({ channel, target, media }) {
  const accessToken = decryptSecret(channel.encrypted_access_token);
  if (!accessToken) {
    throw new MetaApiError("Token ausente.", {
      code: "missing_token",
      tokenExpired: true
    });
  }

  if (!media.length) {
    const result = await metaRequest(`${channel.external_id}/feed`, {
      method: "POST",
      body: {
        message: target.caption || "",
        access_token: accessToken
      }
    });
    return {
      externalId: result.id,
      externalUrl: `https://www.facebook.com/${result.id}`,
      response: sanitizeMetaPayload(result)
    };
  }

  const first = media[0];
  const mediaUrl = first.public_url;
  const endpoint =
    first.media_type === "video"
      ? `${channel.external_id}/videos`
      : `${channel.external_id}/photos`;
  const result = await metaRequest(endpoint, {
    method: "POST",
    body: {
      ...(first.media_type === "video"
        ? { file_url: mediaUrl, description: target.caption || "" }
        : { url: mediaUrl, caption: target.caption || "" }),
      access_token: accessToken
    },
    timeoutMs: 120_000
  });
  return {
    externalId: result.post_id || result.id,
    externalUrl: `https://www.facebook.com/${result.post_id || result.id}`,
    response: sanitizeMetaPayload(result)
  };
}

async function waitForInstagramContainer(containerId, accessToken) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = await metaRequest(containerId, {
      query: { fields: "status_code,status", access_token: accessToken }
    });
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new MetaApiError(
        status.status || "A Meta não conseguiu processar a mídia.",
        { code: "media_processing_failed", sanitizedResponse: status }
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new MetaApiError("Tempo excedido ao processar mídia no Instagram.", {
    code: "media_processing_timeout",
    temporary: true
  });
}

async function createInstagramContainer({
  channel,
  target,
  accessToken,
  mediaItem,
  isCarouselItem = false
}) {
  const isVideo = mediaItem.media_type === "video";
  return metaRequest(`${channel.external_id}/media`, {
    method: "POST",
    body: {
      ...(isVideo
        ? {
            video_url: mediaItem.public_url,
            media_type: target.content_type === "reel" ? "REELS" : "VIDEO"
          }
        : { image_url: mediaItem.public_url }),
      ...(isCarouselItem ? { is_carousel_item: "true" } : {}),
      ...(!isCarouselItem ? { caption: target.caption || "" } : {}),
      access_token: accessToken
    },
    timeoutMs: 120_000
  });
}

async function publishInstagram({ channel, target, media }) {
  const accessToken = decryptSecret(channel.encrypted_access_token);
  if (!accessToken) {
    throw new MetaApiError("Token ausente.", {
      code: "missing_token",
      tokenExpired: true
    });
  }
  if (!media.length) {
    throw new MetaApiError("O Instagram exige uma imagem ou vídeo.", {
      code: "media_required"
    });
  }

  let creationId;
  if (media.length === 1) {
    const container = await createInstagramContainer({
      channel,
      target,
      accessToken,
      mediaItem: media[0]
    });
    creationId = container.id;
  } else {
    const children = [];
    for (const mediaItem of media) {
      const child = await createInstagramContainer({
        channel,
        target,
        accessToken,
        mediaItem,
        isCarouselItem: true
      });
      children.push(child.id);
    }
    const carousel = await metaRequest(`${channel.external_id}/media`, {
      method: "POST",
      body: {
        media_type: "CAROUSEL",
        children: children.join(","),
        caption: target.caption || "",
        access_token: accessToken
      },
      timeoutMs: 120_000
    });
    creationId = carousel.id;
  }

  await waitForInstagramContainer(creationId, accessToken);
  const published = await metaRequest(
    `${channel.external_id}/media_publish`,
    {
      method: "POST",
      body: { creation_id: creationId, access_token: accessToken },
      timeoutMs: 120_000
    }
  );
  const details = await metaRequest(published.id, {
    query: {
      fields: "id,permalink",
      access_token: accessToken
    }
  });
  return {
    externalId: published.id,
    externalUrl: details.permalink || null,
    response: sanitizeMetaPayload({ ...published, permalink: details.permalink })
  };
}

export async function publishToMeta(input) {
  if (input.channel.platform === "facebook") {
    return publishFacebook(input);
  }
  if (input.channel.platform === "instagram") {
    return publishInstagram(input);
  }
  throw new Error(`Plataforma não suportada: ${input.channel.platform}`);
}
