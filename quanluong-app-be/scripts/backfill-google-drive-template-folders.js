/**
 * Backfill folder template `chung-tu-quyet-toan-template` cho user đã liên kết Google Drive.
 *
 * Chạy local: node scripts/backfill-google-drive-template-folders.js
 * Chạy trong docker app: docker compose --env-file .env.docker exec app node scripts/backfill-google-drive-template-folders.js
 */
import "dotenv/config";
import { prisma } from "../src/infra/database/prisma/prisma.client.js";
import { verifyGoogleDriveLinkForUser } from "../src/modules/auth/google-drive-link.service.js";

async function main() {
  const linkedUsers = await prisma.user.findMany({
    where: {
      googleRefreshToken: { not: null },
      googleDriveFolderId: { not: null },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (linkedUsers.length === 0) {
    console.log("Không có user đã liên kết Google Drive để backfill.");
    return;
  }

  const summary = {
    total: linkedUsers.length,
    linked: 0,
    cleared: 0,
    unchecked: 0,
    notLinked: 0,
    failed: 0,
  };

  for (const user of linkedUsers) {
    try {
      const status = await verifyGoogleDriveLinkForUser(user.id);
      if (status?.status === "linked") {
        summary.linked += 1;
      } else if (status?.status === "cleared") {
        summary.cleared += 1;
      } else if (status?.status === "unchecked") {
        summary.unchecked += 1;
      } else if (status?.status === "not_linked") {
        summary.notLinked += 1;
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`Backfill user ${user.id} thất bại:`, error?.message || error);
    }
  }

  console.log("Backfill Google Drive template folder hoàn tất:", summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
