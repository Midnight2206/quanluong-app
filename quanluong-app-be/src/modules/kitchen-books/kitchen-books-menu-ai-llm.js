import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

function readMenuAiFromEnv() {
  const provider = String(process.env.MENU_AI_PROVIDER || "openai").trim().toLowerCase();
  const normalized = provider === "gemini" ? "gemini" : "openai";
  const modelEnv = (process.env.MENU_AI_MODEL || "").trim();
  return {
    provider: normalized,
    apiKey: (process.env.MENU_AI_API_KEY || "").trim(),
    model: modelEnv || (normalized === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini"),
    baseUrl: (process.env.MENU_AI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/+$/, ""),
    timeoutMs: (() => {
      const n = Number(process.env.MENU_AI_TIMEOUT_MS || 60_000);
      return Number.isFinite(n) && n >= 5_000 ? Math.min(n, 300_000) : 60_000;
    })(),
  };
}

function getMenuAiConfig(override) {
  return override ?? readMenuAiFromEnv();
}

function assertMenuAiConfigured(override) {
  const cfg = getMenuAiConfig(override);
  if (!cfg?.apiKey) {
    throw new AppError({
      message: "AI thực đơn chưa được cấu hình (thiếu MENU_AI_API_KEY).",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
}

function extractJsonObject(text) {
  let raw = String(text ?? "").trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(raw);
  if (fence) {
    raw = fence[1].trim();
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    raw = raw.slice(start, end + 1);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError({
      message: "AI trả về JSON không hợp lệ",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
}

async function callOpenAiCompatible({ system, user }, cfg, fetchImpl) {
  const base = String(cfg.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetchImpl(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(cfg.timeoutMs || 60_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AppError({
      message: `LLM lỗi HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callGemini({ system, user }, cfg, fetchImpl) {
  const model = cfg.model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(cfg.timeoutMs || 60_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AppError({
      message: `Gemini lỗi HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
}

async function completeOnce({ system, user }, cfg, fetchImpl) {
  const provider = String(cfg.provider || "openai").toLowerCase();
  if (provider === "gemini") {
    return callGemini({ system, user }, cfg, fetchImpl);
  }
  return callOpenAiCompatible({ system, user }, cfg, fetchImpl);
}

/**
 * @param {{ system: string, user: string }} prompt
 * @param {{ fetchImpl?: typeof fetch, configOverride?: object }} [opts]
 */
async function completeMenuJson({ system, user }, opts = {}) {
  const cfg = getMenuAiConfig(opts.configOverride);
  assertMenuAiConfigured(cfg);
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  let content = await completeOnce({ system, user }, cfg, fetchImpl);
  try {
    return extractJsonObject(content);
  } catch {
    content = await completeOnce(
      {
        system: `${system}\nChi tra ve mot JSON object hop le, khong markdown.`,
        user: `JSON truoc do khong parse duoc. Hay tra lai dung schema periods.sang|trua|chieu.\n\n${user}`,
      },
      cfg,
      fetchImpl,
    );
    return extractJsonObject(content);
  }
}

export { assertMenuAiConfigured, extractJsonObject, completeMenuJson, readMenuAiFromEnv };
