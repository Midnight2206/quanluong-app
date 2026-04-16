import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
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
  googleDriveUnlinkController,
  loginController,
  logoutController,
  patchMeProfileController,
  registerController,
  registerUnitsController,
  refreshTokenController,
  requestVerificationEmailController,
  requestVerificationEmailPublicController,
  resetPasswordController,
  uploadAvatarController,
  verifyEmailController,
} from "./auth.controller.js";
import { uploadAvatarMiddleware } from "./avatar-upload.middleware.js";
import {
  avatarJobParamsSchema,
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  meProfilePatchSchema,
  registerBodySchema,
  requestVerificationEmailPublicBodySchema,
  resetPasswordBodySchema,
} from "./auth.validator.js";

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
authRouter.delete("/google/drive", authMiddleware, asyncHandler(googleDriveUnlinkController));
authRouter.post(
  "/register",
  validateRequest({ body: registerBodySchema }),
  asyncHandler(registerController),
);
authRouter.post("/login", validateRequest({ body: loginBodySchema }), asyncHandler(loginController));
authRouter.post(
  "/forgot-password",
  validateRequest({ body: forgotPasswordBodySchema }),
  asyncHandler(forgotPasswordController),
);
authRouter.post(
  "/reset-password",
  validateRequest({ body: resetPasswordBodySchema }),
  asyncHandler(resetPasswordController),
);
authRouter.post("/refresh-token", asyncHandler(refreshTokenController));
authRouter.get("/current-user", authMiddleware, asyncHandler(currentUserController));
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
authRouter.post(
  "/request-verification-email/public",
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
