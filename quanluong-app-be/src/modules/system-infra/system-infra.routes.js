import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { getSystemInfraController } from "./system-infra.controller.js";

const systemInfraRouter = express.Router();

systemInfraRouter.use(authMiddleware, superadminMiddleware);
systemInfraRouter.get("/", asyncHandler(getSystemInfraController));

export { systemInfraRouter };
