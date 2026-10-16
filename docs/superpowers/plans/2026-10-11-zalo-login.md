# Đăng nhập Zalo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đăng nhập và đăng ký app chính cùng cổng nhà cung cấp bằng Zalo OAuth (mã QR của Zalo), lấy số điện thoại đã xác minh qua Mini App, và gắn Zalo vào tài khoản cũ.

**Architecture:** API làm OAuth v4 PKCE giống Google. Phiếu 10 phút nằm trong bộ nhớ process `app`. Mã Zalo đã gắn thì cấp phiên ngay. Các trường hợp còn lại mở Mini App một màn; server đổi token số rồi mới rẽ nhánh mật khẩu, chờ duyệt, hoặc đăng ký.

**Tech Stack:** Express, Prisma/MariaDB, Node test runner, Next.js (apps/web, apps/supplier), Zalo OAuth v4, zmp-sdk cho Mini App.

**Spec:** `docs/superpowers/specs/2026-10-11-zalo-login-design.md`

## Global Constraints

- OAuth v4 PKCE. QR là trang `https://oauth.zaloapp.com/v4/permission`. App không tự vẽ mã.
- Số điện thoại chỉ từ Mini App `getPhoneNumber`, đổi bằng `GET https://graph.zalo.me/v2.0/me/info` (header `access_token`, `code`, `secret_key`). Client không gửi sẵn số.
- Hồ sơ OAuth: `GET https://graph.zalo.me/v2.0/me?fields=id,name` kèm `appsecret_proof`. Token dùng một lần, không lưu.
- Nút trên app chính và cổng nhà cung cấp. Ẩn trên superadmin. Superadmin không đăng nhập và không gắn qua Zalo.
- Mã Zalo đã gắn, tài khoản đã duyệt và đang hoạt động: cấp phiên, không mở Mini App.
- Cùng mã Zalo trên hồ sơ `PENDING_APPROVAL`: về trang chờ duyệt, không mở Mini App.
- Không có số, từ chối quyền, hoặc `id` Mini App lệch phiếu: không tạo tài khoản.
- Số chuẩn hóa `84` + nội hạt. `0987654321`, `+84987654321`, `84987654321` là một số.
- Trùng đúng một tài khoản đã duyệt, chưa gắn Zalo, không phải superadmin: nhập mật khẩu tại chỗ.
- Trùng một hồ sơ chờ duyệt: không tạo thêm.
- Trùng từ hai tài khoản: không gắn tự động.
- App chính tạo loại `user`, hỏi tên đăng nhập và đơn vị, theo `registrationRequiresApproval`. Cờ tắt thì cấp phiên ngay.
- Cổng nhà cung cấp tạo loại `lttp_supplier`, chỉ hỏi tên đăng nhập, luôn `PENDING_APPROVAL`, `unitId` null, chưa có `UserLttpSupplier`.
- Tài khoản tạo từ Zalo: `password` null, `email` null, `phoneVerifiedAt` lúc tạo.
- Duyệt nhà cung cấp chỉ superadmin thấy (scope all). Chấp nhận bắt `lttpSupplierId` và tạo liên kết.
- Liên kết từ hồ sơ gắn vào đúng user đang đăng nhập, vẫn qua Mini App.
- Form tạo người dùng gửi `profile.phoneNumber`, không set `phoneVerifiedAt`.
- Phiếu khoảng 10 phút. Nhập sai mật khẩu thì nhập lại. Hết hạn thì quét lại.
- Env: `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_LOGIN_REDIRECT_URI`, `ZALO_MINI_APP_DEEPLINK`. Thiếu biến thì 503.
- Test giả lập HTTP Zalo, không gọi mạng.

## File map

- Create `quanluong-app-be/src/modules/auth/zalo-phone.js` — chuẩn hóa số.
- Create `quanluong-app-be/src/modules/auth/zalo-login.decision.js` — rẽ nhánh thuần.
- Create `quanluong-app-be/src/modules/auth/zalo-login.service.js` — OAuth, đổi số, hoàn tất đăng ký/liên kết.
- Create `quanluong-app-be/src/modules/auth/zalo-attempt.store.js` — phiếu trong RAM.
- Modify `quanluong-app-be/prisma/schema.prisma`, migration mới — cột Zalo và nullable email/password.
- Modify `quanluong-app-be/src/config/env.js`, `config.js`, `.env.docker.example`.
- Modify `quanluong-app-be/src/modules/auth/auth.routes.js`, `auth.controller.js`, `auth.service.js`.
- Modify `quanluong-app-be/src/modules/registrations/registrations.service.js`, validator, controller.
- Modify `packages/shared/src/pages/login/LoginPage.jsx`, tạo `ZaloContinuePage.jsx`.
- Modify `apps/web` và `apps/supplier` để có route `/login/zalo`. Supplier có thêm `/login`.
- Modify `packages/shared/src/hocs/SupplierOnlyRoute.jsx` — khách về `/login` của cổng nhà cung cấp.
- Modify `SuperadminUsersPanel.jsx` — ô số điện thoại.
- Modify `UsersPage.jsx` — chọn đối tác khi duyệt `lttp_supplier`.
- Modify `ProfilePage.jsx` — nút liên kết.
- Create `apps/zalo-miniapp/` — một màn xin số.

---

### Task 1: Chuẩn hóa số điện thoại

**Files:**
- Create: `quanluong-app-be/src/modules/auth/zalo-phone.js`
- Test: `quanluong-app-be/src/modules/auth/zalo-phone.test.js`

**Interfaces:**
- Consumes: không
- Produces: `normalizeVnPhone(raw: string): string | null`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVnPhone } from "./zalo-phone.js";

test("normalizeVnPhone gộp 0, +84 và 84", () => {
  assert.equal(normalizeVnPhone("0987654321"), "84987654321");
  assert.equal(normalizeVnPhone("+84 987 654 321"), "84987654321");
  assert.equal(normalizeVnPhone("84987654321"), "84987654321");
});

test("normalizeVnPhone trả null khi không phải số Việt Nam", () => {
  assert.equal(normalizeVnPhone(""), null);
  assert.equal(normalizeVnPhone("12345"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run từ `quanluong-app-be`: `node --test src/modules/auth/zalo-phone.test.js`  
Expected: FAIL, không tìm thấy module.

- [ ] **Step 3: Write minimal implementation**

```js
function normalizeVnPhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  let national = digits;
  if (national.startsWith("84")) {
    national = national.slice(2);
  } else if (national.startsWith("0")) {
    national = national.slice(1);
  }
  if (!/^([35789]\d{8}|2\d{9})$/.test(national)) {
    return null;
  }
  return `84${national}`;
}

export { normalizeVnPhone };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/auth/zalo-phone.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/auth/zalo-phone.js quanluong-app-be/src/modules/auth/zalo-phone.test.js
git commit -m "$(cat <<'EOF'
feat: chuẩn hóa số điện thoại Việt Nam cho đăng nhập Zalo

EOF
)"
```

---

### Task 2: Hàm rẽ nhánh

**Files:**
- Create: `quanluong-app-be/src/modules/auth/zalo-login.decision.js`
- Test: `quanluong-app-be/src/modules/auth/zalo-login.decision.test.js`

**Interfaces:**
- Consumes: không (số đã chuẩn hóa do caller truyền)
- Produces: `decideZaloOauth(user | null) -> { kind: "session"|"pending"|"error"|"await_phone", userId?, code? }`
- Produces: `decideZaloPhone({ portal, matches }) -> { kind: "password"|"pending"|"register"|"error", userId?, code? }`

`user` và mỗi phần tử `matches` có `{ id, typeName, registrationStatus, isActive, deletedAt, zaloUserId }`.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/modules/auth/zalo-login.decision.test.js`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```js
function decideZaloOauth(user) {
  if (!user || user.deletedAt) {
    return { kind: "await_phone" };
  }
  if (user.typeName === "superadmin") {
    return { kind: "error", code: "superadmin" };
  }
  if (user.registrationStatus === "PENDING_APPROVAL") {
    return { kind: "pending", userId: user.id };
  }
  if (user.registrationStatus !== "APPROVED" || !user.isActive) {
    return { kind: "error", code: "inactive" };
  }
  return { kind: "session", userId: user.id };
}

function decideZaloPhone({ matches }) {
  const rows = (matches ?? []).filter((row) => !row.deletedAt && row.typeName !== "superadmin");
  if (rows.length > 1) {
    return { kind: "error", code: "ambiguous" };
  }
  if (rows.length === 1 && rows[0].registrationStatus === "PENDING_APPROVAL") {
    return { kind: "pending", userId: rows[0].id };
  }
  if (
    rows.length === 1 &&
    rows[0].registrationStatus === "APPROVED" &&
    rows[0].isActive &&
    !rows[0].zaloUserId
  ) {
    return { kind: "password", userId: rows[0].id };
  }
  if (rows.length === 1) {
    return { kind: "error", code: "inactive" };
  }
  return { kind: "register" };
}

export { decideZaloOauth, decideZaloPhone };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/auth/zalo-login.decision.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/auth/zalo-login.decision.js quanluong-app-be/src/modules/auth/zalo-login.decision.test.js
git commit -m "$(cat <<'EOF'
feat: rẽ nhánh đăng nhập Zalo trước và sau khi có số

EOF
)"
```

---

### Task 3: Cột dữ liệu và env

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma` model `User` (khoảng dòng 111)
- Create: `quanluong-app-be/prisma/migrations/20261011120000_user_zalo_login/migration.sql`
- Modify: `quanluong-app-be/src/config/env.js`, `quanluong-app-be/src/config/config.js`
- Modify: `quanluong-app-be/.env.docker.example`

**Interfaces:**
- Produces: `config.zalo = { appId, appSecret, loginRedirectUri, miniAppDeeplink, mainOrigin, supplierOrigin }`

- [ ] **Step 1: Sửa schema**

Trên `User`: `email String? @unique`, `password String?`, thêm

```prisma
zaloUserId     String?   @unique @db.VarChar(64)
phoneVerifiedAt DateTime?
```

- [ ] **Step 2: Viết migration**

```sql
ALTER TABLE `User` MODIFY `email` VARCHAR(191) NULL;
ALTER TABLE `User` MODIFY `password` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN `zaloUserId` VARCHAR(64) NULL;
ALTER TABLE `User` ADD COLUMN `phoneVerifiedAt` DATETIME(3) NULL;
CREATE UNIQUE INDEX `User_zaloUserId_key` ON `User`(`zaloUserId`);
```

Đối chiếu tên bảng và độ dài `email`/`password` trong migration tạo `User` trước khi chốt `VARCHAR(191)`. Giữ unique email hiện có; MariaDB cho nhiều NULL.

- [ ] **Step 3: Thêm config**

Trong `env.js`:

```js
zaloAppId: process.env.ZALO_APP_ID || "",
zaloAppSecret: process.env.ZALO_APP_SECRET || "",
zaloLoginRedirectUri: (process.env.ZALO_LOGIN_REDIRECT_URI || "").trim().replace(/\/+$/, ""),
zaloMiniAppDeeplink: (process.env.ZALO_MINI_APP_DEEPLINK || "").trim(),
uiMainOrigin: (process.env.UI_MAIN_ORIGIN || "http://localhost:8080").replace(/\/+$/, ""),
uiSupplierOrigin: (process.env.UI_SUPPLIER_ORIGIN || "http://localhost:8082").replace(/\/+$/, ""),
```

Trong `config.js`:

```js
zalo: {
  appId: env.zaloAppId,
  appSecret: env.zaloAppSecret,
  loginRedirectUri: env.zaloLoginRedirectUri,
  miniAppDeeplink: env.zaloMiniAppDeeplink,
  mainOrigin: env.uiMainOrigin,
  supplierOrigin: env.uiSupplierOrigin,
},
```

Trong `.env.docker.example` thêm bốn biến Zalo, comment, không giá trị thật. `ZALO_LOGIN_REDIRECT_URI` mẫu: `http://localhost:3000/api/auth/zalo/login/callback`.

- [ ] **Step 4: Commit**

```bash
git add quanluong-app-be/prisma/schema.prisma quanluong-app-be/prisma/migrations/20261011120000_user_zalo_login/migration.sql quanluong-app-be/src/config/env.js quanluong-app-be/src/config/config.js quanluong-app-be/.env.docker.example
git commit -m "$(cat <<'EOF'
feat: thêm cột Zalo và biến cấu hình đăng nhập Zalo

EOF
)"
```

---

### Task 4: Phiếu và gọi Zalo

**Files:**
- Create: `quanluong-app-be/src/modules/auth/zalo-attempt.store.js`
- Create: `quanluong-app-be/src/modules/auth/zalo-login.service.js`
- Test: `quanluong-app-be/src/modules/auth/zalo-login.service.test.js`

**Interfaces:**
- Consumes: `normalizeVnPhone`, `decideZaloOauth`, `decideZaloPhone`, `config.zalo`
- Produces:
  - `assertZaloConfigured()`
  - `buildZaloAuthorizeUrl({ state, codeChallenge })`
  - `createPkcePair()`
  - `exchangeZaloCode({ code, codeVerifier, fetchImpl })`
  - `fetchZaloProfile({ accessToken, fetchImpl })` → `{ id, name }`
  - `exchangeZaloPhone({ accessToken, phoneToken, fetchImpl })` → số thô
  - `putAttempt(attempt)`, `getAttempt(ticket)`, `patchAttempt(ticket, patch)`
  - Attempt: `{ ticket, zaloUserId, displayName, phone, portal, mode, fromPath, linkUserId, status, branch, errorCode, targetUserId, expiresAt }`
  - `status`: `await_phone | ready | failed | consumed`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { buildZaloAuthorizeUrl, exchangeZaloPhone, fetchZaloProfile } from "./zalo-login.service.js";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/modules/auth/zalo-login.service.test.js`  
Expected: FAIL

- [ ] **Step 3: Write store and service**

`zalo-attempt.store.js`: `Map` theo ticket. `putAttempt` gắn `expiresAt = Date.now() + 10 * 60 * 1000`. `getAttempt` trả null khi hết hạn hoặc không có. Comment trong file: phiếu chỉ sống trong một process `app`; nhiều replica thì chuyển Map sang Redis.

`zalo-login.service.js`:

```js
import crypto from "node:crypto";

function createPkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

function buildZaloAuthorizeUrl({ state, codeChallenge, appId, redirectUri }) {
  const url = new URL("https://oauth.zaloapp.com/v4/permission");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("state", state);
  return url.toString();
}

function appsecretProof(accessToken, appSecret) {
  return crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

async function fetchZaloProfile({ accessToken, appSecret, fetchImpl }) {
  const url = new URL("https://graph.zalo.me/v2.0/me");
  url.searchParams.set("fields", "id,name");
  const res = await fetchImpl(url, {
    headers: {
      access_token: accessToken,
      appsecret_proof: appsecretProof(accessToken, appSecret),
    },
  });
  const data = await res.json();
  if (!res.ok || data.error || !data.id) {
    throw Object.assign(new Error("zalo_profile"), { code: "profile" });
  }
  return { id: String(data.id), name: typeof data.name === "string" ? data.name : "" };
}

async function exchangeZaloPhone({ accessToken, phoneToken, appSecret, fetchImpl }) {
  const res = await fetchImpl("https://graph.zalo.me/v2.0/me/info", {
    headers: {
      access_token: accessToken,
      code: phoneToken,
      secret_key: appSecret,
    },
  });
  const data = await res.json();
  const number = data?.data?.number;
  if (!res.ok || data.error || !number) {
    throw Object.assign(new Error("zalo_phone"), { code: "no_phone" });
  }
  return String(number);
}

function assertZaloConfigured(zalo) {
  if (!zalo.appId || !zalo.appSecret || !zalo.loginRedirectUri || !zalo.miniAppDeeplink) {
    const err = new Error("zalo_config");
    err.statusCode = 503;
    throw err;
  }
}
```

Export các hàm trên. `exchangeZaloCode` POST `https://oauth.zaloapp.com/v4/access_token` body `application/x-www-form-urlencoded`: `app_id`, `code`, `grant_type=authorization_code`, `code_verifier`. Header `secret_key` = app secret. Trả `access_token` hoặc throw `code: "token"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/auth/zalo-login.service.test.js`  
Expected: PASS. Bổ sung một test `exchangeZaloCode` đọc `access_token` từ JSON giả.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/auth/zalo-attempt.store.js quanluong-app-be/src/modules/auth/zalo-login.service.js quanluong-app-be/src/modules/auth/zalo-login.service.test.js
git commit -m "$(cat <<'EOF'
feat: gọi OAuth Zalo và giữ phiếu đăng nhập trong bộ nhớ

EOF
)"
```

---

### Task 5: Hoàn tất phiên, mật khẩu, đăng ký

**Files:**
- Modify: `quanluong-app-be/src/modules/auth/zalo-login.service.js`
- Modify: `quanluong-app-be/src/modules/auth/auth.service.js` (`login` khoảng dòng 275, thêm `issueZaloSession`)
- Test: `quanluong-app-be/src/modules/auth/zalo-login.service.test.js`

**Interfaces:**
- Consumes: `decideZaloOauth`, `decideZaloPhone`, `normalizeVnPhone`, attempt store, `issueSessionForUser`
- Produces:
  - `applyOauthProfile({ attemptDraft, existingUser })` ghi phiếu hoặc trả `{ kind: "session"|"pending"|"error" }`
  - `applyPhone({ ticket, miniAppUserId, rawPhone })`
  - `completeZaloPassword({ ticket, passwordOk })`
  - `completeZaloRegister({ ticket, username, unitId, createUser })`
  - `issueZaloSession` bỏ qua `assertEmailVerifiedForLogin` khi user không có email và có `phoneVerifiedAt`

- [ ] **Step 1: Write the failing test**

Thêm test thuần, inject loader:

```js
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
```

Tách `applyPhone` và `applyOauthProfile` để không cần Prisma trong test này.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/modules/auth/zalo-login.service.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement**

`applyOauthProfile(user)` gọi `decideZaloOauth`. `session` và `pending` không tạo phiếu chờ số. `await_phone` tạo phiếu `status: "await_phone"`. `error` tạo phiếu `failed`.

`applyPhone`: hết hạn → `failed`/`expired`. `miniAppUserId !== attempt.zaloUserId` → `failed`/`id_mismatch`. `normalizeVnPhone` null → `failed`/`no_phone`. Mode `link`: nếu `zaloUserId` đã thuộc user khác `linkUserId` → `failed`/`taken`; ngược lại `branch: "link"`, `status: "ready"`. Mode `login`: gọi `decideZaloPhone`. `register` thì `branch` là `register`, portal giữ nguyên.

`completeZaloPassword`: chỉ khi `branch === "password"` và `status === "ready"`. `passwordOk === false` giữ nguyên phiếu. `true` thì caller cập nhật user (`zaloUserId`, `profile.phoneNumber`, `phoneVerifiedAt`) và `status: "consumed"`.

`completeZaloRegister`: `branch === "register"`. Caller tạo user. Portal `supplier` thì type `lttp_supplier`, `unitId` null, `PENDING_APPROVAL`, không cấp phiên. Portal `main` thì type `user`, `unitId` bắt buộc. `registrationRequiresApproval` true → pending, không phiên. False → approved, active, caller cấp phiên. Email null, password null, `phoneVerifiedAt` now, fullName từ `displayName`.

Trong `login` của `auth.service.js`, trước `bcrypt.compare`:

```js
if (!raw.password) {
  throw createAuthError();
}
```

Thêm `issueZaloSession` gọi `issueSessionForUser` sau `assertActiveUser`, không gọi `assertEmailVerifiedForLogin` khi `!user.email && user.phoneVerifiedAt`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/auth/zalo-login.service.test.js src/modules/auth/zalo-phone.test.js src/modules/auth/zalo-login.decision.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/auth/zalo-login.service.js quanluong-app-be/src/modules/auth/zalo-login.service.test.js quanluong-app-be/src/modules/auth/auth.service.js
git commit -m "$(cat <<'EOF'
feat: hoàn tất liên kết mật khẩu và đăng ký sau khi Zalo trả số

EOF
)"
```

---

### Task 6: Route HTTP

**Files:**
- Modify: `quanluong-app-be/src/modules/auth/auth.routes.js`
- Modify: `quanluong-app-be/src/modules/auth/auth.controller.js`
- Modify: `quanluong-app-be/src/modules/auth/auth.validator.js`

**Interfaces:**
- Consumes: service Task 4–5, `config.zalo.mainOrigin` / `supplierOrigin`
- Produces:
  - `GET /auth/zalo/login/authorize-url?portal=main|supplier&mode=login|link&from=`
  - `GET /auth/zalo/login/callback`
  - `GET /auth/zalo/attempts/:ticket`
  - `POST /auth/zalo/attempts/:ticket/phone` body `{ accessToken, phoneToken }`
  - `POST /auth/zalo/attempts/:ticket/link` body `{ password }`
  - `POST /auth/zalo/attempts/:ticket/register` body `{ username, unitId? }`

- [ ] **Step 1: Validator**

`portal` enum `main|supplier`. `mode` enum `login|link`. `from` chỉ path bắt đầu bằng `/`, không `//`. Register: `username` 3–50. `unitId` bắt buộc khi phiếu `portal === "main"`. Phone body: cả hai chuỗi non-empty.

- [ ] **Step 2: authorize-url**

`assertZaloConfigured`. `mode=link` yêu cầu `authMiddleware` trên route đó (tách middleware, route login thì public). Session `zaloOAuthLogin = { state, codeVerifier, portal, mode, from, linkUserId }`. Trả `{ url }` JSON như Google authorize-url, để trang login `fetch` rồi `location.assign`.

- [ ] **Step 3: callback**

Sai `state` → redirect `${origin}/login?zalo=error&reason=state`. Đổi code, lấy profile, tìm user `zaloUserId`. `session` → `issueZaloSession` và redirect `from` trên origin của portal. `pending` → redirect `${origin}/login/zalo?ticket=&branch=pending`. `await_phone` → redirect `${origin}/login/zalo?ticket=`. `error` → `?zalo=error&reason=`. Origin lấy từ `config.zalo.mainOrigin` hoặc `supplierOrigin`, không lấy từ query.

- [ ] **Step 4: phone, link, register**

`POST .../phone`: gọi profile Mini App bằng `accessToken` để lấy `id`, rồi `exchangeZaloPhone`, rồi `applyPhone`. Trả `{ status, branch, errorCode, displayName, phone }` — phone đã chuẩn hóa để hiện, không nhận số từ body.

`POST .../link`: `bcrypt.compare` với user `targetUserId`. Sai → 401, phiếu còn. Đúng → cập nhật và `issueZaloSession` nếu mode login; mode link thì không đổi phiên, trả user đã gắn.

`POST .../register`: `completeZaloRegister`. Username trùng → 409.

`GET attempt`: `{ status, branch, errorCode, displayName, phone, portal, miniAppUrl }`. `miniAppUrl` = deeplink cộng `ticket`. Không trả `zaloUserId`.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/auth/auth.routes.js quanluong-app-be/src/modules/auth/auth.controller.js quanluong-app-be/src/modules/auth/auth.validator.js
git commit -m "$(cat <<'EOF'
feat: mở route đăng nhập, xác minh số và đăng ký Zalo

EOF
)"
```

---

### Task 7: Duyệt nhà cung cấp

**Files:**
- Modify: `quanluong-app-be/src/modules/registrations/registrations.validator.js`
- Modify: `quanluong-app-be/src/modules/registrations/registrations.service.js`
- Modify: `quanluong-app-be/src/modules/registrations/registrations.controller.js`
- Modify: `quanluong-app-be/src/modules/registrations/registrations.routes.js`
- Test: `quanluong-app-be/src/modules/registrations/registrations.zalo.test.js`

**Interfaces:**
- Consumes: `User.type.name === "lttp_supplier"`, `UserLttpSupplier`
- Produces: `approveRegistration({ targetUserId, reviewer, scope, lttpSupplierId })`

- [ ] **Step 1: Write the failing test**

Test pure helper, không cần DB:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { supplierApproveError } from "./registrations.service.js";

test("nhà cung cấp thiếu đối tác thì không duyệt", () => {
  assert.equal(supplierApproveError({ typeName: "lttp_supplier", lttpSupplierId: null }), "missing_supplier");
});

test("nhân viên không cần đối tác", () => {
  assert.equal(supplierApproveError({ typeName: "user", lttpSupplierId: null }), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/modules/registrations/registrations.zalo.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement**

`supplierApproveError` như test. `approveRegistration` load target kèm `type`. Nếu helper trả `missing_supplier` → 400. Nếu có id, `lttpSupplier.findUnique` không thấy → 404. Trong `prisma.$transaction`: update approved như hiện tại, `userLttpSupplier.create({ userId, lttpSupplierId })`.

Body schema: `lttpSupplierId: z.coerce.number().int().positive().optional()`. Route approve thêm `validateRequest({ body })`.

`listPendingRegistrations` giữ `unitIdsWhereClause`. Scope subtree không gồm `unitId` null, nên admin đơn vị không thấy đăng ký nhà cung cấp. Không thêm filter mới.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/registrations/registrations.zalo.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/registrations/registrations.validator.js quanluong-app-be/src/modules/registrations/registrations.service.js quanluong-app-be/src/modules/registrations/registrations.controller.js quanluong-app-be/src/modules/registrations/registrations.routes.js quanluong-app-be/src/modules/registrations/registrations.zalo.test.js
git commit -m "$(cat <<'EOF'
feat: duyệt đăng ký nhà cung cấp phải chọn đối tác

EOF
)"
```

---

### Task 8: Nút Zalo và trang tiếp tục

**Files:**
- Modify: `packages/shared/src/pages/login/LoginPage.jsx`
- Create: `packages/shared/src/pages/login/ZaloContinuePage.jsx`
- Modify: `packages/shared/src/pages/login/LoginPage.test.js`
- Create: `apps/web/app/(auth)/login/zalo/page.jsx`
- Create: `apps/supplier/app/(auth)/login/page.jsx`
- Create: `apps/supplier/app/(auth)/login/layout.jsx`
- Create: `apps/supplier/app/(auth)/login/zalo/page.jsx`
- Modify: `packages/shared/src/hocs/SupplierOnlyRoute.jsx`

**Interfaces:**
- Consumes: `GET /auth/zalo/login/authorize-url`, `GET /auth/zalo/attempts/:ticket`, các POST Task 6
- Produces: UI theo spec mục 5

- [ ] **Step 1: Ẩn nút trên superadmin**

Trong `LoginPage`, nút **Đăng nhập bằng Zalo** render khi `window.location.origin` khác `getSuperadminAppOrigin()`. Portal gửi lên API: origin trùng `getSupplierAppOrigin()` → `supplier`, còn lại → `main`. Bấm nút thì `fetch` authorize-url `credentials: "include"` rồi `location.assign(url)`.

`LoginPage.test.js` assert chuỗi `Đăng nhập bằng Zalo` và `getSuperadminAppOrigin`.

- [ ] **Step 2: ZaloContinuePage**

Đọc `ticket` từ query. Poll `GET /auth/zalo/attempts/:ticket` mỗi 2 giây cho đến khi `status` không còn `await_phone`.

- `await_phone`: tiêu đề **Xác minh số điện thoại**, link `miniAppUrl`.
- `failed`: câu theo `errorCode` (`no_phone`, `id_mismatch`, `expired`, `ambiguous`, `superadmin`, `taken`).
- `password`: form mật khẩu, POST `.../link`.
- `pending`: câu đang chờ duyệt.
- `register` và `portal=main`: tên, số (read-only), tên đăng nhập, chọn đơn vị (dùng API register-units hiện có).
- `register` và `portal=supplier`: tên, số, tên đăng nhập. Không có đơn vị.
- `consumed` hoặc response có user: `navigateAfterLogin`.

- [ ] **Step 3: Route**

`apps/web/app/(auth)/login/zalo/page.jsx` render `ZaloContinuePage` trong `Suspense`.

Supplier: copy layout login của web (`PublicOnlyRoute`). `SupplierOnlyRoute` đổi redirect khách thành `window.location.replace("/login")` trên chính origin nhà cung cấp, không sang app chính.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/pages/login/LoginPage.jsx packages/shared/src/pages/login/LoginPage.test.js packages/shared/src/pages/login/ZaloContinuePage.jsx packages/shared/src/hocs/SupplierOnlyRoute.jsx apps/web/app/(auth)/login/zalo/page.jsx apps/supplier/app/(auth)/login/page.jsx apps/supplier/app/(auth)/login/layout.jsx apps/supplier/app/(auth)/login/zalo/page.jsx
git commit -m "$(cat <<'EOF'
feat: thêm đăng nhập Zalo trên app chính và cổng nhà cung cấp

EOF
)"
```

---

### Task 9: Hồ sơ, tạo user, màn duyệt

**Files:**
- Modify: `packages/shared/src/pages/profile/ProfilePage.jsx`
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminUsersPanel.jsx`
- Modify: `packages/shared/src/pages/users/UsersPage.jsx`
- Modify: hook approve trong `packages/shared` (file mutation đăng ký hiện có)

**Interfaces:**
- Consumes: authorize-url `mode=link`, approve body `lttpSupplierId`
- Produces: nút **Liên kết Zalo**, ô số trên form tạo, ô đối tác khi duyệt supplier

- [ ] **Step 1: Hồ sơ**

Nút **Liên kết Zalo** gọi authorize-url `mode=link&portal=` theo origin hiện tại (supplier hoặc main). Ẩn khi user là superadmin hoặc đã có `zaloUserId` trên payload `/me`. Mapper auth cần trả `zaloLinked: Boolean(user.zaloUserId)` — không trả id Zalo ra client. Thêm field trong `auth.mapper.js`.

- [ ] **Step 2: Form tạo**

Trong `SuperadminUsersPanel`, state `phoneNumber`, input, đưa vào `profile.phoneNumber` của payload create/patch. API users đã nhận field này. Không gửi `phoneVerifiedAt`.

- [ ] **Step 3: Duyệt**

`UsersPage` tab review: nếu `user.type?.name === "lttp_supplier"`, hiện select đối tác (API danh sách đối tác superadmin đang dùng ở panel user). Nút Duyệt không gọi mutation khi chưa chọn. Mutation approve gửi `{ lttpSupplierId }`.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/pages/profile/ProfilePage.jsx packages/shared/src/pages/dashboard/superadmin/SuperadminUsersPanel.jsx packages/shared/src/pages/users/UsersPage.jsx packages/shared/src/features/auth/api/authApi.js quanluong-app-be/src/modules/auth/auth.mapper.js
git commit -m "$(cat <<'EOF'
feat: liên kết Zalo từ hồ sơ và chọn đối tác khi duyệt nhà cung cấp

EOF
)"
```

Sửa đúng file mutation approve nếu không nằm trong `authApi.js`.

---

### Task 10: Mini App một màn

**Files:**
- Create: `apps/zalo-miniapp/package.json`
- Create: `apps/zalo-miniapp/src/app.jsx`

**Interfaces:**
- Consumes: `POST /auth/zalo/attempts/:ticket/phone` với `{ accessToken, phoneToken }`
- Produces: deeplink mở app này; query `ticket`

- [ ] **Step 1: Package**

`package.json` name `@quanluong/zalo-miniapp`, dependency `zmp-sdk`. Không thêm app này vào workspace Docker. Deploy bằng Zalo Mini App CLI, ngoài compose.

- [ ] **Step 2: Một màn**

Đọc `ticket` từ query. Nút **Chia sẻ số điện thoại** gọi `getPhoneNumber()` và `getAccessToken()`. POST JSON lên `NEXT_PUBLIC` không dùng được trong Mini App: dùng hằng `API_BASE` trong `apps/zalo-miniapp/src/config.js` đọc `import.meta.env` hoặc file config build của zmp, trỏ tới API public. Thành công: chữ «Quay lại trình duyệt». Lỗi: hiện `message` từ API. Không có màn nào khác.

- [ ] **Step 3: Commit**

```bash
git add apps/zalo-miniapp
git commit -m "$(cat <<'EOF'
feat: Mini App Zalo chỉ xin số điện thoại cho phiếu đăng nhập

EOF
)"
```

Không chạy `npm install` ở root chỉ vì Mini App, trừ khi zmp bắt buộc nằm trong workspace. Giữ nó tách khỏi `apps/*` workspace nếu `apps/*` đang nuốt mọi app — kiểm tra root `package.json` workspaces. Nếu glob là `apps/*`, đặt Mini App ngoài workspace (ví dụ `zalo-miniapp/` ở root) để khỏi làm vỡ `npm ci` như lần `@quanluong/supplier`.

---

### Task 11: Đối chiếu spec

- [ ] Đọc lại spec mục 2–7. Mỗi dòng quyết định phải có trong test Task 2, Task 5, hoặc Task 7.
- [ ] `node --test` các file `zalo-phone`, `zalo-login.decision`, `zalo-login.service`, `registrations.zalo` từ `quanluong-app-be`.
- [ ] Trên máy, sau khi điền env và Zalo duyệt quyền số: quét QR từ `:8080/login` và `:8082/login`. Superadmin `:8081/login` không có nút.
