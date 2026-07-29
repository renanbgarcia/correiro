import { query } from "../db.js";
import { createId } from "../lib/ids.js";
import { sendMail } from "./mailer.js";
import { logger } from "../lib/logger.js";

const CRITICAL_TYPES = new Set([
  "failed",
  "partially_published",
  "token_expired",
  "permission_revoked"
]);

export async function createNotification({
  userId,
  workspaceId,
  type,
  title,
  message,
  relatedType = null,
  relatedId = null
}) {
  const id = createId();
  await query(
    `INSERT INTO notifications (
      id, user_id, workspace_id, type, title, message, related_type, related_id
    ) VALUES (
      :id, :userId, :workspaceId, :type, :title, :message, :relatedType, :relatedId
    )`,
    {
      id,
      userId,
      workspaceId,
      type,
      title,
      message,
      relatedType,
      relatedId
    }
  );

  if (CRITICAL_TYPES.has(type)) {
    const users = await query(
      `SELECT email, email_notifications_enabled
       FROM users WHERE id = :userId LIMIT 1`,
      { userId }
    );
    const user = users[0];
    if (user?.email_notifications_enabled) {
      sendMail({
        to: user.email,
        subject: `[Correiro] ${title}`,
        text: `${message}\n\nAcesse o Correiro para ver os detalhes.`
      })
        .then(async (sent) => {
          if (sent) {
            await query(
              "UPDATE notifications SET email_sent_at = UTC_TIMESTAMP(3) WHERE id = :id",
              { id }
            );
          }
        })
        .catch((error) =>
          logger.error("Falha ao enviar notificação por e-mail", {
            notificationId: id,
            error: error.message
          })
        );
    }
  }
  return id;
}
