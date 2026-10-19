import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "mysql://tester:secret@127.0.0.1:3306/quanluong_test";
process.env.JWT_ACCESS_SECRET ??= "test-jwt-secret";
process.env.SESSION_SECRET ??= "test-session-secret";

const { cleanupAuditLogs, RETENTION_DAYS } = await import("./audit-retention.js");
const { SHEETS, EXPORT_CAP } = await import("../../modules/audit-logs/audit-logs.export.js");
const { AUDIT_LOGS_ROUTE_DEFINITIONS } = await import("../../modules/audit-logs/audit-logs.route-definitions.js");

test("thời hạn lưu theo quyết định: 1 năm / 2 năm / 90 ngày", () => {
  assert.deepEqual(RETENTION_DAYS, { authEventLog: 365, dataChangeLog: 730, usageEvent: 90, usageSessionDaily: 730 });
});

test("cleanupAuditLogs: xóa theo lô với mốc đúng cho từng bảng", async () => {
  const calls = [];
  const fake = (name, total) => {
    let left = total;
    return {
      async findMany({ where, take }) {
        calls.push([name, Object.values(where)[0].lt.toISOString()]);
        const n = Math.min(left, take);
        return Array.from({ length: n }, (_, i) => ({ id: BigInt(i), userId: 1, day: new Date() }));
      },
      async deleteMany() {
        const n = Math.min(left, 5000);
        left -= n;
        return { count: n };
      },
    };
  };
  const client = { authEventLog: fake("auth", 12000), dataChangeLog: fake("chg", 0), usageEvent: fake("use", 3), usageSessionDaily: fake("daily", 1) };
  const now = new Date("2026-10-19T00:00:00Z");
  const r = await cleanupAuditLogs({ now, client });
  assert.deepEqual(r, { auth: 12000, changes: 0, usage: 3, usageDaily: 1 });
  assert.equal(calls.filter((c) => c[0] === "auth").length, 3);
  assert.equal(calls.find((c) => c[0] === "use")[1], "2026-07-21T00:00:00.000Z");
  assert.equal(calls.find((c) => c[0] === "auth")[1], "2025-10-19T00:00:00.000Z");
});

test("export: đủ 3 tab, giới hạn 10.000 dòng, cột không lộ sessionId", () => {
  assert.deepEqual(Object.keys(SHEETS), ["auth", "changes", "usage"]);
  assert.equal(EXPORT_CAP, 10000);
  const row = { occurredAt: "2026-10-19T01:00:00Z", user: { username: "a" }, type: "LOGIN_FAILED", failReason: "BAD_PASSWORD", method: "password", ip: "1.2.x.x", userAgent: "UA", identifier: "a", sessionId: "SECRET-SID" };
  const cells = SHEETS.auth.columns.map(([, , get]) => get(row));
  assert.equal(cells[0], "2026-10-19 08:00:00");
  assert.equal(cells.includes("SECRET-SID"), false);
  assert.equal(cells[3], "Thất bại");
});

test("route xuất Excel dùng quyền auditLogs.export", () => {
  const r = AUDIT_LOGS_ROUTE_DEFINITIONS.find((d) => d.key === "exportLogs");
  assert.equal(r.permission.code, "auditLogs.export");
  assert.equal(r.pathRoute, "/api/audit-logs/:tab/export");
});
