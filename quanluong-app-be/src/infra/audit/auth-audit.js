import { enqueueAudit } from "./audit-writer.js";

const clip = (v, n) => (v == null ? null : String(v).slice(0, n));

/**
 * Ghi sự kiện đăng nhập/đăng xuất. Không nhận mật khẩu/token.
 * identifier chỉ lưu với LOGIN_FAILED (cắt 64 ký tự).
 */
function recordAuthEvent({ type, method = "password", user = null, identifier = null, failReason = null, sessionId = null, ip = null, userAgent = null }) {
  enqueueAudit("auth", {
    occurredAt: new Date().toISOString(),
    type,
    method: clip(method, 16),
    userId: user?.id ?? null,
    unitId: user?.unitId ?? null,
    identifier: type === "LOGIN_FAILED" ? clip(identifier?.trim(), 64) : null,
    failReason: clip(failReason, 32),
    sessionId: clip(sessionId, 64),
    ip: clip(ip, 45),
    userAgent: clip(userAgent, 512),
  });
}

export { recordAuthEvent };
