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
