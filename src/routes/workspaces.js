import { Router } from "express";
import { query } from "../db.js";
import { asyncRoute, assert, jsonData } from "../lib/http.js";
import { isValidTimeZone } from "../lib/time.js";
import {
  booleanValue,
  optionalString,
  requiredString
} from "../lib/validation.js";
import { requireAuth, requireWorkspace } from "../middleware/auth.js";
import { audit } from "../services/audit.js";

export const workspaceRouter = Router();

workspaceRouter.get(
  "/current",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    jsonData(response, request.workspace);
  })
);

workspaceRouter.patch(
  "/current",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const name = requiredString(request.body.name, "Nome do workspace", {
      min: 2,
      max: 120
    });
    const timeZone = requiredString(request.body.timeZone, "Fuso horário", {
      min: 3,
      max: 80
    });
    assert(
      isValidTimeZone(timeZone),
      422,
      "invalid_timezone",
      "Selecione um fuso horário válido."
    );
    const imageUrl = optionalString(request.body.imageUrl, "Imagem", {
      max: 500
    });
    await query(
      `UPDATE workspaces
       SET name = :name, time_zone = :timeZone, image_url = :imageUrl
       WHERE id = :id`,
      { id: request.workspace.id, name, timeZone, imageUrl }
    );
    await audit(
      request,
      "workspace.updated",
      { type: "workspace", id: request.workspace.id },
      { name, timeZone }
    );
    jsonData(response, {
      ...request.workspace,
      name,
      timeZone,
      imageUrl
    });
  })
);

workspaceRouter.patch(
  "/current/publishing",
  requireAuth,
  requireWorkspace,
  asyncRoute(async (request, response) => {
    const paused = booleanValue(request.body.paused);
    await query(
      "UPDATE workspaces SET publishing_paused = :paused WHERE id = :id",
      { id: request.workspace.id, paused }
    );
    await audit(
      request,
      paused ? "publishing.paused" : "publishing.resumed",
      { type: "workspace", id: request.workspace.id }
    );
    jsonData(response, { publishingPaused: paused });
  })
);

workspaceRouter.post(
  "/select/:id",
  requireAuth,
  asyncRoute(async (request, response) => {
    const memberships = await query(
      `SELECT w.id
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE w.id = :workspaceId AND wm.user_id = :userId
       LIMIT 1`,
      { workspaceId: request.params.id, userId: request.user.id }
    );
    assert(
      memberships[0],
      404,
      "workspace_not_found",
      "Workspace não encontrado."
    );
    await query(
      "UPDATE users SET current_workspace_id = :workspaceId WHERE id = :userId",
      { workspaceId: request.params.id, userId: request.user.id }
    );
    jsonData(response, { currentWorkspaceId: request.params.id });
  })
);
