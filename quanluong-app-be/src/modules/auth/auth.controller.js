import bcrypt from "bcryptjs";
import { AUTH_COOKIE_NAMES } from "./auth.constants.js";
import { clearAuthCookies, setAuthCookies } from "./auth.cookies.js";
import { logger } from "../../shared/utils/logger.js";
import { mapCurrentUser } from "./auth.mapper.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import {
  getCurrentUser,
  getRegisterUnits,
  getUserById,
  issueZaloSession,
  login,
  loginWithGoogleAccount,
  logout,
  refreshSession,
  register,
  verifyEmailWithToken,
} from "./auth.service.js";
import { getAttempt, patchAttempt } from "./zalo-attempt.store.js";
import { normalizeVnPhone } from "./zalo-phone.js";
import {
  applyOauthProfile,
  applyPhone,
  assertZaloConfigured,
  buildZaloAuthorizeUrl,
  completeZaloPassword,
  completeZaloRegister,
  createPkcePair,
  exchangeZaloCode,
  exchangeZaloPhone,
  fetchZaloProfile,
} from "./zalo-login.service.js";
import path from "node:path";
import fs from "node:fs/promises";
import {
  dispatchAvatarProcessing,
  getAvatarJobStatusForUser,
  runAvatarProcessingSync,
} from "../../infra/media/avatar-processing.dispatcher.js";
import { removeOwnAvatar } from "./avatar.service.js";
import {
  removeOwnSignature,
  setOwnSignatureFromStaging,
} from "./signature.service.js";
import { updateOwnProfile } from "./me-profile.service.js";
import {
  changePasswordForUser,
  requestPasswordResetByEmail,
  resetPasswordWithToken,
} from "./password-account.service.js";
import {
  requestVerificationEmailByEmail,
  requestVerificationEmailForUser,
} from "./verification-email-request.service.js";
import {
  buildGoogleAuthUrl,
  exchangeCodeAndLinkDrive,
  unlinkGoogleDriveForUser,
  verifyGoogleDriveLinkForUser,
} from "./google-drive-link.service.js";
import {
  buildGoogleLoginAuthUrl,
  exchangeGoogleLoginCode,
  sanitizeLoginFromPath,
} from "./google-login.service.js";
import { avatarPixelCropSchema } from "./auth.validator.js";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import crypto from "node:crypto";
import { getUnitBreadcrumbChain } from "../../shared/units/unit-scope.service.js";
import { respondSuccess } from "../../shared/utils/responders.js";

function pickReturnWebOrigin(req) {
  const originHeader = typeof req.get("origin") === "string" ? req.get("origin").trim() : "";
  if (originHeader && config.security.corsOrigins.includes(originHeader)) {
    return originHeader.replace(/\/+$/, "");
  }
  const referer = typeof req.get("referer") === "string" ? req.get("referer").trim() : "";
  if (referer) {
    try {
      const parsed = new URL(referer);
      const origin = `${parsed.protocol}//${parsed.host}`;
      if (config.security.corsOrigins.includes(origin)) {
        return origin;
      }
    } catch {
      // ignore malformed referer
    }
  }
  return config.publicWebUrl;
}

function googleDriveErrorRedirect(returnOrigin, reason, message) {
  const q = new URLSearchParams({ google: "error", reason });
  if (typeof message === "string" && message.trim()) {
    q.set("msg", message.trim().slice(0, 240));
  }
  const base = String(returnOrigin || config.publicWebUrl).replace(/\/+$/, "");
  return `${base}/?${q.toString()}`;
}

function mapGoogleDriveLinkErrorReason(error) {
  if (!(error instanceof AppError)) {
    return { reason: "unknown" };
  }
  const message = String(error.message || "");
  if (error.statusCode === 503) {
    return { reason: "config", message };
  }
  if (message.includes("refresh token")) {
    return { reason: "no_refresh", message };
  }
  if (message.includes("Không tạo được thư mục") || message.includes("thư mục con")) {
    return { reason: "folder", message };
  }
  if (message.includes("quyền") && (message.includes("Drive") || message.includes("Sheets"))) {
    return { reason: "scope", message };
  }
  if (message.includes("access token")) {
    return { reason: "token", message };
  }
  return { reason: "unknown", message };
}

function googleLoginErrorRedirect(reason, from = "/", message) {
  const q = new URLSearchParams({ google: "error", reason });
  const path = sanitizeLoginFromPath(from);
  if (path !== "/") {
    q.set("from", path);
  }
  if (typeof message === "string" && message.trim()) {
    q.set("msg", message.trim().slice(0, 240));
  }
  return `${config.publicWebUrl}/login?${q.toString()}`;
}

function mapGoogleLoginErrorReason(error) {
  if (!(error instanceof AppError)) {
    return "unknown";
  }
  if (error.statusCode === 404) {
    return "no_account";
  }
  if (error.statusCode === 403) {
    if (String(error.message).includes("chờ")) {
      return "pending";
    }
    if (String(error.message).includes("từ chối")) {
      return "rejected";
    }
    if (String(error.message).includes("xác minh")) {
      return "email";
    }
    return "forbidden";
  }
  if (error.statusCode === 401) {
    return "inactive";
  }
  if (error.statusCode === 503) {
    return "config";
  }
  if (error.statusCode === 400) {
    if (String(error.message).includes("redirect_uri")) {
      return "redirect_uri";
    }
    if (String(error.details?.error ?? "").includes("invalid_grant")) {
      return "token";
    }
    return "token";
  }
  if (error.statusCode === 502) {
    return "profile";
  }
  return "unknown";
}

async function prepareGoogleLoginOAuthSession(req) {
  const from = sanitizeLoginFromPath(
    typeof req.query.from === "string" ? req.query.from : "/",
  );
  const state = crypto.randomBytes(24).toString("hex");
  req.session.googleOAuthLogin = { state, from };
  await saveSessionAsync(req);
  return buildGoogleLoginAuthUrl(state);
}

async function googleLoginStartController(req, res) {
  const url = await prepareGoogleLoginOAuthSession(req);
  return res.redirect(302, url);
}

async function googleLoginAuthorizeUrlController(req, res) {
  const url = await prepareGoogleLoginOAuthSession(req);
  return respondSuccess(res, {
    message: "Sẵn sàng chuyển tới Google để đăng nhập.",
    data: { url },
  });
}

async function googleLoginCallbackController(req, res) {
  const { code, state, error: oauthError } = req.query;

  const fromFallback =
    typeof req.session?.googleOAuthLogin?.from === "string"
      ? req.session.googleOAuthLogin.from
      : "/";

  if (oauthError) {
    return res.redirect(302, googleLoginErrorRedirect("denied", fromFallback));
  }
  if (!code || !state) {
    return res.redirect(302, googleLoginErrorRedirect("missing", fromFallback));
  }

  const sess = req.session.googleOAuthLogin;
  if (!sess || sess.state !== state) {
    return res.redirect(302, googleLoginErrorRedirect("state", fromFallback));
  }

  const from = sanitizeLoginFromPath(sess.from);
  delete req.session.googleOAuthLogin;
  await saveSessionAsync(req);

  try {
    const profile = await exchangeGoogleLoginCode(String(code));
    const session = await loginWithGoogleAccount({
      req,
      email: profile.email,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    setAuthCookies(res, session);
    return res.redirect(302, `${config.publicWebUrl}${from}`);
  } catch (error) {
    const reason = mapGoogleLoginErrorReason(error);
    const message = error instanceof AppError ? error.message : "Đăng nhập Google thất bại.";
    logger.warn(
      {
        reason,
        err: error instanceof AppError ? { statusCode: error.statusCode, code: error.code, details: error.details } : { message: error?.message },
      },
      "Google login callback failed",
    );
    clearAuthCookies(res);
    return res.redirect(302, googleLoginErrorRedirect(reason, from, message));
  }
}

async function mapAuthUserResponse(user) {
  const unitPath = user.unitId ? await getUnitBreadcrumbChain(user.unitId) : [];
  return mapCurrentUser(user, { unitPath });
}

async function loginController(req, res) {
  const session = await login({
    req,
    identifier: req.validatedBody.identifier,
    password: req.validatedBody.password,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  setAuthCookies(res, session);

  return respondSuccess(res, {
    message: "Logged in successfully",
    data: await mapAuthUserResponse(session.user),
  });
}

async function registerController(req, res) {
  const result = await register({
    req,
    username: req.validatedBody.username,
    email: req.validatedBody.email,
    password: req.validatedBody.password,
    unitId: req.validatedBody.unitId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  if (result.pending) {
    return respondSuccess(res, {
      statusCode: 202,
      message: "Đã gửi đăng ký. Vui lòng chờ quản trị đơn vị trong nhánh của bạn duyệt.",
      data: {
        pending: true,
        user: await mapAuthUserResponse(result.user),
      },
    });
  }

  if (result.needsVerification) {
    return respondSuccess(res, {
      statusCode: 201,
      message:
        "Đã tạo tài khoản. Vui lòng mở liên kết trong email để xác minh địa chỉ, sau đó mới đăng nhập được.",
      data: {
        needsVerification: true,
        user: await mapAuthUserResponse(result.user),
      },
    });
  }

  setAuthCookies(res, result);

  return respondSuccess(res, {
    statusCode: 201,
    message: "Registered successfully",
    data: await mapAuthUserResponse(result.user),
  });
}

async function registerUnitsController(_req, res) {
  const units = await getRegisterUnits();

  return respondSuccess(res, {
    message: "Fetched registration units",
    data: units,
  });
}

async function refreshTokenController(req, res) {
  const session = await refreshSession({
    req,
    refreshToken: req.cookies?.[AUTH_COOKIE_NAMES.REFRESH_TOKEN],
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  setAuthCookies(res, session);

  return respondSuccess(res, {
    message: "Refreshed session successfully",
    data: await mapAuthUserResponse(session.user),
  });
}

async function currentUserController(req, res) {
  if (!req.user?.id) {
    return respondSuccess(res, {
      message: "Không có phiên đăng nhập",
      data: null,
    });
  }

  const user = await getCurrentUser(req.user);

  return respondSuccess(res, {
    message: "Fetched current user",
    data: await mapAuthUserResponse(user),
  });
}

function saveSessionAsync(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function requestVerificationEmailController(req, res) {
  const user = await getCurrentUser(req.user);
  const { viaQueue } = await requestVerificationEmailForUser(user);

  return respondSuccess(res, {
    message: viaQueue
      ? "Đã xếp gửi email xác minh. Kiểm tra hộp thư trong vài phút."
      : "Đã gửi email xác minh. Kiểm tra hộp thư.",
    data: { viaQueue },
  });
}

async function requestVerificationEmailPublicController(req, res) {
  const result = await requestVerificationEmailByEmail(req.validatedBody.email);
  if (result.outcome === "silent") {
    return respondSuccess(res, {
      message:
        "Nếu email khớp tài khoản chưa xác minh, hệ thống đã gửi (hoặc xếp hàng gửi) thư xác minh. Kiểm tra hộp thư, kể cả mục spam.",
      data: { silent: true },
    });
  }

  return respondSuccess(res, {
    message: result.viaQueue
      ? "Đã xếp gửi email xác minh. Kiểm tra hộp thư trong vài phút."
      : "Đã gửi email xác minh. Kiểm tra hộp thư.",
    data: { viaQueue: result.viaQueue },
  });
}

async function verifyEmailController(req, res) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  await verifyEmailWithToken(token);

  return respondSuccess(res, {
    message: "Email đã được xác minh. Bạn có thể đăng nhập.",
    data: { verified: true },
  });
}

async function prepareGoogleDriveOAuthSession(req) {
  const user = await getCurrentUser(req.user);
  if (!user.emailVerifiedAt && user.type?.name !== "superadmin") {
    throw new AppError({
      message: "Vui lòng xác minh email trước khi liên kết Google Drive.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  const state = crypto.randomBytes(24).toString("hex");
  req.session.googleOAuthLink = {
    state,
    userId: user.id,
    returnOrigin: pickReturnWebOrigin(req),
  };
  await saveSessionAsync(req);

  return buildGoogleAuthUrl(state);
}

async function googleDriveStartController(req, res) {
  const url = await prepareGoogleDriveOAuthSession(req);
  return res.redirect(302, url);
}

/** JSON URL cho SPA — fetch credentials: 'include' gửi cookie giống /current-user (tránh 401 khi chỉ dùng <a href>). */
async function googleDriveAuthorizeUrlController(req, res) {
  const url = await prepareGoogleDriveOAuthSession(req);
  return respondSuccess(res, {
    message: "Sẵn sàng chuyển tới Google.",
    data: { url },
  });
}

async function googleDriveCallbackController(req, res) {
  const { code, state, error: oauthError } = req.query;
  const fallbackOrigin = pickReturnWebOrigin(req);

  if (oauthError) {
    return res.redirect(302, googleDriveErrorRedirect(fallbackOrigin, "denied"));
  }
  if (!code || !state) {
    return res.redirect(302, googleDriveErrorRedirect(fallbackOrigin, "missing"));
  }

  const sess = req.session.googleOAuthLink;
  const returnOrigin = sess?.returnOrigin || fallbackOrigin;
  if (!sess || sess.state !== state) {
    return res.redirect(302, googleDriveErrorRedirect(returnOrigin, "state"));
  }

  delete req.session.googleOAuthLink;
  await saveSessionAsync(req);

  try {
    await exchangeCodeAndLinkDrive({
      code: String(code),
      userId: sess.userId,
    });
  } catch (e) {
    const { reason, message } = mapGoogleDriveLinkErrorReason(e);
    logger.warn(
      {
        userId: sess.userId,
        reason,
        statusCode: e instanceof AppError ? e.statusCode : undefined,
        message: e instanceof AppError ? e.message : e?.message,
      },
      "Liên kết Google Drive thất bại sau OAuth callback",
    );
    return res.redirect(302, googleDriveErrorRedirect(returnOrigin, reason, message));
  }

  return res.redirect(302, `${returnOrigin}/?google=linked`);
}

async function googleDriveUnlinkController(req, res) {
  const user = await getCurrentUser(req.user);
  await unlinkGoogleDriveForUser(user.id);
  const next = await getCurrentUser(req.user);
  return respondSuccess(res, {
    message: "Đã gỡ liên kết Google Drive trên tài khoản này.",
    data: await mapAuthUserResponse(next),
  });
}

async function googleDriveStatusController(req, res) {
  const user = await getCurrentUser(req.user);
  const status = await verifyGoogleDriveLinkForUser(user.id);
  const next = await getCurrentUser(req.user);
  return respondSuccess(res, {
    message:
      status.status === "cleared"
        ? "Folder Google Drive không còn tồn tại; đã xoá liên kết cũ."
        : "Đã kiểm tra liên kết Google Drive.",
    data: await mapAuthUserResponse(next),
    meta: { googleDriveStatus: status.status },
  });
}

async function logoutController(req, res) {
  await logout({
    req,
    refreshToken: req.cookies?.[AUTH_COOKIE_NAMES.REFRESH_TOKEN],
  });

  clearAuthCookies(res);

  return respondSuccess(res, {
    message: "Logged out successfully",
    data: null,
  });
}

async function forgotPasswordController(req, res) {
  await requestPasswordResetByEmail(req.validatedBody.email);

  return respondSuccess(res, {
    message:
      "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Kiểm tra hộp thư (kể cả spam).",
    data: { ok: true },
  });
}

async function resetPasswordController(req, res) {
  await resetPasswordWithToken(req.validatedBody.token, req.validatedBody.newPassword);

  return respondSuccess(res, {
    message: "Mật khẩu đã được đặt lại. Bạn có thể đăng nhập bằng mật khẩu mới.",
    data: { ok: true },
  });
}

async function changePasswordController(req, res) {
  await changePasswordForUser({
    userId: req.user.id,
    currentPassword: req.validatedBody.currentPassword,
    newPassword: req.validatedBody.newPassword,
  });

  return respondSuccess(res, {
    message:
      "Đã đổi mật khẩu. Các phiên đăng nhập khác đã được hủy; nếu đã cấu hình email, bạn sẽ nhận được thông báo.",
    data: { ok: true },
  });
}

async function uploadAvatarController(req, res) {
  if (!req.file) {
    throw new AppError({
      message: "Chọn file ảnh đại diện (JPEG, PNG, WebP hoặc GIF, tối đa 2MB).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const stagingRelativePath = path
    .relative(config.media.root, req.file.path)
    .replace(/\\/g, "/");

  if (!stagingRelativePath.startsWith("staging/")) {
    await fs.unlink(req.file.path).catch(() => {});
    throw new AppError({
      message: "Lưu tạm ảnh thất bại.",
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  let crop = null;
  const rawCrop = req.body?.crop;
  if (rawCrop && typeof rawCrop === "string") {
    try {
      const parsed = JSON.parse(rawCrop);
      const z = avatarPixelCropSchema.safeParse(parsed);
      if (z.success) {
        crop = z.data;
      }
    } catch {
      /* bỏ qua crop không hợp lệ */
    }
  }

  const dispatched = await dispatchAvatarProcessing({
    userId: req.user.id,
    stagingRelativePath,
    crop,
  });

  if (dispatched.viaQueue) {
    return respondSuccess(res, {
      statusCode: 202,
      message: "Đã nhận ảnh, đang xử lý trong nền.",
      data: { jobId: dispatched.jobId, status: "queued" },
    });
  }

  await runAvatarProcessingSync({
    userId: req.user.id,
    stagingRelativePath,
    crop,
  });
  const user = await getCurrentUser(req.user);

  return respondSuccess(res, {
    message: "Đã cập nhật ảnh đại diện.",
    data: await mapAuthUserResponse(user),
  });
}

async function getAvatarJobController(req, res) {
  const { jobId } = req.validatedParams;
  const r = await getAvatarJobStatusForUser(jobId, req.user.id);

  if (r.unavailable) {
    return respondSuccess(res, {
      data: { status: "unavailable", message: "Hàng đợi xử lý chưa bật; không tra cứu được job." },
    });
  }
  if (r.notFound) {
    throw new AppError({
      message: "Không tìm thấy job xử lý.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (r.forbidden) {
    throw new AppError({
      message: "Không có quyền xem job này.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  return respondSuccess(res, { data: r });
}

async function deleteAvatarController(req, res) {
  await removeOwnAvatar(req.user.id);
  const user = await getCurrentUser(req.user);
  return respondSuccess(res, {
    message: "Đã xóa ảnh đại diện.",
    data: await mapAuthUserResponse(user),
  });
}

async function uploadSignatureController(req, res) {
  if (!req.file) {
    throw new AppError({
      message: "Chọn file ảnh chữ ký PNG nền trong suốt (tối đa 2MB, khuyến nghị dưới 500KB).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    await setOwnSignatureFromStaging(req.user.id, req.file.path);
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    throw err;
  }

  const user = await getCurrentUser(req.user);
  return respondSuccess(res, {
    message: "Đã cập nhật ảnh chữ ký.",
    data: await mapAuthUserResponse(user),
  });
}

async function deleteSignatureController(req, res) {
  await removeOwnSignature(req.user.id);
  const user = await getCurrentUser(req.user);
  return respondSuccess(res, {
    message: "Đã xóa ảnh chữ ký.",
    data: await mapAuthUserResponse(user),
  });
}

async function patchMeProfileController(req, res) {
  await updateOwnProfile(req.user.id, req.validatedBody);
  const user = await getCurrentUser(req.user);
  return respondSuccess(res, {
    message: "Đã cập nhật hồ sơ.",
    data: await mapAuthUserResponse(user),
  });
}

function ensureZaloConfigured() {
  try {
    assertZaloConfigured(config.zalo);
  } catch (error) {
    if (error?.statusCode === 503) {
      throw new AppError({
        message: "Đăng nhập Zalo chưa được cấu hình.",
        statusCode: 503,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      });
    }
    throw error;
  }
}

function zaloPortalOrigin(portal) {
  const raw = portal === "supplier" ? config.zalo.supplierOrigin : config.zalo.mainOrigin;
  return String(raw || "").replace(/\/+$/, "");
}

function zaloLoginErrorRedirect(origin, reason) {
  const q = new URLSearchParams({ zalo: "error", reason: String(reason || "unknown") });
  return `${origin}/login?${q.toString()}`;
}

function zaloContinueRedirect(origin, { ticket, branch } = {}) {
  const q = new URLSearchParams();
  if (ticket) q.set("ticket", ticket);
  if (branch) q.set("branch", branch);
  const qs = q.toString();
  return `${origin}/login/zalo${qs ? `?${qs}` : ""}`;
}

function zaloMiniAppUrl(ticket) {
  const deeplink = String(config.zalo.miniAppDeeplink || "");
  try {
    const url = new URL(deeplink);
    const version = String(config.zalo.miniAppTestingVersion || "").trim();
    if (version) {
      url.searchParams.set("env", "TESTING");
      url.searchParams.set("version", version);
    }
    url.searchParams.set("ticket", ticket);
    return url.toString();
  } catch {
    const join = deeplink.includes("?") ? "&" : "?";
    return `${deeplink}${join}ticket=${encodeURIComponent(ticket)}`;
  }
}

function zaloAttemptFields(attempt) {
  return {
    status: attempt?.status ?? null,
    branch: attempt?.branch ?? null,
    errorCode: attempt?.errorCode ?? null,
    displayName: attempt?.displayName ?? null,
    phone: attempt?.phone ?? null,
  };
}

const ZALO_PHONE_EXCHANGE_MESSAGES = {
  114: "Zalo không nhận được mã số điện thoại.",
  115: "Mã số điện thoại Zalo không hợp lệ.",
  116: "Máy chủ thiếu khóa bí mật Zalo.",
  117: "Khóa bí mật Zalo không đúng.",
  118: "Mã số điện thoại thuộc ứng dụng Zalo khác.",
  119: "Mã số điện thoại đã được dùng. Bấm chia sẻ lại.",
};

const ZALO_ATTEMPT_ERROR_MESSAGES = {
  no_phone: "Zalo không trả về số điện thoại.",
  phone_format: "Số điện thoại Zalo không đúng định dạng.",
  id_mismatch: "Tài khoản Zalo không khớp phiếu này.",
  expired: "Phiếu xác minh đã hết hạn.",
  ambiguous: "Số điện thoại trùng nhiều tài khoản.",
  superadmin: "Không đăng nhập superadmin bằng Zalo.",
  taken: "Mã Zalo đã thuộc tài khoản khác.",
};

function zaloAttemptErrorMessage(errorCode) {
  return ZALO_ATTEMPT_ERROR_MESSAGES[errorCode] || "Đăng nhập Zalo thất bại.";
}

function zaloAttemptNotFound() {
  return new AppError({
    message: "Phiếu đăng nhập Zalo không còn hiệu lực.",
    statusCode: 404,
    code: ERROR_CODES.NOT_FOUND,
  });
}

function zaloPasswordError() {
  return new AppError({
    message: "Tên đăng nhập hoặc mật khẩu không đúng",
    statusCode: 401,
    code: ERROR_CODES.UNAUTHORIZED,
  });
}

function zaloCallbackReason(error) {
  if (error?.code === "token" || error?.code === "profile") return error.code;
  if (error?.statusCode === 503) return "config";
  if (error?.statusCode === 403) return "forbidden";
  if (error?.statusCode === 401) return "inactive";
  return "unknown";
}

function loadZaloAttempt(ticket) {
  const attempt = getAttempt(ticket);
  if (!attempt) throw zaloAttemptNotFound();
  return attempt;
}

async function zaloLoginAuthorizeUrlController(req, res) {
  ensureZaloConfigured();
  const { portal, mode, from } = req.validatedQuery;
  if (mode === "link" && req.user?.type?.name === "superadmin") {
    throw new AppError({
      message: "Superadmin không gắn Zalo.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
  if (mode === "link" && req.user?.zaloUserId) {
    throw new AppError({
      message: "Tài khoản đã gắn Zalo.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = crypto.randomBytes(24).toString("hex");
  req.session.zaloOAuthLogin = {
    state,
    codeVerifier,
    portal,
    mode,
    from: sanitizeLoginFromPath(from),
    linkUserId: mode === "link" ? req.user.id : null,
  };
  await saveSessionAsync(req);
  const url = buildZaloAuthorizeUrl({
    state,
    codeChallenge,
    appId: config.zalo.appId,
    redirectUri: config.zalo.loginRedirectUri,
  });
  return respondSuccess(res, {
    message: "Sẵn sàng chuyển tới Zalo để đăng nhập.",
    data: { url },
  });
}

async function zaloLoginCallbackController(req, res) {
  const sessPreview = req.session?.zaloOAuthLogin;
  const origin = zaloPortalOrigin(sessPreview?.portal === "supplier" ? "supplier" : "main");
  try {
    ensureZaloConfigured();
  } catch {
    return res.redirect(302, zaloLoginErrorRedirect(origin, "config"));
  }

  const { code, state, error: oauthError } = req.query;
  if (oauthError) {
    return res.redirect(302, zaloLoginErrorRedirect(origin, "denied"));
  }
  if (!code || !state || typeof code !== "string" || typeof state !== "string") {
    return res.redirect(302, zaloLoginErrorRedirect(origin, "missing"));
  }
  const sess = req.session?.zaloOAuthLogin;
  if (!sess || sess.state !== state || !sess.codeVerifier) {
    return res.redirect(302, zaloLoginErrorRedirect(origin, "state"));
  }

  const portal = sess.portal === "supplier" ? "supplier" : "main";
  const portalOrigin = zaloPortalOrigin(portal);
  const mode = sess.mode === "link" ? "link" : "login";
  const from = sanitizeLoginFromPath(sess.from);
  const linkUserId = sess.linkUserId ?? null;
  const codeVerifier = sess.codeVerifier;
  delete req.session.zaloOAuthLogin;
  await saveSessionAsync(req);

  try {
    const accessToken = await exchangeZaloCode({
      code,
      codeVerifier,
      appId: config.zalo.appId,
      appSecret: config.zalo.appSecret,
      fetchImpl: fetch,
    });
    const profile = await fetchZaloProfile({
      accessToken,
      appSecret: config.zalo.appSecret,
      fetchImpl: fetch,
    });
    const raw = await prisma.user.findFirst({
      where: { zaloUserId: profile.id },
      include: { type: { select: { name: true } } },
    });
    const existingUser = raw
      ? {
          id: raw.id,
          typeName: raw.type?.name ?? null,
          registrationStatus: raw.registrationStatus,
          isActive: raw.isActive,
          deletedAt: raw.deletedAt,
          zaloUserId: raw.zaloUserId,
        }
      : null;
    const attemptDraft = {
      ticket: crypto.randomBytes(24).toString("hex"),
      portal,
      mode,
      from,
      linkUserId,
      zaloUserId: profile.id,
      displayName: profile.name,
    };
    const result = applyOauthProfile({
      attemptDraft,
      existingUser: mode === "link" ? null : existingUser,
    });
    if (result.kind === "session") {
      const user = await getUserById(result.userId);
      const session = await issueZaloSession({
        req,
        user,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      setAuthCookies(res, session);
      return res.redirect(302, `${portalOrigin}${from}`);
    }
    if (result.kind === "pending") {
      return res.redirect(302, zaloContinueRedirect(portalOrigin, { branch: "pending" }));
    }
    if (result.kind === "await_phone") {
      return res.redirect(302, zaloContinueRedirect(portalOrigin, { ticket: result.attempt.ticket }));
    }
    return res.redirect(302, zaloLoginErrorRedirect(portalOrigin, result.code || "unknown"));
  } catch (error) {
    const reason = zaloCallbackReason(error);
    logger.warn(
      {
        reason,
        portal,
        err: error instanceof AppError ? { statusCode: error.statusCode, code: error.code } : { message: error?.message },
      },
      "Zalo login callback failed",
    );
    if (mode === "login") clearAuthCookies(res);
    return res.redirect(302, zaloLoginErrorRedirect(portalOrigin, reason));
  }
}

async function zaloAttemptController(req, res) {
  ensureZaloConfigured();
  const attempt = loadZaloAttempt(req.validatedParams.ticket);
  return respondSuccess(res, {
    message: "Đã lấy phiếu đăng nhập Zalo.",
    data: {
      ...zaloAttemptFields(attempt),
      portal: attempt.portal ?? null,
      miniAppUrl: zaloMiniAppUrl(attempt.ticket),
    },
  });
}

async function findZaloPhoneMatches(rawPhone) {
  const phone = normalizeVnPhone(rawPhone);
  if (!phone) return [];
  // ponytail: scans every live profile phone; store a normalized column if this table grows.
  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      profile: { is: { phoneNumber: { not: null } } },
    },
    select: {
      id: true,
      registrationStatus: true,
      isActive: true,
      deletedAt: true,
      zaloUserId: true,
      type: { select: { name: true } },
      profile: { select: { phoneNumber: true } },
    },
  });
  return rows
    .filter((row) => normalizeVnPhone(row.profile?.phoneNumber) === phone)
    .map((row) => ({
      id: row.id,
      typeName: row.type?.name ?? null,
      registrationStatus: row.registrationStatus,
      isActive: row.isActive,
      deletedAt: row.deletedAt,
      zaloUserId: row.zaloUserId,
    }));
}

async function zaloPhoneController(req, res) {
  ensureZaloConfigured();
  const ticket = req.validatedParams.ticket;
  const attempt = loadZaloAttempt(ticket);
  if (attempt.status !== "await_phone") {
    return respondSuccess(res, {
      message: "Phiếu đã được xử lý.",
      data: zaloAttemptFields(attempt),
    });
  }

  const { accessToken, phoneToken } = req.validatedBody;
  let profile;
  let rawPhone;
  try {
    profile = await fetchZaloProfile({
      accessToken,
      appSecret: config.zalo.appSecret,
      fetchImpl: fetch,
    });
    rawPhone = await exchangeZaloPhone({
      accessToken,
      phoneToken,
      appSecret: config.zalo.appSecret,
      fetchImpl: fetch,
    });
  } catch (error) {
    const exchangeMessage = ZALO_PHONE_EXCHANGE_MESSAGES[error?.zaloCode];
    return respondSuccess(res, {
      message:
        error?.code === "profile"
          ? "Không đọc được tài khoản Zalo."
          : exchangeMessage ||
            (error?.zaloCode
              ? `Zalo không trả về số điện thoại (mã ${error.zaloCode}).`
              : zaloAttemptErrorMessage("no_phone")),
      data: { ...zaloAttemptFields(attempt), status: "failed", errorCode: "no_phone" },
    });
  }

  const owner =
    attempt.mode === "link"
      ? await prisma.user.findFirst({
          where: { zaloUserId: profile.id },
          select: { id: true },
        })
      : null;
  const next = applyPhone({
    ticket,
    attempt,
    miniAppUserId: profile.id,
    rawPhone,
    matches: attempt.mode === "link" ? [] : await findZaloPhoneMatches(rawPhone),
    ownerUserId: owner?.id ?? null,
  });
  patchAttempt(ticket, next);
  const message =
    next.status === "failed"
      ? zaloAttemptErrorMessage(next.errorCode)
      : "Đã xác minh số điện thoại Zalo.";
  return respondSuccess(res, {
    message,
    data: zaloAttemptFields(next),
  });
}

async function writeZaloUserUpdate(userUpdate, fullNameFallback) {
  const phoneNumber = userUpdate.profile?.phoneNumber ?? null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userUpdate.id },
        data: {
          zaloUserId: userUpdate.zaloUserId,
          phoneVerifiedAt: userUpdate.phoneVerifiedAt,
        },
      });
      await tx.profile.upsert({
        where: { userId: userUpdate.id },
        create: {
          userId: userUpdate.id,
          fullName: fullNameFallback || "User",
          phoneNumber,
        },
        update: { phoneNumber },
      });
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw new AppError({
        message: "Mã Zalo đã thuộc tài khoản khác.",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
}

async function respondZaloSession(req, res, userId, { created = false } = {}) {
  const user = await getUserById(userId);
  const session = await issueZaloSession({
    req,
    user,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  setAuthCookies(res, session);
  return respondSuccess(res, {
    statusCode: created ? 201 : 200,
    message: created ? "Đã tạo tài khoản và đăng nhập." : "Đăng nhập bằng Zalo thành công.",
    data: await mapAuthUserResponse(session.user),
  });
}

async function zaloResumeController(req, res) {
  const ticket = req.validatedParams.ticket;
  const attempt = loadZaloAttempt(ticket);
  if (attempt.status !== "ready" || attempt.branch !== "session" || !attempt.targetUserId) {
    throw new AppError({
      message: "Phiếu chưa sẵn sàng để vào tài khoản.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  patchAttempt(ticket, { status: "consumed" });
  return respondZaloSession(req, res, attempt.targetUserId);
}

async function zaloLinkController(req, res) {
  const ticket = req.validatedParams.ticket;
  const attempt = loadZaloAttempt(ticket);
  if (attempt.status !== "ready" || (attempt.branch !== "password" && attempt.branch !== "link")) {
    throw new AppError({
      message: "Phiếu không ở bước xác nhận mật khẩu.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const user = await prisma.user.findFirst({
    where: { id: attempt.targetUserId, deletedAt: null },
    select: {
      id: true,
      password: true,
      username: true,
      profile: { select: { fullName: true } },
    },
  });
  if (!user?.password) throw zaloPasswordError();
  const passwordOk = await bcrypt.compare(req.validatedBody.password, user.password);
  if (!passwordOk) throw zaloPasswordError();

  const fullName = user.profile?.fullName || user.username;
  if (attempt.branch === "password") {
    const done = completeZaloPassword({ ticket, attempt, passwordOk: true });
    if (!done.ok || !done.userUpdate) {
      throw new AppError({
        message: "Phiếu không ở bước xác nhận mật khẩu.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    await writeZaloUserUpdate(done.userUpdate, fullName);
    patchAttempt(ticket, done.attempt);
  } else {
    await writeZaloUserUpdate(
      {
        id: attempt.targetUserId,
        zaloUserId: attempt.zaloUserId,
        phoneVerifiedAt: new Date(),
        profile: { phoneNumber: attempt.phone },
      },
      fullName,
    );
    patchAttempt(ticket, { ...attempt, status: "consumed" });
  }

  if (attempt.mode === "login") {
    return respondZaloSession(req, res, attempt.targetUserId);
  }
  const linked = await getUserById(attempt.targetUserId);
  return respondSuccess(res, {
    message: "Đã gắn Zalo vào tài khoản.",
    data: await mapAuthUserResponse(linked),
  });
}

async function createZaloUser(draft) {
  const type = await prisma.type.findUnique({ where: { name: draft.typeName } });
  if (!type) {
    throw new AppError({
      message: "Registration is temporarily unavailable",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  if (draft.unitId != null) {
    const unit = await prisma.unit.findFirst({
      where: { id: draft.unitId, isActive: true },
      select: { id: true },
    });
    if (!unit) {
      throw new AppError({
        message: "Selected unit is not available",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
  }
  const usernameTaken = await prisma.user.findFirst({
    where: { username: draft.username },
    select: { id: true },
  });
  if (usernameTaken) {
    throw new AppError({
      message: "Username or email already exists",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  try {
    const created = await prisma.user.create({
      data: {
        username: draft.username,
        email: null,
        password: null,
        zaloUserId: draft.zaloUserId,
        phoneVerifiedAt: draft.phoneVerifiedAt,
        typeId: type.id,
        unitId: draft.unitId,
        isActive: draft.isActive,
        registrationStatus: draft.registrationStatus,
        profile: {
          create: {
            fullName: draft.profile?.fullName || draft.username,
            phoneNumber: draft.profile?.phoneNumber ?? null,
          },
        },
      },
      select: { id: true },
    });
    return getUserById(created.id);
  } catch (error) {
    if (error?.code === "P2002") {
      const target = JSON.stringify(error.meta?.target ?? "").toLowerCase();
      throw new AppError({
        message: target.includes("zalo")
          ? "Mã Zalo đã thuộc tài khoản khác."
          : "Username or email already exists",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
}

async function zaloRegisterController(req, res) {
  const ticket = req.validatedParams.ticket;
  const attempt = loadZaloAttempt(ticket);
  const result = await completeZaloRegister({
    ticket,
    attempt,
    username: req.validatedBody.username,
    unitId: req.validatedBody.unitId,
    createUser: createZaloUser,
  });
  if (result.attempt) patchAttempt(ticket, result.attempt);
  if (!result.ok) {
    throw new AppError({
      message: result.errorCode === "unit_required" ? "Cần chọn đơn vị." : "Phiếu không ở bước đăng ký.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (result.issueSession) {
    return respondZaloSession(req, res, result.user.id, { created: true });
  }
  return respondSuccess(res, {
    statusCode: 202,
    message: "Đã gửi đăng ký. Vui lòng chờ duyệt.",
    data: {
      pending: true,
      user: await mapAuthUserResponse(result.user),
    },
  });
}

export {
  changePasswordController,
  currentUserController,
  deleteAvatarController,
  deleteSignatureController,
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
  verifyEmailController,
  zaloAttemptController,
  zaloLinkController,
  zaloLoginAuthorizeUrlController,
  zaloLoginCallbackController,
  zaloPhoneController,
  zaloRegisterController,
  zaloResumeController,
};
