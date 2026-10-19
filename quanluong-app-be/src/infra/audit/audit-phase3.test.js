import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "mysql://tester:secret@127.0.0.1:3306/quanluong_test";
process.env.JWT_ACCESS_SECRET ??= "test-jwt-secret";
process.env.SESSION_SECRET ??= "test-session-secret";

const writer = await import("./audit-writer.js");
const { normalizePath, recordUsageBatch, vnDay, usageActionMiddleware } = await import("./usage-audit.js");

test("normalizePath: bỏ query, gộp id", () => {
  assert.equal(normalizePath("/so-sach-bep-an/123?tab=1#x"), "/so-sach-bep-an/[id]");
  assert.equal(normalizePath("/users/clx1234567890abcdefghijk"), "/users/[id]");
  assert.equal(normalizePath(""), "/");
});

test("vnDay: theo giờ Việt Nam", () => {
  assert.equal(vnDay("2026-10-18T17:30:00Z"), "2026-10-19");
  assert.equal(vnDay("2026-10-18T16:59:00Z"), "2026-10-18");
});

test("recordUsageBatch: heartbeat kẹp ≤120s, thời điểm lệch bị thay, trang xem đếm vào ngày", async () => {
  const written = [];
  writer.__setAuditWriterForTest({ persist: async (b) => written.push(b), queue: null });
  const now = new Date("2026-10-19T03:00:00Z");
  const r = recordUsageBatch({
    user: { id: 5, unitId: 2 },
    sessionId: "s1",
    now,
    events: [
      { kind: "PAGE_VIEW", path: "/dashboard/units?x=1", at: "2026-10-19T02:59:00Z" },
      { kind: "HEARTBEAT", path: "/", sec: 999 },
      { kind: "ACTION", path: "/x", label: "in", at: "2020-01-01T00:00:00Z" },
      { kind: "BOGUS", path: "/" },
    ],
  });
  assert.equal(r.accepted, 4);
  await writer.flushAudit();
  const b = written[0];
  assert.equal(b.usage.length, 2);
  assert.equal(b.usage[0].path, "/dashboard/units");
  assert.equal(b.usage[1].occurredAt, now.toISOString());
  assert.equal(b.heartbeats.find((h) => h.activeSec).activeSec, 120);
  assert.equal(b.heartbeats.find((h) => h.pageViews).day, "2026-10-19");
  assert.deepEqual(recordUsageBatch({ user: null, events: [] }), { accepted: 0 });
  writer.__setAuditWriterForTest({});
});

test("usageActionMiddleware: chỉ ghi request ghi thành công của user", async () => {
  const written = [];
  writer.__setAuditWriterForTest({ persist: async (b) => written.push(b), queue: null });
  const pending = [];
  const mk = (method, status, user) => {
    const handlers = {};
    const req = { method, user, baseUrl: "/api/units", route: { path: "/:id" }, originalUrl: "/api/units/3", session: {} };
    const res = { statusCode: status, on: (ev, fn) => (handlers[ev] = fn) };
    usageActionMiddleware(req, res, () => {});
    pending.push(handlers.finish?.());
  };
  mk("PATCH", 200, { id: 1, unitId: 2 });
  mk("PATCH", 403, { id: 1 });
  mk("GET", 200, { id: 1 });
  mk("POST", 200, null);
  await Promise.all(pending);
  await writer.flushAudit();
  assert.equal(written[0].usage.length, 1);
  assert.equal(written[0].usage[0].path, "/api/units/:id");
  assert.equal(written[0].usage[0].label, "PATCH");
  writer.__setAuditWriterForTest({});
});

test("usageSourceOf: nhận diện app nhà cung cấp qua Origin/Referer", async () => {
  const { usageSourceOf } = await import("./usage-audit.js");
  const so = "https://ncc.example";
  const req = (h) => ({ get: (k) => h[k.toLowerCase()] });
  assert.equal(usageSourceOf(req({}), so), "web");
  assert.equal(usageSourceOf(req({ origin: "https://khac.example" }), so), "web");
  assert.equal(usageSourceOf(req({ origin: so }), so), "supplier");
  assert.equal(usageSourceOf(req({ referer: `${so}/don-hang` }), so), "supplier");
  assert.equal(usageSourceOf(req({ referer: `${so}.evil.com/x` }), so), "web");
});

test("resolveUsageUnitId: NCC không có unitId lấy đơn vị của NCC liên kết", async () => {
  const { resolveUsageUnitId } = await import("./usage-audit.js");
  assert.equal(await resolveUsageUnitId({ id: 1, unitId: 3 }), 3);
  let calls = 0;
  const loader = async () => { calls++; return 7; };
  const u = { id: 99001, unitId: null, type: { name: "lttp_supplier" } };
  assert.equal(await resolveUsageUnitId(u, { loader }), 7);
  assert.equal(await resolveUsageUnitId(u, { loader }), 7);
  assert.equal(calls, 1);
});

test("recordUsageBatch: gắn nguồn và đơn vị", () => {
  writer.__setAuditWriterForTest({ persist: async () => {}, queue: null });
  const now = new Date("2026-10-19T03:00:00Z");
  recordUsageBatch({ user: { id: 8, unitId: null }, unitId: 4, source: "supplier", sessionId: "s9", now,
    events: [{ kind: "PAGE_VIEW", path: "/a", occurredAt: now.toISOString() }] });
  const flat = JSON.stringify(writer.__peekAuditBuffer());
  assert.match(flat, /"source":"supplier"/);
  assert.match(flat, /"unitId":4/);
});
