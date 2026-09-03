import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const {
  aggregateLinesToDetailRows,
  resolveDocumentNumberFields,
  resolvePdfHeaderSettings,
  resolveSystemSignatureSlots,
} = await import("./chung-tu-data-resolver.service.js");
import { CHUNG_TU_CATEGORY_KEYS } from "./chung-tu-category.constants.js";

test("aggregateLinesToDetailRows sums quantity and amount for same commodity", () => {
  const rows = aggregateLinesToDetailRows([
    {
      commodity: { id: 1, code: "G01", name: "Gạo", measureUnit: "Kg" },
      lttpSupplier: { name: "A" },
      quantity: 2,
      unitPrice: 10000,
      amount: 20000,
    },
    {
      commodity: { id: 1, code: "G01", name: "Gạo", measureUnit: "Kg" },
      lttpSupplier: { name: "B" },
      quantity: 3,
      unitPrice: 10000,
      amount: 30000,
    },
    {
      commodity: { id: 2, code: "T01", name: "Thịt", measureUnit: "Kg" },
      lttpSupplier: { name: "A" },
      quantity: 1,
      unitPrice: 50000,
      amount: 50000,
    },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].tenHang, "Gạo");
  assert.equal(rows[0].soLuong, 5);
  assert.equal(rows[0].thanhTien, "50.000");
  assert.equal(rows[0].donGia, "10.000");
  assert.equal(rows[0].nguoiBan, "A, B");
  assert.equal(rows[1].tenHang, "Thịt");
  assert.equal(rows[1].soLuong, 1);
});

test("aggregateLinesToDetailRows keeps separate rows when same commodity has different unitPrice", () => {
  const rows = aggregateLinesToDetailRows([
    {
      commodity: { id: 1, name: "Gạo", measureUnit: "Kg" },
      lttpSupplier: { name: "A" },
      quantity: 2,
      unitPrice: 10000,
      amount: 20000,
    },
    {
      commodity: { id: 1, name: "Gạo", measureUnit: "Kg" },
      lttpSupplier: { name: "A" },
      quantity: 3,
      unitPrice: 12000,
      amount: 36000,
    },
  ]);

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.donGia),
    ["10.000", "12.000"],
  );
  assert.deepEqual(
    rows.map((row) => row.soLuong),
    [2, 3],
  );
  assert.deepEqual(
    rows.map((row) => row.stt),
    [1, 2],
  );
  // Must not be average 11000 → "11.000"
  assert.notEqual(rows[0].donGia, "11.000");
  assert.notEqual(rows[1].donGia, "11.000");
});

test("aggregateLinesToDetailRows renumbers stt after merge", () => {
  const rows = aggregateLinesToDetailRows([
    {
      commodity: { id: 10, name: "Muối" },
      quantity: 1,
      unitPrice: 1000,
      amount: 1000,
    },
    {
      commodity: { id: 11, name: "Đường" },
      quantity: 2,
      unitPrice: 2000,
      amount: 4000,
    },
  ]);
  assert.deepEqual(
    rows.map((row) => row.stt),
    [1, 2],
  );
});

test("resolveDocumentNumberFields builds quyenSo + day for bang ke", () => {
  const parts = { ngay: "1", thang: "06", nam: "2026" };
  const result = resolveDocumentNumberFields({
    settings: {},
    parts,
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
  });
  assert.equal(result.soChungTu, "062601");
  assert.equal(result.quyenSo, "0626");
});

test("resolveDocumentNumberFields pads single-digit day and keeps two-digit day", () => {
  assert.equal(
    resolveDocumentNumberFields({
      settings: {},
      parts: { ngay: "15", thang: "06", nam: "2026" },
      categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    }).soChungTu,
    "062615",
  );
  assert.equal(
    resolveDocumentNumberFields({
      settings: {},
      parts: { ngay: "01", thang: "06", nam: "2026" },
      categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    }).soChungTu,
    "062601",
  );
});

test("resolveDocumentNumberFields ignores manual overrides for bang ke", () => {
  const parts = { ngay: "15", thang: "06", nam: "2026" };
  const result = resolveDocumentNumberFields({
    settings: { soChungTu: "BK-999", quyenSo: "Q01" },
    parts,
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
  });
  assert.equal(result.soChungTu, "062615");
  assert.equal(result.quyenSo, "0626");
});

test("resolvePdfHeaderSettings uses exporting user profile for don vi fields", () => {
  const result = resolvePdfHeaderSettings({
    mergedSettings: {
      donViCapTren: "Unit profile cap tren",
      donVi: "Unit profile don vi",
      donViSo: "Legacy unit profile line",
    },
    rawSettings: {},
    exportingUserProfile: {
      donViCapTren: "Su doan 372",
      donVi: "Tieu doan 1",
    },
    categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
  });

  assert.equal(result.donViCapTren, "Su doan 372");
  assert.equal(result.donVi, "Tieu doan 1");
  assert.equal(result.donViSo, "Tieu doan 1");
});

test("resolvePdfHeaderSettings keeps unit-profile don vi when profile fields empty", () => {
  const result = resolvePdfHeaderSettings({
    mergedSettings: {
      donViCapTren: "Unit profile cap tren",
      donVi: "Unit profile don vi",
      donViSo: "Legacy unit profile line",
    },
    rawSettings: {},
    exportingUserProfile: {
      donViCapTren: null,
      donVi: "  ",
    },
    categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
  });

  assert.equal(result.donViCapTren, "Unit profile cap tren");
  assert.equal(result.donVi, "Unit profile don vi");
  assert.equal(result.donViSo, "Legacy unit profile line");
});

test("resolvePdfHeaderSettings prefers slip buyer over BKMH header settings", () => {
  const result = resolvePdfHeaderSettings({
    mergedSettings: {},
    rawSettings: {},
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    bkmhHeaderSettings: {
      hoTenNguoiMua: "Buyer from settings",
      boPhan: "Bo phan from settings",
    },
    slips: [
      {
        slipNo: 1,
        buyerDisplayName: "Buyer from slip",
      },
    ],
  });

  assert.equal(result.hoTenNguoiMua, "Buyer from slip");
  assert.equal(result.nguoiMua, "Buyer from slip");
  assert.equal(result.signerNguoiMua, "Buyer from slip");
});

test("resolvePdfHeaderSettings prefers unit-profile boPhan over BKMH settings", () => {
  const result = resolvePdfHeaderSettings({
    mergedSettings: {
      boPhan: "Bo phan from unit profile",
    },
    rawSettings: {},
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    bkmhHeaderSettings: {
      hoTenNguoiMua: "Buyer from settings",
      boPhan: "Bo phan from settings",
    },
    slips: [
      {
        slipNo: 1,
        buyerDisplayName: "   ",
        buyerUser: {
          username: "   ",
          profile: { fullName: "   " },
        },
      },
    ],
  });

  assert.equal(result.hoTenNguoiMua, "Buyer from settings");
  assert.equal(result.boPhan, "Bo phan from unit profile");
});

test("resolveSystemSignatureSlots resolves system slots via catalog, passes through static/prompt unchanged", async () => {
  let resolveCalled = false;
  const mockCatalog = {
    "bkmh.nguoiMua": {
      resolve: async () => {
        resolveCalled = true;
        return { name: "Th/tá A", title: "Tài vụ" };
      },
    },
  };
  const slots = [
    { label: "Người mua", source: "system", catalogNodeId: "bkmh.nguoiMua" },
    { label: "Thủ trưởng", source: "static", staticName: "B", staticTitle: "Chỉ huy" },
    { label: "Người nhận", source: "prompt" },
  ];
  const result = await resolveSystemSignatureSlots(slots, { storageUnitId: 1 }, mockCatalog);
  assert.equal(resolveCalled, true);
  assert.equal(result[0].resolvedName, "Th/tá A");
  assert.equal(result[0].resolvedTitle, "Tài vụ");
  assert.equal(result[1].resolvedName, null);
  assert.equal(result[2].resolvedName, null);
});

test("resolveSystemSignatureSlots returns null resolvedName when catalog node missing", async () => {
  const slots = [{ label: "X", source: "system", catalogNodeId: "nonexistent.node" }];
  const result = await resolveSystemSignatureSlots(slots, {}, {});
  assert.equal(result[0].resolvedName, null);
});

test("resolvePdfHeaderSettings prefers resolvedBkmhBuyer over slip buyer", () => {
  const result = resolvePdfHeaderSettings({
    mergedSettings: {},
    rawSettings: {},
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    bkmhHeaderSettings: {
      hoTenNguoiMua: "Buyer from settings",
      boPhan: "Bo phan from settings",
    },
    slips: [{ slipNo: 1, buyerDisplayName: "Buyer from slip" }],
    resolvedBkmhBuyer: { name: "Th/tá Catalog Buyer", title: "Tài vụ" },
  });

  assert.equal(result.hoTenNguoiMua, "Th/tá Catalog Buyer");
  assert.equal(result.boPhan, "Tài vụ");
});

test("resolvePdfHeaderSettings falls back to BKMH settings when slip buyer and boPhan empty", () => {
  const result = resolvePdfHeaderSettings({
    mergedSettings: {
      boPhan: "   ",
    },
    rawSettings: {},
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    bkmhHeaderSettings: {
      hoTenNguoiMua: "Buyer from settings",
      boPhan: "Bo phan from settings",
    },
    slips: [
      {
        slipNo: 1,
        buyerDisplayName: "   ",
        buyerUser: {
          username: "   ",
          profile: { fullName: "   " },
        },
      },
    ],
  });

  assert.equal(result.hoTenNguoiMua, "Buyer from settings");
  assert.equal(result.boPhan, "Bo phan from settings");
});
