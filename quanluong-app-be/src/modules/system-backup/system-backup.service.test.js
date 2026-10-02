import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { isBackupDate, queueRestore, readBackupState } from "./system-backup.service.js";

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
