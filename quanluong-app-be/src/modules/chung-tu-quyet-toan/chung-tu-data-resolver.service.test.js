import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const {
  aggregateLinesToDetailRows,
  attachDocNumbersToContexts,
  materializeSignatureBlockForRender,
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

test("aggregateLinesToDetailRows cleans float noise in quantity", () => {
  const rows = aggregateLinesToDetailRows([
    {
      commodity: { id: 1, name: "Dầu", measureUnit: "Lít" },
      quantity: 0.1,
      unitPrice: 10000,
      amount: 1000,
    },
    {
      commodity: { id: 1, name: "Dầu", measureUnit: "Lít" },
      quantity: 0.2,
      unitPrice: 10000,
      amount: 2000,
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].soLuong, 0.3);
  assert.equal(rows[0].thucXuat, 0.3);
  assert.equal(String(rows[0].soLuong), "0.3");
  assert.equal(String(rows[0].soLuong).includes("999"), false);
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

test("resolveDocumentNumberFields uses allocation soChungTu when provided", () => {
  const result = resolveDocumentNumberFields({
    settings: { soChungTu: "BK-999", quyenSo: "Q01" },
    parts: { ngay: "15", thang: "06", nam: "2026" },
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    allocation: { quyenSo: "0626", soChungTu: "0003" },
  });
  assert.equal(result.quyenSo, "0626");
  assert.equal(result.soChungTu, "0003");
});

test("resolveDocumentNumberFields no longer builds mmyydd soChungTu for bang ke", () => {
  const result = resolveDocumentNumberFields({
    settings: {},
    parts: { ngay: "15", thang: "06", nam: "2026" },
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
  });
  assert.equal(result.quyenSo, "0626");
  assert.equal(result.soChungTu, "");
  assert.notEqual(result.soChungTu, "062615");
});

test("attachDocNumbersToContexts writes sheetKey and pad soChungTu", async () => {
  const contexts = [
    { periodDate: "2026-06-01", recipientUnitId: 5, detailRows: [] },
    { periodDate: "2026-06-01", recipientUnitId: 6, detailRows: [] },
  ];
  const calls = [];
  await attachDocNumbersToContexts({
    contexts,
    unitId: 1,
    categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
    periodMonth: "2026-06",
    sheetKeyForContext: (ctx) => `unit:${ctx.recipientUnitId}`,
    allocate: async (args) => {
      calls.push(args);
      return {
        quyenSo: args.quyenSo,
        seq: calls.length,
        soChungTu: String(calls.length).padStart(4, "0"),
      };
    },
  });
  assert.equal(contexts[0].sheetKey, "unit:5");
  assert.equal(contexts[0].soChungTu, "0001");
  assert.equal(contexts[0].so, "0001");
  assert.equal(contexts[0].soPhieu, "0001");
  assert.equal(contexts[0].quyenSo, "0626");
  assert.equal(contexts[1].soChungTu, "0002");
  assert.deepEqual(calls[0].sheetKey, "unit:5");
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

test("resolvePdfHeaderSettings always prefers creating user profile even when empty", () => {
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

  assert.equal(result.donViCapTren, "");
  assert.equal(result.donVi, "");
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
        return { name: "A", signatureName: "Th/tá A", title: "Tài vụ" };
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

test("materializeSignatureBlockForRender turns resolved system slots into static for document-service", () => {
  const result = materializeSignatureBlockForRender({
    columns: 2,
    slots: [
      {
        key: "nguoi_mua",
        label: "Người mua",
        col: 0,
        source: "system",
        catalogNodeId: "bkmh.nguoiMua",
        resolvedName: "Th/tá A",
        resolvedTitle: "Tài vụ",
      },
      {
        key: "thu_truong",
        label: "Thủ trưởng",
        col: 1,
        source: "static",
        static_name: "B",
        resolvedName: null,
      },
      {
        key: "empty_sys",
        label: "X",
        col: 2,
        source: "system",
        catalogNodeId: "bkmh.nguoiMua",
        resolvedName: null,
      },
    ],
  });
  assert.deepEqual(result.slots[0], {
    key: "nguoi_mua",
    label: "Người mua",
    col: 0,
    col_span: 1,
    show_date_line: false,
    source: "static",
    static_name: "Th/tá A",
  });
  assert.equal(result.slots[1].source, "static");
  assert.equal(result.slots[1].static_name, "B");
  assert.equal(result.slots[1].resolvedName, undefined);
  assert.deepEqual(result.slots[2], {
    key: "empty_sys",
    label: "X",
    col: 2,
    col_span: 1,
    show_date_line: false,
    source: "dynamic",
  });
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
    resolvedBkmhBuyer: {
      name: "Nguyễn Văn A",
      signatureName: "Th/tá Nguyễn Văn A",
      title: "Tài vụ",
    },
  });

  assert.equal(result.hoTenNguoiMua, "Nguyễn Văn A");
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
