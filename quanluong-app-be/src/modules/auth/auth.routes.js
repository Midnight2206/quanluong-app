import express from "express";
import { sensitiveAuthEndpointRateLimit } from "../../middlewares/auth-rate-limit.middleware.js";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { optionalAuthMiddleware } from "../../middlewares/optional-auth.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import {
  changePasswordController,
  currentUserController,
  deleteAvatarController,
  forgotPasswordController,
  getAvatarJobController,
  googleDriveAuthorizeUrlController,
  googleDriveCallbackController,
  googleDriveStartController,
  googleDriveStatusController,
  googleDriveUnlinkController,
  googleLoginAuthorizeUrlController,
  googleLoginCallbackController,
  googleLoginStartController,
  loginController,
  zaloAttemptController,
  zaloLinkController,
  zaloLoginAuthorizeUrlController,
  zaloLoginCallbackController,
  zaloPhoneController,
  zaloRegisterController,
  logoutController,
  patchMeProfileController,
  registerController,
  registerUnitsController,
  refreshTokenController,
  requestVerificationEmailController,
  requestVerificationEmailPublicController,
  resetPasswordController,
  uploadAvatarController,
  uploadSignatureController,
  deleteSignatureController,
  verifyEmailController,
} from "./auth.controller.js";
import { uploadAvatarMiddleware } from "./avatar-upload.middleware.js";
import { uploadSignatureMiddleware } from "./signature-upload.middleware.js";
import {
  avatarJobParamsSchema,
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  meProfilePatchSchema,
  registerBodySchema,
  requestVerificationEmailPublicBodySchema,
  resetPasswordBodySchema,
  zaloAuthorizeQuerySchema,
  zaloLinkBodySchema,
  zaloPhoneBodySchema,
  zaloRegisterBodySchema,
  zaloTicketParamsSchema,
} from "./auth.validator.js";

function requireAuthWhenZaloLink(req, res, next) {
  if (req.validatedQuery?.mode === "link") {
    return authMiddleware(req, res, next);
  }
  return next();
}

const authRouter = express.Router();

authRouter.get("/verify-email", asyncHandler(verifyEmailController));
authRouter.get("/register-units", asyncHandler(registerUnitsController));
authRouter.get("/google/drive/start", authMiddleware, asyncHandler(googleDriveStartController));
authRouter.get(
  "/google/drive/authorize-url",
  authMiddleware,
  asyncHandler(googleDriveAuthorizeUrlController),
);
authRouter.get("/google/drive/callback", asyncHandler(googleDriveCallbackController));
authRouter.get("/google/login/start", asyncHandler(googleLoginStartController));
authRouter.get("/google/login/authorize-url", asyncHandler(googleLoginAuthorizeUrlController));
authRouter.get("/google/login/callback", asyncHandler(googleLoginCallbackController));
authRouter.get(
  "/zalo/login/authorize-url",
  validateRequest({ query: zaloAuthorizeQuerySchema }),
  requireAuthWhenZaloLink,
  asyncHandler(zaloLoginAuthorizeUrlController),
);
authRouter.get("/zalo/login/callback", asyncHandler(zaloLoginCallbackController));
authRouter.get(
  "/zalo/attempts/:ticket",
  validateRequest({ params: zaloTicketParamsSchema }),
  asyncHandler(zaloAttemptController),
);
authRouter.post(
  "/zalo/attempts/:ticket/phone",
  sensitiveAuthEndpointRateLimit,
  validateRequest({ params: zaloTicketParamsSchema, body: zaloPhoneBodySchema }),
  asyncHandler(zaloPhoneController),
);
authRouter.post(
  "/zalo/attempts/:ticket/link",
  sensitiveAuthEndpointRateLimit,
  validateRequest({ params: zaloTicketParamsSchema, body: zaloLinkBodySchema }),
  asyncHandler(zaloLinkController),
);
authRouter.post(
  "/zalo/attempts/:ticket/register",
  sensitiveAuthEndpointRateLimit,
  validateRequest({ params: zaloTicketParamsSchema, body: zaloRegisterBodySchema }),
  asyncHandler(zaloRegisterController),
);
authRouter.get("/google/drive/status", authMiddleware, asyncHandler(googleDriveStatusController));
authRouter.delete("/google/drive", authMiddleware, asyncHandler(googleDriveUnlinkController));
authRouter.post(
  "/register",
  sensitiveAuthEndpointRateLimit,
  validateRequest({ body: registerBodySchema }),
  asyncHandler(registerController),
);
authRouter.post(
  "/login",
  sensitiveAuthEndpointRateLimit,
  validateRequest({ body: loginBodySchema }),
  asyncHandler(loginController),
);
authRouter.post(
  "/forgot-password",
  sensitiveAuthEndpointRateLimit,
  validateRequest({ body: forgotPasswordBodySchema }),
  asyncHandler(forgotPasswordController),
);
authRouter.post(
  "/reset-password",
  sensitiveAuthEndpointRateLimit,
  validateRequest({ body: resetPasswordBodySchema }),
  asyncHandler(resetPasswordController),
);
authRouter.post("/refresh-token", asyncHandler(refreshTokenController));
authRouter.get("/current-user", optionalAuthMiddleware, asyncHandler(currentUserController));
authRouter.patch(
  "/me/profile",
  authMiddleware,
  validateRequest({ body: meProfilePatchSchema }),
  asyncHandler(patchMeProfileController),
);
authRouter.get(
  "/me/avatar-job/:jobId",
  authMiddleware,
  validateRequest({ params: avatarJobParamsSchema }),
  asyncHandler(getAvatarJobController),
);
authRouter.delete("/me/avatar", authMiddleware, asyncHandler(deleteAvatarController));
authRouter.post(
  "/me/avatar",
  authMiddleware,
  uploadAvatarMiddleware,
  asyncHandler(uploadAvatarController),
);
authRouter.delete("/me/signature", authMiddleware, asyncHandler(deleteSignatureController));
authRouter.post(
  "/me/signature",
  authMiddleware,
  uploadSignatureMiddleware,
  asyncHandler(uploadSignatureController),
);

authRouter.post(
  "/request-verification-email/public",
  sensitiveAuthEndpointRateLimit,
  validateRequest({ body: requestVerificationEmailPublicBodySchema }),
  asyncHandler(requestVerificationEmailPublicController),
);
authRouter.post(
  "/request-verification-email",
  authMiddleware,
  asyncHandler(requestVerificationEmailController),
);
authRouter.post("/logout", authMiddleware, asyncHandler(logoutController));
authRouter.post(
  "/change-password",
  authMiddleware,
  validateRequest({ body: changePasswordBodySchema }),
  asyncHandler(changePasswordController),
);

export { authRouter };
