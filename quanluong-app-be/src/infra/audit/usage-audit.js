import { enqueueAudit } from "./audit-writer.js";
import { config } from "../../config/config.js";

const SUPPLIER_TYPE = "lttp_supplier";
const UNIT_CACHE_MS = 5 * 60 * 1000;
const unitCache = new Map();

/** Ứng dụng nguồn theo Origin/Referer của request (không tin dữ liệu client gửi). */
function usageSourceOf(req, supplierOrigin = config.zalo?.supplierOrigin) {
  const origin = req?.get?.("origin") || "";
  const referer = req?.get?.("referer") || "";
  if (supplierOrigin && (origin === supplierOrigin || referer.startsWith(`${supplierOrigin}/`))) return "supplier";
  return "web";
}

/**
 * Đơn vị gán cho sự kiện sử dụng. User thường: unitId. Tài khoản nhà cung cấp (không có unitId):
 * đơn vị của nhà cung cấp liên kết đầu tiên (theo id) — để admin đơn vị đó thấy trong tab Sử dụng.
 */
async function resolveUsageUnitId(user, { loader, now = Date.now() } = {}) {
  if (!user?.id) return null;
  if (user.unitId != null) return user.unitId;
  if (user.type?.name !== SUPPLIER_TYPE) return null;
  const hit = unitCache.get(user.id);
  if (hit && now - hit.at < UNIT_CACHE_MS) return hit.unitId;
  let unitId = null;
  try {
    const load = loader ?? (async (userId) => {
      const { basePrisma } = await import("../database/prisma/prisma.client.js");
      const link = await basePrisma.userLttpSupplier.findFirst({
        where: { userId },
        orderBy: { lttpSupplierId: "asc" },
        select: { lttpSupplier: { select: { unitId: true } } },
      });
      return link?.lttpSupplier?.unitId ?? null;
    });
    unitId = await load(user.id);
  } catch {
    unitId = null;
  }
  unitCache.set(user.id, { unitId, at: now });
  return unitId;
}

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
function recordUsageBatch({ user, sessionId, events, now = new Date(), source = "web", unitId }) {
  const uid = unitId !== undefined ? unitId : (user?.unitId ?? null);
  if (!user?.id || !Array.isArray(events)) return { accepted: 0 };
  const usage = [];
  const heartbeats = [];
  for (const e of events.slice(0, MAX_EVENTS)) {
    let at = e?.at ? new Date(e.at) : now;
    if (Number.isNaN(at.getTime()) || Math.abs(now - at) > 10 * 60000) at = now;
    const path = normalizePath(e?.path);
    if (e?.kind === "HEARTBEAT") {
      const sec = Math.max(0, Math.min(HEARTBEAT_MAX_SEC, Math.round(Number(e.sec) || 0)));
      if (sec) heartbeats.push({ userId: user.id, unitId: uid, source, day: vnDay(at), activeSec: sec, pageViews: 0, at: at.toISOString() });
      continue;
    }
    if (e?.kind !== "PAGE_VIEW" && e?.kind !== "ACTION") continue;
    usage.push({
      occurredAt: at.toISOString(),
      userId: user.id,
      unitId: uid,
      sessionId: sessionId ? String(sessionId).slice(0, 64) : null,
      kind: e.kind,
      source,
      path,
      label: e.label ? String(e.label).slice(0, 128) : null,
    });
    if (e.kind === "PAGE_VIEW") {
      heartbeats.push({ userId: user.id, unitId: uid, source, day: vnDay(at), activeSec: 0, pageViews: 1, at: at.toISOString() });
    }
  }
  if (usage.length) enqueueAudit("usage", usage);
  if (heartbeats.length) enqueueAudit("heartbeats", heartbeats);
  return { accepted: usage.length + heartbeats.length };
}

/** Middleware: mỗi request ghi (POST/PUT/PATCH/DELETE) thành công của user đăng nhập → ACTION. */
function usageActionMiddleware(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  res.on("finish", async () => {
    try {
      if (!req.user?.id || res.statusCode >= 400) return;
      const routePath = req.route?.path ? `${req.baseUrl || ""}${req.route.path}` : normalizePath(req.originalUrl);
      if (routePath.includes("/audit-logs/usage")) return;
      const unitId = await resolveUsageUnitId(req.user);
      enqueueAudit("usage", {
        occurredAt: new Date().toISOString(),
        userId: req.user.id,
        unitId,
        source: usageSourceOf(req),
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

export { normalizePath, recordUsageBatch, resolveUsageUnitId, usageActionMiddleware, usageSourceOf, vnDay };
