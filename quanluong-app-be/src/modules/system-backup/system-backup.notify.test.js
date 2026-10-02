import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { backupReportRecipients, drainBackupNotify } from "./system-backup.notify.js";

test("email superadmin bỏ địa chỉ .local và trùng", () => {
  const list = backupReportRecipients(
    [
      { email: "a@example.com" },
      { email: "A@example.com" },
      { email: "superadmin@quanluong.local" },
    ],
    "b@example.com",
  );
  assert.deepEqual(list, ["a@example.com", "b@example.com"]);
});

test("drainBackupNotify gửi đúng một phiếu rồi xoá", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ql-backup-mail-"));
  try {
    await mkdir(path.join(root, "requests"));
    await writeFile(
      path.join(root, "requests", "notify.json"),
      JSON.stringify({ ok: false, day: "2026-10-03", detail: "thiếu rclone" }),
    );
    const seen = [];
    const ran = await drainBackupNotify(root, async (body) => {
      seen.push(body);
    });
    assert.equal(ran, true);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].day, "2026-10-03");
    assert.equal(seen[0].ok, false);
    await assert.rejects(readFile(path.join(root, "requests", "notify.json"), "utf8"));
    assert.equal(await drainBackupNotify(root, async () => seen.push("again")), false);
    assert.equal(seen.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
