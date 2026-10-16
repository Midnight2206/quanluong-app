import crypto from "node:crypto";
import { getAttempt, putAttempt } from "./zalo-attempt.store.js";
import { decideZaloOauth, decideZaloPhone } from "./zalo-login.decision.js";
import { normalizeVnPhone } from "./zalo-phone.js";

function createPkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

function buildZaloAuthorizeUrl({ state, codeChallenge, appId, redirectUri }) {
  const url = new URL("https://oauth.zaloapp.com/v4/permission");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("state", state);
  return url.toString();
}

function appsecretProof(accessToken, appSecret) {
  return crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

async function fetchZaloProfile({ accessToken, appSecret, fetchImpl }) {
  const url = new URL("https://graph.zalo.me/v2.0/me");
  url.searchParams.set("fields", "id,name");
  const res = await fetchImpl(url, {
    headers: {
      access_token: accessToken,
      appsecret_proof: appsecretProof(accessToken, appSecret),
    },
  });
  const data = await res.json();
  if (!res.ok || data.error || !data.id) {
    throw Object.assign(new Error("zalo_profile"), { code: "profile" });
  }
  return { id: String(data.id), name: typeof data.name === "string" ? data.name : "" };
}

async function exchangeZaloCode({ code, codeVerifier, appId, appSecret, fetchImpl }) {
  const body = new URLSearchParams({
    app_id: appId,
    code,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });
  const res = await fetchImpl("https://oauth.zaloapp.com/v4/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: appSecret,
    },
    body,
  });
  const data = await res.json();
  if (!res.ok || !data?.access_token) {
    throw Object.assign(new Error("zalo_token"), { code: "token" });
  }
  return String(data.access_token);
}

async function exchangeZaloPhone({ accessToken, phoneToken, appSecret, fetchImpl }) {
  const res = await fetchImpl("https://graph.zalo.me/v2.0/me/info", {
    headers: {
      access_token: accessToken,
      code: phoneToken,
      secret_key: appSecret,
      appsecret_proof: appsecretProof(accessToken, appSecret),
    },
  });
  const data = await res.json();
  const zaloCode = Number(data?.error);
  const number = data?.data?.number;
  if (!res.ok || (Number.isFinite(zaloCode) && zaloCode !== 0) || !number) {
    const err = Object.assign(new Error("zalo_phone"), { code: "no_phone" });
    if (Number.isFinite(zaloCode) && zaloCode !== 0) err.zaloCode = zaloCode;
    throw err;
  }
  return String(number);
}

function assertZaloConfigured(zalo) {
  if (!zalo.appId || !zalo.appSecret || !zalo.loginRedirectUri || !zalo.miniAppDeeplink) {
    const err = new Error("zalo_config");
    err.statusCode = 503;
    throw err;
  }
}

function loadAttempt({ ticket, attempt }) {
  if (attempt) return attempt;
  if (!ticket) return null;
  return getAttempt(ticket);
}

function applyOauthProfile({ attemptDraft, existingUser }) {
  const decision = decideZaloOauth(existingUser);
  if (decision.kind === "session" || decision.kind === "pending") {
    return { kind: decision.kind, userId: decision.userId };
  }
  if (decision.kind === "error") {
    const attempt = putAttempt({
      ...attemptDraft,
      status: "failed",
      errorCode: decision.code,
    });
    return { kind: "error", code: decision.code, attempt };
  }
  const attempt = putAttempt({
    ...attemptDraft,
    status: "await_phone",
  });
  return { kind: "await_phone", attempt };
}

function applyPhone({ ticket, attempt, miniAppUserId, rawPhone, matches, ownerUserId }) {
  const current = loadAttempt({ ticket, attempt });
  if (!current || current.expiresAt <= Date.now()) {
    return { ...(current ?? {}), status: "failed", errorCode: "expired" };
  }
  if (miniAppUserId !== current.zaloUserId) {
    return { ...current, status: "failed", errorCode: "id_mismatch" };
  }
  const phone = normalizeVnPhone(rawPhone);
  if (!phone) {
    return { ...current, status: "failed", errorCode: "phone_format" };
  }
  if (current.mode === "link") {
    if (ownerUserId != null && ownerUserId !== current.linkUserId) {
      return { ...current, phone, status: "failed", errorCode: "taken" };
    }
    return { ...current, phone, status: "ready", branch: "link", targetUserId: current.linkUserId };
  }
  const decision = decideZaloPhone({ matches, zaloUserId: current.zaloUserId });
  if (decision.kind === "error") {
    return { ...current, phone, status: "failed", errorCode: decision.code };
  }
  if (decision.kind === "register") {
    return { ...current, phone, status: "ready", branch: "register" };
  }
  return {
    ...current,
    phone,
    status: "ready",
    branch: decision.kind,
    targetUserId: decision.userId,
  };
}

function completeZaloPassword({ ticket, attempt, passwordOk, now = new Date() }) {
  const current = loadAttempt({ ticket, attempt });
  if (!current || current.branch !== "password" || current.status !== "ready") {
    return { ok: false, attempt: current };
  }
  if (passwordOk !== true) {
    return { ok: false, attempt: current };
  }
  return {
    ok: true,
    attempt: { ...current, status: "consumed" },
    userUpdate: {
      id: current.targetUserId,
      zaloUserId: current.zaloUserId,
      phoneVerifiedAt: now,
      profile: { phoneNumber: current.phone },
    },
  };
}

async function approvalRequired(registrationRequiresApproval) {
  if (typeof registrationRequiresApproval === "boolean") return registrationRequiresApproval;
  const { config } = await import("../../config/config.js");
  return config.auth.registrationRequiresApproval;
}

async function completeZaloRegister({
  ticket,
  attempt,
  username,
  unitId,
  createUser,
  registrationRequiresApproval,
  now = new Date(),
}) {
  const current = loadAttempt({ ticket, attempt });
  if (!current || current.branch !== "register" || current.status !== "ready") {
    return { ok: false, attempt: current };
  }
  const profile = {
    fullName: current.displayName ?? "",
    phoneNumber: current.phone,
  };
  const common = {
    username,
    email: null,
    password: null,
    zaloUserId: current.zaloUserId,
    phoneVerifiedAt: now,
    profile,
  };
  let draft;
  let issueSession = false;
  if (current.portal === "supplier") {
    draft = {
      ...common,
      typeName: "lttp_supplier",
      unitId: null,
      registrationStatus: "PENDING_APPROVAL",
      isActive: false,
    };
  } else {
    if (unitId == null || unitId === "") {
      return { ok: false, errorCode: "unit_required", attempt: current };
    }
    const pending = await approvalRequired(registrationRequiresApproval);
    draft = {
      ...common,
      typeName: "user",
      unitId,
      registrationStatus: pending ? "PENDING_APPROVAL" : "APPROVED",
      isActive: !pending,
    };
    issueSession = !pending;
  }
  const user = await createUser(draft);
  return {
    ok: true,
    issueSession,
    attempt: { ...current, status: "consumed" },
    user,
  };
}

export {
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
};
