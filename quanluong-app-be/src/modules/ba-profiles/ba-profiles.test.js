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
  for (const p of [
    "post /unit-profiles",
    "get /unit-profiles",
    "get /unit-profiles/:id",
    "post /tokens",
    "get /tokens",
    "delete /tokens/:id",
    "get /baseline",
    "get /baseline/:docKey",
    "get /baseline/:docKey/versions",
    "post /baseline/:docKey",
    "get /comparison",
    "post /proposals",
    "get /proposals",
    "patch /proposals/:id",
  ]) {
    assert.ok(paths.includes(p), p);
  }
});

// ---------- bộ nghiệp vụ chung / rules / so sánh / đề xuất ----------
const validator = await import("./ba-profiles.validator.js");

function memDb({ baseline = [], profiles = [], proposals = [] } = {}) {
  const db = fakeDb(profiles);
  const docs = [...baseline];
  const props = [...proposals];
  db.docs = docs;
  db.props = props;
  db.baBaselineDoc = {
    findFirst: async ({ where }) =>
      docs.filter((d) => d.docKey === where.docKey).sort((a, b) => b.version - a.version)[0] ?? null,
    findUnique: async ({ where }) =>
      docs.find((d) => d.docKey === where.docKey_version.docKey && d.version === where.docKey_version.version) ?? null,
    findMany: async ({ where }) => docs.filter((d) => d.docKey === where.docKey).sort((a, b) => b.version - a.version),
    aggregate: async ({ where }) => ({
      _max: { version: docs.filter((d) => d.docKey === where.docKey).reduce((m, d) => Math.max(m, d.version), 0) || null },
    }),
    create: async ({ data }) => {
      const row = { id: docs.length + 1, ...data };
      docs.push(row);
      return row;
    },
  };
  db.baProposal = {
    create: async ({ data }) => {
      const row = { id: props.length + 1, status: "OPEN", ...data, unit: { name: `Đơn vị ${data.unitId}` } };
      props.push(row);
      return row;
    },
    findMany: async ({ where }) =>
      props.filter((p) => (!where.unitId || p.unitId === where.unitId) && (!where.status || p.status === where.status)),
    findUnique: async ({ where }) => props.find((p) => p.id === where.id) ?? null,
    update: async ({ where, data }) => Object.assign(props.find((p) => p.id === where.id), data),
  };
  return db;
}

const unitToken = { id: 9, scope: "UNIT_PUSH", unitId: 2, prefix: "qlba_abc" };
const baselineDoc = { docKey: "nghiep-vu-chung", version: 1, ruleIds: ["CHUNG-01", "CHUNG-20"] };

test("extractChungRuleIds: thứ tự xuất hiện, không trùng", () => {
  assert.deepEqual(utils.extractChungRuleIds("| CHUNG-01 | x | CHUNG-20 … CHUNG-01 CHUNG-1 RIENG-01"), ["CHUNG-01", "CHUNG-20"]);
});

test("publish baseline: version tăng theo docKey, ruleIds chỉ cho nghiep-vu-chung", async () => {
  const db = memDb();
  const a = await svc.publishBaselineDoc({ docKey: "nghiep-vu-chung", title: "v1", contentMarkdown: "CHUNG-01 CHUNG-02", actor: "user:1" }, db);
  const b = await svc.publishBaselineDoc({ docKey: "nghiep-vu-chung", title: "v2", contentMarkdown: "CHUNG-01", actor: "user:1" }, db);
  const c = await svc.publishBaselineDoc({ docKey: "huong-dan", title: "hd", contentMarkdown: "CHUNG-01" }, db);
  assert.deepEqual([a.version, b.version, c.version], [1, 2, 1]);
  assert.deepEqual(db.docs[0].ruleIds, ["CHUNG-01", "CHUNG-02"]);
  assert.equal(db.docs[2].ruleIds, null);
  assert.equal((await svc.getBaselineDoc("nghiep-vu-chung", undefined, db)).version, 2);
  assert.equal((await svc.getBaselineDoc("nghiep-vu-chung", 1, db)).title, "v1");
  await assert.rejects(svc.getBaselineDoc("bo-cau-hoi", undefined, db), (e) => e.statusCode === 404);
  assert.deepEqual((await svc.listLatestBaseline(db)).map((d) => [d.docKey, d.version]), [["huong-dan", 1], ["nghiep-vu-chung", 2]]);
});

test("validator: docKey ngoài danh sách, rule sai dạng / trùng / sai status bị từ chối", () => {
  assert.equal(validator.docKeyParamsSchema.safeParse({ docKey: "khac" }).success, false);
  const ok = validator.pushProfileBodySchema.safeParse({
    ...body,
    rules: [{ ruleId: "CHUNG-20", status: "GIONG", evidence: "QS" }, { ruleId: "RIENG-03", status: "KHAC", note: "x" }],
  });
  assert.equal(ok.success, true);
  for (const rules of [
    [{ ruleId: "CHUNG-1", status: "GIONG" }],
    [{ ruleId: "CHUNG-20", status: "YES" }],
    [{ ruleId: "CHUNG-20", status: "GIONG", evidence: "X" }],
    [{ ruleId: "CHUNG-20", status: "GIONG" }, { ruleId: "CHUNG-20", status: "NA" }],
  ]) {
    assert.equal(validator.pushProfileBodySchema.safeParse({ ...body, rules }).success, false, JSON.stringify(rules));
  }
});

test("push rules: CHUNG-xx phải có trong baseline mới nhất; RIENG tự do; lưu baselineVersion", async () => {
  const db = memDb({ baseline: [baselineDoc] });
  await assert.rejects(
    svc.pushUnitProfile({ token: unitToken, body: { ...body, rules: [{ ruleId: "CHUNG-99", status: "GIONG" }] } }, db),
    (e) => e.statusCode === 422 && e.details.unknownRuleIds[0] === "CHUNG-99",
  );
  const out = await svc.pushUnitProfile(
    { token: unitToken, body: { ...body, rules: [{ ruleId: "CHUNG-20", status: "KHAC", note: "LIFO" }, { ruleId: "RIENG-01", status: "GIONG" }] } },
    db,
  );
  assert.equal(out.version, 1);
  assert.equal(db.rows[0].baselineVersion, 1);
  assert.equal(db.rows[0].rules[0].note, "LIFO");
  await assert.rejects(
    svc.pushUnitProfile({ token: unitToken, body: { ...body, rules: [{ ruleId: "CHUNG-01", status: "GIONG" }] } }, memDb()),
    (e) => e.statusCode === 422,
  );
});

test("buildComparison: ma trận, đếm, %giống, RIENG theo đơn vị", () => {
  const out = utils.buildComparison(["CHUNG-01", "CHUNG-20"], [
    { id: 1, unitId: 2, unitName: "A", version: 3, rules: [{ ruleId: "CHUNG-01", status: "GIONG" }, { ruleId: "CHUNG-20", status: "KHAC", note: "LIFO" }, { ruleId: "RIENG-01", status: "GIONG" }] },
    { id: 2, unitId: 4, unitName: "B", version: 1, rules: [{ ruleId: "CHUNG-01", status: "GIONG" }] },
  ]);
  assert.deepEqual(out.units.map((u) => u.unitId), [2, 4]);
  assert.deepEqual(out.rules[0].counts, { GIONG: 2, KHAC: 0, NA: 0, CHUA_RO: 0, MISSING: 0 });
  assert.equal(out.rules[0].giongPercent, 100);
  assert.equal(out.rules[1].cells[2].note, "LIFO");
  assert.equal(out.rules[1].counts.MISSING, 1);
  assert.equal(out.rules[1].giongPercent, 0);
  assert.deepEqual(out.riengByUnit[2].map((r) => r.ruleId), ["RIENG-01"]);
});

test("đề xuất: UNIT_PUSH gửi + chỉ thấy của mình; GLOBAL thấy tất cả; duyệt ghi người duyệt", async () => {
  const db = memDb();
  const p1 = await svc.createProposal({ token: unitToken, body: { title: "Thêm FIFO", relatedRuleIds: ["CHUNG-25"], proposedText: "x" } }, db);
  await svc.createProposal({ token: { id: 10, scope: "UNIT_PUSH", unitId: 5 }, body: { title: "Khác", proposedText: "y" } }, db);
  assert.equal(p1.unitId, 2);
  assert.equal((await svc.listProposals({ token: unitToken }, db)).length, 1);
  assert.equal((await svc.listProposals({ token: { scope: "GLOBAL_READ" } }, db)).length, 2);
  await assert.rejects(svc.createProposal({ token: { scope: "GLOBAL_WRITE" }, body: { title: "t", proposedText: "x" } }, db), (e) => e.statusCode === 403);
  await assert.rejects(
    svc.createProposal({ token: unitToken, body: { title: "t", proposedText: "password=hunter2" } }, db),
    (e) => e.statusCode === 422,
  );
  const r = await svc.reviewProposal({ id: p1.id, status: "ACCEPTED", reviewComment: "OK", actor: "user:1" }, db);
  assert.equal(r.status, "ACCEPTED");
  assert.equal(r.reviewedBy, "user:1");
  assert.ok(r.reviewedAt instanceof Date);
  assert.equal((await svc.listProposals({ token: unitToken, status: "ACCEPTED" }, db)).length, 1);
  await assert.rejects(svc.reviewProposal({ id: 99, status: "REJECTED" }, db), (e) => e.statusCode === 404);
});

test("actor auth: Bearer qlba_ dùng token; không có → cookie superadmin thành GLOBAL_WRITE", async () => {
  const { createBaActorAuthMiddleware, baActorLabel } = await import("./ba-token-auth.middleware.js");
  const calls = [];
  const mw = createBaActorAuthMiddleware({
    tokenAuth: (req, _res, next) => {
      calls.push("token");
      req.baToken = { scope: "UNIT_PUSH", prefix: "qlba_x" };
      next();
    },
    userAuth: (req, _res, next) => {
      calls.push("user");
      req.user = { id: 3, type: { name: req.headers.role } };
      next();
    },
    superadminOnly: (req, _res, next) => next(req.user.type.name === "superadmin" ? undefined : { statusCode: 403 }),
  });
  const { raw } = utils.generateBaToken();
  const r1 = { headers: { authorization: `Bearer ${raw}` } };
  await runMw(mw, r1);
  const r2 = { headers: { role: "superadmin" } };
  assert.equal(await runMw(mw, r2), undefined);
  assert.equal(r2.baToken.scope, "GLOBAL_WRITE");
  assert.equal((await runMw(mw, { headers: { role: "admin" } })).statusCode, 403);
  assert.deepEqual(calls, ["token", "user", "user"]);
  assert.equal(baActorLabel(r2.baToken), "user:3");
  assert.equal(baActorLabel(r1.baToken), "token:qlba_x");
});

test("quản lý token: GLOBAL_WRITE chỉ superadmin", () => {
  assert.throws(() => svc.assertUserCanManage({ id: 1, unitId: 2, type: { name: "admin" } }, { scope: "GLOBAL_WRITE", unitId: null }));
  assert.doesNotThrow(() => svc.assertUserCanManage({ id: 3, type: { name: "superadmin" } }, { scope: "GLOBAL_WRITE", unitId: null }));
});

test("đọc hồ sơ: GLOBAL_WRITE đọc mọi đơn vị", () => {
  assert.doesNotThrow(() => svc.assertTokenCanReadUnit({ scope: "GLOBAL_WRITE", unitId: null }, 7));
});
