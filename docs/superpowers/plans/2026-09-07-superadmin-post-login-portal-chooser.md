# Superadmin Post-Login Portal Chooser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One login on the main app; after login, superadmin lands on `/chon-cong` and picks «Làm việc» or «Quản trị»; non-superadmin behavior unchanged; no BE Google callback changes.

**Architecture:** Extend `postLoginPath` helpers; shared `PortalChooserPage` under main app `(auth)` layout (AuthLayout, not PublicOnly); wire `LoginPage` password + Google `from`; redirect SA `/login` and unauthenticated `SuperadminOnlyRoute` to main app login.

**Tech Stack:** Next App Router (`apps/web`, `apps/superadmin`), shared React (`packages/shared`), `node:test` source/unit asserts

**Spec:** `docs/superpowers/specs/2026-09-07-superadmin-post-login-portal-chooser-design.md`

## Global Constraints

- Single login surface: main app only
- Superadmin post-login destination: always `/chon-cong` (ignore `?from=`)
- Non-superadmin: `safeInternalPath(from)` unchanged
- Google: FE sets `from=/chon-cong`; **do not** change BE `googleLoginCallbackController`
- «Quản trị» uses `window.location.assign(getSuperadminAppOrigin() + "/dashboard")`
- No new dependencies; no same-domain merge; no remember-last-choice

---

## File Map

| File | Role |
|------|------|
| `packages/shared/src/utils/postLoginPath.js` | `SUPERADMIN_PORTAL_CHOOSER_PATH`, `isSuperadminUser`, `resolvePostLoginPath` (+ keep `safeInternalPath`) |
| `packages/shared/src/utils/postLoginPath.test.js` | Unit tests for helpers |
| `packages/shared/src/pages/portal/PortalChooserPage.jsx` | Chooser UI + auth/type guards |
| `packages/shared/src/pages/portal/PortalChooserPage.test.js` | Source asserts |
| `packages/shared/src/pages/login/LoginPage.jsx` | Use `resolvePostLoginPath`; Google `from` = chooser path |
| `packages/shared/src/pages/login/LoginPage.test.js` | Source asserts (create if missing) |
| `apps/web/app/(auth)/chon-cong/page.jsx` | Route → `PortalChooserPage` (no `PublicOnlyRoute`) |
| `apps/superadmin/app/(auth)/login/page.jsx` | Redirect to main `/login` |
| `packages/shared/src/hocs/SuperadminOnlyRoute.jsx` | Unauth → `${getMainAppOrigin()}/login` |

---

### Task 1: `postLoginPath` helpers + tests

**Files:**
- Modify: `packages/shared/src/utils/postLoginPath.js`
- Create: `packages/shared/src/utils/postLoginPath.test.js`

**Interfaces:**
- Produces:
  - `SUPERADMIN_PORTAL_CHOOSER_PATH` = `"/chon-cong"`
  - `isSuperadminUser(user)` → `boolean`
  - `resolvePostLoginPath(user, fromRaw)` → `string` (internal path only)
  - existing `safeInternalPath(raw)` unchanged

- [ ] **Step 1: Write failing tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPERADMIN_PORTAL_CHOOSER_PATH,
  isSuperadminUser,
  resolvePostLoginPath,
  safeInternalPath,
} from "./postLoginPath.js";

test("safeInternalPath rejects open redirects", () => {
  assert.equal(safeInternalPath("https://evil.example"), "/");
  assert.equal(safeInternalPath("//evil"), "/");
  assert.equal(safeInternalPath("/dashboard"), "/dashboard");
});

test("isSuperadminUser", () => {
  assert.equal(isSuperadminUser({ type: { name: "superadmin" } }), true);
  assert.equal(isSuperadminUser({ type: { name: "admin" } }), false);
  assert.equal(isSuperadminUser(null), false);
});

test("resolvePostLoginPath sends superadmin to chooser ignoring from", () => {
  assert.equal(
    resolvePostLoginPath({ type: { name: "superadmin" } }, "/users"),
    SUPERADMIN_PORTAL_CHOOSER_PATH,
  );
  assert.equal(SUPERADMIN_PORTAL_CHOOSER_PATH, "/chon-cong");
});

test("resolvePostLoginPath keeps safe from for others", () => {
  assert.equal(
    resolvePostLoginPath({ type: { name: "user" } }, "/profile"),
    "/profile",
  );
  assert.equal(resolvePostLoginPath({ type: { name: "user" } }, null), "/");
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd packages/shared && node --test src/utils/postLoginPath.test.js
```

Expected: FAIL (missing exports)

- [ ] **Step 3: Implement helpers**

```js
/**
 * Tránh open redirect sau đăng nhập (chỉ cho phép đường dẫn nội bộ).
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function safeInternalPath(raw) {
  if (raw == null || typeof raw !== "string") {
    return "/";
  }
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) {
    return "/";
  }
  return t;
}

export const SUPERADMIN_PORTAL_CHOOSER_PATH = "/chon-cong";

export function isSuperadminUser(user) {
  return user?.type?.name === "superadmin";
}

/**
 * Đích sau login mật khẩu (path nội bộ app chính).
 * Superadmin luôn vào trang chọn — bỏ qua `from`.
 */
export function resolvePostLoginPath(user, fromRaw) {
  if (isSuperadminUser(user)) {
    return SUPERADMIN_PORTAL_CHOOSER_PATH;
  }
  return safeInternalPath(fromRaw);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd packages/shared && node --test src/utils/postLoginPath.test.js
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/postLoginPath.js packages/shared/src/utils/postLoginPath.test.js
git commit -m "feat(auth): resolvePostLoginPath for superadmin chooser"
```

---

### Task 2: `PortalChooserPage` + main app route

**Files:**
- Create: `packages/shared/src/pages/portal/PortalChooserPage.jsx`
- Create: `packages/shared/src/pages/portal/PortalChooserPage.test.js`
- Create: `apps/web/app/(auth)/chon-cong/page.jsx`

**Interfaces:**
- Consumes: `isSuperadminUser`, `getSuperadminAppOrigin`, auth hooks, `ClientRedirect`, `Button`
- Produces: page component exported as `PortalChooserPage`

- [ ] **Step 1: Failing source test**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("./PortalChooserPage.jsx", import.meta.url), "utf8");

test("PortalChooserPage offers work and admin CTAs", () => {
  assert.match(src, /Làm việc/);
  assert.match(src, /Quản trị/);
  assert.match(src, /getSuperadminAppOrigin/);
  assert.match(src, /\/dashboard/);
  assert.match(src, /isSuperadminUser/);
});
```

- [ ] **Step 2: Run — expect FAIL (missing file)**

```bash
cd packages/shared && node --test src/pages/portal/PortalChooserPage.test.js
```

- [ ] **Step 3: Implement page**

```jsx
"use client";

import { Building2, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  useAuthInitialized,
  useCurrentUser,
  useIsAuthenticated,
} from "@/features/auth/model/authSlice";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { isSuperadminUser } from "@/utils/postLoginPath";
import { getSuperadminAppOrigin } from "@/utils/superadminPortal";

export function PortalChooserPage() {
  const router = useRouter();
  const initialized = useAuthInitialized();
  const isAuthenticated = useIsAuthenticated();
  const user = useCurrentUser();

  if (!initialized) {
    return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  }
  if (!isAuthenticated) {
    return <ClientRedirect href="/login?from=%2Fchon-cong" replace />;
  }
  if (!isSuperadminUser(user)) {
    return <ClientRedirect href="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Chọn cổng làm việc</h1>
        <p className="text-sm text-muted-foreground">
          Tài khoản superadmin có thể vào ứng dụng đơn vị hoặc cổng quản trị hệ thống.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          className="h-11 w-full justify-start gap-2"
          onClick={() => router.replace("/")}
        >
          <Building2 className="size-4" aria-hidden />
          Làm việc
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full justify-start gap-2"
          onClick={() => {
            window.location.assign(`${getSuperadminAppOrigin()}/dashboard`);
          }}
        >
          <Shield className="size-4" aria-hidden />
          Quản trị
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add route (no PublicOnlyRoute — authenticated chooser)**

`apps/web/app/(auth)/chon-cong/page.jsx`:

```jsx
import { Suspense } from "react";
import { PortalChooserPage } from "@/pages/portal/PortalChooserPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Chọn cổng",
  description: "Superadmin chọn vào ứng dụng chính hoặc cổng quản trị hệ thống.",
});

export default function PortalChooserRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <PortalChooserPage />
    </Suspense>
  );
}
```

Do **not** add `chon-cong/layout.jsx` with `PublicOnlyRoute` (that would bounce authed users to `/`).

- [ ] **Step 5: PASS tests + commit**

```bash
cd packages/shared && node --test src/pages/portal/PortalChooserPage.test.js
git add packages/shared/src/pages/portal/ apps/web/app/\(auth\)/chon-cong/
git commit -m "feat(web): superadmin portal chooser page at /chon-cong"
```

---

### Task 3: Wire `LoginPage` (password + Google `from`)

**Files:**
- Modify: `packages/shared/src/pages/login/LoginPage.jsx`
- Create or modify: `packages/shared/src/pages/login/LoginPage.test.js`

**Interfaces:**
- Consumes: `resolvePostLoginPath`, `SUPERADMIN_PORTAL_CHOOSER_PATH` from Task 1
- Login mutation returns user payload (same shape as current-user / `type.name`)

- [ ] **Step 1: Failing source asserts**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("./LoginPage.jsx", import.meta.url), "utf8");

test("LoginPage uses resolvePostLoginPath and Google from chooser", () => {
  assert.match(src, /resolvePostLoginPath/);
  assert.match(src, /SUPERADMIN_PORTAL_CHOOSER_PATH/);
  assert.match(src, /login\(values\)\.unwrap\(\)/);
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd packages/shared && node --test src/pages/login/LoginPage.test.js
```

- [ ] **Step 3: Update LoginPage**

Imports:

```js
import {
  resolvePostLoginPath,
  SUPERADMIN_PORTAL_CHOOSER_PATH,
} from "@/utils/postLoginPath";
```

Password submit:

```js
async function onSubmit(values) {
  try {
    const user = await login(values).unwrap();
    notifySuccess("Đăng nhập thành công");
    const next = resolvePostLoginPath(user, searchParams.get("from"));
    router.replace(next);
  } catch (error) {
    notifyError(error?.data?.message || "Đăng nhập thất bại.");
  }
}
```

Google start — always send chooser as `from` (spec §2 #6):

```js
const params = new URLSearchParams({ from: SUPERADMIN_PORTAL_CHOOSER_PATH });
```

Remove use of `safeInternalPath(searchParams.get("from"))` for Google `from` only. Keep `safeInternalPath` unused unless still needed — prefer drop unused import.

- [ ] **Step 4: PASS + commit**

```bash
cd packages/shared && node --test src/pages/login/LoginPage.test.js src/utils/postLoginPath.test.js
git add packages/shared/src/pages/login/LoginPage.jsx packages/shared/src/pages/login/LoginPage.test.js
git commit -m "feat(auth): send superadmin to portal chooser after login"
```

---

### Task 4: Superadmin app — single login entry

**Files:**
- Modify: `apps/superadmin/app/(auth)/login/page.jsx`
- Modify: `packages/shared/src/hocs/SuperadminOnlyRoute.jsx`
- Create or modify: `packages/shared/src/hocs/SuperadminOnlyRoute.test.js` (source assert)

**Interfaces:**
- Consumes: `getMainAppOrigin()` from `@/utils/superadminPortal`

- [ ] **Step 1: Failing asserts**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../../../../apps/superadmin/app/(auth)/login/page.jsx", import.meta.url),
  "utf8",
);
const guard = readFileSync(new URL("./SuperadminOnlyRoute.jsx", import.meta.url), "utf8");

test("superadmin login redirects to main app login", () => {
  assert.match(route, /getMainAppOrigin/);
  assert.match(route, /\/login/);
  assert.doesNotMatch(route, /LoginPage/);
});

test("SuperadminOnlyRoute unauth uses main login", () => {
  assert.match(guard, /getMainAppOrigin/);
  assert.match(guard, /\/login/);
});
```

(Adjust relative URL if test lives under `hocs/` — prefer assert only `SuperadminOnlyRoute.jsx` + a small test that reads superadmin page via path from repo root using `readFileSync` with absolute join from `process.cwd()` when running from monorepo root.)

Recommended test location: `packages/shared/src/hocs/SuperadminOnlyRoute.test.js` for guard; `apps/superadmin/app/(auth)/login/login-redirect.test.js` for page:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, "page.jsx"), "utf8");

test("SA login page redirects to main origin login", () => {
  assert.match(src, /getMainAppOrigin/);
  assert.doesNotMatch(src, /LoginPage/);
});
```

- [ ] **Step 2: Replace SA login page**

```jsx
"use client";

import { useEffect } from "react";
import { getMainAppOrigin } from "@/utils/superadminPortal";

export default function LoginRoutePage() {
  useEffect(() => {
    window.location.replace(`${getMainAppOrigin()}/login`);
  }, []);
  return <p className="text-sm text-muted-foreground">Chuyển tới trang đăng nhập…</p>;
}
```

Remove `quanLuongPageMeta` / Suspense / `LoginPage` if unused. If metadata export required, keep a thin server wrapper:

```jsx
import { ClientMainLoginRedirect } from "./ClientMainLoginRedirect.jsx";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Đăng nhập",
  description: "Chuyển tới trang đăng nhập ứng dụng chính.",
});

export default function LoginRoutePage() {
  return <ClientMainLoginRedirect />;
}
```

YAGNI: one client page file is enough if metadata can be dropped or kept via layout.

- [ ] **Step 3: Update `SuperadminOnlyRoute`**

Replace unauthenticated branch:

```jsx
if (!isAuthenticated) {
  const href = `${getMainAppOrigin()}/login`;
  return <ClientRedirect href={href} replace />;
}
```

Note: `ClientRedirect` uses Next `router.replace` — **cross-origin** href may not work with App Router. Prefer:

```jsx
if (!isAuthenticated) {
  if (typeof window !== "undefined") {
    window.location.replace(`${getMainAppOrigin()}/login`);
  }
  return <p className="text-sm text-muted-foreground">Chuyển tới trang đăng nhập…</p>;
}
```

Or a tiny `ExternalRedirect` effect component. Do **not** use `router.replace` for absolute other-origin URLs.

- [ ] **Step 4: PASS + commit**

```bash
node --test packages/shared/src/hocs/SuperadminOnlyRoute.test.js apps/superadmin/app/\(auth\)/login/login-redirect.test.js
git add apps/superadmin/app/\(auth\)/login/ packages/shared/src/hocs/SuperadminOnlyRoute.jsx packages/shared/src/hocs/SuperadminOnlyRoute.test.js
git commit -m "feat(superadmin): redirect login to main app"
```

---

### Task 5: Smoke checklist (manual / thin automated)

**Files:** none required beyond fixes

- [ ] **Step 1: Run automated suite for this feature**

```bash
cd packages/shared && node --test \
  src/utils/postLoginPath.test.js \
  src/pages/portal/PortalChooserPage.test.js \
  src/pages/login/LoginPage.test.js \
  src/hocs/SuperadminOnlyRoute.test.js
```

Expected: all PASS

- [ ] **Step 2: Manual checklist vs spec §6**

1. Non-superadmin password → `/` or safe `from`
2. Superadmin password → `/chon-cong` even with `?from=/users`
3. Chooser «Làm việc» → `/`; «Quản trị» → SA `/dashboard`
4. Non-superadmin opens `/chon-cong` → `/`
5. Google: lands `/chon-cong`; non-SA bounced to `/`
6. `SA/login` → main `/login`
7. SA private while logged out → main `/login`

- [ ] **Step 3: Commit any fixes**

```bash
git commit -am "fix(auth): portal chooser smoke fixes"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| One login (main) | T4 |
| Chooser `/chon-cong` | T2 |
| Superadmin ignore `from` | T1 + T3 |
| Non-SA `safeInternalPath` | T1 + T3 |
| Google `from=/chon-cong`, no BE change | T3 |
| Non-SA on chooser → `/` | T2 |
| SA `/login` → main | T4 |
| Unauth SA private → main login | T4 |
| Work / Admin CTAs | T2 |
| Acceptance | T5 |
| Out of scope same-domain / BE callback | — skipped |

**Placeholder scan:** none intentional.  
**Type consistency:** `SUPERADMIN_PORTAL_CHOOSER_PATH` = `"/chon-cong"` everywhere; `isSuperadminUser` / `resolvePostLoginPath` signatures stable across T1–T3.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-07-superadmin-post-login-portal-chooser.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans  

Which approach?
