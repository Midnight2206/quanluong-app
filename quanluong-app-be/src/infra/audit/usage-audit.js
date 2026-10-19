import { enqueueAudit } from "./audit-writer.js";

const HEARTBEAT_MAX_SEC = 120;
const MAX_EVENTS = 50;

/** Ngày theo giờ Việt Nam (YYYY-MM-DD). */
function vnDay(d) {
  return new Date(new Date(d).getTime() + 7 * 3600000).toISOString().slice(0, 10);
}

/** Bỏ query/hash, thay số và id dài bằng [id] để gộp trang. */
function normalizePath(p) {
  const path = String(p || "/").split(/[?#]/)[0].slice(0, 255);
  return path
    .split("/")
    .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f-]{16,}$/i.test(seg) || /^c[a-z0-9]{20,}$/.test(seg) ? "[id]" : seg))
    .join("/") || "/";
}

/**
 * Nhận lô sự kiện từ frontend. events: [{ kind:'PAGE_VIEW'|'HEARTBEAT'|'ACTION', path, label?, at?, sec? }]
 * Thời điểm do máy chủ kẹp trong ±10 phút để chống giả mạo.
 */
function recordUsageBatch({ user, sessionId, events, now = new Date() }) {
  if (!user?.id || !Array.isArray(events)) return { accepted: 0 };
  const usage = [];
  const heartbeats = [];
  for (const e of events.slice(0, MAX_EVENTS)) {
    let at = e?.at ? new Date(e.at) : now;
    if (Number.isNaN(at.getTime()) || Math.abs(now - at) > 10 * 60000) at = now;
    const path = normalizePath(e?.path);
    if (e?.kind === "HEARTBEAT") {
      const sec = Math.max(0, Math.min(HEARTBEAT_MAX_SEC, Math.round(Number(e.sec) || 0)));
      if (sec) heartbeats.push({ userId: user.id, unitId: user.unitId ?? null, day: vnDay(at), activeSec: sec, pageViews: 0, at: at.toISOString() });
      continue;
    }
    if (e?.kind !== "PAGE_VIEW" && e?.kind !== "ACTION") continue;
    usage.push({
      occurredAt: at.toISOString(),
      userId: user.id,
      unitId: user.unitId ?? null,
      sessionId: sessionId ? String(sessionId).slice(0, 64) : null,
      kind: e.kind,
      path,
      label: e.label ? String(e.label).slice(0, 128) : null,
    });
    if (e.kind === "PAGE_VIEW") {
      heartbeats.push({ userId: user.id, unitId: user.unitId ?? null, day: vnDay(at), activeSec: 0, pageViews: 1, at: at.toISOString() });
    }
  }
  if (usage.length) enqueueAudit("usage", usage);
  if (heartbeats.length) enqueueAudit("heartbeats", heartbeats);
  return { accepted: usage.length + heartbeats.length };
}

/** Middleware: mỗi request ghi (POST/PUT/PATCH/DELETE) thành công của user đăng nhập → ACTION. */
function usageActionMiddleware(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  res.on("finish", () => {
    try {
      if (!req.user?.id || res.statusCode >= 400) return;
      const routePath = req.route?.path ? `${req.baseUrl || ""}${req.route.path}` : normalizePath(req.originalUrl);
      if (routePath.includes("/audit-logs/usage")) return;
      enqueueAudit("usage", {
        occurredAt: new Date().toISOString(),
        userId: req.user.id,
        unitId: req.user.unitId ?? null,
        sessionId: req.session?.auth?.sessionId ? String(req.session.auth.sessionId).slice(0, 64) : null,
        kind: "ACTION",
        path: String(routePath).slice(0, 255),
        label: req.method,
      });
    } catch {
      /* không ảnh hưởng request */
    }
  });
  return next();
}

export { normalizePath, recordUsageBatch, usageActionMiddleware, vnDay };
