import rateLimit from "express-rate-limit";

/** Hạn gợi ý AI thực đơn — tránh spam chi phí LLM. */
const menuAiSuggestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = req.user?.id != null ? String(req.user.id) : "anon";
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    return `menu-ai-suggest:${uid}:${ip}`;
  },
  message: {
    success: false,
    message: "Quá nhiều yêu cầu AI gợi ý. Thử lại sau 15 phút.",
  },
});

/** Hạn một lượt trợ lý làm sổ — tách khỏi gợi ý thực đơn. */
const ledgerAiExtractRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = req.user?.id != null ? String(req.user.id) : "anon";
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    return `ledger-ai-assistant:${uid}:${ip}`;
  },
  message: {
    success: false,
    message: "Quá nhiều lượt trợ lý làm sổ. Thử lại sau 15 phút, hoặc nhập tay.",
  },
});

export { ledgerAiExtractRateLimit, menuAiSuggestRateLimit };
