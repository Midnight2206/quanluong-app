import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const prismaRecipientDefaultFindMany = mock.fn(async () => []);
const prismaUnitFindMany = mock.fn(async () => []);

mock.module("../../infra/database/prisma/prisma.client.js", {
  exports: {
    prisma: {
      lttpRecipientUnitDefaultUser: {
        findMany: prismaRecipientDefaultFindMany,
      },
      unit: {
        findMany: prismaUnitFindMany,
      },
    },
  },
});

const {
  mergeRecipientUnitFillFields,
  loadRecipientUnitFillMap,
  attachRecipientUnitFillToMonthlyContexts,
} = await import("./chung-tu-recipient-unit-fill.service.js");
import { resolveLegacyNamedRangeFieldKey } from "./chung-tu-named-range-display.js";
import {
  getDerivedNamedRangeSetForCategory,
  CHUNG_TU_CATEGORY_KEYS,
} from "./chung-tu-category.constants.js";

test.beforeEach(() => {
  prismaRecipientDefaultFindMany.mock.resetCalls();
  prismaUnitFindMany.mock.resetCalls();
});

test("mergeRecipientUnitFillFields writes recipient fill fields", () => {
  const ctx = { sheetName: "DV A", donVi: "Don vi cap minh", recipientUnitName: "" };
  mergeRecipientUnitFillFields(ctx, {
    nguoiNhanHang: "Nguyễn Văn A",
    nguoiNhan: "Nguyễn Văn A",
    donVi: "Tiểu đoàn 1",
    diaChi: "Phòng hậu cần",
    signatureName: "Th/tá Nguyễn Văn A",
  });
  assert.equal(ctx.nguoiNhanHang, "Nguyễn Văn A");
  assert.equal(ctx.nguoiNhan, "Nguyễn Văn A");
  assert.equal(ctx.donVi, "Don vi cap minh");
  assert.equal(ctx.recipientUnitName, "Tiểu đoàn 1");
  assert.equal(ctx.diaChi, "Phòng hậu cần");
  assert.equal(ctx.signatureName, "Th/tá Nguyễn Văn A");
});

test("loadRecipientUnitFillMap sets nguoiNhan, diaChi, signatureName", async () => {
  prismaRecipientDefaultFindMany.mock.mockImplementation(async () => [
    {
      recipientUnitId: 10,
      user: {
        username: "user.a",
        profile: {
          fullName: "Nguyễn Văn A",
          rankAbbr: "Th/tá",
          department: "Phòng hậu cần",
        },
      },
    },
  ]);
  prismaUnitFindMany.mock.mockImplementation(async () => [{ id: 10, name: "Tiểu đoàn 1" }]);

  const fillMap = await loadRecipientUnitFillMap([10]);
  const fill = fillMap.get(10);
  assert.equal(fill.nguoiNhan, fill.nguoiNhanHang);
  assert.equal(fill.diaChi, "Phòng hậu cần");
  assert.equal(fill.signatureName, "Th/tá Nguyễn Văn A");
  assert.equal(fill.donVi, "Tiểu đoàn 1");
});

test("loadRecipientUnitFillMap signatureName falls back to name without rank", async () => {
  prismaRecipientDefaultFindMany.mock.mockImplementation(async () => [
    {
      recipientUnitId: 11,
      user: {
        username: "user.b",
        profile: { fullName: "Trần Thị B", rankAbbr: "", department: "Kho A" },
      },
    },
  ]);
  prismaUnitFindMany.mock.mockImplementation(async () => [{ id: 11, name: "Kho A" }]);

  const fill = (await loadRecipientUnitFillMap([11])).get(11);
  assert.equal(fill.signatureName, "Trần Thị B");
});

test("attachRecipientUnitFillToMonthlyContexts fills by-day contexts", async () => {
  prismaRecipientDefaultFindMany.mock.mockImplementation(async () => [
    {
      recipientUnitId: 10,
      user: {
        username: "user.a",
        profile: {
          fullName: "Nguyễn Văn A",
          rankAbbr: "Th/tá",
          department: "Phòng hậu cần",
        },
      },
    },
  ]);
  prismaUnitFindMany.mock.mockImplementation(async () => [{ id: 10, name: "Tiểu đoàn 1" }]);

  const monthly = {
    sheetContexts: [{ recipientUnitId: 10, periodDate: "2026-06-05", donVi: "Cap minh" }],
  };
  await attachRecipientUnitFillToMonthlyContexts(monthly, { aggregationMode: "by-day" });
  const ctx = monthly.sheetContexts[0];
  assert.equal(ctx.nguoiNhan, "Nguyễn Văn A");
  assert.equal(ctx.diaChi, "Phòng hậu cần");
  assert.equal(ctx.signatureName, "Th/tá Nguyễn Văn A");
  assert.equal(ctx.donVi, "Cap minh");
  assert.equal(ctx.recipientUnitName, "Tiểu đoàn 1");
});

test("legacy named range keys map nguoiNhanHang and donVi", () => {
  assert.equal(resolveLegacyNamedRangeFieldKey("nguoinhanhang"), "nguoiNhanHang");
  assert.equal(resolveLegacyNamedRangeFieldKey("donvi"), "donVi");
  assert.equal(resolveLegacyNamedRangeFieldKey("diachi"), "donVi");
});

test("PXK and PNK include recipient named ranges", () => {
  const pxk = getDerivedNamedRangeSetForCategory(CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO);
  const pnk = getDerivedNamedRangeSetForCategory(CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO);
  assert.ok(pxk.has("nguoiNhanHang"));
  assert.ok(pxk.has("donVi"));
  assert.ok(pxk.has("nguoiNhan"));
  assert.ok(pxk.has("diaChi"));
  assert.ok(pxk.has("lyDoXuatKho"));
  assert.ok(pxk.has("xuatTaiKho"));
  assert.ok(pxk.has("diaDiem"));
  assert.ok(pnk.has("nguoiNhanHang"));
  assert.ok(pnk.has("donVi"));
  assert.ok(pnk.has("canCuPnk"));
});
