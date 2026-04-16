import rateLimit from "express-rate-limit";

/**
 * Giới hạn chặt hơn toàn app cho các POST dưới /api/auth (login, register, refresh…).
 * GET (vd. verify-email) không tính — tránh ăn hết quota khi mở link.
 */
const authPostRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== "POST",
  handler(_req, res) {
    return res.status(429).json({
      success: false,
      message: "Quá nhiều yêu cầu tới máy chủ xác thực. Vui lòng thử lại sau.",
      error: { code: "TOO_MANY_REQUESTS" },
    });
  },
});

export { authPostRateLimit };
