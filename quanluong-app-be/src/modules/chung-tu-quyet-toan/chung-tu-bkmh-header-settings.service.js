import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { CHUNG_TU_CATEGORY_KEYS, assertKnownCategoryKey } from "./chung-tu-category.constants.js";

function assertBkmhCategoryKey(categoryKey) {
  const meta = assertKnownCategoryKey(categoryKey);
  if (meta.key !== CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG) {
    throw new AppError({
      message: "Cấu hình này chỉ áp dụng cho bảng kê mua hàng.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function normalizeOptionalText(value) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new AppError({
      message: "Giá trị phải là chuỗi văn bản hoặc null.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const text = value.trim();
  return text || null;
}

function mapBkmhHeaderSettingsRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    categoryKey: row.categoryKey,
    hoTenNguoiMua: row.hoTenNguoiMua ?? null,
    boPhan: row.boPhan ?? null,
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getChungTuBkmhHeaderSettings({ categoryKey }) {
  assertBkmhCategoryKey(categoryKey);
  const row = await prisma.chungTuBkmhHeaderSettings.findUnique({
    where: { categoryKey },
  });
  return mapBkmhHeaderSettingsRow(row);
}

async function upsertChungTuBkmhHeaderSettings({
  categoryKey,
  hoTenNguoiMua,
  boPhan,
  updatedById,
}) {
  assertBkmhCategoryKey(categoryKey);
  const data = {
    hoTenNguoiMua: normalizeOptionalText(hoTenNguoiMua),
    boPhan: normalizeOptionalText(boPhan),
    updatedById,
  };
  const row = await prisma.chungTuBkmhHeaderSettings.upsert({
    where: { categoryKey },
    create: {
      categoryKey,
      ...data,
    },
    update: data,
  });
  return mapBkmhHeaderSettingsRow(row);
}

export { getChungTuBkmhHeaderSettings, upsertChungTuBkmhHeaderSettings };
