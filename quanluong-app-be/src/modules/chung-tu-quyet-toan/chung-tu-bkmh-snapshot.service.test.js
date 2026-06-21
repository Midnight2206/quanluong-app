import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBkmhSnapshotRows } from "./chung-tu-bkmh-snapshot.service.js";

test("buildBkmhSnapshotRows expands sheetContexts for by-day BKMH", () => {
  const rows = buildBkmhSnapshotRows(
    {
      signerNguoiMua: "Nguyễn Văn A",
      sheetContexts: [
        {
          sheetName: "15",
          ngayChungTu: "2026-06-15",
          ngay: "15",
          thang: "06",
          nam: "2026",
          soChungTu: "062515",
          quyenSo: "0625",
          tongTienSo: 120000,
        },
        {
          sheetName: "16",
          ngayChungTu: "2026-06-16",
          ngay: "16",
          thang: "06",
          nam: "2026",
          soChungTu: "062516",
          quyenSo: "0625",
          tongTienSo: 80000,
        },
      ],
    },
    { periodMonth: "2026-06", aggregationMode: "by-day" },
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].periodDate, "2026-06-15");
  assert.equal(rows[0].soChungTu, "062515");
  assert.equal(rows[0].tongTien, 120000);
  assert.equal(rows[0].nguoiMua, "Nguyễn Văn A");
  assert.equal(rows[1].periodDate, "2026-06-16");
});

test("buildBkmhSnapshotRows uses root context for full-month BKMH", () => {
  const rows = buildBkmhSnapshotRows(
    {
      signerNguoiMua: "Trần B",
      ngayChungTu: "2026-06-30",
      ngay: "30",
      thang: "06",
      nam: "2026",
      soChungTu: "0630",
      quyenSo: "0625",
      tongTienSo: 500000,
    },
    { periodMonth: "2026-06", aggregationMode: "full" },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].periodDate, "2026-06-30");
  assert.equal(rows[0].tongTien, 500000);
});
