import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const { buildBkmhMonthlySummaryExcelBuffer } = await import("./chung-tu-bkmh-monthly.service.js");

test("buildBkmhMonthlySummaryExcelBuffer writes slice rows for by-day month", async () => {
  const buffer = await buildBkmhMonthlySummaryExcelBuffer({
    aggregationMode: "by-day",
    periodMonth: "2026-06",
    displayName: "BKMH 06/2026 — Kho A",
    slices: [
      {
        soChungTu: "Số: 062601",
        ngayThangNam: "Ngày 01 tháng 06 năm 2026",
        periodDate: "2026-06-01",
        tongTien: 1000000,
      },
      {
        soChungTu: "Số: 062615",
        ngayThangNam: "",
        periodDate: "2026-06-15",
        tongTien: 500000,
      },
    ],
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("TongHop");
  assert.ok(sheet);
  assert.deepEqual(sheet.getRow(1).values.slice(1), [
    "Số chứng từ",
    "Ngày tháng năm",
    "Tổng tiền",
  ]);
  assert.equal(sheet.getRow(2).getCell(1).value, "Số: 062601");
  assert.equal(sheet.getRow(2).getCell(2).value, "Ngày 01 tháng 06 năm 2026");
  assert.equal(sheet.getRow(2).getCell(3).value, 1000000);
  assert.equal(sheet.getRow(3).getCell(2).value, "2026-06-15");
});

test("buildBkmhMonthlySummaryExcelBuffer includes unit column for by-unit", async () => {
  const buffer = await buildBkmhMonthlySummaryExcelBuffer({
    aggregationMode: "by-unit",
    periodMonth: "2026-06",
    slices: [
      {
        soChungTu: "Số: 1",
        ngayThangNam: "Ngày 01 tháng 06 năm 2026",
        recipientUnitName: "Tiểu đoàn 1",
        tongTien: 2000,
      },
    ],
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("TongHop");
  assert.deepEqual(sheet.getRow(1).values.slice(1), [
    "Số chứng từ",
    "Ngày tháng năm",
    "Tên đơn vị",
    "Tổng tiền",
  ]);
  assert.equal(sheet.getRow(2).getCell(3).value, "Tiểu đoàn 1");
});
