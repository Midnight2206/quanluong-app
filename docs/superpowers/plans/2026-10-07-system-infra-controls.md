# System infra controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmin chạy backup và xem 80 dòng log trên trang Backup, và restart từng container trừ backup trên trang Hạ tầng.

**Architecture:** Phiếu backup là một file JSON trên volume, cùng kiểu `restore.json`. Vòng watch trong `backup.sh` xóa phiếu rồi gọi backup. Restart gọi Docker API `POST /containers/{id}/restart`, trừ container backup. API tự restart thì trả response trước.

**Tech Stack:** Express, Node `node:test`, Docker Engine API qua unix socket, React Query, `useConfirm`.

## Global Constraints

- Làm trên nhánh mới `feat/system-infra-controls` tách từ `main` hiện tại. Không commit trên `main`. Không push.
- «Chạy backup» và «Xem log» nằm trên trang Backup. Trang Hạ tầng chỉ thêm Restart.
- Backup ghi `requests/backup.json` với `{ requestedAt }`. Không `docker exec`.
- Sửa `ops/backup/backup.sh`. Không tạo lại container `quanluong-backup`. Không sửa compose.
- Restart là `POST /containers/{id}/restart?t=10`, timeout 20 giây. Thành công khi Docker trả 204.
- Mười tên được restart: `quanluong-app-be`, `quanluong-app-be-worker-email`, `quanluong-app-be-worker-media`, `quanluong-app-db`, `quanluong-app-redis`, `quanluong-document-db`, `quanluong-document`, `quanluong-app-qdrant`, `quanluong-app-ui`, `quanluong-app-ui-superadmin`.
- `quanluong-backup` không có nút và API trả 404 «Không restart container này.»
- Chỉ superadmin, middleware hiện có. Không mã quyền mới. Không sửa `permission-catalog.vi.js`.
- Log không đưa vào email.
- Không restart hàng loạt.

---

### Task 1: Phiếu backup và đuôi log

**Files:**
- Modify: `quanluong-app-be/src/modules/system-backup/system-backup.service.js`
- Modify: `quanluong-app-be/src/modules/system-backup/system-backup.service.test.js`
- Modify: `quanluong-app-be/src/modules/system-backup/system-backup.controller.js`
- Modify: `quanluong-app-be/src/modules/system-backup/system-backup.routes.js`

**Interfaces:**
- Consumes: `backupRoot()`, `AppError`, `ERROR_CODES.CONFLICT`.
- Produces:
  - `queueBackup(root = backupRoot(), now = new Date()) → Promise<{ requestedAt: string }>`. 409 khi `backup.json` hoặc `restore.json` đã có.
  - `readBackupLogTail(root = backupRoot(), limit = 80) → Promise<string[]>`.
  - `POST /api/system-backup/backup` → 202, message `Đã nhận lệnh backup`.
  - `GET /api/system-backup/log` → 200, `data.lines`.

- [ ] **Step 1: Write the failing test**

Thêm import `queueBackup` và `readBackupLogTail` vào `system-backup.service.test.js`. Thêm `mkdir` vào import `node:fs/promises`. Thêm các test:

```js
test("queueBackup ghi requestedAt và từ chối khi phiếu còn", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ql-backup-run-"));
  try {
    const first = await queueBackup(root, new Date("2026-10-07T07:00:00.000Z"));
    assert.equal(first.requestedAt, "2026-10-07T07:00:00.000Z");
    const body = JSON.parse(await readFile(path.join(root, "requests", "backup.json"), "utf8"));
    assert.deepEqual(body, { requestedAt: "2026-10-07T07:00:00.000Z" });
    await assert.rejects(queueBackup(root), (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.message, "Đang có một lệnh backup.");
      return true;
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("queueBackup không ghi khi đang có phiếu khôi phục", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ql-backup-busy-"));
  try {
    await mkdir(path.join(root, "requests"), { recursive: true });
    await writeFile(path.join(root, "requests", "restore.json"), '{"date":"2026-10-07"}\n');
    await assert.rejects(queueBackup(root), (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.message, "Đang có một lần khôi phục.");
      return true;
    });
    await assert.rejects(readFile(path.join(root, "requests", "backup.json"), "utf8"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readBackupLogTail lấy 80 dòng cuối và file thiếu thì rỗng", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ql-backup-log-"));
  try {
    assert.deepEqual(await readBackupLogTail(root), []);
    const lines = Array.from({ length: 100 }, (_, i) => `dong ${i + 1}`);
    await writeFile(path.join(root, "backup.log"), `${lines.join("\n")}\n`);
    const tail = await readBackupLogTail(root);
    assert.equal(tail.length, 80);
    assert.equal(tail[0], "dong 21");
    assert.equal(tail[79], "dong 100");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run từ `quanluong-app-be`:

```bash
node --test src/modules/system-backup/system-backup.service.test.js
```

Expected: FAIL vì `queueBackup` chưa export. Test cũ của `queueRestore` vẫn còn trong file.

- [ ] **Step 3: Write minimal implementation**

Thêm vào `system-backup.service.js`, sau `queueRestore`:

```js
async function queueBackup(root = backupRoot(), now = new Date()) {
  const reqDir = path.join(root, "requests");
  await mkdir(reqDir, { recursive: true });
  try {
    await stat(path.join(reqDir, "restore.json"));
    throw new AppError({
      message: "Đang có một lần khôi phục.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  const requestedAt = now.toISOString();
  try {
    await writeFile(path.join(reqDir, "backup.json"), JSON.stringify({ requestedAt }), { flag: "wx" });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new AppError({
        message: "Đang có một lệnh backup.",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
  return { requestedAt };
}

async function readBackupLogTail(root = backupRoot(), limit = 80) {
  try {
    const text = await readFile(path.join(root, "backup.log"), "utf8");
    const lines = text.split("\n");
    if (lines.at(-1) === "") {
      lines.pop();
    }
    return lines.slice(-limit);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
```

Thêm cả hai vào `export`.

Trong `system-backup.controller.js`, import `queueBackup` và `readBackupLogTail`. Thêm:

```js
async function runSystemBackupController(_req, res) {
  const result = await queueBackup();
  return respondSuccess(res, {
    statusCode: 202,
    message: "Đã nhận lệnh backup",
    data: result,
  });
}

async function getSystemBackupLogController(_req, res) {
  return respondSuccess(res, {
    message: "Log backup",
    data: { lines: await readBackupLogTail() },
  });
}
```

Export hai hàm đó.

Trong `system-backup.routes.js`, import hai controller. Sau route `POST /restore`, thêm:

```js
systemBackupRouter.post("/backup", asyncHandler(runSystemBackupController));
systemBackupRouter.get("/log", asyncHandler(getSystemBackupLogController));
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test src/modules/system-backup/system-backup.service.test.js
```

Expected: các test cũ và 3 test mới đều pass.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/system-backup/system-backup.service.js quanluong-app-be/src/modules/system-backup/system-backup.service.test.js quanluong-app-be/src/modules/system-backup/system-backup.controller.js quanluong-app-be/src/modules/system-backup/system-backup.routes.js
git commit -m "$(cat <<'EOF'
feat(backup): queue a manual backup and return the log tail

EOF
)"
```

---

### Task 2: Vòng watch nhận phiếu backup

**Files:**
- Modify: `ops/backup/backup.sh` (hàm `watch_loop`, ngay sau nhánh `restore.json`)
- Modify: `quanluong-app-be/src/modules/system-backup/system-backup.service.test.js`

**Interfaces:**
- Consumes: `do_backup` qua `"$0" backup`. Vòng đã có `set +e`.
- Produces: khi có `requests/backup.json`, xóa file rồi chạy backup một lần.

- [ ] **Step 1: Write the failing test**

Thêm vào `system-backup.service.test.js`. `import.meta.dirname` tính từ file test, bốn cấp lên gốc repo:

```js
test("watch_loop xóa phiếu backup rồi chạy sau nhánh khôi phục", async () => {
  const file = path.resolve(import.meta.dirname, "../../../../ops/backup/backup.sh");
  const text = await readFile(file, "utf8");
  const restoreAt = text.indexOf('"$BACKUP_DIR/requests/restore.json"');
  const backupAt = text.indexOf('"$BACKUP_DIR/requests/backup.json"');
  const manifestAt = text.indexOf('"$0" manifest');
  assert.ok(restoreAt !== -1 && backupAt > restoreAt && manifestAt > backupAt);
  const branch = text.slice(backupAt, manifestAt);
  assert.match(branch, /rm -f "\$BACKUP_DIR\/requests\/backup.json"/);
  assert.match(branch, /"\$0" backup/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run từ `quanluong-app-be`:

```bash
node --test src/modules/system-backup/system-backup.service.test.js
```

Expected: FAIL ở test watch, vì `backup.json` chưa có trong `watch_loop`. Test phiếu vẫn pass.

- [ ] **Step 3: Write minimal implementation**

Trong `watch_loop`, sau khối `if` của `restore.json` và trước `"$0" manifest`, thêm:

```bash
    if [[ -f "$BACKUP_DIR/requests/backup.json" ]]; then
      rm -f "$BACKUP_DIR/requests/backup.json"
      "$0" backup
    fi
```

Giữ `set +e` của vòng. Không thêm nhánh ở `case`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test src/modules/system-backup/system-backup.service.test.js
```

Expected: pass, gồm test watch.

- [ ] **Step 5: Commit**

```bash
git add ops/backup/backup.sh quanluong-app-be/src/modules/system-backup/system-backup.service.test.js
git commit -m "$(cat <<'EOF'
feat(backup): run a queued backup from the watch loop

EOF
)"
```

---

### Task 3: Nút trên trang Backup

**Files:**
- Modify: `packages/shared/src/features/system-backup/api/systemBackupApi.js`
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminBackupPanel.jsx`

**Interfaces:**
- Consumes: `POST /system-backup/backup`, `GET /system-backup/log`. `apiRequest` trả `data` đã unwrap.
- Produces: `useRunSystemBackupMutation()`, và nút xem log gọi GET một lần khi bấm.

- [ ] **Step 1: Write the API helper**

Thêm vào `systemBackupApi.js`:

```js
export function useRunSystemBackupMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: () => apiRequest({ url: "/system-backup/backup", method: "post" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.systemBackup.root }),
  });
}
```

Trang không có test component. Hành vi phiếu và log đã có test ở Task 1.

- [ ] **Step 2: Add the buttons**

Trong `SuperadminBackupPanel.jsx`, import `useRunSystemBackupMutation`. Thêm state:

```js
const [runBackup, { isLoading: backingUp }] = useRunSystemBackupMutation();
const [logLines, setLogLines] = useState(null);
const [logLoading, setLogLoading] = useState(false);
```

Import `useState` từ `react`.

```js
async function onRunBackup() {
  if (!isSuperadmin || backingUp) {
    return;
  }
  const ok = await confirm({
    title: "Chạy backup ngay",
    message:
      "Lệnh được xếp hàng. Container backup chạy trong vòng khoảng 20 giây. App vẫn chạy. Nếu lần backup trước chưa xong, lệnh này lỗi và có email.",
    confirmLabel: "Chạy backup",
    cancelLabel: "Huỷ",
  });
  if (!ok) {
    return;
  }
  try {
    await runBackup();
    notifySuccess("Đã nhận lệnh backup.");
  } catch (error) {
    notifyError(error?.data?.message || "Không gửi được lệnh backup.");
  }
}

async function onShowLog() {
  if (!isSuperadmin || logLoading) {
    return;
  }
  setLogLoading(true);
  try {
    const data = await apiRequest({ url: "/system-backup/log", method: "get" });
    setLogLines(Array.isArray(data?.lines) ? data.lines : []);
  } catch (error) {
    notifyError(error?.data?.message || "Không tải được log backup.");
  } finally {
    setLogLoading(false);
  }
}
```

Import `apiRequest` từ `@/services/apiRequest`.

Ngay sau đoạn mô tả «Mỗi đêm 02:15...», trước khối `data?.status?.message`, thêm:

```jsx
        <div className="flex flex-wrap gap-2">
          <Button
            className="px-3 py-1.5 text-xs"
            disabled={!isSuperadmin || backingUp}
            onClick={onRunBackup}
          >
            {backingUp ? "Đang gửi" : "Chạy backup"}
          </Button>
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={!isSuperadmin || logLoading}
            onClick={onShowLog}
          >
            {logLoading ? "Đang tải" : "Xem log"}
          </Button>
        </div>
        {logLines ? (
          logLines.length === 0 ? (
            <p className="text-xs text-muted-foreground">Chưa có log.</p>
          ) : (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border p-3 text-xs">
              {logLines.join("\n")}
            </pre>
          )
        ) : null}
```

Giữ nguyên danh sách ngày và nút Khôi phục.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/features/system-backup/api/systemBackupApi.js packages/shared/src/pages/dashboard/superadmin/SuperadminBackupPanel.jsx
git commit -m "$(cat <<'EOF'
feat(backup): add run and log actions on the backup page

EOF
)"
```

---

### Task 4: Restart container trên trang Hạ tầng

**Files:**
- Modify: `quanluong-app-be/src/modules/system-infra/system-infra.docker.js`
- Create: `quanluong-app-be/src/modules/system-infra/system-infra.restart.js`
- Create: `quanluong-app-be/src/modules/system-infra/system-infra.restart.test.js`
- Modify: `quanluong-app-be/src/modules/system-infra/system-infra.controller.js`
- Modify: `quanluong-app-be/src/modules/system-infra/system-infra.routes.js`
- Modify: `packages/shared/src/features/system-infra/api/systemInfraApi.js`
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminInfraPanel.jsx`

**Interfaces:**
- Consumes: `WATCHED_CONTAINERS`, `dockerGet`.
- Produces:
  - `dockerPost(pathname, socketPath?, timeout = 20000) → Promise<number>`. Chỉ resolve khi status 204.
  - `listContainerIds(get = dockerGet) → Promise<Map<string, string>>`.
  - `RESTARTABLE_CONTAINERS: string[]` — 10 tên ở Global Constraints, cùng thứ tự.
  - `restartContainer(name, deps) → Promise<{ deferred: boolean, run?: () => Promise<number> }>`.
  - `scheduleSelfRestart(res, run, wait = setTimeout)`.
  - `POST /api/system-infra/containers/:name/restart` → 202, message `Đã nhận lệnh restart`.

- [ ] **Step 1: Write the failing test**

Tạo `system-infra.restart.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  RESTARTABLE_CONTAINERS,
  restartContainer,
  scheduleSelfRestart,
} from "./system-infra.restart.js";

test("danh sách restart bỏ container backup", () => {
  assert.equal(RESTARTABLE_CONTAINERS.includes("quanluong-backup"), false);
  assert.equal(RESTARTABLE_CONTAINERS.includes("quanluong-app-db"), true);
  assert.equal(RESTARTABLE_CONTAINERS.length, 10);
});

test("tên không được phép thì 404 và không gọi docker", async () => {
  for (const name of ["quanluong-backup", "quanluong-app-be-migrate"]) {
    let called = false;
    await assert.rejects(
      restartContainer(name, {
        list: async () => {
          called = true;
          return new Map();
        },
        post: async () => {
          called = true;
          return 204;
        },
      }),
      (error) => {
        assert.equal(error.statusCode, 404);
        assert.equal(error.message, "Không restart container này.");
        return true;
      },
    );
    assert.equal(called, false);
  }
});

test("không thấy container thì 404", async () => {
  await assert.rejects(
    restartContainer("quanluong-app-db", {
      list: async () => new Map(),
      post: async () => 204,
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, "Không thấy container.");
      return true;
    },
  );
});

test("restart db gọi đúng đường dẫn", async () => {
  const calls = [];
  const result = await restartContainer("quanluong-app-db", {
    list: async () => new Map([["quanluong-app-db", "db1"]]),
    post: async (pathname) => {
      calls.push(pathname);
      return 204;
    },
  });
  assert.equal(result.deferred, false);
  assert.deepEqual(calls, ["/containers/db1/restart?t=10"]);
});

test("restart api trả trước rồi mới gọi docker", async () => {
  let posted = false;
  const result = await restartContainer("quanluong-app-be", {
    list: async () => new Map([["quanluong-app-be", "app1"]]),
    post: async () => {
      posted = true;
      return 204;
    },
  });
  assert.equal(result.deferred, true);
  assert.equal(posted, false);
  const events = {};
  scheduleSelfRestart(
    { on(name, fn) { events[name] = fn; } },
    result.run,
    (fn) => fn(),
  );
  assert.equal(posted, false);
  events.finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(posted, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run từ `quanluong-app-be`:

```bash
node --test src/modules/system-infra/system-infra.restart.test.js
```

Expected: FAIL vì module chưa có.

- [ ] **Step 3: Write minimal implementation**

Thêm vào `system-infra.docker.js`:

```js
function dockerPost(pathname, socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock", timeout = 20000) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath, path: pathname, method: "POST", timeout },
      (res) => {
        res.on("end", () => {
          if (res.statusCode !== 204) {
            reject(new Error(`docker ${res.statusCode}`));
            return;
          }
          resolve(res.statusCode);
        });
        res.resume();
      },
    );
    req.on("timeout", () => req.destroy(new Error("docker timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function listContainerIds(get = dockerGet) {
  const list = await get("/containers/json?all=1");
  const ids = new Map();
  for (const item of list || []) {
    for (const raw of item.Names || []) {
      const name = String(raw).replace(/^\//, "");
      if (item.Id) {
        ids.set(name, item.Id);
      }
    }
  }
  return ids;
}
```

Export `dockerPost` và `listContainerIds`.

Tạo `system-infra.restart.js`:

```js
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { logger } from "../../shared/utils/logger.js";
import { WATCHED_CONTAINERS } from "./system-infra.classify.js";
import { dockerPost, listContainerIds } from "./system-infra.docker.js";

const RESTARTABLE_CONTAINERS = WATCHED_CONTAINERS.filter((name) => name !== "quanluong-backup");

async function restartContainer(name, deps = {}) {
  if (!RESTARTABLE_CONTAINERS.includes(name)) {
    throw new AppError({
      message: "Không restart container này.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const list = deps.list ?? listContainerIds;
  const post = deps.post ?? dockerPost;
  const ids = await list();
  const id = ids.get(name);
  if (!id) {
    throw new AppError({
      message: "Không thấy container.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const run = () => post(`/containers/${id}/restart?t=10`);
  if (name === "quanluong-app-be") {
    return { deferred: true, run };
  }
  try {
    await run();
  } catch {
    throw new AppError({
      message: "Không restart được container.",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  return { deferred: false };
}

function scheduleSelfRestart(res, run, wait = setTimeout) {
  res.on("finish", () => {
    wait(() => {
      Promise.resolve(run()).catch((error) => {
        logger.warn({ err: error }, "Restart API thất bại");
      });
    }, 500);
  });
}

export { RESTARTABLE_CONTAINERS, restartContainer, scheduleSelfRestart };
```

Trong controller, thêm:

```js
import { restartContainer, scheduleSelfRestart } from "./system-infra.restart.js";

async function restartSystemInfraController(req, res) {
  const result = await restartContainer(req.params.name);
  respondSuccess(res, {
    statusCode: 202,
    message: "Đã nhận lệnh restart",
    data: { name: req.params.name },
  });
  if (result.deferred) {
    scheduleSelfRestart(res, result.run);
  }
}
```

Export `restartSystemInfraController`.

Trong routes:

```js
systemInfraRouter.post("/containers/:name/restart", asyncHandler(restartSystemInfraController));
```

Đặt sau `GET /`.

Trong `systemInfraApi.js`:

```js
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

export function useRestartContainerMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (name) =>
      apiRequest({
        url: `/system-infra/containers/${encodeURIComponent(name)}/restart`,
        method: "post",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.systemInfra.root }),
  });
}
```

Giữ `useSystemInfraQuery` như hiện tại.

Trong `SuperadminInfraPanel.jsx`, import `Button`, `useConfirm`, `useCurrentUser`, `notifyError`, `notifySuccess`, và `useRestartContainerMutation`. Mỗi dòng container có nút khi `row.name !== "quanluong-backup"`:

```jsx
function ContainerRow({ row, onRestart, restarting }) {
  return (
    <li className="flex items-baseline justify-between gap-3 px-3 py-2">
      <span className="text-sm">{row.name}</span>
      <span className="flex items-center gap-2">
        {row.name === "quanluong-backup" ? null : (
          <Button
            variant="dangerGhost"
            className="px-3 py-1.5 text-xs"
            disabled={restarting}
            onClick={() => onRestart(row.name)}
          >
            Restart
          </Button>
        )}
        <span className={`text-right text-xs ${STATUS_CLASS[row.status] || STATUS_CLASS.unknown}`}>
          {row.message}
        </span>
      </span>
    </li>
  );
}
```

`onRestart`:

```js
async function onRestart(name) {
  const ok = await confirm({
    title: `Restart ${name}`,
    message: "Site có thể ngắt một lúc.",
    confirmLabel: "Restart",
    cancelLabel: "Huỷ",
    variant: "danger",
  });
  if (!ok) {
    return;
  }
  try {
    await restart(name);
    notifySuccess("Đã nhận lệnh restart.");
  } catch (error) {
    notifyError(error?.data?.message || "Không restart được container.");
  }
}
```

Chỉ hiện nút khi `useCurrentUser()?.type?.name === "superadmin"`. Đĩa và backup đêm không có nút Restart.

- [ ] **Step 4: Run test to verify it passes**

Run từ `quanluong-app-be`:

```bash
node --test src/modules/system-infra/system-infra.restart.test.js src/modules/system-backup/system-backup.service.test.js
```

Expected: restart 5 pass, và test backup vẫn pass.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/system-infra/system-infra.docker.js quanluong-app-be/src/modules/system-infra/system-infra.restart.js quanluong-app-be/src/modules/system-infra/system-infra.restart.test.js quanluong-app-be/src/modules/system-infra/system-infra.controller.js quanluong-app-be/src/modules/system-infra/system-infra.routes.js packages/shared/src/features/system-infra/api/systemInfraApi.js packages/shared/src/pages/dashboard/superadmin/SuperadminInfraPanel.jsx
git commit -m "$(cat <<'EOF'
feat(infra): restart an allowlisted container from the health page

EOF
)"
```
