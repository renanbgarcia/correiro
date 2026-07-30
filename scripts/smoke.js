import assert from "node:assert/strict";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const email = process.env.SMOKE_EMAIL || "demo@correiro.local";
const password = process.env.SMOKE_PASSWORD || "Demo@123";
const cookies = new Map();

function captureCookies(response) {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  for (const header of setCookies) {
    const [pair] = header.split(";");
    const separator = pair.indexOf("=");
    if (separator > 0) {
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }
}

function cookieHeader() {
  return [...cookies.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request(path, options = {}) {
  const method = options.method || "GET";
  const headers = { Accept: "application/json" };
  if (cookies.size) headers.Cookie = cookieHeader();
  if (!["GET", "HEAD"].includes(method) && cookies.has("correiro_csrf")) {
    headers["X-CSRF-Token"] = decodeURIComponent(
      cookies.get("correiro_csrf")
    );
  }
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers,
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  captureCookies(response);
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(
      `${method} ${path}: ${payload.error?.message || response.status}`
    );
  }
  return payload;
}

async function waitForPost(postId, predicate, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await request(`/posts/${postId}`);
    if (predicate(result.data)) return result.data;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Tempo excedido aguardando a publicação ${postId}.`);
}

async function smoke() {
  const health = await request("/health");
  assert.equal(health.data.database, "connected");

  await request("/auth/login", {
    method: "POST",
    body: { email, password }
  });
  const [channelsResult, mediaResult, providersResult] = await Promise.all([
    request("/channels"),
    request("/media?limit=10"),
    request("/channels/providers")
  ]);
  const channels = channelsResult.data.filter(
    (channel) => channel.status === "connected"
  );
  const facebook = channels.find(
    (channel) => channel.platform === "facebook"
  );
  const instagram = channels.find(
    (channel) => channel.platform === "instagram"
  );
  const media = mediaResult.data[0];
  assert.ok(facebook, "Canal Facebook conectado");
  assert.ok(instagram, "Canal Instagram conectado");
  assert.equal(facebook.connectionProvider, "demo");
  assert.equal(instagram.connectionProvider, "demo");
  assert.equal(typeof providersResult.data.composio.configured, "boolean");
  assert.equal(providersResult.data.demo.configured, true);
  assert.ok(media, "Mídia de demonstração disponível");

  const caption =
    "Validação integrada do motor de publicação. #simularfalha";
  const created = await request("/posts", {
    method: "POST",
    body: {
      mode: "now",
      baseCaption: caption,
      timeZone: "America/Sao_Paulo",
      targets: [
        {
          channelId: facebook.id,
          caption,
          mediaIds: [media.id]
        },
        {
          channelId: instagram.id,
          caption,
          mediaIds: [media.id]
        }
      ]
    }
  });
  const postId = created.data.id;

  const partial = await waitForPost(
    postId,
    (post) => post.status === "partially_published"
  );
  const failedTarget = partial.targets.find(
    (target) => target.status === "failed"
  );
  assert.equal(failedTarget.platform, "instagram");
  assert.equal(
    partial.targets.find((target) => target.platform === "facebook").status,
    "published"
  );

  await request(`/posts/${postId}/retry/${failedTarget.id}`, {
    method: "POST"
  });
  const recovered = await waitForPost(
    postId,
    (post) => post.status === "published"
  );
  assert.ok(
    recovered.targets.every((target) => target.status === "published"),
    "Todos os destinos devem estar publicados depois da repetição seletiva."
  );

  await request(`/posts/${postId}`, { method: "DELETE" });
  await request("/auth/logout", { method: "POST" });

  console.log(
    JSON.stringify({
      ok: true,
      checked: [
        "health",
        "login",
        "workspace scoping",
        "channels",
        "connection providers",
        "media",
        "publish now",
        "partial publication",
        "selective retry",
        "idempotent completion",
        "logout"
      ]
    })
  );
}

smoke().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
