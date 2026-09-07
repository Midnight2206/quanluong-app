#!/usr/bin/env node
/**
 * Đồng bộ các ChungTuPdfTemplate có status=retired sang document-service.
 *
 * Chạy sau khi document-service đã hỗ trợ retired status và Prisma migrate đã hoàn tất.
 * Chạy: node scripts/sync-chung-tu-pdf-template-status-to-ds.mjs
 */
import "dotenv/config";

import { AppError } from "../src/errors/app-error.js";
import { prisma } from "../src/infra/database/prisma/prisma.client.js";
import { retireTemplate } from "../src/services/document-service.client.js";

function isAlreadyRetiredError(error) {
  return error instanceof AppError && error.statusCode === 409;
}

async function main() {
  const rows = await prisma.chungTuPdfTemplate.findMany({
    where: { status: "retired" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      categoryKey: true,
      documentServiceTemplateId: true,
    },
  });

  console.log(
    `[sync-chung-tu-pdf-template-status-to-ds] found ${rows.length} retired template(s)`,
  );

  if (!rows.length) {
    return;
  }

  let retired = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await retireTemplate(row.documentServiceTemplateId);
      retired += 1;
      console.log(
        `  ok id=${row.id} category=${row.categoryKey} dsTemplateId=${row.documentServiceTemplateId}`,
      );
    } catch (error) {
      if (isAlreadyRetiredError(error)) {
        skipped += 1;
        console.log(
          `  skip id=${row.id} category=${row.categoryKey} dsTemplateId=${row.documentServiceTemplateId} already-retired`,
        );
        continue;
      }

      failed += 1;
      console.error(
        `  fail id=${row.id} category=${row.categoryKey} dsTemplateId=${row.documentServiceTemplateId}:`,
        error?.message || error,
      );
    }
  }

  console.log(
    `[sync-chung-tu-pdf-template-status-to-ds] done: retired=${retired} skipped=${skipped} failed=${failed}`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
