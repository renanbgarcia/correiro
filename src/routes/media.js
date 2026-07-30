import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { config } from "../config.js";
import { query } from "../db.js";
import { signValue, verifySignature } from "../lib/crypto.js";
import { AppError, asyncRoute, assert, jsonData } from "../lib/http.js";
import { createId } from "../lib/ids.js";
import { parsePagination } from "../lib/http.js";
import { requireAuth, requireWorkspace } from "../middleware/auth.js";
import { audit } from "../services/audit.js";

const uploadsDir = path.join(config.storageDir, "uploads");
const thumbnailsDir = path.join(config.storageDir, "thumbnails");
const tempDir = path.join(config.storageDir, "tmp");
for (const directory of [uploadsDir, thumbnailsDir, tempDir]) {
  fs.mkdirSync(directory, { recursive: true });
}

const upload = multer({
  dest: tempDir,
  limits: { fileSize: config.uploads.maxVideoBytes, files: 1 }
});

export const mediaRouter = Router();

const MIME_BY_SIGNATURE = [
  {
    mime: "image/jpeg",
    extension: ".jpg",
    match: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8
  },
  {
    mime: "image/png",
    extension: ".png",
    match: (buffer) =>
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
  },
  {
    mime: "image/webp",
    extension: ".webp",
    match: (buffer) =>
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP"
  },
  {
    mime: "image/gif",
    extension: ".gif",
    match: (buffer) => ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString())
  },
  {
    mime: "video/mp4",
    extension: ".mp4",
    match: (buffer) => buffer.subarray(4, 8).toString() === "ftyp"
  }
];

async function inspectFile(filePath) {
  const handle = await fsp.open(filePath, "r");
  try {
    const header = Buffer.alloc(32);
    await handle.read(header, 0, header.length, 0);
    return MIME_BY_SIGNATURE.find((candidate) => candidate.match(header)) || null;
  } finally {
    await handle.close();
  }
}

function safeStoragePath(candidate) {
  const resolved = path.resolve(candidate);
  const storageRoot = `${path.resolve(config.storageDir)}${path.sep}`;
  if (!resolved.startsWith(storageRoot)) {
    throw new AppError(400, "invalid_path", "Caminho de mídia inválido.");
  }
  return resolved;
}

function serializeMedia(row) {
  return {
    id: row.id,
    mediaType: row.media_type,
    mimeType: row.mime_type,
    originalName: row.original_name,
    sizeBytes: Number(row.size_bytes),
    width: row.width,
    height: row.height,
    durationSeconds: row.duration_seconds,
    processingStatus: row.processing_status,
    errorMessage: row.error_message,
    fileUrl: `/api/media/${row.id}/file`,
    thumbnailUrl: row.thumbnail_path
      ? `/api/media/${row.id}/thumbnail`
      : `/api/media/${row.id}/file`,
    createdAt: row.created_at
  };
}

mediaRouter.get(
  "/",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const { page, limit, offset } = parsePagination(request, {
      limit: 30,
      maxLimit: 60
    });
    const type =
      request.query.type === "image" || request.query.type === "video"
        ? request.query.type
        : null;
    const search = String(request.query.search || "").trim();
    const params = {
      workspaceId: request.workspace.id,
      type,
      search: `%${search}%`,
      limit,
      offset
    };
    const where = `
      workspace_id = :workspaceId
      AND deleted_at IS NULL
      AND (:type IS NULL OR media_type = :type)
      AND (:search = '%%' OR original_name LIKE :search)
    `;
    const [rows, countRows] = await Promise.all([
      query(
        `SELECT * FROM media_assets
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT :limit OFFSET :offset`,
        params
      ),
      query(
        `SELECT COUNT(*) AS total FROM media_assets WHERE ${where}`,
        params
      )
    ]);
    jsonData(response, rows.map(serializeMedia), 200, {
      page,
      limit,
      total: Number(countRows[0].total),
      pages: Math.ceil(Number(countRows[0].total) / limit)
    });
  })
);

mediaRouter.post(
  "/upload",
  requireAuth,
  requireWorkspace,
  upload.single("file"),
  asyncRoute(async (request, response) => {
    assert(
      request.file,
      422,
      "file_required",
      "Selecione uma imagem ou vídeo."
    );
    const temporaryPath = request.file.path;
    let finalPath;
    try {
      const detected = await inspectFile(temporaryPath);
      assert(
        detected,
        422,
        "unsupported_media",
        "Formato não aceito. Use JPG, PNG, WEBP, GIF ou MP4."
      );
      const mediaType = detected.mime.startsWith("image/") ? "image" : "video";
      const limit =
        mediaType === "image"
          ? config.uploads.maxImageBytes
          : config.uploads.maxVideoBytes;
      assert(
        request.file.size <= limit,
        422,
        "media_too_large",
        `O arquivo ultrapassa o limite de ${Math.round(
          limit / 1024 / 1024
        )} MB.`
      );

      const id = createId();
      const storageName = `${id}${detected.extension}`;
      finalPath = path.join(uploadsDir, storageName);
      await fsp.rename(temporaryPath, finalPath);

      let width = null;
      let height = null;
      let thumbnailPath = null;
      if (mediaType === "image") {
        const metadata = await sharp(finalPath).metadata();
        width = metadata.width || null;
        height = metadata.height || null;
        thumbnailPath = path.join(thumbnailsDir, `${id}.webp`);
        await sharp(finalPath)
          .rotate()
          .resize(640, 640, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(thumbnailPath);
      }

      await query(
        `INSERT INTO media_assets (
          id, workspace_id, uploaded_by, media_type, mime_type, original_name,
          storage_name, storage_path, thumbnail_path, size_bytes, width, height,
          processing_status
        ) VALUES (
          :id, :workspaceId, :uploadedBy, :mediaType, :mimeType, :originalName,
          :storageName, :storagePath, :thumbnailPath, :sizeBytes, :width, :height,
          'ready'
        )`,
        {
          id,
          workspaceId: request.workspace.id,
          uploadedBy: request.user.id,
          mediaType,
          mimeType: detected.mime,
          originalName: path
            .basename(request.file.originalname)
            .normalize("NFKC")
            .slice(0, 255),
          storageName,
          storagePath: finalPath,
          thumbnailPath,
          sizeBytes: request.file.size,
          width,
          height
        }
      );
      await audit(request, "media.uploaded", { type: "media", id }, {
        mediaType,
        sizeBytes: request.file.size
      });
      const rows = await query(
        "SELECT * FROM media_assets WHERE id = :id",
        { id }
      );
      jsonData(response, serializeMedia(rows[0]), 201);
    } catch (error) {
      await fsp.unlink(temporaryPath).catch(() => {});
      if (finalPath) await fsp.unlink(finalPath).catch(() => {});
      throw error;
    }
  })
);

async function findAuthorizedMedia(request) {
  const rows = await query(
    `SELECT * FROM media_assets
     WHERE id = :id AND workspace_id = :workspaceId AND deleted_at IS NULL
     LIMIT 1`,
    { id: request.params.id, workspaceId: request.workspace.id }
  );
  assert(rows[0], 404, "media_not_found", "Mídia não encontrada.");
  return rows[0];
}

function streamFile(response, mediaPath, mimeType, filename, disposition = "inline") {
  const resolved = safeStoragePath(mediaPath);
  if (!fs.existsSync(resolved)) {
    throw new AppError(404, "file_not_found", "Arquivo de mídia não encontrado.");
  }
  response.setHeader("Content-Type", mimeType);
  response.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${encodeURIComponent(filename)}"`
  );
  response.setHeader("Cache-Control", "private, max-age=3600");
  fs.createReadStream(resolved).pipe(response);
}

mediaRouter.get(
  "/:id/file",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const media = await findAuthorizedMedia(request);
    streamFile(
      response,
      media.storage_path,
      media.mime_type,
      media.original_name
    );
  })
);

mediaRouter.get(
  "/:id/thumbnail",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const media = await findAuthorizedMedia(request);
    streamFile(
      response,
      media.thumbnail_path || media.storage_path,
      media.thumbnail_path ? "image/webp" : media.mime_type,
      `miniatura-${media.original_name}`
    );
  })
);

mediaRouter.get(
  ["/public/:id/:expires/:signature", "/public/:id"],
  asyncRoute(async (request, response) => {
    const expires = Number(request.params.expires || request.query.expires);
    const signature = String(
      request.params.signature || request.query.sig || ""
    );
    assert(
      Number.isFinite(expires) &&
        expires > Math.floor(Date.now() / 1000) &&
        expires < Math.floor(Date.now() / 1000) + 25 * 60 * 60 &&
        verifySignature(`${request.params.id}:${expires}`, signature),
      403,
      "invalid_media_signature",
      "Este link de mídia expirou."
    );
    const rows = await query(
      `SELECT * FROM media_assets
       WHERE id = :id AND deleted_at IS NULL LIMIT 1`,
      { id: request.params.id }
    );
    assert(rows[0], 404, "media_not_found", "Mídia não encontrada.");
    streamFile(
      response,
      rows[0].storage_path,
      rows[0].mime_type,
      rows[0].original_name
    );
  })
);

mediaRouter.delete(
  "/:id",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const media = await findAuthorizedMedia(request);
    const usages = await query(
      `SELECT COUNT(*) AS total
       FROM post_media pm
       JOIN post_targets pt ON pt.id = pm.target_id
       JOIN posts p ON p.id = pt.post_id
       WHERE pm.media_id = :id AND p.deleted_at IS NULL`,
      { id: media.id }
    );
    assert(
      Number(usages[0].total) === 0,
      409,
      "media_in_use",
      "Esta mídia está em uso em uma publicação."
    );
    await query(
      "UPDATE media_assets SET deleted_at = UTC_TIMESTAMP(3) WHERE id = :id",
      { id: media.id }
    );
    await audit(request, "media.deleted", { type: "media", id: media.id });
    jsonData(response, { message: "Mídia excluída." });
  })
);

export function buildPublicMediaUrl(mediaId, ttlSeconds = 60 * 60) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = signValue(`${mediaId}:${expires}`);
  const appUrl = config.appUrl.replace(/\/+$/, "");
  return `${appUrl}/api/media/public/${encodeURIComponent(
    mediaId
  )}/${expires}/${encodeURIComponent(signature)}`;
}
