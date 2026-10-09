import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { PERMISSIONS } from "../../shared/constants/permissions.js";
import { getSystemInfraController, restartSystemInfraController } from "./system-infra.controller.js";

const systemInfraRouter = express.Router();

systemInfraRouter.use(authMiddleware, permissionMiddleware([PERMISSIONS.SYSTEM_INFRA_MANAGE]));
systemInfraRouter.get("/", asyncHandler(getSystemInfraController));
systemInfraRouter.post("/containers/:name/restart", asyncHandler(restartSystemInfraController));

export { systemInfraRouter };
