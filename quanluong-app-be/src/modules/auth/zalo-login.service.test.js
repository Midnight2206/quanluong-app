import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPhone,
  buildZaloAuthorizeUrl,
  completeZaloRegister,
  exchangeZaloCode,
  exchangeZaloPhone,
  fetchZaloProfile,
} from "./zalo-login.service.js";

test("buildZaloAuthorizeUrl trỏ trang cấp quyền PKCE", () => {
  const url = new URL(buildZaloAuthorizeUrl({
    state: "s1",
    codeChallenge: "abc",
    appId: "1",
    redirectUri: "http://localhost:3000/api/auth/zalo/login/callback",
  }));
  assert.equal(url.origin + url.pathname, "https://oauth.zaloapp.com/v4/permission");
  assert.equal(url.searchParams.get("state"), "s1");
  assert.equal(url.searchParams.get("code_challenge"), "abc");
});

test("fetchZaloProfile đọc id và name", async () => {
  const profile = await fetchZaloProfile({
    accessToken: "tok",
    appSecret: "sec",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ error: 0, id: "z1", name: "An" }),
    }),
  });
  assert.deepEqual(profile, { id: "z1", name: "An" });
});

test("exchangeZaloPhone đọc data.number và không nhận số từ client", async () => {
  const number = await exchangeZaloPhone({
    accessToken: "tok",
    phoneToken: "code1",
    appSecret: "sec",
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers.access_token, "tok");
      assert.equal(init.headers.code, "code1");
      assert.equal(init.headers.secret_key, "sec");
      return { ok: true, json: async () => ({ error: 0, data: { number: "84987654321" } }) };
    },
  });
  assert.equal(number, "84987654321");
});

test("exchangeZaloCode đọc access_token từ JSON giả", async () => {
  const token = await exchangeZaloCode({
    code: "authcode",
    codeVerifier: "verifier",
    appId: "1",
    appSecret: "sec",
    fetchImpl: async (url, init) => {
      assert.equal(String(url), "https://oauth.zaloapp.com/v4/access_token");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.secret_key, "sec");
      const body = new URLSearchParams(init.body);
      assert.equal(body.get("app_id"), "1");
      assert.equal(body.get("code"), "authcode");
      assert.equal(body.get("grant_type"), "authorization_code");
      assert.equal(body.get("code_verifier"), "verifier");
      return { ok: true, json: async () => ({ access_token: "tok-from-json" }) };
    },
  });
  assert.equal(token, "tok-from-json");
});

test("applyPhone một user đã duyệt thì phiếu sẵn sàng nhập mật khẩu", () => {
  const attempt = {
    ticket: "t1",
    zaloUserId: "z-new",
    portal: "main",
    mode: "login",
    status: "await_phone",
    expiresAt: Date.now() + 60_000,
  };
  const next = applyPhone({
    attempt,
    miniAppUserId: "z-new",
    rawPhone: "0987654321",
    matches: [{ id: 7, typeName: "user", registrationStatus: "APPROVED", isActive: true, deletedAt: null, zaloUserId: null }],
  });
  assert.equal(next.branch, "password");
  assert.equal(next.targetUserId, 7);
  assert.equal(next.phone, "84987654321");
});

test("applyPhone mode link từ chối khi mã Zalo đã thuộc người khác", () => {
  const next = applyPhone({
    attempt: {
      zaloUserId: "z-new",
      status: "await_phone",
      expiresAt: Date.now() + 1000,
      portal: "main",
      mode: "link",
      linkUserId: 3,
    },
    miniAppUserId: "z-new",
    rawPhone: "0987654321",
    matches: [],
    ownerUserId: 9,
  });
  assert.equal(next.errorCode, "taken");
});

test("applyPhone lệch id Mini App thì failed", () => {
  const next = applyPhone({
    attempt: { zaloUserId: "z1", status: "await_phone", expiresAt: Date.now() + 1000, portal: "main", mode: "login" },
    miniAppUserId: "other",
    rawPhone: "0987654321",
    matches: [],
  });
  assert.equal(next.status, "failed");
  assert.equal(next.errorCode, "id_mismatch");
});

function readyRegisterAttempt(portal) {
  return {
    branch: "register",
    status: "ready",
    portal,
    zaloUserId: "z1",
    displayName: "An",
    phone: "84987654321",
  };
}

test("completeZaloRegister cổng chính chờ duyệt không cấp phiên", async () => {
  let draft;
  const result = await completeZaloRegister({
    attempt: readyRegisterAttempt("main"),
    username: "an",
    unitId: 4,
    registrationRequiresApproval: true,
    createUser: async (next) => {
      draft = next;
      return { id: 1 };
    },
  });
  assert.equal(result.issueSession, false);
  assert.equal(draft.typeName, "user");
  assert.equal(draft.unitId, 4);
});

test("completeZaloRegister nhà cung cấp chờ duyệt không cấp phiên", async () => {
  let draft;
  const result = await completeZaloRegister({
    attempt: readyRegisterAttempt("supplier"),
    username: "ncc",
    unitId: 9,
    createUser: async (next) => {
      draft = next;
      return { id: 2 };
    },
  });
  assert.equal(draft.typeName, "lttp_supplier");
  assert.equal(draft.unitId, null);
  assert.equal(draft.registrationStatus, "PENDING_APPROVAL");
  assert.equal(result.issueSession, false);
});

test("completeZaloRegister cổng chính thiếu đơn vị thì unit_required", async () => {
  let called = false;
  const result = await completeZaloRegister({
    attempt: readyRegisterAttempt("main"),
    username: "an",
    unitId: null,
    createUser: async () => {
      called = true;
      return { id: 1 };
    },
  });
  assert.equal(result.errorCode, "unit_required");
  assert.equal(called, false);
});
