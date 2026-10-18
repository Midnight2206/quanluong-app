/**
 * Nạp bộ nghiệp vụ chung (kit BA) vào BaBaselineDoc.
 * Dùng: node scripts/ba-seed-baseline.js [thư-mục-kit]
 * Mặc định (không truyền thư mục): $BA_KIT_DIR, rồi /app/ba-kit (image backend), rồi <repo>/docs/ba-kit.
 * Thư mục chứa 00-huong-dan-tro-ly-ba.md, 01-nghiep-vu-chung.md, 02-mau-ho-so-don-vi.md, 03-bo-cau-hoi.md.
 * Chỉ đăng phiên bản mới khi nội dung khác bản mới nhất (chạy lại an toàn).
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/infra/database/prisma/prisma.client.js";
import { getLatestBaselineDoc, publishBaselineDoc } from "../src/modules/ba-profiles/ba-profiles.service.js";

const FILES = {
  "huong-dan": "00-huong-dan-tro-ly-ba.md",
  "nghiep-vu-chung": "01-nghiep-vu-chung.md",
  "mau-ho-so": "02-mau-ho-so-don-vi.md",
  "bo-cau-hoi": "03-bo-cau-hoi.md",
};

function titleOf(markdown, fallback) {
  const m = /^#\s+(.+)$/m.exec(markdown);
  return (m ? m[1] : fallback).trim().slice(0, 255);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

/** Thư mục kit: tham số > BA_KIT_DIR > <be-root>/ba-kit (container /app/ba-kit) > <repo>/docs/ba-kit. */
function resolveKitDir(arg) {
  if (arg) return path.resolve(arg);
  const candidates = [
    process.env.BA_KIT_DIR,
    path.resolve(scriptDir, "../ba-kit"),
    path.resolve(scriptDir, "../../docs/ba-kit"),
  ].filter(Boolean);
  const found = candidates.find((d) => existsSync(path.join(d, FILES["huong-dan"])));
  if (!found) throw new Error(`Không thấy thư mục kit. Đã thử: ${candidates.join(", ")}`);
  return found;
}

async function main() {
  const dir = resolveKitDir(process.argv[2]);
  console.log(`kit: ${dir}`);
  for (const [docKey, file] of Object.entries(FILES)) {
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

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
