import { Router } from "express";
import { config } from "../config.js";
import { query, withTransaction } from "../db.js";
import {
  createOpaqueToken,
  hashToken
} from "../lib/crypto.js";
import { AppError, asyncRoute, assert, jsonData } from "../lib/http.js";
import { createId } from "../lib/ids.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  booleanValue,
  emailAddress,
  requiredString
} from "../lib/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/security.js";
import { audit } from "../services/audit.js";
import { sendMail } from "../services/mailer.js";

export const authRouter = Router();

const authRateLimit = rateLimit({
  keyPrefix: "auth",
  windowMs: 15 * 60 * 1000,
  max: 20
});

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: config.session.ttlDays * 24 * 60 * 60 * 1000
  };
}

function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: config.session.ttlDays * 24 * 60 * 60 * 1000
  };
}

async function issueSession(request, response, userId) {
  const token = createOpaqueToken();
  const csrfToken = createOpaqueToken(24);
  const expiresAt = new Date(
    Date.now() + config.session.ttlDays * 24 * 60 * 60 * 1000
  );
  await query(
    `INSERT INTO sessions (
      id, user_id, token_hash, ip_address, user_agent, expires_at
    ) VALUES (
      :id, :userId, :tokenHash, :ipAddress, :userAgent, :expiresAt
    )`,
    {
      id: createId(),
      userId,
      tokenHash: hashToken(token),
      ipAddress: request.ip || null,
      userAgent: String(request.headers["user-agent"] || "").slice(0, 500),
      expiresAt
    }
  );
  response.cookie(config.session.cookieName, token, sessionCookieOptions());
  response.cookie(
    config.session.csrfCookieName,
    csrfToken,
    csrfCookieOptions()
  );
}

async function issueUserToken(userId, type, ttlMs) {
  const token = createOpaqueToken();
  await query(
    `INSERT INTO user_tokens (
      id, user_id, type, token_hash, expires_at
    ) VALUES (
      :id, :userId, :type, :tokenHash, :expiresAt
    )`,
    {
      id: createId(),
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs)
    }
  );
  return token;
}

function publicUser(row) {
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

authRouter.post(
  "/register",
  authRateLimit,
  asyncRoute(async (request, response) => {
    const name = requiredString(request.body.name, "Nome", {
      min: 2,
      max: 120
    });
    const email = emailAddress(request.body.email);
    const password = requiredString(request.body.password, "Senha", {
      min: 8,
      max: 200
    });
    assert(
      booleanValue(request.body.acceptTerms),
      422,
      "terms_required",
      "Você precisa aceitar os Termos de Uso."
    );
    assert(
      booleanValue(request.body.acceptPrivacy),
      422,
      "privacy_required",
      "Você precisa aceitar a Política de Privacidade."
    );

    const existing = await query(
      "SELECT id FROM users WHERE email = :email LIMIT 1",
      { email }
    );
    assert(
      !existing.length,
      409,
      "email_in_use",
      "Já existe uma conta com este e-mail."
    );

    const userId = createId();
    const workspaceId = createId();
    const passwordHash = await hashPassword(password);
    const now = new Date();

    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO users (
          id, name, email, password_hash, terms_accepted_at, privacy_accepted_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, name, email, passwordHash, now, now]
      );
      await connection.execute(
        `INSERT INTO workspaces (id, owner_id, name, time_zone)
         VALUES (?, ?, ?, ?)`,
        [
          workspaceId,
          userId,
          `Workspace de ${name.split(" ")[0]}`,
          "America/Sao_Paulo"
        ]
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
    });

    const verificationToken = await issueUserToken(
      userId,
      "email_verification",
      24 * 60 * 60 * 1000
    );
    const verificationUrl = `${config.appUrl}/?verify=${encodeURIComponent(
      verificationToken
    )}`;
    await sendMail({
      to: email,
      subject: "Confirme seu e-mail no Correiro",
      text: `Confirme seu e-mail acessando: ${verificationUrl}`
    });

    jsonData(
      response,
      {
        message:
          "Conta criada. Confirme o e-mail para entrar.",
        ...(config.isProduction ? {} : { developmentVerificationUrl: verificationUrl })
      },
      201
    );
  })
);

authRouter.post(
  "/verify-email",
  authRateLimit,
  asyncRoute(async (request, response) => {
    const token = requiredString(request.body.token, "Token", {
      min: 20,
      max: 500
    });
    const rows = await query(
      `SELECT ut.id, ut.user_id, u.email_verified_at
       FROM user_tokens ut
       JOIN users u ON u.id = ut.user_id
       WHERE ut.type = 'email_verification'
         AND ut.token_hash = :tokenHash
         AND ut.expires_at > UTC_TIMESTAMP(3)
         AND ut.used_at IS NULL
       LIMIT 1`,
      { tokenHash: hashToken(token) }
    );
    assert(
      rows[0],
      400,
      "invalid_token",
      "Este link de confirmação é inválido ou expirou."
    );

    await withTransaction(async (connection) => {
      await connection.execute(
        "UPDATE users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP(3)) WHERE id = ?",
        [rows[0].user_id]
      );
      await connection.execute(
        "UPDATE user_tokens SET used_at = UTC_TIMESTAMP(3) WHERE id = ?",
        [rows[0].id]
      );
    });
    jsonData(response, { message: "E-mail confirmado. Você já pode entrar." });
  })
);

authRouter.post(
  "/login",
  authRateLimit,
  asyncRoute(async (request, response) => {
    const email = emailAddress(request.body.email);
    const password = requiredString(request.body.password, "Senha", {
      min: 1,
      max: 200
    });
    const rows = await query(
      "SELECT * FROM users WHERE email = :email LIMIT 1",
      { email }
    );
    const user = rows[0];
    const validPassword =
      user && (await verifyPassword(password, user.password_hash));
    assert(
      validPassword,
      401,
      "invalid_credentials",
      "E-mail ou senha incorretos."
    );
    assert(
      user.status === "active",
      403,
      "account_unavailable",
      "Esta conta não está disponível."
    );
    assert(
      user.email_verified_at,
      403,
      "email_not_verified",
      "Confirme seu e-mail antes de entrar."
    );

    await issueSession(request, response, user.id);
    request.user = publicUser(user);
    await audit(request, "auth.login", { type: "user", id: user.id });
    jsonData(response, { user: publicUser(user) });
  })
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncRoute(async (request, response) => {
    await query("DELETE FROM sessions WHERE id = :id", {
      id: request.sessionId
    });
    response.clearCookie(config.session.cookieName, sessionCookieOptions());
    response.clearCookie(config.session.csrfCookieName, csrfCookieOptions());
    jsonData(response, { message: "Sessão encerrada." });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncRoute(async (request, response) => {
    const workspaces = await query(
      `SELECT w.id, w.name, w.image_url, w.time_zone, w.publishing_paused,
              wm.role AS member_role
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = :userId
       ORDER BY w.created_at`,
      { userId: request.user.id }
    );
    jsonData(response, {
      user: request.user,
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        imageUrl: workspace.image_url,
        timeZone: workspace.time_zone,
        publishingPaused: Boolean(workspace.publishing_paused),
        memberRole: workspace.member_role
      }))
    });
  })
);

authRouter.patch(
  "/profile",
  requireAuth,
  asyncRoute(async (request, response) => {
    const name = requiredString(request.body.name, "Nome", {
      min: 2,
      max: 120
    });
    const notifications = booleanValue(
      request.body.emailNotificationsEnabled,
      true
    );
    await query(
      `UPDATE users
       SET name = :name, email_notifications_enabled = :notifications
       WHERE id = :id`,
      { id: request.user.id, name, notifications }
    );
    await audit(request, "profile.updated", {
      type: "user",
      id: request.user.id
    });
    jsonData(response, {
      ...request.user,
      name,
      emailNotificationsEnabled: notifications
    });
  })
);

authRouter.patch(
  "/password",
  requireAuth,
  authRateLimit,
  asyncRoute(async (request, response) => {
    const currentPassword = requiredString(
      request.body.currentPassword,
      "Senha atual",
      { min: 1, max: 200 }
    );
    const newPassword = requiredString(request.body.newPassword, "Nova senha", {
      min: 8,
      max: 200
    });
    const users = await query(
      "SELECT password_hash FROM users WHERE id = :id LIMIT 1",
      { id: request.user.id }
    );
    assert(
      await verifyPassword(currentPassword, users[0].password_hash),
      401,
      "invalid_password",
      "A senha atual está incorreta."
    );
    const passwordHash = await hashPassword(newPassword);
    await withTransaction(async (connection) => {
      await connection.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        [passwordHash, request.user.id]
      );
      await connection.execute(
        "DELETE FROM sessions WHERE user_id = ? AND id <> ?",
        [request.user.id, request.sessionId]
      );
    });
    await audit(request, "security.password_changed", {
      type: "user",
      id: request.user.id
    });
    jsonData(response, { message: "Senha alterada com segurança." });
  })
);

authRouter.post(
  "/forgot-password",
  authRateLimit,
  asyncRoute(async (request, response) => {
    const email = emailAddress(request.body.email);
    const users = await query(
      "SELECT id, email FROM users WHERE email = :email AND status = 'active' LIMIT 1",
      { email }
    );
    let developmentResetUrl;
    if (users[0]) {
      const token = await issueUserToken(
        users[0].id,
        "password_reset",
        60 * 60 * 1000
      );
      const resetUrl = `${config.appUrl}/?reset=${encodeURIComponent(token)}`;
      developmentResetUrl = resetUrl;
      await sendMail({
        to: email,
        subject: "Redefina sua senha no Correiro",
        text: `Use este link em até 1 hora: ${resetUrl}`
      });
    }
    jsonData(response, {
      message:
        "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.",
      ...(config.isProduction || !developmentResetUrl
        ? {}
        : { developmentResetUrl })
    });
  })
);

authRouter.post(
  "/reset-password",
  authRateLimit,
  asyncRoute(async (request, response) => {
    const token = requiredString(request.body.token, "Token", {
      min: 20,
      max: 500
    });
    const newPassword = requiredString(request.body.password, "Nova senha", {
      min: 8,
      max: 200
    });
    const tokens = await query(
      `SELECT id, user_id
       FROM user_tokens
       WHERE type = 'password_reset'
         AND token_hash = :tokenHash
         AND expires_at > UTC_TIMESTAMP(3)
         AND used_at IS NULL
       LIMIT 1`,
      { tokenHash: hashToken(token) }
    );
    assert(
      tokens[0],
      400,
      "invalid_token",
      "Este link de recuperação é inválido ou expirou."
    );
    const passwordHash = await hashPassword(newPassword);
    await withTransaction(async (connection) => {
      await connection.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        [passwordHash, tokens[0].user_id]
      );
      await connection.execute(
        "UPDATE user_tokens SET used_at = UTC_TIMESTAMP(3) WHERE id = ?",
        [tokens[0].id]
      );
      await connection.execute("DELETE FROM sessions WHERE user_id = ?", [
        tokens[0].user_id
      ]);
    });
    jsonData(response, {
      message: "Senha redefinida. Entre novamente com a nova senha."
    });
  })
);

authRouter.get(
  "/export",
  requireAuth,
  asyncRoute(async (request, response) => {
    const [userRows, workspaceRows, channelRows, postRows] = await Promise.all([
      query(
        `SELECT id, name, email, status, created_at
         FROM users WHERE id = :userId`,
        { userId: request.user.id }
      ),
      query(
        `SELECT w.id, w.name, w.time_zone, w.created_at
         FROM workspaces w
         JOIN workspace_members wm ON wm.workspace_id = w.id
         WHERE wm.user_id = :userId`,
        { userId: request.user.id }
      ),
      query(
        `SELECT sc.id, sc.platform, sc.external_id, sc.name, sc.username,
                sc.connection_provider, sc.status, sc.created_at
         FROM social_channels sc
         JOIN workspace_members wm ON wm.workspace_id = sc.workspace_id
         WHERE wm.user_id = :userId`,
        { userId: request.user.id }
      ),
      query(
        `SELECT p.id, p.base_caption, p.status, p.scheduled_at,
                p.published_at, p.created_at
         FROM posts p
         JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
         WHERE wm.user_id = :userId AND p.deleted_at IS NULL`,
        { userId: request.user.id }
      )
    ]);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="correiro-dados-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`
    );
    jsonData(response, {
      exportedAt: new Date().toISOString(),
      user: userRows[0],
      workspaces: workspaceRows,
      channels: channelRows,
      posts: postRows
    });
  })
);

authRouter.delete(
  "/account",
  requireAuth,
  authRateLimit,
  asyncRoute(async (request, response) => {
    const password = requiredString(request.body.password, "Senha", {
      min: 1,
      max: 200
    });
    const users = await query(
      "SELECT password_hash FROM users WHERE id = :id LIMIT 1",
      { id: request.user.id }
    );
    assert(
      await verifyPassword(password, users[0].password_hash),
      401,
      "invalid_password",
      "A senha informada está incorreta."
    );

    await audit(request, "privacy.account_deleted", {
      type: "user",
      id: request.user.id
    });
    const tombstoneEmail = `deleted+${request.user.id}@invalid.local`;
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE social_channels sc
         JOIN workspace_members wm ON wm.workspace_id = sc.workspace_id
         SET sc.encrypted_access_token = NULL,
             sc.encrypted_refresh_token = NULL,
             sc.token_expires_at = NULL,
             sc.provider_connection_id = NULL,
             sc.status = 'disconnected',
             sc.disconnected_at = UTC_TIMESTAMP(3)
         WHERE wm.user_id = ?`,
        [request.user.id]
      );
      await connection.execute(
        `UPDATE users
         SET name = 'Conta excluída', email = ?, status = 'deleted',
             deleted_at = UTC_TIMESTAMP(3), current_workspace_id = NULL
         WHERE id = ?`,
        [tombstoneEmail, request.user.id]
      );
      await connection.execute("DELETE FROM sessions WHERE user_id = ?", [
        request.user.id
      ]);
    });
    response.clearCookie(config.session.cookieName, sessionCookieOptions());
    response.clearCookie(config.session.csrfCookieName, csrfCookieOptions());
    jsonData(response, { message: "Sua conta foi excluída." });
  })
);
