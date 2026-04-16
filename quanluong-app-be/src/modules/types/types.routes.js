import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { PERMISSIONS } from "../../shared/constants/permissions.js";
import { listTypesController } from "./types.controller.js";

const typesRouter = express.Router();

typesRouter.use(authMiddleware);

typesRouter.get(
  "/",
  permissionMiddleware([PERMISSIONS.USERS_READ]),
  asyncHandler(listTypesController),
);

export { typesRouter };
