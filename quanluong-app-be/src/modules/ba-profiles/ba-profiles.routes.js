import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import {
  comparisonController,
  createProposalController,
  getBaselineDocController,
  listBaselineController,
  listBaselineVersionsController,
  listProposalsController,
  publishBaselineController,
  reviewProposalController,
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
import {
  createBaActorAuthMiddleware,
  createBaTokenAuthMiddleware,
  requireBaScope,
} from "./ba-token-auth.middleware.js";
import { ALL_SCOPES, GLOBAL_SCOPES } from "./ba-profiles.utils.js";
import {
  baselineQuerySchema,
  createProposalBodySchema,
  docKeyParamsSchema,
  listProposalsQuerySchema,
  publishBaselineBodySchema,
  reviewProposalBodySchema,
  createTokenBodySchema,
  idParamsSchema,
  listProfilesQuerySchema,
  pushProfileBodySchema,
} from "./ba-profiles.validator.js";

const baTokenAuth = createBaTokenAuthMiddleware({
  findActiveTokenByHash: (h) => findActiveTokenByHash(h),
  touchToken: (id) => touchToken(id),
});

// Trợ lý (Bearer qlba_…) hoặc superadmin đăng nhập (coi như GLOBAL_WRITE)
const baActorAuth = createBaActorAuthMiddleware({
  tokenAuth: baTokenAuth,
  userAuth: authMiddleware,
  superadminOnly: superadminMiddleware,
});

const baProfilesRouter = express.Router();

// --- Bộ nghiệp vụ chung: mọi token đọc được; GLOBAL_WRITE / superadmin đăng ---
baProfilesRouter.get("/baseline", baActorAuth, requireBaScope(...ALL_SCOPES), asyncHandler(listBaselineController));
baProfilesRouter.get(
  "/baseline/:docKey",
  baActorAuth,
  requireBaScope(...ALL_SCOPES),
  validateRequest({ params: docKeyParamsSchema, query: baselineQuerySchema }),
  asyncHandler(getBaselineDocController),
);
baProfilesRouter.get(
  "/baseline/:docKey/versions",
  baActorAuth,
  requireBaScope(...ALL_SCOPES),
  validateRequest({ params: docKeyParamsSchema }),
  asyncHandler(listBaselineVersionsController),
);
baProfilesRouter.post(
  "/baseline/:docKey",
  baActorAuth,
  requireBaScope("GLOBAL_WRITE"),
  validateRequest({ params: docKeyParamsSchema, body: publishBaselineBodySchema }),
  asyncHandler(publishBaselineController),
);

// --- Bảng so sánh (chỉ GLOBAL) ---
baProfilesRouter.get("/comparison", baActorAuth, requireBaScope(...GLOBAL_SCOPES), asyncHandler(comparisonController));

// --- Đề xuất: đơn vị gửi + xem của mình; GLOBAL xem tất cả; GLOBAL_WRITE duyệt ---
baProfilesRouter.post(
  "/proposals",
  baActorAuth,
  requireBaScope("UNIT_PUSH"),
  validateRequest({ body: createProposalBodySchema }),
  asyncHandler(createProposalController),
);
baProfilesRouter.get(
  "/proposals",
  baActorAuth,
  requireBaScope(...ALL_SCOPES),
  validateRequest({ query: listProposalsQuerySchema }),
  asyncHandler(listProposalsController),
);
baProfilesRouter.patch(
  "/proposals/:id",
  baActorAuth,
  requireBaScope("GLOBAL_WRITE"),
  validateRequest({ params: idParamsSchema, body: reviewProposalBodySchema }),
  asyncHandler(reviewProposalController),
);

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
  requireBaScope(...ALL_SCOPES),
  validateRequest({ query: listProfilesQuerySchema }),
  asyncHandler(listProfilesByTokenController),
);
baProfilesRouter.get(
  "/unit-profiles/:id",
  baTokenAuth,
  requireBaScope(...ALL_SCOPES),
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
