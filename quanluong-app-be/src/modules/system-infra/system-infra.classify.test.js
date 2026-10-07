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
