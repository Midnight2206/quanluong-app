import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDerivedNamedRangeMappings,
  enrichFillRulesWithSpreadsheetMeta,
} from "./chung-tu-template-fill-config.service.js";

function spreadsheetMetaWithRanges(ranges) {
  return {
    sheetIdToTitle: new Map([[1, "01"]]),
    namedRanges: ranges.map((item) => ({
      name: item.name,
      range: {
        sheetId: 1,
        startRowIndex: item.startRowIndex ?? 2,
        endRowIndex: item.endRowIndex ?? 3,
        startColumnIndex: item.startColumnIndex ?? 0,
        endColumnIndex: item.endColumnIndex ?? 1,
      },
    })),
  };
}

test("buildDerivedNamedRangeMappings maps camelCase named ranges as single field", () => {
  const meta = spreadsheetMetaWithRanges([
    { name: "soChungTu", startColumnIndex: 10, endColumnIndex: 11 },
    { name: "quyenSo", startColumnIndex: 5, endColumnIndex: 9 },
    { name: "nguoiMua", startColumnIndex: 0, endColumnIndex: 5 },
    {
      name: "tongTienBangChu",
      startColumnIndex: 0,
      endColumnIndex: 8,
    },
    {
      name: "ngayThangNam",
      startColumnIndex: 0,
      endColumnIndex: 6,
    },
  ]);

  const mappings = buildDerivedNamedRangeMappings(meta, "bang-ke-mua-hang");
  const byName = Object.fromEntries(mappings.map((m) => [m.rangeName, m]));

  assert.equal(byName.soChungTu.fieldKey, "soChungTu");
  assert.equal(byName.soChungTu.rule, "field");
  assert.equal(byName.quyenSo.fieldKey, "quyenSo");
  assert.equal(byName.quyenSo.rule, "field");
  assert.equal(byName.tongTienBangChu.fieldKey, "tongTienBangChu");
  assert.equal(byName.tongTienBangChu.rule, "field");
  assert.equal(byName.ngayThangNam.fieldKey, "ngayThangNam");
  assert.equal(byName.nguoiMua, undefined);
});

test("buildDerivedNamedRangeMappings still accepts legacy snake_case", () => {
  const meta = spreadsheetMetaWithRanges([
    { name: "so_chung_tu", startColumnIndex: 10, endColumnIndex: 11 },
    { name: "quyen_so", startColumnIndex: 5, endColumnIndex: 9 },
    { name: "tongTienBanChu", startColumnIndex: 0, endColumnIndex: 1 },
  ]);

  const mappings = buildDerivedNamedRangeMappings(meta, "bang-ke-mua-hang");
  const byName = Object.fromEntries(mappings.map((m) => [m.rangeName, m.fieldKey]));

  assert.equal(byName.so_chung_tu, "soChungTu");
  assert.equal(byName.quyen_so, "quyenSo");
  assert.equal(byName.tongTienBanChu, "tongTienBangChu");
});

test("buildDerivedNamedRangeMappings maps canCuBkmh for phieu nhap kho", () => {
  const meta = spreadsheetMetaWithRanges([
    { name: "canCuBkmh", startColumnIndex: 0, endColumnIndex: 12 },
    { name: "soChungTu", startColumnIndex: 10, endColumnIndex: 11 },
  ]);
  const mappings = buildDerivedNamedRangeMappings(meta, "phieu-nhap-kho");
  const byName = Object.fromEntries(mappings.map((m) => [m.rangeName, m.fieldKey]));
  assert.equal(byName.canCuBkmh, "canCuBkmh");
  assert.equal(byName.soChungTu, "soChungTu");
});

test("enrichFillRulesWithSpreadsheetMeta replaces saved signer mappings", () => {
  const meta = spreadsheetMetaWithRanges([
    { name: "soChungTu", startColumnIndex: 10, endColumnIndex: 11 },
  ]);

  const fillRules = enrichFillRulesWithSpreadsheetMeta(
    {
      version: 2,
      sheets: {
        namedRanges: [
          {
            rangeName: "soChungTu",
            rule: "charGrid",
            fieldKey: "signerNguoiMua",
          },
          {
            rangeName: "nguoiMua",
            rule: "charGrid",
            fieldKey: "nguoiMua",
          },
        ],
      },
    },
    meta,
    "bang-ke-mua-hang",
  );

  assert.deepEqual(
    fillRules.sheets.namedRanges.map((r) => r.rangeName),
    ["soChungTu"],
  );
  assert.equal(fillRules.sheets.namedRanges[0].fieldKey, "soChungTu");
  assert.equal(fillRules.sheets.namedRanges[0].rule, "field");
});
