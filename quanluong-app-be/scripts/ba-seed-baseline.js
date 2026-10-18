/**
 * Nạp bộ nghiệp vụ chung (kit BA) vào BaBaselineDoc.
 * Dùng: node scripts/ba-seed-baseline.js <thư-mục-kit>
 * Thư mục chứa 00-huong-dan-tro-ly-ba.md, 01-nghiep-vu-chung.md, 02-mau-ho-so-don-vi.md, 03-bo-cau-hoi.md.
 * Chỉ đăng phiên bản mới khi nội dung khác bản mới nhất (chạy lại an toàn).
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Thiếu thư mục kit: node scripts/ba-seed-baseline.js <dir>");
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
