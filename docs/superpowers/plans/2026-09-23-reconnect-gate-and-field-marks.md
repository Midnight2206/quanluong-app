# Reconnect Gate + Persistent Field Marks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accurately detect real online (API probe), block the private UI with a sync overlay until outbox flush + server refetch finish, keep local drafts, and keep local-unsaved field warnings across page remounts.

**Architecture:** Extend `networkStatus` with probe-gated `online`. Orchestrate a sequential reconnect pipeline inside `OfflineProvider` (flush → invalidate → refetch active → prefetchBoot) behind `ReconnectSyncOverlay`. Persist field-mark keys in a module registry and reapply after route/hydrate instead of clearing on pathname change.

**Tech Stack:** Existing `apiRequest`, React Query (`QueryClient`), Dexie offline module, assert-based `*.selfcheck.mjs`, React client components in `packages/shared`.

**Spec:** `docs/superpowers/specs/2026-09-23-reconnect-gate-and-field-marks-design.md`

## Global Constraints

- Approach **A** only — gate lives in `OfflineProvider`.
- Keep IDB drafts / pageUi on reconnect (do not wipe).
- Field marks clear only on save/clear-draft/logout wipe — never on route change.
- Overlay copy (exact): `Đang đồng bộ dữ liệu từ máy chủ (bạn vừa làm việc offline)…`
- Tip copy (exact): `Dữ liệu chưa được lưu vào máy chủ. Đây chỉ là dữ liệu tạm trên máy.`
- Probe: `GET /auth/current-user` via `apiRequest`.
- Prefer `*.selfcheck.mjs` over new test frameworks.
- Do not commit unless the user asks.
- Skip login/password/modal/chat (`data-no-persist` / password types).

## File map

| Path | Responsibility |
|------|----------------|
| `packages/shared/src/offline/sync/networkStatus.js` | Browser hint + probed app-level online |
| `packages/shared/src/offline/sync/probeReachability.js` | Probe helper + backoff schedule |
| `packages/shared/src/offline/sync/OfflineSyncController.js` | Share in-flight flush promise |
| `packages/shared/src/offline/OfflineProvider.jsx` | Reconnect pipeline + context flags |
| `packages/shared/src/offline/ui/ReconnectSyncOverlay.jsx` | Blocking loading / error / retry |
| `packages/shared/src/offline/runReconnectSync.js` | Pure async pipeline (testable) |
| `packages/shared/src/lib/clientPersist/localUnsavedFieldRegistry.js` | Persist which fields stay marked |
| `packages/shared/src/hooks/useLocalUnsavedFieldMarks.js` | Mark/reapply; no clear-on-route |
| `packages/shared/src/hooks/useDraftPersist.js` | Dispatch reapply after hydrate |

---

### Task 1: Probe reachability + probed networkStatus

**Files:**
- Create: `packages/shared/src/offline/sync/probeReachability.js`
- Create: `packages/shared/src/offline/sync/probeReachability.selfcheck.mjs`
- Modify: `packages/shared/src/offline/sync/networkStatus.js`
- Create: `packages/shared/src/offline/sync/networkStatus.selfcheck.mjs`
- Modify: `packages/shared/src/offline/hooks/useNetworkStatus.js` (no API change — still `{ online }`, but `online` is probed)

**Interfaces:**
- Consumes: injectable `probeFn` returning `Promise<boolean>`
- Produces:
  - `PROBE_BACKOFF_MS = [2000, 5000, 10000, 30000]`
  - `createReachabilityController({ probe, subscribeBrowser }) → { getOnline, subscribe, start, stop, _test }`
  - `getNetworkOnline()` / `subscribeNetworkStatus(cb)` remain the public API (probed)

- [ ] **Step 1: Write failing selfcheck for backoff + probe gate**

Create `probeReachability.selfcheck.mjs`:

```js
import assert from "node:assert/strict";
import {
  PROBE_BACKOFF_MS,
  createReachabilityController,
} from "./probeReachability.js";

assert.deepEqual(PROBE_BACKOFF_MS, [2000, 5000, 10000, 30000]);

let browserOnline = false;
const browserListeners = new Set();
function emitBrowser(next) {
  browserOnline = next;
  for (const cb of browserListeners) cb(next);
}

const probes = [];
const ctrl = createReachabilityController({
  getBrowserOnline: () => browserOnline,
  subscribeBrowser: (cb) => {
    browserListeners.add(cb);
    cb(browserOnline);
    return () => browserListeners.delete(cb);
  },
  probe: async () => {
    const ok = probes.shift() ?? false;
    return ok;
  },
  now: () => 0,
  schedule: (fn) => {
    // sync-run scheduled retries in test via returned handles
    const h = { fn, cancelled: false };
    queueMicrotask(() => {
      if (!h.cancelled) h.fn();
    });
    return () => {
      h.cancelled = true;
    };
  },
});

const seen = [];
ctrl.subscribe((v) => seen.push(v));
ctrl.start();
assert.equal(ctrl.getOnline(), false);

probes.push(false);
emitBrowser(true);
await new Promise((r) => setTimeout(r, 20));
assert.equal(ctrl.getOnline(), false, "probe fail → still offline");

probes.push(true);
emitBrowser(false);
emitBrowser(true);
await new Promise((r) => setTimeout(r, 20));
assert.equal(ctrl.getOnline(), true, "probe ok → online");

emitBrowser(false);
assert.equal(ctrl.getOnline(), false, "browser offline → immediate offline");

console.log("probeReachability: ok");
```

- [ ] **Step 2: Run selfcheck — expect FAIL (module missing)**

Run: `node packages/shared/src/offline/sync/probeReachability.selfcheck.mjs`  
Expected: FAIL `Cannot find module`

- [ ] **Step 3: Implement `probeReachability.js`**

```js
export const PROBE_BACKOFF_MS = [2000, 5000, 10000, 30000];

/**
 * @param {{
 *   getBrowserOnline: () => boolean;
 *   subscribeBrowser: (cb: (online: boolean) => void) => () => void;
 *   probe: () => Promise<boolean>;
 *   schedule?: (fn: () => void, ms: number) => () => void;
 * }} opts
 */
export function createReachabilityController({
  getBrowserOnline,
  subscribeBrowser,
  probe,
  schedule = (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
}) {
  /** @type {Set<(online: boolean) => void>} */
  const listeners = new Set();
  let appOnline = false;
  let probing = false;
  let retryIndex = 0;
  /** @type {(() => void) | null} */
  let cancelRetry = null;
  /** @type {(() => void) | null} */
  let unsubBrowser = null;
  let started = false;

  function emit() {
    for (const cb of listeners) cb(appOnline);
  }

  function setAppOnline(next) {
    if (next === appOnline) return;
    appOnline = next;
    emit();
  }

  function clearRetry() {
    cancelRetry?.();
    cancelRetry = null;
  }

  async function runProbe() {
    if (probing) return;
    if (!getBrowserOnline()) {
      clearRetry();
      setAppOnline(false);
      return;
    }
    probing = true;
    try {
      const ok = await probe();
      if (!getBrowserOnline()) {
        setAppOnline(false);
        return;
      }
      if (ok) {
        retryIndex = 0;
        clearRetry();
        setAppOnline(true);
        return;
      }
      setAppOnline(false);
      const wait = PROBE_BACKOFF_MS[Math.min(retryIndex, PROBE_BACKOFF_MS.length - 1)];
      retryIndex += 1;
      clearRetry();
      cancelRetry = schedule(() => {
        void runProbe();
      }, wait);
    } catch {
      setAppOnline(false);
      const wait = PROBE_BACKOFF_MS[Math.min(retryIndex, PROBE_BACKOFF_MS.length - 1)];
      retryIndex += 1;
      clearRetry();
      cancelRetry = schedule(() => {
        void runProbe();
      }, wait);
    } finally {
      probing = false;
    }
  }

  function onBrowser(online) {
    if (!online) {
      clearRetry();
      retryIndex = 0;
      setAppOnline(false);
      return;
    }
    void runProbe();
  }

  return {
    getOnline: () => appOnline,
    subscribe(cb) {
      listeners.add(cb);
      cb(appOnline);
      return () => listeners.delete(cb);
    },
    start() {
      if (started) return;
      started = true;
      unsubBrowser = subscribeBrowser(onBrowser);
      if (getBrowserOnline()) void runProbe();
    },
    stop() {
      started = false;
      clearRetry();
      unsubBrowser?.();
      unsubBrowser = null;
      setAppOnline(false);
    },
  };
}
```

- [ ] **Step 4: Wire `networkStatus.js` to use controller in browser**

Keep a thin browser subscription (raw `navigator.onLine`) and default probe:

```js
import { createReachabilityController } from "./probeReachability.js";

function wireBrowser() {
  // existing window online/offline listeners → getBrowserOnline / subscribeBrowser
}

let probeImpl = async () => {
  // default: if no probe injected, treat navigator.onLine as truth (SSR/tests)
  return typeof navigator !== "undefined" ? navigator.onLine : true;
};

/** @param {() => Promise<boolean>} fn */
export function setNetworkProbeForTest(fn) {
  probeImpl = fn;
}

const controller = createReachabilityController({
  getBrowserOnline: () => /* raw navigator */,
  subscribeBrowser: (cb) => { /* wire + notify */ },
  probe: () => probeImpl(),
});

// getNetworkOnline / subscribeNetworkStatus delegate to controller
// On first subscribe in browser: controller.start()
// OfflineProvider will call setNetworkProbe(() => apiRequest(...).then(() => true).catch(() => false))
```

Also export `setNetworkProbe(fn)` (production) used by `OfflineProvider` once `apiRequest` is available.

- [ ] **Step 5: Run selfchecks — PASS**

Run:
```bash
node packages/shared/src/offline/sync/probeReachability.selfcheck.mjs
node packages/shared/src/offline/sync/networkStatus.selfcheck.mjs
```
Expected: both print `ok`

- [ ] **Step 6: Commit only if user asks**

---

### Task 2: Share in-flight flush promise on OfflineSyncController

**Files:**
- Modify: `packages/shared/src/offline/sync/OfflineSyncController.js`
- Create: `packages/shared/src/offline/sync/OfflineSyncController.selfcheck.mjs`

**Interfaces:**
- Consumes: existing `flushOutbox`
- Produces: `flush()` always returns the same in-flight `Promise` while flushing; second caller awaits real result (not `{flushed:0}`)

- [ ] **Step 1: Write failing selfcheck**

```js
import assert from "node:assert/strict";
import { createOfflineSyncController } from "./OfflineSyncController.js";

let calls = 0;
let release;
const gate = new Promise((r) => {
  release = r;
});

const fakeDb = {};
const controller = createOfflineSyncController({
  db: fakeDb,
  userId: 1,
  apiRequest: async () => ({}),
  getHandlers: () => ({}),
  // test seam — if not present, selfcheck imports a testable flush inject:
  _flushOutboxForTest: async () => {
    calls += 1;
    await gate;
    return { flushed: 2, failed: 0, needsReview: 0 };
  },
});

// Prefer: export createOfflineSyncController with optional flushOutboxDep
```

Implement with dependency injection:

```js
export function createOfflineSyncController({
  db,
  userId,
  apiRequest,
  getHandlers,
  flushOutboxFn = flushOutbox,
  getNetworkOnlineFn = getNetworkOnline,
  subscribeNetworkStatusFn = subscribeNetworkStatus,
}) {
  let inFlight = null;
  async function flush() {
    if (!running || db == null || userId == null) {
      return { flushed: 0, failed: 0, needsReview: 0 };
    }
    if (!getNetworkOnlineFn()) {
      return { flushed: 0, failed: 0, needsReview: 0 };
    }
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        return await flushOutboxFn(db, {
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
  // start/stop unchanged except use subscribeNetworkStatusFn
  return { start, stop, flush };
}
```

Selfcheck:

```js
controller.start();
const p1 = controller.flush();
const p2 = controller.flush();
assert.equal(p1, p2);
release();
const [a, b] = await Promise.all([p1, p2]);
assert.equal(a.flushed, 2);
assert.equal(b.flushed, 2);
assert.equal(calls, 1);
console.log("OfflineSyncController: ok");
```

- [ ] **Step 2: Run — FAIL then implement — PASS**

Run: `node packages/shared/src/offline/sync/OfflineSyncController.selfcheck.mjs`

- [ ] **Step 3: Commit only if user asks**

---

### Task 3: `runReconnectSync` pure pipeline

**Files:**
- Create: `packages/shared/src/offline/runReconnectSync.js`
- Create: `packages/shared/src/offline/runReconnectSync.selfcheck.mjs`

**Interfaces:**
- Consumes: `flushOutbox()`, `invalidateLttpData(qc)`, `qc.refetchQueries`, `prefetchBoot`
- Produces: `runReconnectSync(deps) → Promise<void>`; throws on failure

- [ ] **Step 1: Write selfcheck**

```js
import assert from "node:assert/strict";
import { runReconnectSync } from "./runReconnectSync.js";

const log = [];
await runReconnectSync({
  flushOutbox: async () => {
    log.push("flush");
    return { flushed: 0, failed: 0, needsReview: 0 };
  },
  invalidate: () => log.push("invalidate"),
  refetchActive: async () => {
    log.push("refetch");
  },
  prefetchBoot: async () => {
    log.push("prefetch");
  },
});
assert.deepEqual(log, ["flush", "invalidate", "refetch", "prefetch"]);

let failed = false;
try {
  await runReconnectSync({
    flushOutbox: async () => {
      throw new Error("boom");
    },
    invalidate: () => {},
    refetchActive: async () => {},
    prefetchBoot: async () => {},
  });
} catch {
  failed = true;
}
assert.equal(failed, true);
console.log("runReconnectSync: ok");
```

- [ ] **Step 2: Implement**

```js
export async function runReconnectSync({
  flushOutbox,
  invalidate,
  refetchActive,
  prefetchBoot,
}) {
  await flushOutbox();
  invalidate();
  await refetchActive();
  await prefetchBoot();
}
```

Note: always `invalidate()` after flush (even if flushed=0), per spec.

- [ ] **Step 3: Run — PASS**

---

### Task 4: ReconnectSyncOverlay + OfflineProvider gate

**Files:**
- Create: `packages/shared/src/offline/ui/ReconnectSyncOverlay.jsx`
- Modify: `packages/shared/src/offline/OfflineProvider.jsx`
- Modify: `packages/shared/src/offline/ui/OfflineChromeOffset.jsx` (optional: also offset when blocking — not required if overlay is full-screen fixed)

**Interfaces:**
- Consumes: `runReconnectSync`, `setNetworkProbe`, `createOfflineSyncController.flush`, `invalidateLttpData`, `prefetchBoot`, `apiRequest`
- Produces: `useOffline()` adds `{ reconnectBlocking: boolean, reconnectError: string | null, retryReconnect: () => void }`

- [ ] **Step 1: Implement overlay UI**

```jsx
"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReconnectSyncOverlay({ error, onRetry }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 print:hidden"
      role="alertdialog"
      aria-modal="true"
      aria-busy={!error}
      aria-label="Đồng bộ dữ liệu"
    >
      <div className="mx-4 max-w-sm rounded-lg border border-border bg-card p-4 text-center shadow-lg">
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" className="mt-3" onClick={onRetry}>
              Thử lại
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm text-foreground">
              Đang đồng bộ dữ liệu từ máy chủ (bạn vừa làm việc offline)…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire OfflineProvider**

Key logic (sketch):

```jsx
const { online } = useNetworkStatus();
const [reconnectBlocking, setReconnectBlocking] = useState(false);
const [reconnectError, setReconnectError] = useState(null);
const sawOfflineRef = useRef(false);
const runIdRef = useRef(0);

useEffect(() => {
  setNetworkProbe(async () => {
    try {
      await apiRequest({ url: "/auth/current-user", method: "get" });
      return true;
    } catch {
      return false;
    }
  });
}, []);

useEffect(() => {
  if (!online) sawOfflineRef.current = true;
}, [online]);

const runGate = useCallback(async () => {
  if (!sawOfflineRef.current) return; // no flash on cold start while online
  if (userId == null || !ready) return;
  const id = ++runIdRef.current;
  setReconnectBlocking(true);
  setReconnectError(null);
  try {
    await runReconnectSync({
      flushOutbox: () => flushOutboxFn(),
      invalidate: () => invalidateLttpData(qc),
      refetchActive: () => qc.refetchQueries({ type: "active" }),
      prefetchBoot: () =>
        db ? prefetchBoot({ db, apiRequest }) : Promise.resolve(),
    });
    if (id === runIdRef.current) {
      setReconnectBlocking(false);
    }
  } catch (e) {
    if (id === runIdRef.current) {
      setReconnectError(
        e?.message || "Không đồng bộ được. Kiểm tra mạng và thử lại.",
      );
    }
  }
}, [userId, ready, db, qc, flushOutboxFn]);

useEffect(() => {
  if (online) void runGate();
}, [online, runGate]);

// Remove fire-and-forget flush/prefetch effects that race the gate;
// gate owns flush+prefetch when transitioning; cold-start online without sawOffline: keep light prefetchBoot once.

return (
  <Ctx.Provider value={{ ..., online, reconnectBlocking, reconnectError, retryReconnect: () => void runGate() }}>
    <OfflineBanner online={online} />
    <OfflineChromeOffset />
    {reconnectBlocking ? (
      <ReconnectSyncOverlay error={reconnectError} onRetry={() => void runGate()} />
    ) : null}
    <div
      aria-busy={reconnectBlocking || undefined}
      className={reconnectBlocking ? "pointer-events-none select-none" : undefined}
    >
      <OfflineConflictDock />
      {children}
    </div>
  </Ctx.Provider>
);
```

Important:
- Delete or narrow the old effects at lines that `void syncRef.current?.flush()` and `void prefetchBoot` on every `online` so they do not race / double-fetch outside the gate. Cold start (never offline): one `prefetchBoot` when ready+db+online is OK without blocking overlay.
- `controller.start()` may still auto-flush on online — that is fine if flush shares inFlight with gate’s `flushOutboxFn`.

- [ ] **Step 3: Manual smoke**

1. DevTools → Offline → banner shows.  
2. Online → overlay copy exact → then dismisses.  
3. While overlay visible, clicks do not hit forms.

- [ ] **Step 4: Commit only if user asks**

---

### Task 5: localUnsavedFieldRegistry + reapply marks

**Files:**
- Create: `packages/shared/src/lib/clientPersist/localUnsavedFieldRegistry.js`
- Create: `packages/shared/src/lib/clientPersist/localUnsavedFieldRegistry.selfcheck.mjs`
- Modify: `packages/shared/src/hooks/useLocalUnsavedFieldMarks.js`
- Modify: `packages/shared/src/hooks/useDraftPersist.js` (dispatch reapply after hydrate)
- Modify: `packages/shared/src/lib/clientPersist/wipeClientPersist.js` (clear registry on wipe)

**Interfaces:**
- Produces:
  - `markLocalUnsavedField(routeKey, fieldKey)`
  - `unmarkLocalUnsavedField(routeKey, fieldKey)`
  - `listLocalUnsavedFields(routeKey) → string[]`
  - `clearLocalUnsavedFieldRegistry()`
  - `clearLocalUnsavedFieldsForRoute(routeKey)`
  - Event: `quanluong:reapply-local-unsaved-marks`
  - `reapplyLocalUnsavedFieldMarks()` exported

- [ ] **Step 1: Registry selfcheck**

```js
import assert from "node:assert/strict";
import {
  clearLocalUnsavedFieldRegistry,
  markLocalUnsavedField,
  unmarkLocalUnsavedField,
  listLocalUnsavedFields,
} from "./localUnsavedFieldRegistry.js";

clearLocalUnsavedFieldRegistry();
markLocalUnsavedField("/lttp", "issueDate");
markLocalUnsavedField("/lttp", "recipientName");
assert.deepEqual(listLocalUnsavedFields("/lttp").sort(), [
  "issueDate",
  "recipientName",
]);
unmarkLocalUnsavedField("/lttp", "issueDate");
assert.deepEqual(listLocalUnsavedFields("/lttp"), ["recipientName"]);
clearLocalUnsavedFieldRegistry();
assert.equal(listLocalUnsavedFields("/lttp").length, 0);
console.log("localUnsavedFieldRegistry: ok");
```

- [ ] **Step 2: Implement registry** (Map `routeKey → Set<fieldKey>`)

- [ ] **Step 3: Update `useLocalUnsavedFieldMarks`**

Changes vs current:
1. On `ensureMark`: `markLocalUnsavedField(pathname, fieldKey)`.
2. On `removeMark`: `unmarkLocalUnsavedField(pathname, fieldKey)`.
3. **Remove** `clearAllMarks` from the `pathname` effect body start.
4. Add `reapply()`:
   - For each key in `listLocalUnsavedFields(pathname)`, find control in `[data-page-scroll-owner]` via `[name=]`, `[id=]`, `[data-persist-key=]`; if markable + has value → `ensureMark`.
5. Listen `quanluong:reapply-local-unsaved-marks` and call `reapply` (rAF twice or `setTimeout(0)` after hydrate).
6. On pathname change: schedule `reapply` only (no clear).
7. `clearLocalUnsavedFieldMarks()`: clear registry + clearAllMarks (unchanged event).

Export:

```js
export function reapplyLocalUnsavedFieldMarks() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("quanluong:reapply-local-unsaved-marks"));
  }
}
```

- [ ] **Step 4: `useDraftPersist` after successful hydrate with record**

After `setDraftState(record)` / `setLoaded(true)` when `record` truthy:

```js
reapplyLocalUnsavedFieldMarks();
```

Import from `useLocalUnsavedFieldMarks.js`.

- [ ] **Step 5: `wipeClientPersist` calls `clearLocalUnsavedFieldRegistry()`**

- [ ] **Step 6: Run selfchecks + manual**

```bash
node packages/shared/src/lib/clientPersist/localUnsavedFieldRegistry.selfcheck.mjs
```

Manual: edit field → blur → warning → navigate away → back → after draft hydrate, warning returns without re-blur.

- [ ] **Step 7: Commit only if user asks**

---

### Task 6: Integration smoke checklist (no new framework)

**Files:**
- Modify (optional note only): `docs/superpowers/specs/2026-09-23-app-wide-draft-persist-smoke.md` — add reconnect + mark persistence bullets

- [ ] **Step 1: Run all related selfchecks**

```bash
node packages/shared/src/offline/sync/probeReachability.selfcheck.mjs
node packages/shared/src/offline/sync/networkStatus.selfcheck.mjs
node packages/shared/src/offline/sync/OfflineSyncController.selfcheck.mjs
node packages/shared/src/offline/runReconnectSync.selfcheck.mjs
node packages/shared/src/lib/clientPersist/localUnsavedFieldRegistry.selfcheck.mjs
node packages/shared/src/hooks/useDraftPersist.behavior.selfcheck.mjs
```

Expected: all print `ok`.

- [ ] **Step 2: Browser checklist (Acceptance from spec §6)**

1. Offline → edit → blur mark → change page → return → marks still visible after hydrate.  
2. Online again → overlay blocks → then usable.  
3. Kill API (or block `/auth/current-user`) while Wi‑Fi on → stay offline / gate error + Thử lại.  
4. After successful gate, active LTTP queries match server (Network tab shows refetch).  
5. Discard draft / successful submit → marks gone.  
6. Password fields never marked.

- [ ] **Step 3: Commit only if user asks**

---

## Self-review (plan vs spec)

| Spec section | Task |
|--------------|------|
| §1 Probe online | Task 1 |
| §2 Reconnect gate + overlay + no skip | Task 3–4 |
| §3 Flush share + always invalidate | Task 2–3 |
| §4 Keep drafts + persistent marks + reapply | Task 5 |
| §6 Acceptance | Task 6 |
| Cold start no flash | Task 4 `sawOfflineRef` |
| Exact overlay / tip copy | Task 4 / existing marks |
| wipe registry on logout | Task 5 wipeClientPersist |

No TBD/placeholder steps remain. Names consistent: `runReconnectSync`, `reconnectBlocking`, `reapplyLocalUnsavedFieldMarks`, `setNetworkProbe`.
