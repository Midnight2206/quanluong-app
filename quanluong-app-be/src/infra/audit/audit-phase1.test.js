import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "mysql://tester:secret@127.0.0.1:3306/quanluong_test";
process.env.JWT_ACCESS_SECRET ??= "test-jwt-secret";
process.env.SESSION_SECRET ??= "test-session-secret";

const { maskIp, displayIp } = await import("./ip-mask.js");
const writer = await import("./audit-writer.js");
const { recordAuthEvent } = await import("./auth-audit.js");
const { resolveRange, scopeWhere, cursorWhere, nextCursor } = await import("../../modules/audit-logs/audit-logs.utils.js");
const { runWithAuditContext, getAuditContext, setAuditActor } = await import("./audit-context.js");

test("maskIp: IPv4 / IPv4-mapped / IPv6", () => {
  assert.equal(maskIp("113.161.22.33"), "113.161.x.x");
  assert.equal(maskIp("::ffff:10.0.0.7"), "10.0.x.x");
  assert.equal(maskIp("2001:db8:abcd:12::1"), "2001:db8:abcd::x");
  assert.equal(maskIp(null), null);
});

test("displayIp: đầy đủ <90 ngày, che khi cũ hơn", () => {
  const now = new Date("2026-10-19T00:00:00Z");
  assert.equal(displayIp("1.2.3.4", new Date("2026-08-01T00:00:00Z"), now), "1.2.3.4");
  assert.equal(displayIp("1.2.3.4", new Date("2026-07-01T00:00:00Z"), now), "1.2.x.x");
});

test("resolveRange: mặc định 7 ngày, chặn >92 ngày, ngày theo giờ VN", () => {
  const now = new Date("2026-10-19T05:00:00Z");
  const r = resolveRange({}, now);
  assert.equal(r.lte.getTime(), now.getTime());
  assert.equal(now - r.gte, 7 * 86400000);
  const d = resolveRange({ from: "2026-10-01", to: "2026-10-01" });
  assert.equal(d.gte.toISOString(), "2026-09-30T17:00:00.000Z");
  assert.throws(() => resolveRange({ from: "2026-01-01", to: "2026-10-01" }), /92/);
  assert.throws(() => resolveRange({ from: "2026-10-05", to: "2026-10-01" }));
});

test("scopeWhere: superadmin thấy cả unitId null; admin chỉ nhánh", () => {
  assert.deepEqual(scopeWhere({ mode: "all", unitIds: null }), {});
  assert.deepEqual(scopeWhere({ mode: "subtree", unitIds: [3, 4] }), { unitId: { in: [3, 4] } });
  assert.deepEqual(scopeWhere({ mode: "exact", unitIds: [] }), { unitId: { in: [-1] } });
  assert.deepEqual(cursorWhere("10"), { id: { lt: 10n } });
  assert.equal(nextCursor([{ id: 5n }, { id: 4n }], 2), "4");
  assert.equal(nextCursor([{ id: 5n }], 2), null);
});

test("recordAuthEvent: không lưu identifier khi thành công; cắt độ dài; ghi trực tiếp khi không có queue", async () => {
  const written = [];
  writer.__setAuditWriterForTest({ persist: async (b) => written.push(b), queue: null });
  recordAuthEvent({ type: "LOGIN_SUCCESS", user: { id: 1, unitId: 9 }, identifier: "alice", ip: "1.1.1.1", userAgent: "x".repeat(900) });
  recordAuthEvent({ type: "LOGIN_FAILED", identifier: "y".repeat(100), failReason: "NOT_FOUND" });
  await writer.flushAudit();
  assert.equal(written.length, 1);
  const [ok, bad] = written[0].auth;
  assert.equal(ok.identifier, null);
  assert.equal(ok.unitId, 9);
  assert.equal(ok.userAgent.length, 512);
  assert.equal(bad.identifier.length, 64);
  assert.equal(bad.userId, null);
  assert.equal(bad.unitId, null);
  assert.equal(Object.keys(bad).some((k) => /password|token/i.test(k)), false);
});

test("writer: lỗi ghi không ném ra ngoài; dùng queue khi có", async () => {
  writer.__setAuditWriterForTest({ persist: async () => { throw new Error("db down"); }, queue: null });
  writer.enqueueAudit("auth", { type: "LOGOUT" });
  await assert.doesNotReject(writer.flushAudit());
  const jobs = [];
  writer.__setAuditWriterForTest({ queue: { add: async (n, d) => jobs.push([n, d]) } });
  writer.enqueueAudit("auth", { type: "LOGOUT" });
  await writer.flushAudit();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0][0], "batch");
  writer.__setAuditWriterForTest({});
});

test("audit context: setAuditActor gán user trong ngữ cảnh", () => {
  runWithAuditContext({ userId: null }, () => {
    setAuditActor({ id: 7, unitId: 2 });
    assert.equal(getAuditContext().userId, 7);
    assert.equal(getAuditContext().unitId, 2);
  });
  assert.equal(getAuditContext(), null);
});

test("scopeWhere khớp hằng UNIT_SCOPE_MODES thật", async () => {
  const { UNIT_SCOPE_MODES } = await import("../../shared/units/unit-scope.service.js");
  assert.deepEqual(scopeWhere({ mode: UNIT_SCOPE_MODES.ALL, unitIds: null }), {});
  assert.deepEqual(scopeWhere({ mode: UNIT_SCOPE_MODES.SUBTREE, unitIds: [1] }), { unitId: { in: [1] } });
});
