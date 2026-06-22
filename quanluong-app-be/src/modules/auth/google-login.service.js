import { google } from "googleapis";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_LOGIN_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function getLoginOAuthClient() {
  const { clientId, clientSecret, loginRedirectUri } = config.google;
  if (!clientId || !clientSecret || !loginRedirectUri) {
    return null;
  }
  return new google.auth.OAuth2(clientId, clientSecret, loginRedirectUri);
}

function assertGoogleLoginConfigured() {
  if (!getLoginOAuthClient()) {
    throw new AppError({
      message:
        "Google đăng nhập chưa được cấu hình (GOOGLE_CLIENT_ID / SECRET / GOOGLE_LOGIN_REDIRECT_URI).",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
}

function buildGoogleLoginAuthUrl(state) {
  assertGoogleLoginConfigured();
  const client = getLoginOAuthClient();
  return client.generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    scope: GOOGLE_LOGIN_SCOPES,
    state,
  });
}

async function fetchGoogleUserInfo(accessToken) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AppError({
      message: "Không lấy được thông tin tài khoản Google.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      details: typeof data === "object" ? data : undefined,
    });
  }
  return data;
}

function mapGoogleTokenExchangeError(data, status) {
  const errCode = String(data?.error ?? "");
  if (errCode === "invalid_client") {
    return new AppError({
      message: "GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET không hợp lệ.",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      details: data,
    });
  }
  if (errCode === "redirect_uri_mismatch") {
    return new AppError({
      message:
        "redirect_uri không khớp Google Console. Kiểm tra GOOGLE_LOGIN_REDIRECT_URI (phải trùng URI đã đăng ký).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      details: data,
    });
  }
  if (errCode === "invalid_grant") {
    return new AppError({
      message: "Mã đăng nhập Google đã hết hạn hoặc đã dùng. Hãy thử đăng nhập lại.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      details: data,
    });
  }
  return new AppError({
    message: `Google từ chối đổi mã đăng nhập (${errCode || status}).`,
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    details: data,
  });
}

async function exchangeGoogleLoginCode(code) {
  const { clientId, clientSecret, loginRedirectUri } = config.google;
  if (!clientId || !clientSecret || !loginRedirectUri) {
    throw new AppError({
      message: "Google đăng nhập chưa được cấu hình.",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: String(code),
    grant_type: "authorization_code",
    redirect_uri: loginRedirectUri,
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData?.access_token) {
    throw mapGoogleTokenExchangeError(tokenData, tokenRes.status);
  }

  const profile = await fetchGoogleUserInfo(tokenData.access_token);
  const email = typeof profile.email === "string" ? profile.email.trim() : "";
  if (!email) {
    throw new AppError({
      message: "Google không cung cấp địa chỉ email.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (profile.email_verified === false) {
    throw new AppError({
      message: "Email Google chưa được xác minh.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  return {
    email,
    name: typeof profile.name === "string" ? profile.name : null,
    picture: typeof profile.picture === "string" ? profile.picture : null,
    sub: typeof profile.sub === "string" ? profile.sub : null,
  };
}

function sanitizeLoginFromPath(raw) {
  if (typeof raw !== "string") {
    return "/";
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }
  return trimmed;
}

export {
  buildGoogleLoginAuthUrl,
  exchangeGoogleLoginCode,
  getLoginOAuthClient,
  sanitizeLoginFromPath,
};
