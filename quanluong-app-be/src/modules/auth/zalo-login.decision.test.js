import assert from "node:assert/strict";
import test from "node:test";
import { decideZaloOauth, decideZaloPhone } from "./zalo-login.decision.js";

const base = {
  id: 1,
  typeName: "user",
  registrationStatus: "APPROVED",
  isActive: true,
  deletedAt: null,
  zaloUserId: null,
};

test("oauth cấp phiên khi mã Zalo đã gắn tài khoản hoạt động", () => {
  assert.deepEqual(decideZaloOauth({ ...base, zaloUserId: "z1" }), {
    kind: "session",
    userId: 1,
  });
});

test("oauth về chờ duyệt khi hồ sơ pending đã có mã Zalo", () => {
  assert.deepEqual(
    decideZaloOauth({ ...base, registrationStatus: "PENDING_APPROVAL", zaloUserId: "z1" }),
    { kind: "pending", userId: 1 },
  );
});

test("oauth từ chối superadmin và khi chưa gắn thì chờ số", () => {
  assert.equal(decideZaloOauth({ ...base, typeName: "superadmin", zaloUserId: "z1" }).kind, "error");
  assert.deepEqual(decideZaloOauth(null), { kind: "await_phone" });
});

test("sau số: một tài khoản đã duyệt chưa gắn thì nhập mật khẩu", () => {
  assert.deepEqual(decideZaloPhone({ portal: "main", matches: [base] }), {
    kind: "password",
    userId: 1,
  });
});

test("sau số: không trùng thì đăng ký theo cổng", () => {
  assert.equal(decideZaloPhone({ portal: "supplier", matches: [] }).kind, "register");
});

test("sau số: hai tài khoản thì lỗi, một pending thì chờ duyệt", () => {
  assert.equal(decideZaloPhone({ portal: "main", matches: [base, { ...base, id: 2 }] }).code, "ambiguous");
  assert.equal(
    decideZaloPhone({
      portal: "main",
      matches: [{ ...base, registrationStatus: "PENDING_APPROVAL" }],
    }).kind,
    "pending",
  );
});

test("sau số: chỉ superadmin thì lỗi superadmin", () => {
  assert.deepEqual(decideZaloPhone({ portal: "main", matches: [{ ...base, typeName: "superadmin" }] }), {
    kind: "error",
    code: "superadmin",
  });
});

test("sau số: superadmin cùng tài khoản khác thì lỗi ambiguous", () => {
  assert.equal(
    decideZaloPhone({ portal: "main", matches: [base, { ...base, id: 2, typeName: "superadmin" }] }).code,
    "ambiguous",
  );
});
