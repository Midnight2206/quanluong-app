import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const prismaMonthlyFindUnique = mock.fn(async () => null);

mock.module("../../infra/database/prisma/prisma.client.js", {
  exports: {
    prisma: {
      chungTuBkmhMonthly: {
        findUnique: prismaMonthlyFindUnique,
      },
    },
  },
});

const { resolvePnkMonthlyFromBkmhSlices } = await import("./chung-tu-data-resolver.service.js");

test.beforeEach(() => {
  prismaMonthlyFindUnique.mock.resetCalls();
});

test("resolvePnkMonthlyFromBkmhSlices throws clear error when no BKMH monthly exists", async () => {
  prismaMonthlyFindUnique.mock.mockImplementation(async () => null);

  await assert.rejects(
    resolvePnkMonthlyFromBkmhSlices({
      storageUnitId: 9,
      periodMonth: "2026-06",
      resolveSettingsForSlips: () => ({ donVi: "Kho A" }),
    }),
    /Vui lòng xuất BKMH trước khi xuất PNK/,
  );
});

test("resolvePnkMonthlyFromBkmhSlices skips empty days and re-aggregates same-price rows", async () => {
  prismaMonthlyFindUnique.mock.mockImplementation(async () => ({
    id: 91,
    unitIdsJson: [10, 11],
    slices: [
      {
        id: 1,
        sortKey: "2026-06-01-a",
        soChungTu: "062601",
        periodDate: new Date("2026-06-01T00:00:00.000Z"),
        recipientUnitId: 10,
        recipientUnitName: "Bep A",
        ngayThangNam: "Ngay 01 thang 06 nam 2026",
        detailRowsJson: [
          {
            stt: 1,
            tenHang: "Gao",
            maSo: "G01",
            dvt: "Kg",
            commodityId: 7,
            quantity: 2,
            unitPrice: 10000,
            amount: 20000,
          },
        ],
      },
      {
        id: 2,
        sortKey: "2026-06-01-b",
        soChungTu: "062601B",
        periodDate: new Date("2026-06-01T00:00:00.000Z"),
        recipientUnitId: 11,
        recipientUnitName: "Bep B",
        ngayThangNam: "Ngay 01 thang 06 nam 2026",
        detailRowsJson: [
          {
            stt: 1,
            tenHang: "Gao",
            maSo: "G01",
            dvt: "Kg",
            commodityId: 7,
            quantity: 3,
            unitPrice: 10000,
            amount: 30000,
          },
          {
            stt: 2,
            tenHang: "Gao",
            maSo: "G01",
            dvt: "Kg",
            commodityId: 7,
            quantity: 1,
            unitPrice: 12000,
            amount: 12000,
          },
        ],
      },
      {
        id: 3,
        sortKey: "2026-06-02",
        soChungTu: "062602",
        periodDate: new Date("2026-06-02T00:00:00.000Z"),
        recipientUnitId: 10,
        recipientUnitName: "Bep A",
        ngayThangNam: "Ngay 02 thang 06 nam 2026",
        detailRowsJson: [],
      },
    ],
  }));

  const result = await resolvePnkMonthlyFromBkmhSlices({
    storageUnitId: 9,
    periodMonth: "2026-06",
    resolveSettingsForSlips: () => ({ donVi: "Kho A" }),
  });

  assert.equal(prismaMonthlyFindUnique.mock.callCount(), 1);
  assert.deepEqual(prismaMonthlyFindUnique.mock.calls[0].arguments[0], {
    where: {
      storageUnitId_periodMonth: {
        storageUnitId: 9,
        periodMonth: "2026-06",
      },
    },
    select: {
      id: true,
      unitIdsJson: true,
      slices: {
        select: {
          id: true,
          sortKey: true,
          soChungTu: true,
          periodDate: true,
          recipientUnitId: true,
          recipientUnitName: true,
          ngayThangNam: true,
          detailRowsJson: true,
        },
        orderBy: [{ sortKey: "asc" }, { id: "asc" }],
      },
    },
  });

  assert.equal(result.sheetContexts.length, 1);
  assert.equal(result.sheetContexts[0].periodDate, "2026-06-01");
  assert.equal(result.sheetContexts[0].aggregationMode, "by-day");
  assert.equal(result.sheetContexts[0].canCuBkmh, "Theo BKMH số: 062601 ngày 01 tháng 06 năm 2026; Theo BKMH số: 062601B ngày 01 tháng 06 năm 2026");
  assert.equal(result.sheetContexts[0].detailRows.length, 2);
  assert.deepEqual(
    result.sheetContexts[0].detailRows.map((row) => ({
      soLuong: row.soLuong,
      unitPrice: row.unitPrice,
      thanhTien: row.thanhTien,
    })),
    [
      { soLuong: 5, unitPrice: 10000, thanhTien: "50.000" },
      { soLuong: 1, unitPrice: 12000, thanhTien: "12.000" },
    ],
  );
  assert.equal(result.rootContext.sheetContexts.length, 1);
  assert.equal(result.rootContext.aggregationMode, "by-day");
  assert.equal(result.rootContext.tongTien, "62.000");
  assert.equal(result.rootContext.canCuBkmh, result.sheetContexts[0].canCuBkmh);
});
