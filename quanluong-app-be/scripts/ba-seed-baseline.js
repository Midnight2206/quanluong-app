/**
 * Nạp baseline BA vào BaBaselineDoc.
 * Dùng: node scripts/ba-seed-baseline.js [thư-mục-kit]
 * Kit (tham số > BA_KIT_DIR > /app/ba-kit > <repo>/docs/ba-kit):
 *   00-huong-dan-tro-ly-ba.md, 01-nghiep-vu-chung.md, 02-mau-ho-so-don-vi.md, 03-bo-cau-hoi.md.
 * Quy tắc sổ (BA_QUY_TAC_DIR > /app/quy-tac > <repo>/docs/so-sach-bep-an/quy-tac):
 *   map QUY_TAC_FILES. Thêm file sau: docKey mới trong BA_DOC_KEYS + một dòng map (không migration).
 * Chỉ đăng phiên bản mới khi nội dung khác bản mới nhất (chạy lại an toàn).
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BA_DOC_KEYS } from "../src/modules/ba-profiles/ba-profiles.utils.js";

const KIT_FILES = {
  "huong-dan": "00-huong-dan-tro-ly-ba.md",
  "nghiep-vu-chung": "01-nghiep-vu-chung.md",
  "mau-ho-so": "02-mau-ho-so-don-vi.md",
  "bo-cau-hoi": "03-bo-cau-hoi.md",
};

/** docKey → file trong docs/so-sach-bep-an/quy-tac. */
const QUY_TAC_FILES = {
  "quy-tac-phu-luc": "10_phu_luc_cuoi_so.md",
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function titleOf(markdown, fallback) {
  const m = /^#\s+(.+)$/m.exec(markdown);
  return (m ? m[1] : fallback).trim().slice(0, 255);
}

/**
 * explicit (tham số CLI) thắng tuyệt đối.
 * Không thì lấy thư mục đầu tiên trong [env, ...relatives] có file marker.
 */
function resolveMarkedDir({ explicit, envDir, relatives, marker, fromDir = scriptDir }) {
  if (explicit) return path.resolve(explicit);
  const candidates = [envDir, ...relatives.map((rel) => path.resolve(fromDir, rel))].filter(Boolean);
  const found = candidates.find((d) => existsSync(path.join(d, marker)));
  if (!found) throw new Error(`Không thấy ${marker}. Đã thử: ${candidates.join(", ")}`);
  return found;
}

function resolveKitDir(arg) {
  return resolveMarkedDir({
    explicit: arg,
    envDir: process.env.BA_KIT_DIR,
    relatives: ["../ba-kit", "../../docs/ba-kit"],
    marker: KIT_FILES["huong-dan"],
  });
}

function resolveQuyTacDir() {
  return resolveMarkedDir({
    envDir: process.env.BA_QUY_TAC_DIR,
    relatives: ["../quy-tac", "../../docs/so-sach-bep-an/quy-tac"],
    marker: QUY_TAC_FILES["quy-tac-phu-luc"],
  });
}

function assertSeedKeys(files) {
  for (const docKey of Object.keys(files)) {
    if (!BA_DOC_KEYS.includes(docKey)) {
      throw new Error(`docKey "${docKey}" chưa có trong BA_DOC_KEYS (cột VarChar 40, thêm vào mảng — không migration).`);
    }
  }
}

async function publishFiles(dir, files, { getLatestBaselineDoc, publishBaselineDoc }) {
  for (const [docKey, file] of Object.entries(files)) {
    const content = await readFile(path.join(dir, file), "utf8");
    const latest = await getLatestBaselineDoc(docKey);
    if (latest?.contentMarkdown === content) {
      console.log(`${docKey}: giữ v${latest.version} (không đổi)`);
      continue;
    }
    const row = await publishBaselineDoc({
      docKey,
      title: titleOf(content, file),
      contentMarkdown: content,
      actor: "script:ba-seed-baseline",
    });
    const rules = Array.isArray(row.ruleIds) ? ` · ${row.ruleIds.length} CHUNG-xx` : "";
    console.log(`${docKey}: đăng v${row.version}${rules}`);
  }
}

async function main() {
  assertSeedKeys(KIT_FILES);
  assertSeedKeys(QUY_TAC_FILES);
  const { prisma } = await import("../src/infra/database/prisma/prisma.client.js");
  const { getLatestBaselineDoc, publishBaselineDoc } = await import("../src/modules/ba-profiles/ba-profiles.service.js");
  const deps = { getLatestBaselineDoc, publishBaselineDoc };
  try {
    const kitDir = resolveKitDir(process.argv[2]);
    const quyTacDir = resolveQuyTacDir();
    console.log(`kit: ${kitDir}`);
    await publishFiles(kitDir, KIT_FILES, deps);
    console.log(`quy-tac: ${quyTacDir}`);
    await publishFiles(quyTacDir, QUY_TAC_FILES, deps);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  });
}

export { KIT_FILES, QUY_TAC_FILES, assertSeedKeys, resolveMarkedDir, resolveQuyTacDir, titleOf };
