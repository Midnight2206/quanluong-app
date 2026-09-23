# Outbox AUTH_EXPIRED + Reauth Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify 401/403 separately in outbox flush, bail the FIFO loop on auth expiry, verify/refresh session before flush, and show an in-place reauth modal that resumes reconnect sync after login.

**Architecture:** Pure classifiers + `flushOutbox` return `{ authExpired, forbidden }`. `verifySessionOrRefresh` runs in `OfflineSyncController.flush` before the processor. `runReconnectSync` surfaces `AUTH_EXPIRED` without treating it as partial flush failure. `OfflineProvider` owns `reauthRequired` + `ReauthOverlay` and resumes the reconnect gate after successful login.

**Tech Stack:** Existing `apiRequest` / `httpClient`, Dexie outbox, Zustand `useAuthStore`, React client components in `packages/shared`, assert-based `*.selfcheck.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-23-outbox-auth-expired-reauth-design.md`

## Global Constraints

- Approach **1** only — classify in processor; trigger/UI in `OfflineProvider`.
- 401 → item stays `pending`, bail loop; 403 → item `failed`, continue.
- No new Dexie outbox status.
- Reauth copy (exact): `Phiên hết hạn, đăng nhập lại`
- 403 toast (exact): `Bạn không có quyền thực hiện thao tác này`
- Forbidden fallback `lastError` (exact): `Bạn không có quyền thực hiện thao tác này`
- No Google OAuth inside `ReauthOverlay` (link to `/login` only if needed).
- Prefer `*.selfcheck.mjs`; no new test frameworks.
- Do not commit unless the user asks.
- Do not wipe drafts/outbox on `AUTH_EXPIRED` (only on user-id change via existing login mutation).

## File map

| Path | Responsibility |
|------|----------------|
| `packages/shared/src/offline/outbox/errors.js` | `isAuthExpired` / `isForbidden` / `isClientError` |
| `packages/shared/src/offline/outbox/processor.js` | Flush loop: 401 bail, 403 fail+continue, return shape |
| `packages/shared/src/offline/auth/verifySessionOrRefresh.js` | Proactive session check + optional refresh |
| `packages/shared/src/offline/sync/OfflineSyncController.js` | Call verify before flush; empty defaults |
| `packages/shared/src/offline/runReconnectSync.js` | `authExpired` → throw `AUTH_EXPIRED` (not partial-flush) |
| `packages/shared/src/offline/ui/ReauthOverlay.jsx` | Modal login form |
| `packages/shared/src/offline/OfflineProvider.jsx` | `reauthRequired`, toast on `forbidden`, resume after login |
| `packages/shared/src/offline/hooks/useOfflineQueue.js` | Route flush through provider flush only |

---

### Task 1: Outbox error classifiers + flush 401/403

**Files:**
- Create: `packages/shared/src/offline/outbox/errors.js`
- Create: `packages/shared/src/offline/outbox/errors.selfcheck.mjs`
- Modify: `packages/shared/src/offline/outbox/processor.js`
- Modify: `packages/shared/src/offline/outbox/outbox.selfcheck.mjs`

**Interfaces:**
- Consumes: existing `flushOutbox(db, { userId, apiRequest, handlers, sleep })`
- Produces:
  - `isAuthExpired(err) → boolean` (`err?.status === 401`)
  - `isForbidden(err) → boolean` (`err?.status === 403`)
  - `isClientError(err) → boolean` (`400 ≤ status < 500` and not 401/403)
  - `flushOutbox` → `{ flushed, failed, needsReview, authExpired, forbidden }`

- [ ] **Step 1: Write failing classifiers selfcheck**

Create `errors.selfcheck.mjs`:

```js
import assert from "node:assert/strict";
import { isAuthExpired, isForbidden, isClientError } from "./errors.js";

assert.equal(isAuthExpired({ status: 401 }), true);
assert.equal(isForbidden({ status: 403 }), true);
assert.equal(isClientError({ status: 401 }), false);
assert.equal(isClientError({ status: 403 }), false);
assert.equal(isClientError({ status: 422 }), true);
assert.equal(isClientError({ status: 503 }), false);
assert.equal(isClientError({}), false);

console.log("outbox errors: ok");
```

- [ ] **Step 2: Run selfcheck — expect FAIL (module missing)**

Run: `node packages/shared/src/offline/outbox/errors.selfcheck.mjs`  
Expected: FAIL — cannot find module `./errors.js`

- [ ] **Step 3: Implement `errors.js`**

```js
export function isAuthExpired(err) {
  return err?.status === 401;
}

export function isForbidden(err) {
  return err?.status === 403;
}

export function isClientError(err) {
  const status = err?.status;
  if (!(status >= 400 && status < 500)) return false;
  if (status === 401 || status === 403) return false;
  return true;
}
```

- [ ] **Step 4: Re-run classifiers selfcheck — expect PASS**

Run: `node packages/shared/src/offline/outbox/errors.selfcheck.mjs`  
Expected: `outbox errors: ok`

- [ ] **Step 5: Extend `outbox.selfcheck.mjs` with 401 bail + 403 continue (failing first)**

Append after existing asserts (keep prior cases). Use the same `createMockDb` / `enqueueOutboxItem` pattern already in the file:

```js
// --- 401 bail ---
const db401 = createMockDb();
let calls401 = 0;
await enqueueOutboxItem(db401, {
  userId: 1,
  operation: OP_CREATE_ORDER,
  payload: { url: "/a", method: "post", body: {} },
});
await enqueueOutboxItem(db401, {
  userId: 1,
  operation: OP_CREATE_ORDER,
  payload: { url: "/b", method: "post", body: {} },
});
const r401 = await flushOutbox(db401, {
  userId: 1,
  sleep: async () => {},
  apiRequest: async () => {
    calls401 += 1;
    throw { status: 401, data: { message: "unauthorized" } };
  },
});
assert.equal(r401.authExpired, true);
assert.equal(r401.flushed, 0);
assert.equal(r401.forbidden, 0);
assert.equal(calls401, 1);
const pending401 = [...db401._rows.values()].filter((r) => r.status === "pending");
assert.equal(pending401.length, 2);

// --- 403 continue ---
const db403 = createMockDb();
let urls403 = [];
await enqueueOutboxItem(db403, {
  userId: 1,
  operation: OP_CREATE_ORDER,
  payload: { url: "/deny", method: "post", body: {} },
});
await enqueueOutboxItem(db403, {
  userId: 1,
  operation: OP_CREATE_ORDER,
  payload: { url: "/ok", method: "post", body: {} },
});
const r403 = await flushOutbox(db403, {
  userId: 1,
  sleep: async () => {},
  apiRequest: async (opts) => {
    urls403.push(opts.url);
    if (opts.url === "/deny") {
      throw { status: 403, data: { message: "nope" } };
    }
  },
});
assert.equal(r403.authExpired, false);
assert.equal(r403.forbidden, 1);
assert.equal(r403.failed, 1);
assert.equal(r403.flushed, 1);
assert.deepEqual(urls403, ["/deny", "/ok"]);
const failed403 = [...db403._rows.values()].find((r) => r.payload?.url === "/deny");
assert.equal(failed403?.status, "failed");
assert.match(String(failed403?.lastError), /nope|không có quyền/i);
```

- [ ] **Step 6: Run outbox selfcheck — expect FAIL on `authExpired` undefined**

Run: `node packages/shared/src/offline/outbox/outbox.selfcheck.mjs`  
Expected: FAIL (`authExpired` undefined / wrong call count)

- [ ] **Step 7: Implement processor changes**

In `processor.js`:

1. Import classifiers from `./errors.js`; remove local `isClientError`.
2. Initialize `let authExpired = false; let forbidden = 0;`
3. Early return when `userId == null || db == null`:

```js
return { flushed: 0, failed: 0, needsReview: 0, authExpired: false, forbidden: 0 };
```

4. In `catch (err)` — handle **before** create-like / other branches (applies to all ops):

```js
} catch (err) {
  if (isAuthExpired(err)) {
    await db.table("outbox").put({
      ...item,
      status: "pending",
      lastError: String(err?.data?.message ?? err?.message ?? "AUTH_EXPIRED"),
      updatedAt: nowIso(),
    });
    authExpired = true;
    break;
  }
  if (isForbidden(err)) {
    await db.table("outbox").put({
      ...item,
      status: "failed",
      lastError: String(
        err?.data?.message ?? err?.message ?? "Bạn không có quyền thực hiện thao tác này",
      ),
      updatedAt: nowIso(),
    });
    failed += 1;
    forbidden += 1;
    continue;
  }
  if (isAutoRetryOperation(item.operation)) {
    // existing isClientError / retry branches unchanged
  } else {
    // existing non-auto-retry failed branch
  }
}
```

5. Final return: `{ flushed, failed, needsReview, authExpired, forbidden }`.

- [ ] **Step 8: Re-run outbox selfcheck — expect PASS**

Run: `node packages/shared/src/offline/outbox/outbox.selfcheck.mjs`  
Expected: `offline outbox: ok`

- [ ] **Step 9: Commit (only if user asked)**

```bash
git add packages/shared/src/offline/outbox/errors.js \
  packages/shared/src/offline/outbox/errors.selfcheck.mjs \
  packages/shared/src/offline/outbox/processor.js \
  packages/shared/src/offline/outbox/outbox.selfcheck.mjs
git commit -m "feat(offline): classify outbox 401/403 and bail on AUTH_EXPIRED"
```

---

### Task 2: `verifySessionOrRefresh`

**Files:**
- Create: `packages/shared/src/offline/auth/verifySessionOrRefresh.js`
- Create: `packages/shared/src/offline/auth/verifySessionOrRefresh.selfcheck.mjs`

**Interfaces:**
- Consumes: `apiRequest({ url, method, data? })`; optional `setAuthState` + `mapPermissionsFromUser`
- Produces:
  - `verifySessionOrRefresh({ apiRequest, setAuthState?, mapPermissionsFromUser? }) → Promise<{ ok: true, user } | { ok: false, reason: 'AUTH_EXPIRED' }>`

- [ ] **Step 1: Write failing selfcheck**

```js
import assert from "node:assert/strict";
import { verifySessionOrRefresh } from "./verifySessionOrRefresh.js";

const user = { id: 1, permissions: [] };

{
  const calls = [];
  const r = await verifySessionOrRefresh({
    apiRequest: async (opts) => {
      calls.push(opts.url);
      return user;
    },
    setAuthState: () => {},
    mapPermissionsFromUser: () => [],
  });
  assert.equal(r.ok, true);
  assert.equal(r.user.id, 1);
  assert.deepEqual(calls, ["/auth/current-user"]);
}

{
  const calls = [];
  let n = 0;
  const r = await verifySessionOrRefresh({
    apiRequest: async (opts) => {
      calls.push(`${opts.method}:${opts.url}`);
      n += 1;
      if (opts.url === "/auth/current-user" && n === 1) {
        throw { status: 401 };
      }
      if (opts.url === "/auth/refresh-token") return {};
      return user;
    },
    setAuthState: () => {},
    mapPermissionsFromUser: () => [],
  });
  assert.equal(r.ok, true);
  assert.ok(calls.includes("post:/auth/refresh-token"));
}

{
  const r = await verifySessionOrRefresh({
    apiRequest: async (opts) => {
      if (opts.url === "/auth/current-user") throw { status: 401 };
      throw { status: 401 };
    },
    setAuthState: () => {},
    mapPermissionsFromUser: () => [],
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "AUTH_EXPIRED");
}

console.log("verifySessionOrRefresh: ok");
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

Run: `node packages/shared/src/offline/auth/verifySessionOrRefresh.selfcheck.mjs`  
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

```js
export async function verifySessionOrRefresh({
  apiRequest,
  setAuthState,
  mapPermissionsFromUser,
} = {}) {
  async function tryCurrentUser() {
    return apiRequest({ url: "/auth/current-user", method: "get" });
  }

  let user;
  try {
    user = await tryCurrentUser();
  } catch (err) {
    if (err?.status !== 401) {
      return { ok: false, reason: "AUTH_EXPIRED" };
    }
    try {
      await apiRequest({ url: "/auth/refresh-token", method: "post", data: {} });
      user = await tryCurrentUser();
    } catch {
      return { ok: false, reason: "AUTH_EXPIRED" };
    }
  }

  if (user == null) {
    return { ok: false, reason: "AUTH_EXPIRED" };
  }

  if (typeof setAuthState === "function") {
    const permissions =
      typeof mapPermissionsFromUser === "function"
        ? mapPermissionsFromUser(user)
        : undefined;
    setAuthState(permissions != null ? { user, permissions } : { user });
  }

  return { ok: true, user };
}
```

- [ ] **Step 4: Run selfcheck — expect PASS**

Run: `node packages/shared/src/offline/auth/verifySessionOrRefresh.selfcheck.mjs`  
Expected: `verifySessionOrRefresh: ok`

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add packages/shared/src/offline/auth/verifySessionOrRefresh.js \
  packages/shared/src/offline/auth/verifySessionOrRefresh.selfcheck.mjs
git commit -m "feat(offline): add verifySessionOrRefresh helper"
```

---

### Task 3: Controller proactive verify

**Files:**
- Modify: `packages/shared/src/offline/sync/OfflineSyncController.js`
- Modify: `packages/shared/src/offline/sync/OfflineSyncController.selfcheck.mjs`

**Interfaces:**
- Consumes: `verifySessionOrRefresh` (injectable as `verifySessionOrRefreshFn`)
- Produces: `flush()` always returns full shape including `authExpired` / `forbidden`; skips processor when verify fails

- [ ] **Step 1: Extend selfcheck — verify fail short-circuits**

```js
let flushCalls = 0;
const ctrlAuth = createOfflineSyncController({
  db: {},
  userId: 1,
  apiRequest: async () => ({}),
  getNetworkOnlineFn: () => true,
  subscribeNetworkStatusFn: () => () => {},
  verifySessionOrRefreshFn: async () => ({ ok: false, reason: "AUTH_EXPIRED" }),
  _flushOutboxForTest: async () => {
    flushCalls += 1;
    return { flushed: 9, failed: 0, needsReview: 0, authExpired: false, forbidden: 0 };
  },
});
ctrlAuth.start();
const denied = await ctrlAuth.flush();
assert.equal(denied.authExpired, true);
assert.equal(denied.flushed, 0);
assert.equal(flushCalls, 0);
ctrlAuth.stop();
```

Update the original `_flushOutboxForTest` return to include `authExpired: false, forbidden: 0`.

- [ ] **Step 2: Run — expect FAIL (`verifySessionOrRefreshFn` ignored)**

Run: `node packages/shared/src/offline/sync/OfflineSyncController.selfcheck.mjs`  
Expected: FAIL

- [ ] **Step 3: Implement controller changes**

```js
import { verifySessionOrRefresh as defaultVerify } from "../auth/verifySessionOrRefresh.js";

const EMPTY = {
  flushed: 0,
  failed: 0,
  needsReview: 0,
  authExpired: false,
  forbidden: 0,
};

export function createOfflineSyncController({
  db,
  userId,
  apiRequest,
  getHandlers,
  flushOutboxFn = flushOutbox,
  _flushOutboxForTest,
  getNetworkOnlineFn = getNetworkOnline,
  subscribeNetworkStatusFn = subscribeNetworkStatus,
  verifySessionOrRefreshFn = defaultVerify,
}) {
  const flushOutboxImpl = _flushOutboxForTest ?? flushOutboxFn;
  // ... running / inFlight / unsub as today ...

  function flush() {
    if (!running || db == null || userId == null) {
      return Promise.resolve({ ...EMPTY });
    }
    if (!getNetworkOnlineFn()) {
      return Promise.resolve({ ...EMPTY });
    }
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const session = await verifySessionOrRefreshFn({ apiRequest });
        if (!session?.ok) {
          return { ...EMPTY, authExpired: true };
        }
        return await flushOutboxImpl(db, {
          userId,
          apiRequest,
          handlers: getHandlers?.() ?? {},
        });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  // start / stop unchanged
  return { start, stop, flush };
}
```

Production `OfflineProvider` (Task 6) injects auth-store wiring into `verifySessionOrRefreshFn`. Controller default without `setAuthState` is fine for Node selfchecks.

- [ ] **Step 4: Run selfcheck — expect PASS**

Run: `node packages/shared/src/offline/sync/OfflineSyncController.selfcheck.mjs`  
Expected: `OfflineSyncController: ok`

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add packages/shared/src/offline/sync/OfflineSyncController.js \
  packages/shared/src/offline/sync/OfflineSyncController.selfcheck.mjs
git commit -m "feat(offline): verify session before outbox flush"
```

---

### Task 4: `runReconnectSync` AUTH_EXPIRED branch

**Files:**
- Modify: `packages/shared/src/offline/runReconnectSync.js`
- Modify: `packages/shared/src/offline/runReconnectSync.selfcheck.mjs`

**Interfaces:**
- Consumes: `flushOutbox()` → may include `authExpired`
- Produces: throws `Error` with `message === 'AUTH_EXPIRED'` and `code === 'AUTH_EXPIRED'` when auth expired; does **not** run invalidate/refetch/prefetch; does **not** use partial-flush message

- [ ] **Step 1: Add failing selfcheck case**

```js
let authThrown = false;
let invalidateAfterAuth = 0;
try {
  await runReconnectSync({
    flushOutbox: async () => ({
      flushed: 0,
      failed: 0,
      needsReview: 0,
      authExpired: true,
      forbidden: 0,
    }),
    invalidate: () => {
      invalidateAfterAuth += 1;
    },
    refetchActive: async () => {},
    prefetchBoot: async () => {},
  });
} catch (e) {
  authThrown = true;
  assert.equal(e.message, "AUTH_EXPIRED");
  assert.equal(e.code, "AUTH_EXPIRED");
}
assert.equal(authThrown, true);
assert.equal(invalidateAfterAuth, 0);
```

- [ ] **Step 2: Run — expect FAIL**

Run: `node packages/shared/src/offline/runReconnectSync.selfcheck.mjs`  
Expected: FAIL

- [ ] **Step 3: Implement**

```js
const OUTBOX_PARTIAL_FLUSH_MSG =
  "Không gửi hết thao tác lên máy chủ. Kiểm tra mạng và thử lại.";

export async function runReconnectSync({
  flushOutbox,
  invalidate,
  refetchActive,
  prefetchBoot,
}) {
  const flushResult = await flushOutbox();
  if (flushResult?.authExpired) {
    const err = new Error("AUTH_EXPIRED");
    err.code = "AUTH_EXPIRED";
    throw err;
  }
  if (flushResult?.failed > 0) {
    throw new Error(OUTBOX_PARTIAL_FLUSH_MSG);
  }
  invalidate();
  await refetchActive();
  await prefetchBoot();
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `node packages/shared/src/offline/runReconnectSync.selfcheck.mjs`  
Expected: `runReconnectSync: ok`

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add packages/shared/src/offline/runReconnectSync.js \
  packages/shared/src/offline/runReconnectSync.selfcheck.mjs
git commit -m "feat(offline): surface AUTH_EXPIRED from reconnect sync"
```

---

### Task 5: `ReauthOverlay` UI

**Files:**
- Create: `packages/shared/src/offline/ui/ReauthOverlay.jsx`
- Create: `packages/shared/src/offline/ui/ReauthOverlay.contract.selfcheck.mjs`

**Interfaces:**
- Consumes: `useLoginMutation`, `loginSchema`, `Button`, react-hook-form + zodResolver
- Produces: `<ReauthOverlay onSuccess={() => void | Promise<void>} />`

- [ ] **Step 1: Write contract selfcheck**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, "ReauthOverlay.jsx"), "utf8");

assert.match(src, /Phiên hết hạn, đăng nhập lại/);
assert.match(src, /useLoginMutation/);
assert.match(src, /loginSchema/);
assert.match(src, /onSuccess/);
assert.doesNotMatch(src, /google\/login/i);

console.log("ReauthOverlay contract: ok");
```

- [ ] **Step 2: Run — expect FAIL (file missing)**

Run: `node packages/shared/src/offline/ui/ReauthOverlay.contract.selfcheck.mjs`  
Expected: FAIL — ENOENT

- [ ] **Step 3: Implement `ReauthOverlay.jsx`**

Mirror identifier + password fields from `LoginPage.jsx` (no Google authorize flow). Required pieces:

- Headline exact: `Phiên hết hạn, đăng nhập lại`
- `useForm` + `zodResolver(loginSchema)` + `useLoginMutation`
- On success: `notifySuccess`, then `await onSuccess?.()`
- Optional footer link to `/login` for Google (must not call Google authorize APIs)
- `z-[70]` overlay, `role="alertdialog"`

Copy input markup patterns from `packages/shared/src/pages/login/LoginPage.jsx` for `identifier` / `password` only.

- [ ] **Step 4: Run contract selfcheck — expect PASS**

Run: `node packages/shared/src/offline/ui/ReauthOverlay.contract.selfcheck.mjs`  
Expected: `ReauthOverlay contract: ok`

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add packages/shared/src/offline/ui/ReauthOverlay.jsx \
  packages/shared/src/offline/ui/ReauthOverlay.contract.selfcheck.mjs
git commit -m "feat(offline): add ReauthOverlay for expired session"
```

---

### Task 6: Wire `OfflineProvider` + queue flush path

**Files:**
- Modify: `packages/shared/src/offline/OfflineProvider.jsx`
- Modify: `packages/shared/src/offline/hooks/useOfflineQueue.js`
- Create: `packages/shared/src/offline/OfflineProvider.reauth.contract.selfcheck.mjs`

**Interfaces:**
- Consumes: Tasks 1–5 APIs
- Produces:
  - `reauthRequired` state + `ReauthOverlay`
  - On `AUTH_EXPIRED` from `runGate`: set `reauthRequired`, keep `reconnectBlocking`, do **not** set `reconnectError`
  - On overlay success: verify → clear `reauthRequired` → resume `runGate` (if saw offline) or `flushOutboxFn`
  - After provider flush: if `forbidden > 0`, toast once with exact 403 copy
  - `useOfflineQueue` uses provider flush only (no direct `flushOutbox` bypass)

- [ ] **Step 1: Write Provider contract selfcheck**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, "OfflineProvider.jsx"), "utf8");

assert.match(src, /ReauthOverlay/);
assert.match(src, /reauthRequired/);
assert.match(src, /AUTH_EXPIRED/);
assert.match(src, /Bạn không có quyền thực hiện thao tác này/);
assert.match(src, /verifySessionOrRefresh/);

console.log("OfflineProvider reauth contract: ok");
```

- [ ] **Step 2: Run — expect FAIL (missing strings)**

Run: `node packages/shared/src/offline/OfflineProvider.reauth.contract.selfcheck.mjs`  
Expected: FAIL

- [ ] **Step 3: Update empty flush defaults in Provider**

Every `{ flushed: 0, failed: 0, needsReview: 0 }` → add `authExpired: false, forbidden: 0`.

- [ ] **Step 4: Wire controller + flush wrapper**

```js
import { mapPermissionsFromUser, useAuthStore } from "@/features/auth/model/authStore";
import { verifySessionOrRefresh } from "./auth/verifySessionOrRefresh.js";
import { notifyWarning } from "@/services/notify";
import { ReauthOverlay } from "./ui/ReauthOverlay.jsx";

// state
const [reauthRequired, setReauthRequired] = useState(false);
// clear reauthRequired alongside reconnect flags when userId changes

const controller = createOfflineSyncController({
  db,
  userId,
  apiRequest,
  getHandlers: () => lttpHandlers,
  verifySessionOrRefreshFn: (opts) =>
    verifySessionOrRefresh({
      ...opts,
      setAuthState: (p) => useAuthStore.getState().setAuthState(p),
      mapPermissionsFromUser,
    }),
});

setFlushOutboxFn(() => async () => {
  const result = await controller.flush();
  if (result.authExpired) {
    setReauthRequired(true);
  }
  if (result.forbidden > 0) {
    notifyWarning("Bạn không có quyền thực hiện thao tác này");
  }
  if (result.flushed > 0) {
    invalidateLttpData(qc);
  }
  return result;
});
```

- [ ] **Step 5: Handle AUTH_EXPIRED in `runGate` catch**

```js
} catch (e) {
  if (id !== runIdRef.current) return;
  if (e?.code === "AUTH_EXPIRED" || e?.message === "AUTH_EXPIRED") {
    setReauthRequired(true);
    return; // keep reconnectBlocking; no reconnectError
  }
  setReconnectError(
    e?.message || "Không đồng bộ được. Kiểm tra mạng và thử lại.",
  );
}
```

- [ ] **Step 6: Render overlay + success handler**

```js
async function handleReauthSuccess() {
  const session = await verifySessionOrRefresh({
    apiRequest,
    setAuthState: (p) => useAuthStore.getState().setAuthState(p),
    mapPermissionsFromUser,
  });
  if (!session.ok) return;
  setReauthRequired(false);
  if (sawOfflineRef.current) {
    void runGate();
  } else {
    void flushOutboxFn();
  }
}
```

JSX preference: when `reauthRequired`, show `ReauthOverlay` (z-70); hide reconnect spinner while reauth is up (`reconnectBlocking && !reauthRequired` for `ReconnectSyncOverlay`). Keep `pointer-events-none` on children while `reconnectBlocking || reauthRequired`.

- [ ] **Step 7: Fix `useOfflineQueue.js`**

Replace direct `flushOutbox(db, …)` sync paths with `flushFromProvider()` so verify + authExpired + forbidden toast always apply. If provider flush is the noop default, keep a guarded fallback only when `db` ready — prefer provider once controller is mounted.

- [ ] **Step 8: Run all related selfchecks**

```bash
node packages/shared/src/offline/outbox/errors.selfcheck.mjs
node packages/shared/src/offline/outbox/outbox.selfcheck.mjs
node packages/shared/src/offline/auth/verifySessionOrRefresh.selfcheck.mjs
node packages/shared/src/offline/sync/OfflineSyncController.selfcheck.mjs
node packages/shared/src/offline/runReconnectSync.selfcheck.mjs
node packages/shared/src/offline/ui/ReauthOverlay.contract.selfcheck.mjs
node packages/shared/src/offline/OfflineProvider.reauth.contract.selfcheck.mjs
```

Expected: all print `…: ok`

- [ ] **Step 9: Manual smoke (browser)**

1. Expire session with pending outbox → `ReauthOverlay`; items stay `pending`.
2. Login same user → overlay closes; flush/reconnect resumes.
3. One 403 + one OK op → first `failed`, second synced; one 403 toast; no reauth modal.

- [ ] **Step 10: Commit (only if user asked)**

```bash
git add packages/shared/src/offline/OfflineProvider.jsx \
  packages/shared/src/offline/hooks/useOfflineQueue.js \
  packages/shared/src/offline/OfflineProvider.reauth.contract.selfcheck.mjs
git commit -m "feat(offline): reauth overlay and forbidden toast on flush"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Classify 401/403 out of `isClientError` | 1 |
| Bail loop on 401; item `pending` | 1 |
| 403 fail + continue; `forbidden` count | 1 |
| Return `{ authExpired, forbidden }` | 1 |
| `verifySessionOrRefresh` | 2 |
| Proactive verify in controller | 3 |
| Reactive 401 in loop | 1 |
| `runReconnectSync` AUTH_EXPIRED ≠ partial flush | 4 |
| Reauth modal + copy | 5 |
| Resume after login | 6 |
| 403 toast once | 6 |
| No Google in modal | 5 |
| No new Dexie status / no wipe on AUTH_EXPIRED | 1, 6 |
