import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "mysql://tester:secret@127.0.0.1:3306/quanluong_test";
process.env.JWT_ACCESS_SECRET ??= "test-jwt-secret";
process.env.SESSION_SECRET ??= "test-session-secret";

const utils = await import("./ba-profiles.utils.js");
const { createBaTokenAuthMiddleware, requireBaScope } = await import("./ba-token-auth.middleware.js");
const svc = await import("./ba-profiles.service.js");

function runMw(mw, req) {
  return new Promise((resolve) => mw(req, {}, (arg) => resolve(arg)));
}

// ---------- token auth ----------
test("generateBaToken: prefix qlba_, hash sha256 khớp", () => {
  const { raw, tokenHash, prefix } = utils.generateBaToken();
  assert.match(raw, /^qlba_[A-Za-z0-9_-]{40,}$/);
  assert.equal(tokenHash, utils.hashBaToken(raw));
  assert.equal(tokenHash.length, 64);
  assert.ok(raw.startsWith(prefix));
});

test("token auth: hợp lệ gắn req.baToken và cập nhật lastUsedAt", async () => {
  const { raw, tokenHash } = utils.generateBaToken();
  const touched = [];
  const mw = createBaTokenAuthMiddleware({
    findActiveTokenByHash: async (h) => (h === tokenHash ? { id: 7, scope: "UNIT_PUSH", unitId: 3, revokedAt: null } : null),
    touchToken: async (id) => touched.push(id),
  });
  const req = { headers: { authorization: `Bearer ${raw}` } };
  assert.equal(await runMw(mw, req), undefined);
  assert.equal(req.baToken.id, 7);
  assert.deepEqual(touched, [7]);
});

test("token auth: thiếu header / sai token / token đã thu hồi → 401", async () => {
  const { raw } = utils.generateBaToken();
  const mw = createBaTokenAuthMiddleware({
    findActiveTokenByHash: async () => null,
    touchToken: async () => {},
  });
  assert.equal((await runMw(mw, { headers: {} })).statusCode, 401);
  assert.equal((await runMw(mw, { headers: { authorization: "Bearer eyJhbGciOi.jwt.token" } })).statusCode, 401);
  assert.equal((await runMw(mw, { headers: { authorization: `Bearer ${raw}` } })).statusCode, 401);
  const revokedMw = createBaTokenAuthMiddleware({
    findActiveTokenByHash: async () => ({ id: 1, scope: "UNIT_PUSH", unitId: 1, revokedAt: new Date() }),
    touchToken: async () => {},
  });
  assert.equal((await runMw(revokedMw, { headers: { authorization: `Bearer ${raw}` } })).statusCode, 401);
});

test("requireBaScope: GLOBAL_READ không được đẩy", async () => {
  const err = await runMw(requireBaScope("UNIT_PUSH"), { baToken: { scope: "GLOBAL_READ" } });
  assert.equal(err.statusCode, 403);
  assert.equal(await runMw(requireBaScope("UNIT_PUSH"), { baToken: { scope: "UNIT_PUSH" } }), undefined);
});

// ---------- secret rejection ----------
test("detectSecrets bắt mật khẩu, Bearer, khóa riêng, qlba_", () => {
  assert.deepEqual(utils.detectSecrets("Mật khẩu: abc123"), ["password"]);
  assert.deepEqual(utils.detectSecrets("password=hunter2"), ["password"]);
  assert.deepEqual(utils.detectSecrets("Authorization: Bearer abcdefghijklmnop1234"), ["bearer"]);
  assert.deepEqual(utils.detectSecrets("-----BEGIN RSA PRIVATE KEY-----"), ["private_key"]);
  assert.ok(utils.detectSecrets("token qlba_abcdefghij").includes("qlba_token"));
  assert.deepEqual(utils.detectSecrets("Đổi mật khẩu định kỳ là việc của admin. Sổ nhập xuất 13 bước."), []);
});

function fakeDb(existing = []) {
  const rows = [...existing];
  return {
    rows,
    baUnitProfile: {
      aggregate: async ({ where }) => ({
        _max: { version: rows.filter((r) => r.unitId === where.unitId).reduce((m, r) => Math.max(m, r.version), 0) || null },
      }),
      create: async ({ data }) => {
        const row = { id: rows.length + 1, ...data };
        rows.push(row);
        return { id: row.id, unitId: row.unitId, version: row.version };
      },
      findMany: async () => rows.map((r) => ({ ...r, unit: { name: `Đơn vị ${r.unitId}` } })),
    },
  };
}

const body = { title: "Hồ sơ", contentMarkdown: "# CHUNG-01 giống", schemaVersion: "ba-kit-v1" };

test("push: 422 khi nội dung chứa bí mật", async () => {
  const db = fakeDb();
  await assert.rejects(
    svc.pushUnitProfile({ token: { id: 1, scope: "UNIT_PUSH", unitId: 2 }, body: { ...body, contentMarkdown: "mật khẩu = 123456" } }, db),
    (e) => e.statusCode === 422,
  );
  assert.equal(db.rows.length, 0);
});

// ---------- unit scoping ----------
test("push: unitId lấy từ token, bỏ qua unitId trong body; version tăng theo đơn vị", async () => {
  const db = fakeDb([{ id: 1, unitId: 5, version: 1 }]);
  const token = { id: 9, scope: "UNIT_PUSH", unitId: 2 };
  const a = await svc.pushUnitProfile({ token, body: { ...body, unitId: 5 } }, db);
  const b = await svc.pushUnitProfile({ token, body }, db);
  assert.deepEqual([a.unitId, a.version, b.version], [2, 1, 2]);
  assert.ok(db.rows.filter((r) => r.unitId === 5).length === 1);
});

test("push: token GLOBAL_READ bị chặn", async () => {
  await assert.rejects(svc.pushUnitProfile({ token: { id: 1, scope: "GLOBAL_READ", unitId: null }, body }, fakeDb()), (e) => e.statusCode === 403);
});

test("đọc: UNIT_PUSH chỉ đọc đơn vị mình, GLOBAL_READ đọc mọi đơn vị", () => {
  assert.doesNotThrow(() => svc.assertTokenCanReadUnit({ scope: "UNIT_PUSH", unitId: 2 }, 2));
  assert.throws(() => svc.assertTokenCanReadUnit({ scope: "UNIT_PUSH", unitId: 2 }, 3), (e) => e.statusCode === 403);
  assert.doesNotThrow(() => svc.assertTokenCanReadUnit({ scope: "GLOBAL_READ", unitId: null }, 3));
});

test("quản lý token: admin chỉ đơn vị mình, GLOBAL_READ chỉ superadmin", () => {
  const admin = { id: 1, unitId: 2, type: { name: "admin" } };
  const user = { id: 2, unitId: 2, type: { name: "user" } };
  const sa = { id: 3, unitId: null, type: { name: "superadmin" } };
  assert.doesNotThrow(() => svc.assertUserCanManage(admin, { scope: "UNIT_PUSH", unitId: 2 }));
  assert.throws(() => svc.assertUserCanManage(admin, { scope: "UNIT_PUSH", unitId: 3 }));
  assert.throws(() => svc.assertUserCanManage(admin, { scope: "GLOBAL_READ", unitId: null }));
  assert.throws(() => svc.assertUserCanManage(user, { scope: "UNIT_PUSH", unitId: 2 }));
  assert.doesNotThrow(() => svc.assertUserCanManage(sa, { scope: "GLOBAL_READ", unitId: null }));
});

// ---------- latest per unit ----------
test("listLatestProfiles: mỗi đơn vị bản version cao nhất, kèm tên đơn vị", async () => {
  const db = fakeDb([
    { id: 1, unitId: 2, version: 1 },
    { id: 2, unitId: 2, version: 3 },
    { id: 3, unitId: 4, version: 1 },
    { id: 4, unitId: 2, version: 2 },
  ]);
  const out = await svc.listLatestProfiles(db);
  assert.deepEqual(out.map((r) => [r.unitId, r.version, r.unitName]), [[2, 3, "Đơn vị 2"], [4, 1, "Đơn vị 4"]]);
});

test("router mount: các route BA tồn tại", async () => {
  const { baProfilesRouter } = await import("./ba-profiles.routes.js");
  const paths = baProfilesRouter.stack.filter((l) => l.route).map((l) => `${Object.keys(l.route.methods)[0]} ${l.route.path}`);
  for (const p of ["post /unit-profiles", "get /unit-profiles", "get /unit-profiles/:id", "post /tokens", "get /tokens", "delete /tokens/:id"]) {
    assert.ok(paths.includes(p), p);
  }
});
