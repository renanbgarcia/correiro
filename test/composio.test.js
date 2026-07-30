import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import {
  ComposioApiError,
  classifyComposioError,
  createComposioConnectLink,
  parseFacebookPages,
  parseInstagramAccount,
  publishToComposio
} from "../src/services/composio.js";

test("normaliza a resposta textual de Páginas do Facebook", () => {
  const pages = parseFacebookPages({
    data: JSON.stringify({
      data: [
        {
          id: "page_123",
          name: "Café Aurora",
          picture: { data: { url: "https://cdn.example/avatar.jpg" } },
          tasks: ["CREATE_CONTENT", "MODERATE"]
        }
      ]
    })
  });

  assert.deepEqual(pages, [
    {
      platform: "facebook",
      externalId: "page_123",
      name: "Café Aurora",
      username: null,
      avatarUrl: "https://cdn.example/avatar.jpg",
      accountType: "page",
      associatedPageId: null,
      permissions: ["CREATE_CONTENT", "MODERATE"]
    }
  ]);
});

test("normaliza a conta profissional do Instagram", () => {
  const account = parseInstagramAccount({
    response: JSON.stringify({
      id: "ig_456",
      name: "Café Aurora",
      username: "cafeaurora",
      account_type: "BUSINESS",
      profile_picture_url: "https://cdn.example/instagram.jpg"
    })
  });

  assert.equal(account.externalId, "ig_456");
  assert.equal(account.username, "cafeaurora");
  assert.equal(account.accountType, "business");
  assert.equal(account.avatarUrl, "https://cdn.example/instagram.jpg");
});

test("cria Connect Link com autenticação gerenciada e sem fluxo legado", async () => {
  const calls = [];
  const client = {
    authConfigs: {
      async list(query) {
        calls.push(["authConfigs.list", query]);
        return {
          items: [{ id: "auth_facebook", status: "ENABLED" }],
          nextCursor: null,
          totalPages: 1
        };
      },
      async create() {
        assert.fail("não deve criar auth config quando já existe uma ativa");
      }
    },
    connectedAccounts: {
      async link(userId, authConfigId, options) {
        calls.push([
          "connectedAccounts.link",
          userId,
          authConfigId,
          options
        ]);
        return {
          id: "ca_123",
          redirectUrl: "https://connect.composio.dev/link_123"
        };
      }
    }
  };

  const result = await createComposioConnectLink(
    {
      platform: "facebook",
      providerUserId: "correiro-workspace-ws_1",
      callbackUrl:
        "https://correiro.example/api/channels/composio/callback?state=opaque",
      alias: "correiro-facebook-ws_1"
    },
    { client }
  );

  assert.equal(result.id, "ca_123");
  assert.equal(result.toolkit, "facebook");
  assert.equal(calls[0][1].isComposioManaged, true);
  assert.equal(calls[1][0], "connectedAccounts.link");
  assert.equal(calls[1][1], "correiro-workspace-ws_1");
  assert.equal(calls[1][2], "auth_facebook");
  assert.equal(calls[1][3].allowMultiple, true);
});

test("publica foto no Facebook usando conexão e versão fixadas", async () => {
  const calls = [];
  const client = {
    tools: {
      async execute(tool, body) {
        calls.push({ tool, body });
        return {
          successful: true,
          error: null,
          logId: "log_fb_1",
          data: { response: JSON.stringify({ post_id: "page_123_789" }) }
        };
      }
    }
  };

  const result = await publishToComposio(
    {
      channel: {
        platform: "facebook",
        external_id: "page_123",
        provider_connection_id: "ca_fb_1"
      },
      target: { caption: "Café fresquinho", content_type: "post" },
      media: [
        {
          media_type: "image",
          public_url: "https://correiro.example/media/photo.jpg"
        }
      ]
    },
    { client }
  );

  assert.equal(result.externalId, "page_123_789");
  assert.equal(calls[0].tool, "FACEBOOK_CREATE_PHOTO_POST");
  assert.equal(calls[0].body.connectedAccountId, "ca_fb_1");
  assert.equal(calls[0].body.version, config.composio.facebookVersion);
  assert.equal(calls[0].body.arguments.page_id, "page_123");
  assert.equal(
    calls[0].body.arguments.url,
    "https://correiro.example/media/photo.jpg"
  );
});

test("cria e publica contêiner no Instagram usando o Composio", async () => {
  const calls = [];
  const client = {
    tools: {
      async execute(tool, body) {
        calls.push({ tool, body });
        if (tool === "INSTAGRAM_POST_IG_USER_MEDIA") {
          return {
            successful: true,
            error: null,
            logId: "log_ig_container",
            data: { creation_id: "container_123" }
          };
        }
        return {
          successful: true,
          error: null,
          logId: "log_ig_publish",
          data: { media_id: "media_456" }
        };
      },
      async proxyExecute(body) {
        calls.push({ tool: "proxy", body });
        return {
          data: {
            id: "media_456",
            permalink: "https://www.instagram.com/p/example/"
          }
        };
      }
    }
  };

  const result = await publishToComposio(
    {
      channel: {
        platform: "instagram",
        external_id: "ig_456",
        provider_connection_id: "ca_ig_1"
      },
      target: { caption: "Novidade no cardápio", content_type: "post" },
      media: [
        {
          media_type: "image",
          public_url: "https://correiro.example/media/photo.jpg"
        }
      ]
    },
    { client }
  );

  assert.equal(result.externalId, "media_456");
  assert.equal(
    result.externalUrl,
    "https://www.instagram.com/p/example/"
  );
  assert.deepEqual(
    calls.slice(0, 2).map((call) => call.tool),
    [
      "INSTAGRAM_POST_IG_USER_MEDIA",
      "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH"
    ]
  );
  assert.equal(calls[0].body.version, config.composio.instagramVersion);
  assert.equal(calls[0].body.arguments.ig_user_id, "ig_456");
  assert.equal(calls[1].body.arguments.creation_id, "container_123");
});

test("classifica expiração e indisponibilidade sem expor credenciais", () => {
  const expired = classifyComposioError(
    new ComposioApiError("connected account revoked", {
      connectionExpired: true,
      sanitizedResponse: { provider: "composio", logId: "log_1" }
    }),
    "instagram"
  );
  const temporary = classifyComposioError(
    Object.assign(new Error("Error executing the tool"), {
      name: "ComposioToolExecutionError",
      cause: Object.assign(new Error("Too many requests"), { status: 429 })
    }),
    "facebook"
  );

  assert.equal(expired.code, "token_expired");
  assert.match(expired.friendlyMessage, /Reconecte/);
  assert.equal(temporary.temporary, true);
  assert.equal(temporary.code, "composio_temporarily_unavailable");
  assert.deepEqual(expired.sanitizedResponse, {
    provider: "composio",
    logId: "log_1"
  });
});
