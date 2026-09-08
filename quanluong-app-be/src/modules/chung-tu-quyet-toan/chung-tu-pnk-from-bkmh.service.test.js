import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const prismaBkmhSliceFindMany = mock.fn(async () => []);

mock.module("../../infra/database/prisma/prisma.client.js", {
  exports: {
    prisma: {
      chungTuBkmhSlice: {
        findMany: prismaBkmhSliceFindMany,
      },
    },
  },
});

const { resolvePnkFromBkmhSlices } = await import("./chung-tu-data-resolver.service.js");

test.beforeEach(() => {
  prismaBkmhSliceFindMany.mock.resetCalls();
});

test("resolvePnkFromBkmhSlices throws clear error when no BKMH slices exist in range", async () => {
  prismaBkmhSliceFindMany.mock.mockImplementation(async () => []);

  await assert.rejects(
    resolvePnkFromBkmhSlices({
      storageUnitId: 9,
      dateFrom: "2026-06-01",
      dateTo: "2026-06-03",
      aggregationMode: "by-day",
      resolveSettingsForSlips: () => ({ donVi: "Kho A" }),
      lyDoNhapKho: "Nhap hang bo sung",
      nhapTaiKho: "Kho tong",
    }),
    /Không có dữ liệu BKMH từ ngày 2026-06-01 đến 2026-06-03/,
  );
});

test("resolvePnkFromBkmhSlices groups by buyerKey and day in by-day mode", async () => {
  prismaBkmhSliceFindMany.mock.mockImplementation(async () => [
    {
      id: 1,
      sortKey: "2026-06-01-a",
      soChungTu: "062601",
      periodDate: new Date("2026-06-01T00:00:00.000Z"),
      recipientUnitId: 10,
      recipientUnitName: "Bep A",
      ngayThangNam: "Ngay 01 thang 06 nam 2026",
      buyerKey: "user:7",
      buyerName: "Nguyen Van A",
      buyerSignatureName: "Th/tá Nguyen Van A",
      buyerTitle: "Tai vu",
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
      buyerKey: "user:7",
      buyerName: "Nguyen Van A",
      buyerSignatureName: "Th/tá Nguyen Van A",
      buyerTitle: "Tai vu",
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
      sortKey: "2026-06-01-c",
      soChungTu: "062601C",
      periodDate: new Date("2026-06-01T00:00:00.000Z"),
      recipientUnitId: 12,
      recipientUnitName: "Bep C",
      ngayThangNam: "Ngay 01 thang 06 nam 2026",
      buyerKey: "name:tran thi b",
      buyerName: "Tran Thi B",
      buyerSignatureName: "Trung uy Tran Thi B",
      buyerTitle: "Hau can",
      detailRowsJson: [
        {
          stt: 1,
          tenHang: "Muoi",
          maSo: "M01",
          dvt: "Kg",
          commodityId: 8,
          quantity: 4,
          unitPrice: 5000,
          amount: 20000,
        },
      ],
    },
    {
      id: 4,
      sortKey: "2026-06-02-empty",
      soChungTu: "062602",
      periodDate: new Date("2026-06-02T00:00:00.000Z"),
      recipientUnitId: 10,
      recipientUnitName: "Bep A",
      ngayThangNam: "Ngay 02 thang 06 nam 2026",
      buyerKey: "user:7",
      buyerName: "Nguyen Van A",
      buyerSignatureName: "Th/tá Nguyen Van A",
      buyerTitle: "Tai vu",
      detailRowsJson: [],
    },
  ]);

  const result = await resolvePnkFromBkmhSlices({
    storageUnitId: 9,
    dateFrom: "2026-06-01",
    dateTo: "2026-06-02",
    aggregationMode: "by-day",
    resolveSettingsForSlips: () => ({ donVi: "Kho A" }),
    lyDoNhapKho: "Nhap hang bo sung",
    nhapTaiKho: "Kho tong",
  });

  assert.equal(prismaBkmhSliceFindMany.mock.callCount(), 1);
  assert.deepEqual(prismaBkmhSliceFindMany.mock.calls[0].arguments[0], {
    where: {
      monthly: {
        is: {
          storageUnitId: 9,
        },
      },
      periodDate: {
        gte: new Date("2026-06-01T00:00:00.000Z"),
        lte: new Date("2026-06-02T23:59:59.999Z"),
      },
    },
    select: {
      id: true,
      sortKey: true,
      soChungTu: true,
      periodDate: true,
      recipientUnitId: true,
      recipientUnitName: true,
      ngayThangNam: true,
      detailRowsJson: true,
      buyerKey: true,
      buyerName: true,
      buyerSignatureName: true,
      buyerTitle: true,
    },
    orderBy: [{ periodDate: "asc" }, { sortKey: "asc" }, { id: "asc" }],
  });

  assert.deepEqual(
    result.sheetContexts.map((ctx) => ({
      periodDate: ctx.periodDate,
      buyerKey: ctx.buyerKey,
      nguoiGiaoHang: ctx.nguoiGiaoHang,
      diaChi: ctx.diaChi,
      lyDoNhapKho: ctx.lyDoNhapKho,
      nhapTaiKho: ctx.nhapTaiKho,
      buyerSignatureName: ctx.buyerSignatureName,
      aggregationMode: ctx.aggregationMode,
    })),
    [
      {
        periodDate: "2026-06-01",
        buyerKey: "user:7",
        nguoiGiaoHang: "Nguyen Van A",
        diaChi: "Tai vu",
        lyDoNhapKho: "Nhap hang bo sung",
        nhapTaiKho: "Kho tong",
        buyerSignatureName: "Th/tá Nguyen Van A",
        aggregationMode: "by-day",
      },
      {
        periodDate: "2026-06-01",
        buyerKey: "name:tran thi b",
        nguoiGiaoHang: "Tran Thi B",
        diaChi: "Hau can",
        lyDoNhapKho: "Nhap hang bo sung",
        nhapTaiKho: "Kho tong",
        buyerSignatureName: "Trung uy Tran Thi B",
        aggregationMode: "by-day",
      },
    ],
  );
  assert.equal(
    result.sheetContexts[0].canCuPnk,
    "Căn cứ vào BKMH số 062601 ngày 01 tháng 06 năm 2026 của đ/c Nguyen Van A, Căn cứ vào BKMH số 062601B ngày 01 tháng 06 năm 2026 của đ/c Nguyen Van A",
  );
  assert.equal(result.sheetContexts[0].detailRows.length, 2);
  assert.deepEqual(
    result.sheetContexts[0].detailRows.map((row) => ({
      soLuong: row.soLuong,
      unitPrice: row.unitPrice,
      thanhTien: row.thanhTien,
    })),
    [
      { soLuong: "5", unitPrice: 10000, thanhTien: "50.000" },
      { soLuong: "1", unitPrice: 12000, thanhTien: "12.000" },
    ],
  );
  assert.equal(result.rootContext.sheetContexts.length, 2);
  assert.equal(result.rootContext.aggregationMode, "by-day");
  assert.equal(result.rootContext.lyDoNhapKho, "Nhap hang bo sung");
  assert.equal(result.rootContext.nhapTaiKho, "Kho tong");
});

test("resolvePnkFromBkmhSlices groups one buyer across days in full mode", async () => {
  prismaBkmhSliceFindMany.mock.mockImplementation(async () => [
    {
      id: 1,
      sortKey: "2026-06-01",
      soChungTu: "062601",
      periodDate: new Date("2026-06-01T00:00:00.000Z"),
      recipientUnitId: 10,
      recipientUnitName: "Bep A",
      ngayThangNam: "Ngay 01 thang 06 nam 2026",
      buyerKey: "user:7",
      buyerName: "Nguyen Van A",
      buyerSignatureName: "Th/tá Nguyen Van A",
      buyerTitle: "Tai vu",
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
      sortKey: "2026-06-02",
      soChungTu: "062602",
      periodDate: new Date("2026-06-02T00:00:00.000Z"),
      recipientUnitId: 10,
      recipientUnitName: "Bep A",
      ngayThangNam: "Ngay 02 thang 06 nam 2026",
      buyerKey: "user:7",
      buyerName: "Nguyen Van A",
      buyerSignatureName: "Th/tá Nguyen Van A",
      buyerTitle: "Tai vu",
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
      ],
    },
  ]);

  const result = await resolvePnkFromBkmhSlices({
    storageUnitId: 9,
    dateFrom: "2026-06-01",
    dateTo: "2026-06-02",
    aggregationMode: "full",
    resolveSettingsForSlips: () => ({ donVi: "Kho A" }),
    lyDoNhapKho: "Nhap hang bo sung",
    nhapTaiKho: "Kho tong",
  });

  assert.equal(result.sheetContexts.length, 1);
  assert.equal(result.sheetContexts[0].buyerKey, "user:7");
  assert.equal(result.sheetContexts[0].aggregationMode, "full");
  assert.equal(result.sheetContexts[0].nguoiGiaoHang, "Nguyen Van A");
  assert.equal(result.sheetContexts[0].diaChi, "Tai vu");
  assert.equal(result.sheetContexts[0].lyDoNhapKho, "Nhap hang bo sung");
  assert.equal(result.sheetContexts[0].nhapTaiKho, "Kho tong");
  assert.equal(
    result.sheetContexts[0].canCuPnk,
    "Căn cứ vào BKMH số 062601 ngày 01 tháng 06 năm 2026 của đ/c Nguyen Van A, Căn cứ vào BKMH số 062602 ngày 02 tháng 06 năm 2026 của đ/c Nguyen Van A",
  );
  assert.deepEqual(
    result.sheetContexts[0].detailRows.map((row) => ({
      soLuong: row.soLuong,
      unitPrice: row.unitPrice,
      thanhTien: row.thanhTien,
    })),
    [{ soLuong: "5", unitPrice: 10000, thanhTien: "50.000" }],
  );
  assert.equal(result.rootContext.sheetContexts.length, 1);
  assert.equal(result.rootContext.aggregationMode, "full");
  assert.equal(result.rootContext.lyDoNhapKho, "Nhap hang bo sung");
  assert.equal(result.rootContext.nhapTaiKho, "Kho tong");
});

test("resolvePnkFromBkmhSlices throws 400 when a source slice misses buyerKey", async () => {
  prismaBkmhSliceFindMany.mock.mockImplementation(async () => [
    {
      id: 1,
      sortKey: "2026-06-01-a",
      soChungTu: "062601",
      periodDate: new Date("2026-06-01T00:00:00.000Z"),
      recipientUnitId: 10,
      recipientUnitName: "Bep A",
      ngayThangNam: "Ngay 01 thang 06 nam 2026",
      buyerKey: "",
      buyerName: "Nguyen Van A",
      buyerSignatureName: "Th/tá Nguyen Van A",
      buyerTitle: "Tai vu",
      detailRowsJson: [
        {
          stt: 1,
          tenHang: "Gao",
          quantity: 2,
          unitPrice: 10000,
          amount: 20000,
        },
      ],
    },
  ]);

  await assert.rejects(
    resolvePnkFromBkmhSlices({
      storageUnitId: 9,
      dateFrom: "2026-06-01",
      dateTo: "2026-06-01",
      aggregationMode: "by-day",
      resolveSettingsForSlips: () => ({ donVi: "Kho A" }),
      lyDoNhapKho: "Nhap hang bo sung",
      nhapTaiKho: "Kho tong",
    }),
    (error) => {
      assert.equal(error?.statusCode, 400);
      assert.match(
        String(error?.message),
        /BKMH thiếu thông tin người mua trên slice\. Vui lòng xuất lại BKMH trước khi xuất PNK\./,
      );
      return true;
    },
  );
});
