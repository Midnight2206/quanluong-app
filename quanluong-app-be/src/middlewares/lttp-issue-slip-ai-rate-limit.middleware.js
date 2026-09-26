import rateLimit from "express-rate-limit";

/** Hạn gợi ý AI phiếu xuất LTTP — tránh spam chi phí LLM. */
const lttpIssueSlipAiSuggestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = req.user?.id != null ? String(req.user.id) : "anon";
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    return `lttp-issue-ai-suggest:${uid}:${ip}`;
  },
  message: {
    success: false,
    message: "Quá nhiều yêu cầu AI gợi ý phiếu xuất. Thử lại sau 15 phút.",
  },
});

const lttpIssueSlipAiChatRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = req.user?.id != null ? String(req.user.id) : "anon";
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    return `lttp-issue-ai-chat:${uid}:${ip}`;
  },
  message: {
    success: false,
    message: "Quá nhiều yêu cầu AI chat phiếu xuất. Thử lại sau 15 phút.",
  },
});

export { lttpIssueSlipAiChatRateLimit, lttpIssueSlipAiSuggestRateLimit };
