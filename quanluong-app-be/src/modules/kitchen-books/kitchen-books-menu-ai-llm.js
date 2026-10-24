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

function userContent(user, image) {
  if (!image) return user;
  return [
    { type: "text", text: user },
    { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.base64}` } },
  ];
}

async function callOpenAiCompatible({ system, user, image, temperature }, cfg, fetchImpl) {
  const base = String(cfg.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetchImpl(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: temperature ?? 0.4,
      // OpenRouter giữ credit theo trần này. Bỏ qua thì model Gemini xin 65536 và 402 khi số dư chỉ đủ ~16000.
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent(user, image) },
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

async function callGemini({ system, user, image, temperature }, cfg, fetchImpl) {
  const model = cfg.model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const parts = [{ text: user }];
  if (image) {
    parts.push({ inlineData: { mimeType: image.mime, data: image.base64 } });
  }
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: temperature ?? 0.4 },
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

async function completeOnce({ system, user, image, temperature }, cfg, fetchImpl) {
  const provider = String(cfg.provider || "openai").toLowerCase();
  if (provider === "gemini") {
    return callGemini({ system, user, image, temperature }, cfg, fetchImpl);
  }
  return callOpenAiCompatible({ system, user, image, temperature }, cfg, fetchImpl);
}

function aiFailure(err) {
  if (err instanceof AppError) return err;
  const name = err?.name || "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new AppError({
      message: "AI không phản hồi. Nhập bằng tay.",
      statusCode: 504,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  return new AppError({
    message: "AI không đọc được. Nhập bằng tay.",
    statusCode: 502,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
  });
}

/**
 * Trích JSON theo schema người gọi mô tả. Không ghi sổ, không tính lại số.
 * @param {{ system: string, user: string, image?: { mime: string, base64: string }, temperature?: number }} prompt
 * @param {{ fetchImpl?: typeof fetch, configOverride?: object, disabledMessage?: string, retryUserHint?: string }} [opts]
 */
async function extractStructured(prompt, opts = {}) {
  const cfg = getMenuAiConfig(opts.configOverride);
  if (!cfg?.apiKey) {
    throw new AppError({
      message: opts.disabledMessage || "AI chưa được cấu hình (thiếu MENU_AI_API_KEY).",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const temperature = prompt.temperature ?? 0;
  let content;
  try {
    content = await completeOnce({ ...prompt, temperature }, cfg, fetchImpl);
  } catch (err) {
    throw aiFailure(err);
  }
  try {
    return { data: extractJsonObject(content), model: cfg.model, provider: cfg.provider };
  } catch (err) {
    if (!(err instanceof AppError)) throw aiFailure(err);
    try {
      content = await completeOnce(
        {
          system: `${prompt.system}\nChi tra ve mot JSON object hop le, khong markdown, khong ten nguoi.`,
          user: `JSON truoc do khong dung. ${opts.retryUserHint || "Tra lai dung schema."}\n\n${prompt.user}`,
          image: prompt.image,
          temperature,
        },
        cfg,
        fetchImpl,
      );
    } catch (retryErr) {
      throw aiFailure(retryErr);
    }
    return { data: extractJsonObject(content), model: cfg.model, provider: cfg.provider };
  }
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
    const retryHint =
      opts.retryUserHint ??
      "Hay tra lai dung schema periods.sang|trua|chieu.";
    content = await completeOnce(
      {
        system: `${system}\nChi tra ve mot JSON object hop le, khong markdown.`,
        user: `JSON truoc do khong parse duoc. ${retryHint}\n\n${user}`,
      },
      cfg,
      fetchImpl,
    );
    return extractJsonObject(content);
  }
}

export {
  assertMenuAiConfigured,
  extractJsonObject,
  completeMenuJson,
  extractStructured,
  readMenuAiFromEnv,
};
