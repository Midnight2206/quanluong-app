import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const prismaFindUnique = mock.fn(async () => null);
const prismaUpsert = mock.fn(async ({ create, update }) => ({
  id: 1,
  categoryKey: create?.categoryKey ?? update?.categoryKey ?? "bang-ke-mua-hang",
  hoTenNguoiMua: create?.hoTenNguoiMua ?? update?.hoTenNguoiMua ?? null,
  boPhan: create?.boPhan ?? update?.boPhan ?? null,
  updatedById: create?.updatedById ?? update?.updatedById ?? 1,
  createdAt: new Date("2026-08-26T08:00:00.000Z"),
  updatedAt: new Date("2026-08-26T08:30:00.000Z"),
}));

mock.module("../../infra/database/prisma/prisma.client.js", {
  exports: {
    prisma: {
      chungTuBkmhHeaderSettings: {
        findUnique: prismaFindUnique,
        upsert: prismaUpsert,
      },
    },
  },
});

const { AppError } = await import("../../errors/app-error.js");
const { ERROR_CODES } = await import("../../errors/error-codes.js");
const {
  getChungTuBkmhHeaderSettings,
  upsertChungTuBkmhHeaderSettings,
} = await import("./chung-tu-bkmh-header-settings.service.js");

test.beforeEach(() => {
  prismaFindUnique.mock.resetCalls();
  prismaUpsert.mock.resetCalls();
});

test("getChungTuBkmhHeaderSettings returns null when settings are missing", async () => {
  prismaFindUnique.mock.mockImplementation(async () => null);

  const result = await getChungTuBkmhHeaderSettings({
    categoryKey: "bang-ke-mua-hang",
  });

  assert.equal(prismaFindUnique.mock.callCount(), 1);
  assert.deepEqual(prismaFindUnique.mock.calls[0].arguments[0], {
    where: { categoryKey: "bang-ke-mua-hang" },
  });
  assert.equal(result, null);
});

test("upsertChungTuBkmhHeaderSettings stores and maps header fields", async () => {
  prismaUpsert.mock.mockImplementation(async () => ({
    id: 7,
    categoryKey: "bang-ke-mua-hang",
    hoTenNguoiMua: "Nguyen Van A",
    boPhan: "Phong Hau can",
    updatedById: 88,
    createdAt: new Date("2026-08-26T08:00:00.000Z"),
    updatedAt: new Date("2026-08-26T08:30:00.000Z"),
  }));

  const result = await upsertChungTuBkmhHeaderSettings({
    categoryKey: "bang-ke-mua-hang",
    hoTenNguoiMua: "Nguyen Van A",
    boPhan: "Phong Hau can",
    updatedById: 88,
  });

  assert.equal(prismaUpsert.mock.callCount(), 1);
  assert.deepEqual(prismaUpsert.mock.calls[0].arguments[0], {
    where: { categoryKey: "bang-ke-mua-hang" },
    create: {
      categoryKey: "bang-ke-mua-hang",
      hoTenNguoiMua: "Nguyen Van A",
      boPhan: "Phong Hau can",
      updatedById: 88,
    },
    update: {
      hoTenNguoiMua: "Nguyen Van A",
      boPhan: "Phong Hau can",
      updatedById: 88,
    },
  });
  assert.deepEqual(result, {
    id: 7,
    categoryKey: "bang-ke-mua-hang",
    hoTenNguoiMua: "Nguyen Van A",
    boPhan: "Phong Hau can",
    updatedById: 88,
    createdAt: "2026-08-26T08:00:00.000Z",
    updatedAt: "2026-08-26T08:30:00.000Z",
  });
});

test("non-BKMH categoryKey throws validation AppError", async () => {
  await assert.rejects(
    () =>
      getChungTuBkmhHeaderSettings({
        categoryKey: "phieu-xuat-kho",
      }),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 400 &&
      error.code === ERROR_CODES.VALIDATION_ERROR &&
      /(chi ap dung cho bang ke mua hang|chỉ áp dụng cho bảng kê mua hàng)/i.test(error.message),
  );
  assert.equal(prismaFindUnique.mock.callCount(), 0);
  assert.equal(prismaUpsert.mock.callCount(), 0);
});
