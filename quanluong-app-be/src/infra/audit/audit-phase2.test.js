import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "mysql://tester:secret@127.0.0.1:3306/quanluong_test";
process.env.JWT_ACCESS_SECRET ??= "test-jwt-secret";
process.env.SESSION_SECRET ??= "test-session-secret";

const { diffRecords, snapshot, isSensitiveField, REDACTED } = await import("./audit-redact.js");
const { parsePrimaryKeys, getModelMeta, DEFAULT_EXCLUDED_MODELS } = await import("./audit-model-meta.js");
const { pkWhere, recordIdOf, wrapTransaction } = await import("./prisma-audit.extension.js");
const { getAuditContext, runWithAuditContext } = await import("./audit-context.js");

test("trường nhạy cảm được nhận diện, trường thường thì không", () => {
  for (const f of ["password", "passwordResetTokenHash", "googleRefreshToken", "tokenHash", "emailVerificationTokenHash", "appSecret", "apiKey"]) {
    assert.equal(isSensitiveField(f), true, f);
  }
  for (const f of ["username", "footprint", "name", "unitId", "createdAt", "zaloUserId", "description"]) {
    assert.equal(isSensitiveField(f), false, f);
  }
});

test("snapshot: ẩn mật khẩu, bỏ updatedAt, rút gọn văn bản dài, Bytes, BigInt, Date", () => {
  const scalar = new Set(["id", "password", "note", "blob", "big", "at", "updatedAt"]);
  const s = snapshot(
    { id: 1, password: "$2a$hash", note: "x".repeat(5000), blob: Buffer.from("abc"), big: 10n, at: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date(), profile: { a: 1 } },
    scalar,
  );
  assert.equal(s.password, REDACTED);
  assert.equal("updatedAt" in s, false);
  assert.equal("profile" in s, false);
  assert.match(s.note, /^\[văn bản 5000 ký tự, sha256:[0-9a-f]{12}\]$/);
  assert.equal(s.blob, "[bytes 3]");
  assert.equal(s.big, "10");
  assert.equal(s.at, "2026-01-01T00:00:00.000Z");
  assert.equal(JSON.stringify(s).includes("$2a$hash"), false);
});

test("diffRecords: chỉ trường đổi; nhạy cảm chỉ báo đã đổi; bỏ qua updatedAt", () => {
  const before = { id: 1, name: "A", password: "old", isActive: true, updatedAt: new Date(1) };
  const after = { id: 1, name: "B", password: "new", isActive: true, updatedAt: new Date(2) };
  const d = diffRecords(before, after, new Set(Object.keys(after)));
  assert.deepEqual(d, { name: { from: "A", to: "B" }, password: { from: REDACTED, to: REDACTED } });
  assert.deepEqual(diffRecords(before, { ...before }, null), {});
  assert.deepEqual(diffRecords({ d: new Date("2026-01-01") }, { d: new Date("2026-01-01") }, null), {});
});

test("parsePrimaryKeys: @id và @@id kép", () => {
  const pk = parsePrimaryKeys(`model A {\n  id Int @id @default(autoincrement())\n}\nmodel B {\n  x Int\n  y Int\n  @@id([x, y])\n}\nmodel C {\n  code String @id\n}\n`);
  assert.deepEqual(pk, { A: ["id"], B: ["x", "y"], C: ["code"] });
});

test("model meta từ schema thật: mọi model có khóa chính; loại trừ đúng danh sách", () => {
  const meta = getModelMeta();
  assert.ok(meta.size > 50);
  for (const m of meta.values()) assert.ok(m.pk.length, `${m.name} thiếu PK`);
  assert.deepEqual(meta.get("TypePermission").pk, ["typeId", "permissionId"]);
  const planned = new Set(["UsageEvent", "UsageSessionDaily"]);
  for (const name of DEFAULT_EXCLUDED_MODELS) if (!planned.has(name)) assert.ok(meta.has(name), `loại trừ model không tồn tại: ${name}`);
  assert.ok(DEFAULT_EXCLUDED_MODELS.includes("DataChangeLog"));
});

test("pkWhere / recordIdOf cho khóa đơn và khóa kép", () => {
  const single = { pk: ["id"] };
  const comp = { pk: ["typeId", "permissionId"] };
  assert.deepEqual(pkWhere(single, { id: 5 }), { id: 5 });
  assert.deepEqual(pkWhere(comp, { typeId: 1, permissionId: 2 }), { typeId_permissionId: { typeId: 1, permissionId: 2 } });
  assert.equal(recordIdOf(single, { id: 5 }), "5");
  assert.equal(recordIdOf(comp, { typeId: 1, permissionId: 2 }), '{"typeId":1,"permissionId":2}');
});

function fakeClient() {
  return {
    async $transaction(arg) {
      if (typeof arg === "function") return arg({ fakeTx: true });
      return Promise.all(arg.map((f) => f()));
    },
  };
}

test("wrapTransaction: commit → ghi; rollback → bỏ; tx có trong ngữ cảnh", async () => {
  const emitted = [];
  const $tx = wrapTransaction(fakeClient(), (items) => emitted.push(...items));
  await runWithAuditContext({ userId: 3 }, async () => {
    const r = await $tx(async (tx) => {
      const ctx = getAuditContext();
      assert.equal(ctx.tx, tx);
      assert.equal(ctx.userId, 3);
      ctx.txBuffer.push({ model: "X", action: "CREATE" });
      return 42;
    });
    assert.equal(r, 42);
    assert.equal(getAuditContext().txBuffer, undefined, "không rò ngữ cảnh tx ra ngoài");
  });
  assert.equal(emitted.length, 1);

  await assert.rejects(
    $tx(async () => {
      getAuditContext().txBuffer.push({ model: "X", action: "DELETE" });
      throw new Error("rollback");
    }),
    /rollback/,
  );
  assert.equal(emitted.length, 1, "rollback không được ghi");

  await $tx([async () => getAuditContext().txBuffer.push({ model: "Y", action: "UPDATE" })]);
  assert.equal(emitted.length, 2, "batch transaction commit được ghi");
});
