/**
 * Kiểm thử tích hợp với MariaDB thật (chạy trong container backend):
 *   AUDIT_IT_DB=1 node --test src/infra/audit/prisma-audit.integration.test.js
 * Bỏ qua khi không có AUDIT_IT_DB.
 */
import assert from "node:assert/strict";
import test from "node:test";

const enabled = process.env.AUDIT_IT_DB === "1";

test("extension ghi đúng thay đổi và an toàn với transaction", { skip: !enabled && "cần AUDIT_IT_DB=1 và DB thật" }, async () => {
  const { basePrisma } = await import("../database/prisma/prisma.client.js");
  const { withAudit } = await import("./prisma-audit.extension.js");
  const { runWithAuditContext } = await import("./audit-context.js");
  const emitted = [];
  const db = withAudit(basePrisma, { emit: (items) => emitted.push(...items) });
  const code = `audit_it_${Date.now()}`;
  const byCode = (c) => emitted.filter((e) => e.model === "LttpFoodGroup" && JSON.stringify(e.changes).includes(c));
  let id;
  try {
    await runWithAuditContext({ userId: 999, unitId: 7, requestId: "it-1", route: "TEST", ip: "10.1.2.3" }, async () => {
      // CREATE ngoài transaction
      const g = await db.lttpFoodGroup.create({ data: { code, name: "Nhóm thử", sortOrder: 1 } });
      id = g.id;
      // UPDATE với select (phải đọc lại để có diff đầy đủ)
      await db.lttpFoodGroup.update({ where: { id }, data: { name: "Nhóm thử 2" }, select: { id: true } });
      // UPDATE không đổi gì → không ghi
      await db.lttpFoodGroup.update({ where: { id }, data: { name: "Nhóm thử 2" } });
      // Interactive transaction commit
      await db.$transaction(async (tx) => {
        await tx.lttpFoodGroup.update({ where: { id }, data: { sortOrder: 5 } });
      });
      // Interactive transaction rollback → không ghi, dữ liệu không đổi
      await assert.rejects(
        db.$transaction(async (tx) => {
          await tx.lttpFoodGroup.update({ where: { id }, data: { sortOrder: 99 } });
          throw new Error("rollback-it");
        }),
        /rollback-it/,
      );
      // Batch transaction
      await db.$transaction([db.lttpFoodGroup.update({ where: { id }, data: { isActive: false } })]);
      // updateMany
      await db.lttpFoodGroup.updateMany({ where: { code }, data: { sortOrder: 6 } });
      // DELETE
      await db.lttpFoodGroup.delete({ where: { id } });
      id = null;
    });

    const rows = emitted.filter((e) => e.model === "LttpFoodGroup" && (e.recordId === String(byCode(code)[0]?.recordId)));
    const actions = rows.map((r) => r.action);
    assert.deepEqual(actions, ["CREATE", "UPDATE", "UPDATE", "UPDATE", "UPDATE", "DELETE"]);
    assert.deepEqual(rows[1].changes, { name: { from: "Nhóm thử", to: "Nhóm thử 2" } });
    assert.deepEqual(rows[2].changes, { sortOrder: { from: 1, to: 5 } });
    assert.deepEqual(rows[3].changes, { isActive: { from: true, to: false } });
    assert.deepEqual(rows[4].changes, { sortOrder: { from: 5, to: 6 } });
    assert.equal(rows.some((r) => r.changes?.sortOrder?.to === 99), false, "rollback không để lại nhật ký");
    assert.equal(rows[0].userId, 999);
    assert.equal(rows[0].unitId, 7);
    assert.equal(rows[0].ip, "10.1.2.3");
    assert.equal(rows[0].route, "TEST");
  } catch (error) {
    if (id) await basePrisma.lttpFoodGroup.delete({ where: { id } }).catch(() => {});
    await basePrisma.$disconnect();
    throw error;
  }

  // Mật khẩu người dùng không bao giờ lộ trong nhật ký
  const sa = await basePrisma.type.findFirst({ select: { id: true } });
  const uname = `audit_it_u_${Date.now()}`;
  const u = await db.user.create({ data: { username: uname, password: "$2a$10$plaintext-should-not-leak", typeId: sa.id } });
  try {
    await db.user.update({ where: { id: u.id }, data: { password: "$2a$10$another-secret-value" } });
    const userRows = emitted.filter((e) => e.model === "User" && e.recordId === String(u.id));
    assert.equal(userRows.length, 2);
    assert.equal(JSON.stringify(userRows).includes("plaintext-should-not-leak"), false);
    assert.equal(JSON.stringify(userRows).includes("another-secret-value"), false);
    assert.deepEqual(userRows[1].changes, { password: { from: "[ẩn]", to: "[ẩn]" } });
  } finally {
    await basePrisma.user.delete({ where: { id: u.id } });
    await basePrisma.$disconnect();
  }
});
