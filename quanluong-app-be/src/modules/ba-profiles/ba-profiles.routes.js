import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import {
  adminGetProfileController,
  adminListProfilesController,
  createTokenController,
  getProfileByTokenController,
  listProfilesByTokenController,
  listTokensController,
  pushProfileController,
  revokeTokenController,
} from "./ba-profiles.controller.js";
import { findActiveTokenByHash, touchToken } from "./ba-profiles.service.js";
import { createBaTokenAuthMiddleware, requireBaScope } from "./ba-token-auth.middleware.js";
import {
  createTokenBodySchema,
  idParamsSchema,
  listProfilesQuerySchema,
  pushProfileBodySchema,
} from "./ba-profiles.validator.js";

const baTokenAuth = createBaTokenAuthMiddleware({
  findActiveTokenByHash: (h) => findActiveTokenByHash(h),
  touchToken: (id) => touchToken(id),
});

const baProfilesRouter = express.Router();

// --- Bot (Bearer qlba_…) ---
baProfilesRouter.post(
  "/unit-profiles",
  baTokenAuth,
  requireBaScope("UNIT_PUSH"),
  validateRequest({ body: pushProfileBodySchema }),
  asyncHandler(pushProfileController),
);
baProfilesRouter.get(
  "/unit-profiles",
  baTokenAuth,
  requireBaScope("UNIT_PUSH", "GLOBAL_READ"),
  validateRequest({ query: listProfilesQuerySchema }),
  asyncHandler(listProfilesByTokenController),
);
baProfilesRouter.get(
  "/unit-profiles/:id",
  baTokenAuth,
  requireBaScope("UNIT_PUSH", "GLOBAL_READ"),
  validateRequest({ params: idParamsSchema }),
  asyncHandler(getProfileByTokenController),
);

// --- Superadmin UI (cookie JWT) ---
baProfilesRouter.get(
  "/admin/unit-profiles",
  authMiddleware,
  superadminMiddleware,
  validateRequest({ query: listProfilesQuerySchema }),
  asyncHandler(adminListProfilesController),
);
baProfilesRouter.get(
  "/admin/unit-profiles/:id",
  authMiddleware,
  superadminMiddleware,
  validateRequest({ params: idParamsSchema }),
  asyncHandler(adminGetProfileController),
);

// --- Quản lý token (cookie JWT; quyền kiểm trong service) ---
baProfilesRouter.post(
  "/tokens",
  authMiddleware,
  validateRequest({ body: createTokenBodySchema }),
  asyncHandler(createTokenController),
);
baProfilesRouter.get("/tokens", authMiddleware, asyncHandler(listTokensController));
baProfilesRouter.delete(
  "/tokens/:id",
  authMiddleware,
  validateRequest({ params: idParamsSchema }),
  asyncHandler(revokeTokenController),
);

export { baProfilesRouter };
