import crypto from "node:crypto";

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
    },
  });
  const data = await res.json();
  const number = data?.data?.number;
  if (!res.ok || data.error || !number) {
    throw Object.assign(new Error("zalo_phone"), { code: "no_phone" });
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

export {
  assertZaloConfigured,
  buildZaloAuthorizeUrl,
  createPkcePair,
  exchangeZaloCode,
  exchangeZaloPhone,
  fetchZaloProfile,
};
