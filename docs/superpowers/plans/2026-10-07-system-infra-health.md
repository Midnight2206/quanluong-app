# System infra health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmin mở trang Hạ tầng và thấy đĩa máy chủ, kết quả backup đêm 02:15, và 11 container của stack.

**Architecture:** Hàm thuần chấm đĩa, log backup, và state container. Service đọc `/host`, `backup.log`, và Docker socket rồi ghép một JSON. Trang superadmin chỉ hiển thị JSON đó, tải lại mỗi 30 giây.

**Tech Stack:** Express, Node `node:test`, `fs.statfs`, HTTP qua unix socket Docker, React Query, Next app `apps/superadmin`.

## Global Constraints

- Bản này chỉ xem. Không email, không start/stop/restart, không `docker exec`.
- Chỉ superadmin. Middleware giống `/api/system-backup`: `authMiddleware` rồi `superadminMiddleware`. Không thêm mã quyền mới, không sửa `permission-catalog.vi.js`.
- `GET /api/system-infra`.
- Container lấy từ Docker socket gắn vào service `app`. Chỉ `GET /containers/json?all=1` và `GET /containers/{id}/json`. Timeout mỗi request 2 giây. List và inspect chạy song song.
- Đĩa lấy từ mount chỉ đọc `/` của máy chủ tại `/host`. `usedPercent = usedBytes / totalBytes * 100`. `totalBytes <= 0` hoặc không đọc được → `unknown`. `>= 90` → `down`. `>= 80` → `warn`. Còn lại → `ok`.
- Backup đọc `/var/backups/quanluong/backup.log` (`BACKUP_DIR` nếu có). Mốc 02:15 `Asia/Ho_Chi_Minh`. Container đang chạy không làm dòng backup thành `ok`. `status.json` không tham gia.
- Response không chứa env, bản inspect thô, hay log thô.
- `quanluong-app-be-migrate` không có trong bảng.
- 11 container, đúng thứ tự: `quanluong-app-be`, `quanluong-app-be-worker-email`, `quanluong-app-be-worker-media`, `quanluong-app-db`, `quanluong-app-redis`, `quanluong-document-db`, `quanluong-document`, `quanluong-app-qdrant`, `quanluong-backup`, `quanluong-app-ui`, `quanluong-app-ui-superadmin`.
- Socket lỗi → 11 dòng `unknown`, câu «Không đọc được Docker». Đĩa và backup vẫn trả.
- Không tạo lại container `quanluong-backup`.

---

### Task 1: Chấm đĩa và container

**Files:**
- Create: `quanluong-app-be/src/modules/system-infra/system-infra.classify.js`
- Test: `quanluong-app-be/src/modules/system-infra/system-infra.classify.test.js`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `WATCHED_CONTAINERS: string[]` — 11 tên đúng thứ tự ở Global Constraints.
  - `classifyDisk({ totalBytes: number, usedBytes: number })` → `{ status, message, totalBytes, usedBytes, freeBytes, usedPercent }`.
  - `classifyContainer(row | null)` — `row` là `{ status: string, health: string | null }`. Trả `{ status, message }`.

- [ ] **Step 1: Write the failing test**

Tạo `quanluong-app-be/src/modules/system-infra/system-infra.classify.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { classifyContainer, classifyDisk, WATCHED_CONTAINERS } from "./system-infra.classify.js";

test("disk thresholds", () => {
  assert.equal(classifyDisk({ totalBytes: 100, usedBytes: 79 }).status, "ok");
  assert.equal(classifyDisk({ totalBytes: 100, usedBytes: 80 }).status, "warn");
  assert.equal(classifyDisk({ totalBytes: 100, usedBytes: 90 }).status, "down");
  assert.equal(classifyDisk({ totalBytes: 0, usedBytes: 0 }).status, "unknown");
  const row = classifyDisk({ totalBytes: 100, usedBytes: 40 });
  assert.equal(row.freeBytes, 60);
  assert.equal(row.usedPercent, 40);
  assert.match(row.message, /40%/);
});

test("watched container names exclude migrate and keep order", () => {
  assert.deepEqual(WATCHED_CONTAINERS, [
    "quanluong-app-be",
    "quanluong-app-be-worker-email",
    "quanluong-app-be-worker-media",
    "quanluong-app-db",
    "quanluong-app-redis",
    "quanluong-document-db",
    "quanluong-document",
    "quanluong-app-qdrant",
    "quanluong-backup",
    "quanluong-app-ui",
    "quanluong-app-ui-superadmin",
  ]);
});

test("container health labels", () => {
  assert.deepEqual(classifyContainer({ status: "running", health: "healthy" }), {
    status: "ok",
    message: "đang chạy khỏe",
  });
  assert.equal(classifyContainer({ status: "running", health: "unhealthy" }).status, "down");
  assert.equal(classifyContainer({ status: "running", health: "unhealthy" }).message, "lỗi healthcheck");
  assert.equal(classifyContainer({ status: "running", health: "starting" }).status, "warn");
  assert.equal(classifyContainer({ status: "running", health: "starting" }).message, "đang khởi động");
  assert.deepEqual(classifyContainer({ status: "running", health: null }), {
    status: "ok",
    message: "đang chạy",
  });
  assert.deepEqual(classifyContainer({ status: "exited", health: null }), {
    status: "down",
    message: "đã dừng",
  });
  assert.deepEqual(classifyContainer(null), {
    status: "down",
    message: "không thấy container",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quanluong-app-be && node --test src/modules/system-infra/system-infra.classify.test.js`

Expected: FAIL, cannot find module `./system-infra.classify.js`.

- [ ] **Step 3: Write minimal implementation**

Tạo `quanluong-app-be/src/modules/system-infra/system-infra.classify.js`:

```js
const WATCHED_CONTAINERS = [
  "quanluong-app-be",
  "quanluong-app-be-worker-email",
  "quanluong-app-be-worker-media",
  "quanluong-app-db",
  "quanluong-app-redis",
  "quanluong-document-db",
  "quanluong-document",
  "quanluong-app-qdrant",
  "quanluong-backup",
  "quanluong-app-ui",
  "quanluong-app-ui-superadmin",
];

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v >= 1024 ** 3) {
    const gb = v / 1024 ** 3;
    const text = gb >= 10 ? String(Math.round(gb)) : String(Math.round(gb * 10) / 10);
    return `${text} GB`;
  }
  if (v >= 1024 ** 2) return `${Math.max(1, Math.round(v / 1024 ** 2))} MB`;
  return `${Math.max(0, Math.round(v / 1024))} KB`;
}

function classifyDisk({ totalBytes, usedBytes }) {
  const total = Number(totalBytes);
  const used = Number(usedBytes);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(used) || used < 0) {
    return {
      status: "unknown",
      message: "Không đọc được đĩa",
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      usedPercent: 0,
    };
  }
  const freeBytes = Math.max(0, total - used);
  const usedPercent = (used / total) * 100;
  let status = "ok";
  if (usedPercent >= 90) status = "down";
  else if (usedPercent >= 80) status = "warn";
  const shown = Math.round(usedPercent * 10) / 10;
  return {
    status,
    message: `Đã dùng ${formatBytes(used)} (${shown}%) — còn ${formatBytes(freeBytes)}`,
    totalBytes: total,
    usedBytes: used,
    freeBytes,
    usedPercent: shown,
  };
}

function classifyContainer(row) {
  if (!row) return { status: "down", message: "không thấy container" };
  if (row.status !== "running") return { status: "down", message: "đã dừng" };
  if (row.health === "healthy") return { status: "ok", message: "đang chạy khỏe" };
  if (row.health === "unhealthy") return { status: "down", message: "lỗi healthcheck" };
  if (row.health === "starting") return { status: "warn", message: "đang khởi động" };
  return { status: "ok", message: "đang chạy" };
}

export { WATCHED_CONTAINERS, classifyDisk, classifyContainer };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quanluong-app-be && node --test src/modules/system-infra/system-infra.classify.test.js`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/system-infra/system-infra.classify.js quanluong-app-be/src/modules/system-infra/system-infra.classify.test.js
git commit -m "$(cat <<'EOF'
feat(infra): classify disk fill and container health

EOF
)"
```

---

### Task 2: Chấm log backup đêm

**Files:**
- Modify: `quanluong-app-be/src/modules/system-infra/system-infra.classify.js`
- Modify: `quanluong-app-be/src/modules/system-infra/system-infra.classify.test.js`

**Interfaces:**
- Consumes: file classify từ Task 1. Giữ `classifyDisk`, `classifyContainer`, `WATCHED_CONTAINERS`.
- Produces: `classifyBackupLog(log, now)` → `{ status, message, lastSuccessDay }`. `log === null` nghĩa là không đọc được file. `now` là `Date`.

- [ ] **Step 1: Write the failing test**

Thêm vào cuối `system-infra.classify.test.js`. Đổi dòng import thành:

```js
import {
  classifyBackupLog,
  classifyContainer,
  classifyDisk,
  WATCHED_CONTAINERS,
} from "./system-infra.classify.js";
```

Thêm các test:

```js
const tenAm = new Date("2026-10-07T03:00:00.000Z");
const oneAm = new Date("2026-10-06T18:00:00.000Z");

test("backup log at 10:00 +07 uses today's 02:15 slot", () => {
  const ok = classifyBackupLog(
    "2026-10-07T02:16:01+07:00 backup bắt đầu day=2026-10-07\n2026-10-07T02:20:00+07:00 backup xong\n",
    tenAm,
  );
  assert.equal(ok.status, "ok");
  assert.equal(ok.lastSuccessDay, "2026-10-07");
  assert.match(ok.message, /2026-10-07/);

  const failed = classifyBackupLog(
    "2026-10-07T02:16:01+07:00 backup bắt đầu day=2026-10-07\n2026-10-07T02:16:05+07:00 BACKUP_FAILED thiếu rclone.conf\n",
    tenAm,
  );
  assert.equal(failed.status, "warn");
  assert.match(failed.message, /Backup lỗi ngày 2026-10-07/);
  assert.equal(failed.lastSuccessDay, null);

  const stale = classifyBackupLog(
    "2026-10-06T02:16:01+07:00 backup bắt đầu day=2026-10-06\n2026-10-06T02:20:00+07:00 backup xong\n",
    tenAm,
  );
  assert.equal(stale.status, "warn");
  assert.equal(stale.lastSuccessDay, "2026-10-06");

  const running = classifyBackupLog(
    "2026-10-07T09:00:00+07:00 backup bắt đầu day=2026-10-07\n",
    tenAm,
  );
  assert.equal(running.status, "warn");
  assert.equal(running.message, "Backup đang chạy");

  const stuck = classifyBackupLog(
    "2026-10-07T06:00:00+07:00 backup bắt đầu day=2026-10-07\n",
    tenAm,
  );
  assert.equal(stuck.message, "Backup bắt đầu nhưng không thấy kết thúc");

  const noClock = classifyBackupLog("backup bắt đầu day=2026-10-07\n", tenAm);
  assert.equal(noClock.message, "Backup bắt đầu nhưng không thấy kết thúc");

  const empty = classifyBackupLog("", tenAm);
  assert.equal(empty.status, "warn");
  assert.match(empty.message, /02:15/);
  assert.equal(empty.lastSuccessDay, null);
});

test("backup before 02:15 accepts yesterday's success", () => {
  const row = classifyBackupLog(
    "2026-10-06T02:16:01+07:00 backup bắt đầu day=2026-10-06\n2026-10-06T02:20:00+07:00 backup xong\n",
    oneAm,
  );
  assert.equal(row.status, "ok");
  assert.equal(row.lastSuccessDay, "2026-10-06");
});

test("unreadable backup log is unknown", () => {
  const row = classifyBackupLog(null, tenAm);
  assert.equal(row.status, "unknown");
  assert.equal(row.lastSuccessDay, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quanluong-app-be && node --test src/modules/system-infra/system-infra.classify.test.js`

Expected: FAIL, `classifyBackupLog` is not exported.

- [ ] **Step 3: Write minimal implementation**

Thêm vào `system-infra.classify.js`, phía trên dòng `export`, và sửa export.

```js
const SLOT_MINUTES = 2 * 60 + 15;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function zonedParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + Number(parts.minute),
  };
}

function slotDay(now) {
  const parts = zonedParts(now);
  if (parts.minutes >= SLOT_MINUTES) return parts.day;
  return zonedParts(new Date(now.getTime() - 24 * 60 * 60 * 1000)).day;
}

function classifyBackupLog(log, now) {
  if (log == null) {
    return { status: "unknown", message: "Không đọc được log backup", lastSuccessDay: null };
  }
  const attempts = [];
  let lastSuccessDay = null;
  for (const raw of String(log).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const iso = /^(\d{4}-\d{2}-\d{2}T\S+)/.exec(line);
    const at = iso ? new Date(iso[1]) : null;
    const started = /backup bắt đầu day=(\d{4}-\d{2}-\d{2})/.exec(line);
    if (started) {
      attempts.push({
        day: started[1],
        at: at && !Number.isNaN(at.getTime()) ? at : null,
        outcome: "open",
      });
      continue;
    }
    if (!line.includes("backup xong") && !line.includes("BACKUP_FAILED")) continue;
    const open = attempts.findLast((item) => item.outcome === "open");
    if (!open) continue;
    open.outcome = line.includes("BACKUP_FAILED") ? "fail" : "ok";
    if (open.outcome === "ok") lastSuccessDay = open.day;
  }
  const slot = slotDay(now);
  const latest = attempts.at(-1);
  if (!latest || (latest.outcome === "ok" && latest.day < slot)) {
    return {
      status: "warn",
      message: "Chưa có backup xong cho mốc 02:15 gần nhất",
      lastSuccessDay,
    };
  }
  if (latest.outcome === "open") {
    const age = latest.at ? now.getTime() - latest.at.getTime() : Number.POSITIVE_INFINITY;
    if (latest.day >= slot && age >= 0 && age < THREE_HOURS_MS) {
      return { status: "warn", message: "Backup đang chạy", lastSuccessDay };
    }
    return {
      status: "warn",
      message: "Backup bắt đầu nhưng không thấy kết thúc",
      lastSuccessDay,
    };
  }
  if (latest.outcome === "fail") {
    return {
      status: "warn",
      message: `Backup lỗi ngày ${latest.day}`,
      lastSuccessDay,
    };
  }
  return {
    status: "ok",
    message: `Backup xong ngày ${latest.day}`,
    lastSuccessDay,
  };
}
```

Đổi export thành:

```js
export { WATCHED_CONTAINERS, classifyDisk, classifyContainer, classifyBackupLog };
```

`Array.prototype.findLast` và `Array.prototype.at` có trong Node 22 của container backend.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quanluong-app-be && node --test src/modules/system-infra/system-infra.classify.test.js`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/system-infra/system-infra.classify.js quanluong-app-be/src/modules/system-infra/system-infra.classify.test.js
git commit -m "$(cat <<'EOF'
feat(infra): score the nightly backup log against 02:15

EOF
)"
```

---

### Task 3: Ghép báo cáo

**Files:**
- Create: `quanluong-app-be/src/modules/system-infra/system-infra.service.js`
- Test: `quanluong-app-be/src/modules/system-infra/system-infra.service.test.js`

**Interfaces:**
- Consumes: `classifyDisk`, `classifyBackupLog`, `classifyContainer`, `WATCHED_CONTAINERS`.
- Produces: `readInfra(deps?)` → `{ checkedAt, disk, backup, containers }`. `deps` có thể có `now`, `readDisk`, `readLog`, `listContainers`. `listContainers` trả `Map<string, { status, health }>`. Throw từ `listContainers` làm 11 dòng `unknown`. Throw từ `readLog` làm backup `unknown`. Throw từ `readDisk` làm đĩa `unknown`.

- [ ] **Step 1: Write the failing test**

Tạo `quanluong-app-be/src/modules/system-infra/system-infra.service.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { WATCHED_CONTAINERS } from "./system-infra.classify.js";
import { readInfra } from "./system-infra.service.js";

const now = new Date("2026-10-07T03:00:00.000Z");

test("docker failure still returns disk and backup", async () => {
  const report = await readInfra({
    now,
    readDisk: async () => ({ totalBytes: 100, usedBytes: 40 }),
    readLog: async () =>
      "2026-10-07T02:16:01+07:00 backup bắt đầu day=2026-10-07\n2026-10-07T02:20:00+07:00 backup xong\n",
    listContainers: async () => {
      throw new Error("no sock");
    },
  });
  assert.equal(report.disk.status, "ok");
  assert.equal(report.backup.status, "ok");
  assert.equal(report.containers.length, 11);
  assert.deepEqual(
    report.containers.map((row) => row.name),
    WATCHED_CONTAINERS,
  );
  assert.equal(
    report.containers.every((row) => row.status === "unknown" && row.message === "Không đọc được Docker"),
    true,
  );
  assert.equal(JSON.stringify(report).includes("Env"), false);
  assert.equal(JSON.stringify(report).includes("rclone"), false);
});

test("a running backup container does not mark the log ok", async () => {
  const containers = new Map([
    ["quanluong-backup", { status: "running", health: null, Env: ["DB_PASSWORD=secret"] }],
  ]);
  const report = await readInfra({
    now,
    readDisk: async () => ({ totalBytes: 100, usedBytes: 40 }),
    readLog: async () =>
      "2026-10-06T02:16:01+07:00 backup bắt đầu day=2026-10-06\n2026-10-06T02:20:00+07:00 backup xong\n",
    listContainers: async () => containers,
  });
  assert.equal(report.backup.status, "warn");
  const backupRow = report.containers.find((row) => row.name === "quanluong-backup");
  assert.equal(backupRow.status, "ok");
  assert.equal(backupRow.message, "đang chạy");
  assert.equal(JSON.stringify(report).includes("secret"), false);
  assert.equal(report.containers.find((row) => row.name === "quanluong-app-db").message, "không thấy container");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quanluong-app-be && node --test src/modules/system-infra/system-infra.service.test.js`

Expected: FAIL, cannot find `./system-infra.service.js`.

- [ ] **Step 3: Write minimal implementation**

Tạo `quanluong-app-be/src/modules/system-infra/system-infra.service.js`:

```js
import { readFile } from "node:fs/promises";
import path from "node:path";
import { statfs } from "node:fs/promises";
import {
  WATCHED_CONTAINERS,
  classifyBackupLog,
  classifyContainer,
  classifyDisk,
} from "./system-infra.classify.js";
import { listWatchedContainers } from "./system-infra.docker.js";

function unknownDocker() {
  return WATCHED_CONTAINERS.map((name) => ({
    name,
    status: "unknown",
    message: "Không đọc được Docker",
  }));
}

async function readHostDisk() {
  const dir = process.env.INFRA_HOST_ROOT || "/host";
  const stat = await statfs(dir);
  const bsize = Number(stat.bsize);
  const totalBytes = Number(stat.blocks) * bsize;
  const freeBytes = Number(stat.bavail) * bsize;
  return { totalBytes, usedBytes: totalBytes - freeBytes };
}

async function readBackupLog() {
  const root = process.env.BACKUP_DIR || "/var/backups/quanluong";
  return readFile(path.join(root, "backup.log"), "utf8");
}

async function readInfra(deps = {}) {
  const now = deps.now ?? new Date();
  const readDisk = deps.readDisk ?? readHostDisk;
  const readLog = deps.readLog ?? readBackupLog;
  const listContainers = deps.listContainers ?? listWatchedContainers;

  let diskInput = { totalBytes: 0, usedBytes: 0 };
  try {
    diskInput = await readDisk();
  } catch {
    diskInput = { totalBytes: 0, usedBytes: 0 };
  }

  let log = null;
  try {
    log = await readLog();
  } catch {
    log = null;
  }

  let containers;
  try {
    const found = await listContainers();
    containers = WATCHED_CONTAINERS.map((name) => {
      const row = found.get(name) ?? null;
      return { name, ...classifyContainer(row ? { status: row.status, health: row.health ?? null } : null) };
    });
  } catch {
    containers = unknownDocker();
  }

  return {
    checkedAt: now.toISOString(),
    disk: classifyDisk(diskInput),
    backup: classifyBackupLog(log, now),
    containers,
  };
}

export { readInfra, readHostDisk, readBackupLog };
```

Task 4 tạo `system-infra.docker.js`. Task 3 cần file đó tồn tại để import không vỡ khi chạy service ngoài test. Tạo stub tạm, Task 4 thay bằng bản thật:

```js
async function listWatchedContainers() {
  throw new Error("docker socket chưa gắn");
}

export { listWatchedContainers };
```

Đặt stub tại `quanluong-app-be/src/modules/system-infra/system-infra.docker.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quanluong-app-be && node --test src/modules/system-infra/system-infra.classify.test.js src/modules/system-infra/system-infra.service.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/system-infra/system-infra.service.js quanluong-app-be/src/modules/system-infra/system-infra.service.test.js quanluong-app-be/src/modules/system-infra/system-infra.docker.js
git commit -m "$(cat <<'EOF'
feat(infra): assemble a partial health report when docker is down

EOF
)"
```

---

### Task 4: Docker socket và route

**Files:**
- Modify: `quanluong-app-be/src/modules/system-infra/system-infra.docker.js`
- Create: `quanluong-app-be/src/modules/system-infra/system-infra.docker.test.js`
- Create: `quanluong-app-be/src/modules/system-infra/system-infra.controller.js`
- Create: `quanluong-app-be/src/modules/system-infra/system-infra.routes.js`
- Modify: `quanluong-app-be/src/app/routes.js`

**Interfaces:**
- Consumes: `readInfra` từ Task 3. `WATCHED_CONTAINERS` từ Task 1.
- Produces: `listWatchedContainers(dockerGet?)` → `Map`. Route `GET /` trên router gắn tại `/system-infra`.

- [ ] **Step 1: Write the failing test**

Tạo `quanluong-app-be/src/modules/system-infra/system-infra.docker.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { listWatchedContainers } from "./system-infra.docker.js";

test("list keeps only watched names and drops inspect env", async () => {
  const calls = [];
  const dockerGet = async (pathname) => {
    calls.push(pathname);
    if (pathname.startsWith("/containers/json")) {
      return [
        { Id: "db1", Names: ["/quanluong-app-db"] },
        { Id: "mig1", Names: ["/quanluong-app-be-migrate"] },
        { Id: "other", Names: ["/nginx"] },
      ];
    }
    if (pathname === "/containers/db1/json") {
      return {
        State: { Status: "running", Health: { Status: "healthy" } },
        Config: { Env: ["DB_PASSWORD=secret"] },
      };
    }
    throw new Error(pathname);
  };
  const found = await listWatchedContainers(dockerGet);
  assert.equal(found.size, 1);
  assert.deepEqual(found.get("quanluong-app-db"), { status: "running", health: "healthy" });
  assert.equal(JSON.stringify([...found.values()]).includes("secret"), false);
  assert.equal(calls.some((path) => path.includes("migrate")), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quanluong-app-be && node --test src/modules/system-infra/system-infra.docker.test.js`

Expected: FAIL, `listWatchedContainers` không nhận getter hoặc không lọc tên.

- [ ] **Step 3: Write minimal implementation**

Thay nội dung `system-infra.docker.js` bằng:

```js
import http from "node:http";
import { WATCHED_CONTAINERS } from "./system-infra.classify.js";

function dockerGet(pathname, socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock") {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath, path: pathname, method: "GET", timeout: 2000 },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode !== 200) {
            reject(new Error(`docker ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("docker timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function listWatchedContainers(get = dockerGet) {
  const wanted = new Set(WATCHED_CONTAINERS);
  const list = await get("/containers/json?all=1");
  const hits = [];
  for (const item of list || []) {
    const name = (item.Names || [])
      .map((value) => String(value).replace(/^\//, ""))
      .find((value) => wanted.has(value));
    if (name && item.Id) hits.push({ name, id: item.Id });
  }
  const rows = await Promise.all(
    hits.map(async (hit) => {
      const body = await get(`/containers/${hit.id}/json`);
      return [
        hit.name,
        {
          status: body?.State?.Status ?? "",
          health: body?.State?.Health?.Status ?? null,
        },
      ];
    }),
  );
  return new Map(rows);
}

export { dockerGet, listWatchedContainers };
```

Tạo `system-infra.controller.js`:

```js
import { respondSuccess } from "../../shared/utils/responders.js";
import { readInfra } from "./system-infra.service.js";

async function getSystemInfraController(_req, res) {
  return respondSuccess(res, {
    message: "Tình trạng hạ tầng",
    data: await readInfra(),
  });
}

export { getSystemInfraController };
```

Tạo `system-infra.routes.js`:

```js
import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { getSystemInfraController } from "./system-infra.controller.js";

const systemInfraRouter = express.Router();

systemInfraRouter.use(authMiddleware, superadminMiddleware);
systemInfraRouter.get("/", asyncHandler(getSystemInfraController));

export { systemInfraRouter };
```

Trong `quanluong-app-be/src/app/routes.js`, thêm import cạnh import backup:

```js
import { systemInfraRouter } from "../modules/system-infra/system-infra.routes.js";
```

Thêm ngay sau dòng `router.use("/system-backup", systemBackupRouter);`:

```js
router.use("/system-infra", systemInfraRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quanluong-app-be && node --test src/modules/system-infra/system-infra.classify.test.js src/modules/system-infra/system-infra.service.test.js src/modules/system-infra/system-infra.docker.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/system-infra quanluong-app-be/src/app/routes.js
git commit -m "$(cat <<'EOF'
feat(infra): add the superadmin infrastructure report route

EOF
)"
```

---

### Task 5: Mount socket và đĩa máy chủ

**Files:**
- Modify: `docker-compose.yml` service `app` volumes, khoảng dòng 38–40
- Modify: `docker-compose.dev.yml` service `app` volumes chỉ nếu bước kiểm tra cho thấy mount bị mất

**Interfaces:**
- Consumes: không có code.
- Produces: container `app` thấy `/var/run/docker.sock`, `/host` chỉ đọc, và `/var/backups/quanluong`.

- [ ] **Step 1: Add the mounts on the base app service**

Trong `docker-compose.yml`, `services.app.volumes` thành:

```yaml
    volumes:
      - media_data:/data/media
      - backup_data:/var/backups/quanluong
      - /var/run/docker.sock:/var/run/docker.sock
      - /:/host:ro
```

Không thêm mount này vào `worker-email`, `worker-media`, hay `backup`.

- [ ] **Step 2: Check the merged dev config**

Chỉ in target của volume service `app`. Không in cả file config.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file quanluong-app-be/.env.docker config --format json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const vols=JSON.parse(s).services.app.volumes||[]; for (const v of vols) console.log(typeof v==="string"?v:(v.target||""))})'
```

Expected: output chứa cả ba dòng `/data/media`, `/var/backups/quanluong`, `/var/run/docker.sock`, `/host`.

Nếu `/host`, socket, hoặc `/var/backups/quanluong` không có, thêm đúng mount còn thiếu vào `services.app.volumes` của `docker-compose.dev.yml`. Không khai báo lại một target đã có.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml
git commit -m "$(cat <<'EOF'
feat(infra): let the app read host disk and the docker socket

EOF
)"
```

Nếu `docker-compose.dev.yml` không đổi, chỉ `git add docker-compose.yml`.

Không `force-recreate` container `quanluong-backup`. App cần tạo lại sau khi mount đổi thì làm ở lúc triển khai, không nằm trong task này.

---

### Task 6: Trang Hạ tầng

**Files:**
- Modify: `packages/shared/src/features/route-access/routeAccessRegistry.js` cạnh key `dashboard-backup`
- Modify: `packages/shared/src/pages/dashboard/superadminDashboardTabMeta.js`
- Modify: `packages/shared/src/pages/dashboard/superadminDashboardTabMeta.test.js`
- Modify: `packages/shared/src/app/query/queryKeys.js`
- Create: `packages/shared/src/features/system-infra/api/systemInfraApi.js`
- Create: `packages/shared/src/pages/dashboard/superadmin/SuperadminInfraPanel.jsx`
- Modify: `packages/shared/src/pages/dashboard/DashboardTabPages.jsx`
- Create: `apps/superadmin/app/(private)/dashboard/infra/page.jsx`

**Interfaces:**
- Consumes: `GET /system-infra` trả `data` như spec mục 4. `apiRequest` đã unwrap `body.data`.
- Produces: route `/dashboard/infra` trên cổng superadmin, `routeAccessKey` `dashboard-infra`.

- [ ] **Step 1: Update the nav test so it fails**

Trong `superadminDashboardTabMeta.test.js`, đổi `9` thành `10` ở cả hai assertion `length`. Thêm `"infra"` vào cuối mảng `paths`, ngay sau `"backup"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && node --test src/pages/dashboard/superadminDashboardTabMeta.test.js`

Expected: FAIL, length is 9.

- [ ] **Step 3: Register the page and render the table**

Trong `routeAccessRegistry.js`, ngay sau block `dashboard-backup`:

```js
  "dashboard-infra": {
    description: "Hạ tầng — superadmin xem đĩa, backup đêm và container",
    requiredPermissions: [],
  },
```

Trong `superadminDashboardTabMeta.js`, thêm `Activity` vào import từ `lucide-react`. Thêm phần tử cuối mảng, sau backup:

```js
  {
    path: "infra",
    label: "Hạ tầng",
    shortLabel: "Hạ tầng",
    section: "Hệ thống",
    icon: Activity,
    routeAccessKey: "dashboard-infra",
  },
```

Trong `queryKeys.js`, sau `systemBackup`:

```js
  systemInfra: { root: ["systemInfra"], state: () => ["systemInfra", "state"] },
```

Tạo `packages/shared/src/features/system-infra/api/systemInfraApi.js`:

```js
"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { apiRequest } from "@/services/apiRequest";

export function useSystemInfraQuery() {
  return useQuery({
    queryKey: qk.systemInfra.state(),
    queryFn: () => apiRequest({ url: "/system-infra", method: "get" }),
    refetchInterval: 30000,
  });
}
```

Tạo `packages/shared/src/pages/dashboard/superadmin/SuperadminInfraPanel.jsx`:

```jsx
"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { useSystemInfraQuery } from "@/features/system-infra/api/systemInfraApi";

const STATUS_CLASS = {
  ok: "text-emerald-700 dark:text-emerald-300",
  warn: "text-amber-700 dark:text-amber-300",
  down: "text-destructive",
  unknown: "text-muted-foreground",
};

function StatusLine({ name, status, message }) {
  return (
    <li className="flex items-baseline justify-between gap-3 px-3 py-2">
      <span className="text-sm">{name}</span>
      <span className={`text-right text-xs ${STATUS_CLASS[status] || STATUS_CLASS.unknown}`}>
        {message}
      </span>
    </li>
  );
}

export function SuperadminInfraPanel() {
  const { data, isLoading, isError } = useSystemInfraQuery();
  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-3 !p-3 sm:!p-4">
        <div>
          <p className="text-sm font-medium">Hạ tầng</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Đĩa máy chủ, backup đêm lúc 02:15, và container đang chạy. Trang tự tải lại mỗi 30 giây.
          </p>
        </div>
        {isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Đang kiểm tra
          </p>
        ) : null}
        {isError ? <p className="text-xs text-destructive">Không tải được tình trạng hạ tầng.</p> : null}
        {data ? (
          <ul className="divide-y divide-border rounded-xl border border-border">
            <StatusLine name="Đĩa" status={data.disk?.status} message={data.disk?.message} />
            <StatusLine name="Backup đêm" status={data.backup?.status} message={data.backup?.message} />
            {(data.containers || []).map((row) => (
              <StatusLine key={row.name} name={row.name} status={row.status} message={row.message} />
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

Trong `DashboardTabPages.jsx`, import `SuperadminInfraPanel` cạnh import backup, và thêm:

```jsx
export function DashboardInfraPage() {
  return (
    <div className="min-w-0">
      <SuperadminInfraPanel />
    </div>
  );
}
```

Tạo `apps/superadmin/app/(private)/dashboard/infra/page.jsx`:

```jsx
import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardInfraPage } from "@/pages/dashboard/DashboardTabPages";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Hạ tầng",
  description: "Đĩa máy chủ, backup đêm và container.",
});

export default function DashboardInfraRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-infra">
      <DashboardInfraPage />
    </RouteApiGuard>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && node --test src/pages/dashboard/superadminDashboardTabMeta.test.js`

Expected: PASS. `superadminPortalNavItems.length` là 10 và có `/dashboard/infra`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/features/route-access/routeAccessRegistry.js packages/shared/src/pages/dashboard/superadminDashboardTabMeta.js packages/shared/src/pages/dashboard/superadminDashboardTabMeta.test.js packages/shared/src/app/query/queryKeys.js packages/shared/src/features/system-infra/api/systemInfraApi.js packages/shared/src/pages/dashboard/superadmin/SuperadminInfraPanel.jsx packages/shared/src/pages/dashboard/DashboardTabPages.jsx apps/superadmin/app/\(private\)/dashboard/infra/page.jsx
git commit -m "$(cat <<'EOF'
feat(infra): show disk, backup, and containers to superadmin

EOF
)"
```
