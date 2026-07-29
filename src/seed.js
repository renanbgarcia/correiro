import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { config } from "./config.js";
import { closeDatabase, query, withTransaction } from "./db.js";
import { encryptSecret } from "./lib/crypto.js";
import { createId } from "./lib/ids.js";
import { logger } from "./lib/logger.js";
import { hashPassword } from "./lib/password.js";
import { runMigrations } from "./migrate.js";

const DEMO_EMAIL = "demo@correiro.local";
const DEMO_PASSWORD = "Demo@123";

const demoVisuals = [
  {
    name: "cafe-lancamento.jpg",
    title: "Uma pausa que inspira",
    subtitle: "Café Aurora · nova seleção",
    colors: ["#5A3E2B", "#EBA65B", "#F7E8CF"]
  },
  {
    name: "bastidores.jpg",
    title: "Feito com calma",
    subtitle: "Dos grãos à sua xícara",
    colors: ["#2D5F52", "#D9A66F", "#F2E9DD"]
  },
  {
    name: "domingo.jpg",
    title: "Domingo pede Aurora",
    subtitle: "Brunch · 9h às 14h",
    colors: ["#6E4B74", "#E59B83", "#F9E5D8"]
  }
];

function svgForVisual(visual) {
  const [dark, accent, light] = visual.colors;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${light}"/>
          <stop offset="1" stop-color="${accent}"/>
        </linearGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-opacity=".18"/></filter>
      </defs>
      <rect width="1200" height="1200" rx="70" fill="url(#bg)"/>
      <circle cx="940" cy="230" r="240" fill="${accent}" opacity=".42"/>
      <circle cx="190" cy="1010" r="310" fill="${dark}" opacity=".08"/>
      <g filter="url(#shadow)">
        <ellipse cx="600" cy="735" rx="330" ry="90" fill="${dark}" opacity=".18"/>
        <path d="M360 470h430v270c0 170-95 265-215 265S360 910 360 740z" fill="#fffdf8"/>
        <path d="M790 560h85c115 0 142 180 22 226-42 16-82 8-114-6v-66c40 22 93 28 115-14 25-48-7-83-46-83h-62z" fill="#fffdf8"/>
        <ellipse cx="575" cy="475" rx="214" ry="48" fill="${dark}"/>
        <ellipse cx="575" cy="467" rx="178" ry="31" fill="#8A5A3C"/>
        <path d="M520 380c-70-96 75-119 14-202M620 390c-60-85 74-109 17-186" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" opacity=".7"/>
      </g>
      <text x="100" y="125" fill="${dark}" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="6">CAFÉ AURORA</text>
      <text x="100" y="250" fill="${dark}" font-family="Arial, sans-serif" font-size="72" font-weight="800">${visual.title}</text>
      <text x="104" y="312" fill="${dark}" font-family="Arial, sans-serif" font-size="34" opacity=".76">${visual.subtitle}</text>
    </svg>
  `);
}

async function createDemoMedia(workspaceId, userId) {
  const uploadDir = path.join(config.storageDir, "uploads");
  const thumbnailDir = path.join(config.storageDir, "thumbnails");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(thumbnailDir, { recursive: true });
  const media = [];

  for (const visual of demoVisuals) {
    const id = createId();
    const storageName = `${id}.jpg`;
    const storagePath = path.join(uploadDir, storageName);
    const thumbnailPath = path.join(thumbnailDir, `${id}.webp`);
    const source = svgForVisual(visual);
    await sharp(source).jpeg({ quality: 90 }).toFile(storagePath);
    await sharp(source)
      .resize(640, 640, { fit: "inside" })
      .webp({ quality: 82 })
      .toFile(thumbnailPath);
    const stat = await fs.stat(storagePath);
    await query(
      `INSERT INTO media_assets (
        id, workspace_id, uploaded_by, media_type, mime_type, original_name,
        storage_name, storage_path, thumbnail_path, size_bytes, width, height,
        processing_status
      ) VALUES (
        :id, :workspaceId, :userId, 'image', 'image/jpeg', :originalName,
        :storageName, :storagePath, :thumbnailPath, :sizeBytes, 1200, 1200,
        'ready'
      )`,
      {
        id,
        workspaceId,
        userId,
        originalName: visual.name,
        storageName,
        storagePath,
        thumbnailPath,
        sizeBytes: stat.size
      }
    );
    media.push(id);
  }
  return media;
}

async function addTarget(connection, input) {
  const targetId = createId();
  await connection.execute(
    `INSERT INTO post_targets (
      id, post_id, channel_id, platform, caption, content_type, status,
      published_at, external_post_id, external_url, friendly_error,
      technical_error, attempt_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      targetId,
      input.postId,
      input.channelId,
      input.platform,
      input.caption,
      input.contentType || "image",
      input.status,
      input.publishedAt || null,
      input.externalId || null,
      input.externalUrl || null,
      input.friendlyError || null,
      input.technicalError || null,
      input.attemptCount || 0
    ]
  );
  for (const [position, mediaId] of (input.mediaIds || []).entries()) {
    await connection.execute(
      "INSERT INTO post_media (target_id, media_id, position) VALUES (?, ?, ?)",
      [targetId, mediaId, position]
    );
  }
  return targetId;
}

async function createDemoPosts({
  userId,
  workspaceId,
  facebookId,
  instagramId,
  mediaIds
}) {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const definitions = [
    {
      caption:
        "Um café especial transforma qualquer pausa. Nossa nova seleção chegou — notas de caramelo, cacau e um final delicado. ☕✨\n\n#CafeAurora #CafeEspecial",
      status: "scheduled",
      scheduledAt: new Date(now + 5 * hour),
      media: mediaIds[0],
      channels: ["facebook", "instagram"]
    },
    {
      caption:
        "Amanhã tem bastidores por aqui: vamos mostrar como escolhemos cada grão da nova safra. Salve para acompanhar.",
      instagramCaption:
        "Dos grãos à xícara: amanhã abrimos os bastidores da nova safra. Salve para acompanhar. 🌿\n\n#Bastidores #CafeEspecial",
      status: "scheduled",
      scheduledAt: new Date(now + 2 * day + 3 * hour),
      media: mediaIds[1],
      channels: ["facebook", "instagram"]
    },
    {
      caption:
        "Domingo combina com brunch e café sem pressa. Esperamos você das 9h às 14h.",
      status: "scheduled",
      scheduledAt: new Date(now + 5 * day),
      media: mediaIds[2],
      channels: ["instagram"]
    },
    {
      caption:
        "A nova seleção Aurora já está disponível. Qual nota você percebe primeiro: cacau ou caramelo?",
      status: "published",
      scheduledAt: new Date(now - 3 * day),
      publishedAt: new Date(now - 3 * day + 2 * 60 * 1000),
      media: mediaIds[0],
      channels: ["facebook", "instagram"]
    },
    {
      caption:
        "Pequenos rituais fazem dias melhores. Hoje, reserve cinco minutos só para você.",
      status: "published",
      scheduledAt: new Date(now - 8 * day),
      publishedAt: new Date(now - 8 * day + 90 * 1000),
      media: mediaIds[1],
      channels: ["facebook"]
    },
    {
      caption:
        "Hoje tem café coado na hora e uma novidade no balcão. Venha descobrir.",
      status: "partially_published",
      scheduledAt: new Date(now - day),
      publishedAt: new Date(now - day + 2 * 60 * 1000),
      media: mediaIds[2],
      channels: ["facebook", "instagram"],
      failInstagram: true
    },
    {
      caption:
        "Ideia de campanha: apresentar as pessoas por trás de cada receita.",
      status: "draft",
      scheduledAt: null,
      media: mediaIds[1],
      channels: ["facebook", "instagram"]
    }
  ];

  await withTransaction(async (connection) => {
    for (const definition of definitions) {
      const postId = createId();
      await connection.execute(
        `INSERT INTO posts (
          id, workspace_id, author_id, base_caption, status, scheduled_at,
          scheduled_time_zone, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'America/Sao_Paulo', ?)`,
        [
          postId,
          workspaceId,
          userId,
          definition.caption,
          definition.status,
          definition.scheduledAt,
          definition.publishedAt || null
        ]
      );

      for (const platform of definition.channels) {
        const failed =
          platform === "instagram" && definition.failInstagram;
        const targetStatus =
          definition.status === "partially_published"
            ? failed
              ? "failed"
              : "published"
            : definition.status;
        const targetId = await addTarget(connection, {
          postId,
          channelId: platform === "facebook" ? facebookId : instagramId,
          platform,
          caption:
            platform === "instagram" && definition.instagramCaption
              ? definition.instagramCaption
              : definition.caption,
          status: targetStatus,
          publishedAt:
            targetStatus === "published" ? definition.publishedAt : null,
          externalId:
            targetStatus === "published"
              ? `demo_${platform}_${createId().slice(0, 8)}`
              : null,
          externalUrl:
            targetStatus === "published"
              ? platform === "facebook"
                ? "https://www.facebook.com/"
                : "https://www.instagram.com/"
              : null,
          friendlyError: failed
            ? "A conexão com o Instagram expirou. Reconecte a conta."
            : null,
          technicalError: failed
            ? "Demo: OAuthException code 190, subcode 463"
            : null,
          attemptCount: failed ? 4 : targetStatus === "published" ? 1 : 0,
          mediaIds: [definition.media]
        });

        if (definition.status === "scheduled") {
          await connection.execute(
            `INSERT INTO publication_jobs (
              id, target_id, idempotency_key, status, run_at, max_attempts
            ) VALUES (?, ?, ?, 'waiting', ?, 4)`,
            [
              createId(),
              targetId,
              `${targetId}:seed:schedule`,
              definition.scheduledAt
            ]
          );
        }
        if (targetStatus === "published") {
          const jobId = createId();
          await connection.execute(
            `INSERT INTO publication_jobs (
              id, target_id, idempotency_key, status, run_at, attempt_count,
              max_attempts, completed_at
            ) VALUES (?, ?, ?, 'completed', ?, 1, 4, ?)`,
            [
              jobId,
              targetId,
              `${targetId}:seed:published`,
              definition.scheduledAt,
              definition.publishedAt
            ]
          );
          await connection.execute(
            `INSERT INTO publication_attempts (
              id, job_id, target_id, attempt_number, started_at, finished_at,
              result, sanitized_response
            ) VALUES (?, ?, ?, 1, ?, ?, 'success', ?)`,
            [
              createId(),
              jobId,
              targetId,
              definition.scheduledAt,
              definition.publishedAt,
              JSON.stringify({ id: `demo_${platform}`, demo: true })
            ]
          );
          const base = platform === "instagram" ? 1.35 : 1;
          const metricValues = {
            likes: Math.round((82 + (postId.charCodeAt(0) % 40)) * base),
            comments: Math.round(12 * base),
            shares: Math.round(8 * base),
            reach: Math.round(2180 * base),
            impressions: Math.round(2940 * base)
          };
          for (const [metricType, metricValue] of Object.entries(metricValues)) {
            await connection.execute(
              `INSERT INTO metrics (
                id, target_id, metric_type, metric_value, collected_at
              ) VALUES (?, ?, ?, ?, ?)`,
              [
                createId(),
                targetId,
                metricType,
                metricValue,
                definition.publishedAt
              ]
            );
          }
        }
        if (failed) {
          const jobId = createId();
          await connection.execute(
            `INSERT INTO publication_jobs (
              id, target_id, idempotency_key, status, run_at, attempt_count,
              max_attempts, last_error_code, last_error_message
            ) VALUES (?, ?, ?, 'failed', ?, 4, 4, 'token_expired', ?)`,
            [
              jobId,
              targetId,
              `${targetId}:seed:failed`,
              definition.scheduledAt,
              "Demo: OAuthException code 190"
            ]
          );
          await connection.execute(
            `INSERT INTO publication_attempts (
              id, job_id, target_id, attempt_number, started_at, finished_at,
              result, error_code, friendly_error, technical_error,
              sanitized_response
            ) VALUES (?, ?, ?, 4, ?, ?, 'permanent_failure',
                      'token_expired', ?, ?, ?)`,
            [
              createId(),
              jobId,
              targetId,
              definition.scheduledAt,
              definition.publishedAt,
              "A conexão com o Instagram expirou. Reconecte a conta.",
              "Demo: OAuthException code 190, subcode 463",
              JSON.stringify({ error: { code: 190, token: "[redacted]" } })
            ]
          );
        }
      }
    }
  });
}

async function seed() {
  await runMigrations();
  const existing = await query("SELECT id FROM users WHERE email = :email", {
    email: DEMO_EMAIL
  });
  if (existing[0]) {
    logger.info("Dados de demonstração já existem", {
      email: DEMO_EMAIL
    });
    return;
  }

  const userId = createId();
  const workspaceId = createId();
  const facebookId = createId();
  const instagramId = createId();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await withTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO users (
        id, name, email, password_hash, role, status, email_verified_at,
        terms_accepted_at, privacy_accepted_at
      ) VALUES (?, 'Marina Costa', ?, ?, 'admin', 'active',
                UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [userId, DEMO_EMAIL, passwordHash]
    );
    await connection.execute(
      `INSERT INTO workspaces (
        id, owner_id, name, time_zone, settings
      ) VALUES (?, ?, 'Café Aurora', 'America/Sao_Paulo', ?)`,
      [workspaceId, userId, JSON.stringify({ demo: true })]
    );
    await connection.execute(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES (?, ?, 'owner')`,
      [workspaceId, userId]
    );
    await connection.execute(
      "UPDATE users SET current_workspace_id = ? WHERE id = ?",
      [workspaceId, userId]
    );
    await connection.execute(
      `INSERT INTO social_channels (
        id, workspace_id, platform, external_id, name, avatar_url, account_type,
        encrypted_access_token, permissions, status, is_demo, last_synced_at
      ) VALUES (?, ?, 'facebook', ?, 'Café Aurora', '/assets/channel-aurora.svg',
                'page', ?, ?, 'connected', TRUE, UTC_TIMESTAMP(3))`,
      [
        facebookId,
        workspaceId,
        `demo-facebook-${workspaceId}`,
        encryptSecret("demo-facebook-token"),
        JSON.stringify([
          "pages_show_list",
          "pages_manage_posts",
          "pages_read_engagement"
        ])
      ]
    );
    await connection.execute(
      `INSERT INTO social_channels (
        id, workspace_id, platform, external_id, name, username, avatar_url,
        account_type, encrypted_access_token, permissions, status, is_demo,
        last_synced_at
      ) VALUES (?, ?, 'instagram', ?, 'Café Aurora', 'cafeaurora',
                '/assets/channel-aurora.svg', 'business', ?, ?,
                'connected', TRUE, UTC_TIMESTAMP(3))`,
      [
        instagramId,
        workspaceId,
        `demo-instagram-${workspaceId}`,
        encryptSecret("demo-instagram-token"),
        JSON.stringify(["instagram_basic", "instagram_content_publish"])
      ]
    );
  });

  const mediaIds = await createDemoMedia(workspaceId, userId);
  await createDemoPosts({
    userId,
    workspaceId,
    facebookId,
    instagramId,
    mediaIds
  });
  await query(
    `INSERT INTO notifications (
      id, user_id, workspace_id, type, title, message, related_type, related_id
    ) VALUES (
      :id, :userId, :workspaceId, 'partially_published',
      'Publicação parcialmente concluída',
      'O Facebook publicou, mas o Instagram precisa ser reconectado.',
      'post', NULL
    )`,
    { id: createId(), userId, workspaceId }
  );
  logger.info("Demonstração criada", {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD
  });
}

seed()
  .catch((error) => {
    logger.error("Falha ao criar demonstração", {
      error: error.message,
      stack: error.stack
    });
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
