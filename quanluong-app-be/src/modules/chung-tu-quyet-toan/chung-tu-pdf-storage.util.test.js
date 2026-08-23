import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const {
  buildChungTuPdfRelativePath,
  writeChungTuPdfFile,
  readChungTuPdfFile,
  deleteChungTuPdfFile,
} = await import("./chung-tu-pdf-storage.util.js");

test("chung-tu PDF storage write/read/delete under injected rootDir", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "chung-tu-pdf-"));
  const relativePath = buildChungTuPdfRelativePath({
    categoryKey: "pnk",
    exportKey: "exp-001",
    year: 2026,
  });
  assert.equal(relativePath, "chung-tu-pdf/pnk/2026/exp-001.pdf");

  const buffer = Buffer.from("%PDF-1.4 test");
  const abs = await writeChungTuPdfFile(relativePath, buffer, rootDir);
  assert.equal(abs, path.join(rootDir, relativePath));

  const read = await readChungTuPdfFile(relativePath, rootDir);
  assert.equal(read.toString(), buffer.toString());

  await deleteChungTuPdfFile(relativePath, rootDir);
  await deleteChungTuPdfFile(relativePath, rootDir);

  await fs.rm(rootDir, { recursive: true, force: true });
});
