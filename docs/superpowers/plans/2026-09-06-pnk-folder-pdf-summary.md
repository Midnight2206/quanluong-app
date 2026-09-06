# PNK Folder PDF Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PNK có tab Tổng hợp theo folder PDF (batch), panel file với meta Số CT/Ngày/Tổng tiền + Xem/Tải/In; Lịch sử PNK bỏ accordion file.

**Architecture:** Thêm `summaryJson` trên `ChungTuPdfExport`, extract từ `slice.context` lúc tạo batch, flatten trong API list. FE: `hasSummary` PNK; `ChungTuSummaryWorkspace` nhánh batch; `ChungTuPnkBatchSummaryPanel`; History PNK mirror UX BKMH folder actions.

**Tech Stack:** Prisma/MariaDB, Node ESM (`quanluong-app-be`), React (`packages/shared`), `node:test`

**Spec:** `docs/superpowers/specs/2026-09-06-pnk-folder-pdf-summary-design.md`

## Global Constraints

- Không dựng sổ tháng PNK mới (reuse `pdf-export-batches`)
- Meta: `soChungTu`, `periodDate` / `ngayThangNam`, `tongTien`, `recipientUnitName?`
- Folder cũ thiếu meta → «—»; vẫn xem/tải/in qua fileId
- Ngoài scope: PXK summary; backfill meta cũ; đổi document-service
- BKMH Tổng hợp / Lịch sử không regress

---

## File Map

| File | Role |
|------|------|
| `quanluong-app-be/prisma/schema.prisma` | `ChungTuPdfExport.summaryJson Json?` |
| `quanluong-app-be/prisma/migrations/…_chung_tu_pdf_export_summary_json/` | Migration |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-summary.util.js` | `buildExportSummaryFromContext`, `sumFolderTongTien` |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-summary.util.test.js` | Unit tests |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.js` | Persist + map |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js` | Assert map/create summary |
| `packages/shared/.../chungTuCategoryConfig.js` | `hasSummary` PNK |
| `packages/shared/.../ChungTuSummaryWorkspace.jsx` | PNK batch list |
| `packages/shared/.../ChungTuPnkBatchSummaryPanel.jsx` | Panel |
| `packages/shared/.../ChungTuHistoryWorkspace.jsx` | PNK no accordion + Xem tổng hợp |
| Matching FE `*.test.js` | Source asserts |

---

### Task 1: Schema + summary helper + batch map/create

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma` (`ChungTuPdfExport`)
- Create: migration for `summaryJson`
- Create: `chung-tu-pdf-export-summary.util.js` + `.test.js`
- Modify: `chung-tu-pdf-export-batch.service.js` (+ tests)

**Interfaces:**
- Produces:
  ```js
  /** @returns {{ soChungTu?: string, periodDate?: string, ngayThangNam?: string, tongTien?: number, recipientUnitName?: string } | null} */
  export function buildExportSummaryFromContext(context) {}
  /** @returns {number|null} */
  export function sumFolderTongTien(files) {}
  ```
- `mapBatchExportRow` adds flattened summary fields + keeps `summary` object optional
- `mapBatchRow` adds `tongTienFolder: sumFolderTongTien(files)`

- [ ] **Step 1: Failing tests for helper**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExportSummaryFromContext,
  sumFolderTongTien,
} from "./chung-tu-pdf-export-summary.util.js";

test("buildExportSummaryFromContext maps known context keys", () => {
  const summary = buildExportSummaryFromContext({
    soChungTu: "062601",
    periodDate: "2026-06-15",
    ngayThangNam: "ngày 15 tháng 6 năm 2026",
    tongTien: 1500000,
    recipientUnitName: "Đại đội 1",
  });
  assert.deepEqual(summary, {
    soChungTu: "062601",
    periodDate: "2026-06-15",
    ngayThangNam: "ngày 15 tháng 6 năm 2026",
    tongTien: 1500000,
    recipientUnitName: "Đại đội 1",
  });
});

test("buildExportSummaryFromContext returns null when empty", () => {
  assert.equal(buildExportSummaryFromContext(null), null);
  assert.equal(buildExportSummaryFromContext({}), null);
});

test("buildExportSummaryFromContext sums detailRows thanhTien when tongTien missing", () => {
  const summary = buildExportSummaryFromContext({
    soChungTu: "1",
    periodDate: "2026-06-01",
    detailRows: [{ thanhTien: 1000 }, { thanhTien: "2.000" }, { thanhTien: null }],
  });
  assert.equal(summary.soChungTu, "1");
  assert.equal(summary.tongTien, 3000); // parse VND-ish numbers; if parser already exists reuse it
});

test("sumFolderTongTien sums numeric tongTien only", () => {
  assert.equal(sumFolderTongTien([{ tongTien: 1 }, { tongTien: 2 }, {}]), 3);
  assert.equal(sumFolderTongTien([{ soChungTu: "x" }]), null);
});
```

Inspect real PNK `slice.context` in export path (`buildDocumentServicePayload` / FE payload builder) and extend helper to read the **actual** keys present (aliases OK). Prefer reusing an existing number parser if one exists in the module; otherwise minimal parse: strip dots, `Number`.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-summary.util.test.js
```

- [ ] **Step 3: Implement helper + schema**

```prisma
// on ChungTuPdfExport
summaryJson Json?
```

Create Prisma migration. Implement util.

- [ ] **Step 4: Wire batch service**

In create loop:

```js
summaryJson: buildExportSummaryFromContext(slice.context),
```

Pass into `exports.create`. Update `mapBatchExportRow`:

```js
const summary =
  row.summaryJson && typeof row.summaryJson === "object" && !Array.isArray(row.summaryJson)
    ? row.summaryJson
    : null;
return {
  // ...existing
  soChungTu: summary?.soChungTu ?? null,
  periodDate: summary?.periodDate ?? toIsoDateOnly(row.periodDate),
  ngayThangNam: summary?.ngayThangNam ?? null,
  tongTien: summary?.tongTien ?? null,
  recipientUnitName: summary?.recipientUnitName ?? null,
  summary,
};
```

`mapBatchRow`: `tongTienFolder: sumFolderTongTien(files)`.

Add/adjust test in `chung-tu-pdf-export-batch.service.test.js` asserting map exposes summary fields (mock row with `summaryJson`).

- [ ] **Step 5: Tests PASS**

```bash
cd quanluong-app-be && node --test \
  src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-summary.util.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js
```

- [ ] **Step 6: Commit**

```bash
git add quanluong-app-be/prisma quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-summary.util.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-summary.util.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js
git commit -m "$(cat <<'EOF'
feat(chung-tu): persist PNK export summaryJson on batch files

EOF
)"
```

---

### Task 2: FE `hasSummary` + Summary list + PNK panel

**Files:**
- Modify: `packages/shared/src/pages/chungTuQuyetToan/chungTuCategoryConfig.js` (+ test)
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuSummaryWorkspace.jsx` (+ test)
- Create: `packages/shared/src/pages/chungTuQuyetToan/ChungTuPnkBatchSummaryPanel.jsx` (+ optional test)
- May touch: `ChungTuBkmhMonthlySummary.test.js` / `chungTuCategoryConfig.test.js` (update PNK hasSummary asserts)

**Interfaces:**
- Consumes: batch list from `useChungTuPdfExportBatchesQuery`; file fields `soChungTu`, `ngayThangNam`/`periodDate`, `tongTien`, `recipientUnitName`, `downloadPath` / fileId
- Produces: panel props `{ batch, open, onOpenChange }` where `batch` has `batchKey`, `files`, `aggregationMode`, `displayName`, zip/merged paths

- [ ] **Step 1: Failing tests**

```js
// config
assert.equal(getChungTuCategoryConfig("phieu-nhap-kho").hasSummary, true);
assert.equal(getChungTuCategoryConfig("phieu-xuat-kho").hasSummary, false);

// SummaryWorkspace source
assert.match(summarySrc, /phieu-nhap-kho/);
assert.match(summarySrc, /useChungTuPdfExportBatchesQuery/);
assert.match(summarySrc, /ChungTuPnkBatchSummaryPanel/);
assert.match(summarySrc, /Mở tổng hợp/);

// Panel source
assert.match(panelSrc, /Số chứng từ|soChungTu/);
assert.match(panelSrc, /openChungTuPdfExportBatchFile|downloadChungTuPdfExportBatchFile|merged|zip/i);
```

Update any test still asserting PNK `hasSummary === false`.

- [ ] **Step 2: Implement config**

```js
hasSummary: tab.id === "bang-ke-mua-hang" || tab.id === "phieu-nhap-kho",
```

- [ ] **Step 3: Implement SummaryWorkspace PNK branch**

If `categoryKey === "phieu-nhap-kho"`: mirror BKMH table structure but rows = batches; columns per spec; click → `setSelectedBatch(batch)`.

Keep BKMH branch unchanged (`useChungTuBkmhMonthlyListQuery`).

- [ ] **Step 4: Implement `ChungTuPnkBatchSummaryPanel`**

Pattern after `ChungTuBkmhSliceSummaryPanel` (modal/drawer, Escape closes):

- Table columns: Số CT, Ngày, optional Đơn vị (`aggregationMode === "by-unit"`), Tổng tiền, actions
- Missing meta → «—»
- Actions: open/download/print single file via existing helpers in `chungTuPdfApi.js`
- Header: In tất cả (merged.pdf) · Tải zip

- [ ] **Step 5: Tests PASS**

```bash
cd packages/shared && node --test \
  src/pages/chungTuQuyetToan/chungTuCategoryConfig.test.js \
  src/pages/chungTuQuyetToan/ChungTuBkmhMonthlySummary.test.js \
  src/pages/chungTuQuyetToan/ChungTuCategoryWorkspace.test.js
# plus any new panel/summary tests
```

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(fe): PNK summary tab lists PDF folders and opens batch panel

EOF
)"
```

---

### Task 3: History PNK — no accordion + Xem tổng hợp

**Files:**
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuHistoryWorkspace.jsx`
- Create/modify: `ChungTuHistoryWorkspace.test.js` (or extend existing)

**Interfaces:**
- Consumes: same `ChungTuPnkBatchSummaryPanel` as Task 2
- When `categoryKey === "phieu-nhap-kho"`: folder card actions like BKMH; **do not** render accordion file list

- [ ] **Step 1: Failing source test**

```js
assert.match(historySrc, /phieu-nhap-kho/);
assert.match(historySrc, /Xem tổng hợp/);
assert.match(historySrc, /ChungTuPnkBatchSummaryPanel/);
// Ensure accordion file list gated away for PNK:
assert.match(historySrc, /isPnkCategory|phieu-nhap-kho/);
assert.doesNotMatch(
  // or assert accordion block is inside !isPnk && !isBkmh
  historySrc.slice(historySrc.indexOf("File trong folder") - 80),
  /isPnkCategory\s*\?\s*.*File trong folder/,
);
```

Prefer assert structure: accordion only when `!isBkmhCategory && !isPnkCategory` (PXK keeps accordion).

- [ ] **Step 2: Implement**

```js
const isPnkCategory = categoryKey === "phieu-nhap-kho";
```

For PNK batch cards (non-BKMH list already uses `pdfExportBatches`):

- Actions: In tất cả | Tải zip | **Xem tổng hợp** | Xóa  
- Remove/hide «File trong folder» accordion when `isPnkCategory`  
- State `selectedPnkBatch` → render `ChungTuPnkBatchSummaryPanel`

Do not change BKMH monthly history branch.

- [ ] **Step 3: Tests PASS**

```bash
cd packages/shared && node --test src/pages/chungTuQuyetToan/ChungTuHistoryWorkspace.test.js
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(fe): PNK history uses summary panel instead of file accordion

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| `summaryJson` + extract helper | T1 |
| Persist on create + map API | T1 |
| `hasSummary` PNK | T2 |
| Summary list folders | T2 |
| Panel columns + actions | T2 |
| History no accordion + Xem tổng hợp | T3 |
| Old folders «—» | T1 map + T2/T3 display |
| No PXK / no backfill | — |

## Ops

- Apply Prisma migration on deploy (`summaryJson`).
- Folder PDF xuất **trước** thay đổi sẽ không có meta cho đến khi xuất lại.

## Self-review

- Spec §4.2 no new endpoint → T1 only extends map/list.  
- Spec §5.2 columns → T2.  
- Spec §5.4 → T3.  
- No placeholders.
