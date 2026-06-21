import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildChungTuDocumentKey } from "./chung-tu-document-key.js";
import {
  buildUnitSheetTitles,
  lastDayOfMonth,
  sanitizeSheetTitle,
} from "./chung-tu-monthly-sheets.js";
import { buildTemplateFullDisplayName } from "./chung-tu-template-tree.util.js";

describe("chung-tu-document-key", () => {
  test("buildChungTuDocumentKey uses stable monthly key for BKMH (no template/agg)", () => {
    const key = buildChungTuDocumentKey({
      categoryKey: "bang-ke-mua-hang",
      unitId: 1,
      periodMonth: "2026-06",
      unitIds: [2, 5],
      aggregationMode: "by-unit",
      templateDriveFileId: "abc123XYZ",
    });
    assert.equal(key, "bang-ke-mua-hang:m:2026-06:u:1:units:2,5");
  });

  test("buildChungTuDocumentKey uses stable monthly key for PNK", () => {
    const key = buildChungTuDocumentKey({
      categoryKey: "phieu-nhap-kho",
      unitId: 1,
      periodMonth: "2026-06",
      unitIds: [2, 5],
      aggregationMode: "by-unit",
      templateDriveFileId: "abc123XYZ",
    });
    assert.equal(key, "phieu-nhap-kho:m:2026-06:u:1:units:2,5");
  });

  test("buildChungTuDocumentKey uses stable monthly key for PXK", () => {
    const key = buildChungTuDocumentKey({
      categoryKey: "phieu-xuat-kho",
      unitId: 1,
      periodMonth: "2026-06",
      unitIds: [2, 5],
      aggregationMode: "by-unit",
      templateDriveFileId: "abc123XYZ",
    });
    assert.equal(key, "phieu-xuat-kho:m:2026-06:u:1:units:2,5");
  });

  test("buildChungTuDocumentKey includes aggregation and template for legacy monthly docs", () => {
    const key = buildChungTuDocumentKey({
      categoryKey: "other-category",
      unitId: 1,
      periodMonth: "2026-06",
      unitIds: [2, 5],
      aggregationMode: "by-unit",
      templateDriveFileId: "abc123XYZ",
    });
    assert.equal(
      key,
      "other-category:m:2026-06:agg:by-unit:units:2,5:tpl:abc123XYZ",
    );
  });
});

describe("chung-tu-monthly-sheets", () => {
  test("sanitizeSheetTitle removes forbidden characters and truncates", () => {
    const title = sanitizeSheetTitle("Đơn vị [A]: test/quá dài tên đơn vị này", { maxLen: 20 });
    assert.ok(!title.includes("["));
    assert.ok(!title.includes(":"));
    assert.ok(title.length <= 20);
  });

  test("buildUnitSheetTitles deduplicates same unit names", () => {
    const rows = buildUnitSheetTitles([1, 2], {
      1: "Tiểu đoàn 1",
      2: "Tiểu đoàn 1",
    });
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].sheetTitle, rows[1].sheetTitle);
    assert.ok(rows[1].sheetTitle.includes("(2)"));
  });

  test("lastDayOfMonth returns final calendar day", () => {
    assert.equal(lastDayOfMonth("2026-02"), "2026-02-28");
    assert.equal(lastDayOfMonth("2024-02"), "2024-02-29");
  });

  test("buildTemplateFullDisplayName joins folder path and template leaf", () => {
    assert.equal(
      buildTemplateFullDisplayName(["bang-ke-mua-hang", "Tiểu đoàn 1"], "BKMH925"),
      "bang-ke-mua-hang / Tiểu đoàn 1 / BKMH925",
    );
  });
});
