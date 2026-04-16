/**
 * Đặt lại trạng thái xác minh email trên mọi user (dev / test).
 * Chạy: node scripts/reset-email-verification.js
 * Docker: docker compose exec quanluong-app-be node scripts/reset-email-verification.js
 */
import "dotenv/config";
import { prisma } from "../src/infra/database/prisma/prisma.client.js";

async function main() {
  const result = await prisma.user.updateMany({
    data: {
      emailVerifiedAt: null,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    },
  });

  console.log(`Đã reset trường xác minh email cho ${result.count} user.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
