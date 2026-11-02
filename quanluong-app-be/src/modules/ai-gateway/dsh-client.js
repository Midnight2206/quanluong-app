import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

export class DshUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = "DshUnavailable";
    this.code = "DSH_UNAVAILABLE";
  }
}

function serviceConfig(env = process.env, override = {}) {
  return {
    url: String(override.url || env.DSH_SERVICE_URL || "").trim().replace(/\/+$/, ""),
    token: String(override.token || env.DSH_SERVICE_TOKEN || "").trim(),
    timeoutMs: (() => {
      const n = Number(env.DSH_TIMEOUT_MS || env.MENU_AI_TIMEOUT_MS || 60_000);
      return Number.isFinite(n) && n >= 1000 ? n : 60_000;
    })(),
  };
}

const sessions = new Map();

async function parseJson(response) {
  return response.json().catch(() => ({}));
}

function unavailable(message) {
  return new DshUnavailable(message);
}

async function call(fetchImpl, url, token, timeoutMs, body) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw unavailable(error?.message || "DSH service is unreachable");
  }
  const payload = await parseJson(response);
  if (response.status === 503 || response.status === 502 || response.status === 504) {
    throw unavailable(payload.error || `DSH HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new AppError({
      message: payload.error || `DSH HTTP ${response.status}`,
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  return payload;
}

export async function completeViaDsh(input, opts = {}) {
  const cfg = serviceConfig(process.env, opts);
  if (!cfg.url || !cfg.token) throw unavailable("DSH service is not configured");
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const accountId = String(input.accountId ?? "system");
  const unitId = String(input.unitId ?? input.feature ?? "0");
  const surface = input.surface || "web";
  const key = `${cfg.url}|${accountId}|${unitId}|${surface}`;
  let sessionId = sessions.get(key);
  if (!sessionId) {
    const created = await call(fetchImpl, `${cfg.url}/v1/sessions`, cfg.token, cfg.timeoutMs, {
      accountId,
      unitId,
      surface,
    });
    sessionId = created.id;
    if (!sessionId) throw unavailable("DSH did not return a session id");
    sessions.set(key, sessionId);
  }
  const message = {
    accountId,
    unitId,
    surface,
    text: input.user || "",
    system: input.system || "",
    temperature: input.temperature ?? 0,
    model: input.model || "",
    feature: input.feature || "",
    grantId: input.grantId || "",
    image: input.image ? { mime: input.image.mime, base64: input.image.base64 } : undefined,
  };
  try {
    return await postMessage(fetchImpl, cfg, opts, sessionId, message);
  } catch (error) {
    if (!(error instanceof AppError) || !/not found/i.test(error.message)) throw error;
    sessions.delete(key);
    const created = await call(fetchImpl, `${cfg.url}/v1/sessions`, cfg.token, cfg.timeoutMs, {
      accountId,
      unitId,
      surface,
    });
    sessionId = created.id;
    if (!sessionId) throw unavailable("DSH did not return a session id");
    sessions.set(key, sessionId);
    return postMessage(fetchImpl, cfg, opts, sessionId, message);
  }
}

async function postMessage(fetchImpl, cfg, opts, sessionId, message) {
  const result = await call(
    fetchImpl,
    `${cfg.url}/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
    cfg.token,
    opts.timeoutMs || cfg.timeoutMs,
    message,
  );
  return String(result.content || "");
}

export function resetDshSessions() {
  sessions.clear();
}
