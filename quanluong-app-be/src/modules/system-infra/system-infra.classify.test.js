import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyBackupLog,
  classifyContainer,
  classifyDisk,
  WATCHED_CONTAINERS,
} from "./system-infra.classify.js";

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

