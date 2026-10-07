import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  isBackupDate,
  queueBackup,
  queueRestore,
  readBackupLogTail,
  readBackupState,
} from "./system-backup.service.js";

test("isBackupDate chỉ nhận YYYY-MM-DD", () => {
  assert.equal(isBackupDate("2026-10-03"), true);
  assert.equal(isBackupDate("2026-10-3"), false);
  assert.equal(isBackupDate("../2026-10-03"), false);
});

test("queueRestore ghi đúng một request cho ngày có trong manifest", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ql-backup-"));
  try {
    await writeFile(
      path.join(root, "manifest.json"),
      JSON.stringify({
        keep: 10,
        driveReady: true,
        versions: [{ date: "2026-10-03", db: true, document: true, qdrant: true, media: true, bytes: 1 }],
      }),
    );
    const status = await queueRestore("2026-10-03", root);
    assert.equal(status.state, "running");
    assert.equal(status.date, "2026-10-03");
    const req = JSON.parse(await readFile(path.join(root, "requests", "restore.json"), "utf8"));
    assert.equal(req.date, "2026-10-03");
    await assert.rejects(queueRestore("2026-10-03", root), (error) => error.statusCode === 409);
    const listed = await readBackupState(root);
    assert.equal(listed.versions.length, 1);
    assert.equal(listed.status.state, "running");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("queueBackup từ chối khi chưa gắn thư mục backup", async () => {
  const root = path.join(tmpdir(), `ql-backup-unmounted-${Date.now()}`);
  await assert.rejects(queueBackup(root), (error) => {
    assert.equal(error.statusCode, 503);
    assert.equal(error.message, "Chưa gắn thư mục backup.");
    return true;
  });
  await assert.rejects(access(root), (error) => error.code === "ENOENT");
});

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
