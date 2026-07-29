import { query } from "../db.js";

export function aggregatePostStatus(targetStatuses, fallback = "draft") {
  if (!targetStatuses.length) return fallback;
  const statuses = new Set(targetStatuses);
  const published = targetStatuses.filter((status) => status === "published")
    .length;
  const failed = targetStatuses.filter((status) => status === "failed").length;

  if (published === targetStatuses.length) return "published";
  if (published > 0 && failed > 0) return "partially_published";
  if (failed === targetStatuses.length) return "failed";
  if (
    statuses.has("processing") ||
    statuses.has("queued") ||
    (published > 0 && published < targetStatuses.length)
  ) {
    return "processing";
  }
  if (statuses.has("scheduled")) return "scheduled";
  if (statuses.size === 1 && statuses.has("cancelled")) return "cancelled";
  return fallback;
}

export async function refreshPostStatus(postId, executor = query) {
  const postRows = await executor(
    "SELECT status FROM posts WHERE id = :postId LIMIT 1",
    { postId }
  );
  const targetRows = await executor(
    "SELECT status FROM post_targets WHERE post_id = :postId",
    { postId }
  );
  if (!postRows[0]) return null;
  const previousStatus = postRows[0].status;
  const status = aggregatePostStatus(
    targetRows.map((row) => row.status),
    previousStatus
  );
  await executor(
    `UPDATE posts
     SET status = :status,
         published_at = IF(
           :status = 'published',
           COALESCE(published_at, UTC_TIMESTAMP(3)),
           published_at
         )
     WHERE id = :postId`,
    { postId, status }
  );
  return { previousStatus, status };
}
