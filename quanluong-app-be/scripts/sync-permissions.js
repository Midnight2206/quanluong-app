/**
 * Đồng bộ catalog quyền từ route definitions vào DB + cập nhật superadmin type + seed ma trận cấp.
 * Chạy: npm run sync:permissions
 * Tùy chọn: ASSIGN_ADMIN_DEFAULTS=true để gán thêm gói DEFAULT_ADMIN cho type admin.
 */
import { ROUTE_PERMISSION_DEFINITIONS } from "../src/app/route-permissions.js";
import { syncPermissionsFromRoutes } from "../src/modules/auth/auth.service.js";
import { prisma } from "../src/infra/database/prisma/prisma.client.js";
import { redis } from "../src/infra/cache/redis.client.js";
import { ensureUnitLevelPermissionCapsSeed } from "../src/shared/permissions/unit-level-cap.service.js";
import { DEFAULT_ADMIN_PERMISSION_CODES } from "../src/shared/constants/default-admin-permissions.js";

const DEPRECATED_PERMISSION_CODES = [
  "jobTitles.applyDown",
  "lttp.commodities.applyDown",
  "lttp.prices.applyDown",
];

async function assignPermissionsToType({ typeId, permissionCodes }) {
  if (!permissionCodes.length) {
    return;
  }

  const permissions = await prisma.permission.findMany({
    where: { code: { in: permissionCodes } },
    select: { id: true },
  });

  await prisma.$transaction(
    permissions.map((permission) =>
      prisma.typePermission.upsert({
        where: {
          typeId_permissionId: {
            typeId,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          typeId,
          permissionId: permission.id,
        },
      }),
    ),
  );
}

async function main() {
  await syncPermissionsFromRoutes(ROUTE_PERMISSION_DEFINITIONS);
  await prisma.permission.deleteMany({
    where: { code: { in: DEPRECATED_PERMISSION_CODES } },
  });

  const allPermissions = await prisma.permission.findMany({ select: { code: true } });
  const superadminType = await prisma.type.findUnique({
    where: { name: "superadmin" },
    select: { id: true },
  });

  if (superadminType) {
    await assignPermissionsToType({
      typeId: superadminType.id,
      permissionCodes: allPermissions.map((p) => p.code),
    });
  }

  const adminType = await prisma.type.findUnique({
    where: { name: "admin" },
    select: { id: true },
  });
  if (adminType) {
    await assignPermissionsToType({
      typeId: adminType.id,
      permissionCodes: DEFAULT_ADMIN_PERMISSION_CODES,
    });
  }

  await ensureUnitLevelPermissionCapsSeed();

  const kitchen = allPermissions.filter((p) => p.code.includes("kitchen"));
  console.log(`Đã đồng bộ ${allPermissions.length} quyền. kitchenBooks: ${kitchen.map((p) => p.code).join(", ") || "—"}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    redis?.disconnect();
    await prisma.$disconnect();
  });
