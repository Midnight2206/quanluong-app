# PXK LTTP Fields, Aggregation & Signatures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PXK xuất từ LTTP với gộp `by-unit` (default) / `by-day` (đơn vị×ngày); auto-fill `nguoiNhan`/`diaChi`/`lyDoXuatKho`; extraFields `xuatTaiKho`/`diaDiem`; chữ ký khóa Thủ kho + Người nhận.

**Architecture:** Siết resolver monthly BY_DAY **chỉ cho PXK** thành sheet `(recipientUnitId, issueDate)`; mở rộng recipient fill; helper lý do xuất; wire catalog + export batch + signature settings UI (mirror PNK).

**Tech Stack:** Node ESM (`quanluong-app-be`), Prisma, React (`packages/shared`), `node:test`

**Spec:** `docs/superpowers/specs/2026-09-07-pxk-lttp-fields-signatures-design.md`

## Global Constraints

- Aggregation PXK: chỉ `by-unit` \| `by-day`; default `by-unit`; **không `full`**
- by-day PXK: 1 PDF / (đơn vị × ngày); BKMH by-day **giữ hành vi hiện tại** (1 sheet / ngày gộp đơn vị) trừ khi code path đã category-aware
- `lyDoXuatKho`: by-unit `Cấp tiếp phẩm tháng MM năm YYYY`; by-day `Cấp tiếp phẩm ngày DD tháng MM năm YYYY`
- Giữ `nguoiNhanHang` + `donVi`
- Ngoài scope: Tổng hợp PXK; document-service layout; backfill settings

---

## File Map

| File | Role |
|------|------|
| `chung-tu-pxk-ly-do.util.js` (+ test) | `formatLyDoXuatKho` |
| `chung-tu-recipient-unit-fill.service.js` (+ test) | `diaChi`, `nguoiNhan`, `signatureName`; attach by-day+by-unit |
| `chung-tu-data-resolver.service.js` (+ test) | PXK BY_DAY = unit×day sheets |
| `chung-tu-pdf-batch-slices.util.js` (+ test) | by-day fileName gồm đơn vị+ngày khi có `recipientUnitId` |
| `chung-tu-quyet-toan.validator.js` (+ test) | PXK reject `full` |
| `chung-tu-pdf-field-catalog.js` / label-field / category constants | Register new keys |
| `chung-tu-pdf-export-batch.service.js` | Inject extras + materialize `nguoi_nhan` |
| `chung-tu-pdf-map.util.js` / resolve path | Map fields into payload |
| `ChungTuExportWorkspace.jsx` (+ test) | PXK options; default by-unit |
| `ChungTuSignatureSettingsWorkspace.jsx` (+ test) | Locked slots + extraFields PXK |
| FE `chungTuLabelField.js` / category config derived ranges | Mirror BE keys |

---

### Task 1: `formatLyDoXuatKho` + recipient fill (`diaChi` / `nguoiNhan` / `signatureName`)

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pxk-ly-do.util.js`
- Create: `chung-tu-pxk-ly-do.util.test.js`
- Modify: `chung-tu-recipient-unit-fill.service.js` (+ `.test.js`)

**Interfaces:**
```js
export function formatLyDoXuatKho({ aggregationMode, periodMonth, periodDate })
// returns string; pad MM/DD

// fill map value shape:
{ nguoiNhanHang, nguoiNhan, donVi, diaChi, signatureName }
```

- [ ] **Step 1: Failing tests**

```js
assert.equal(
  formatLyDoXuatKho({ aggregationMode: "by-unit", periodMonth: "2026-06" }),
  "Cấp tiếp phẩm tháng 06 năm 2026",
);
assert.equal(
  formatLyDoXuatKho({ aggregationMode: "by-day", periodDate: "2026-06-05" }),
  "Cấp tiếp phẩm ngày 05 tháng 06 năm 2026",
);

// recipient fill (mock prisma or unit-level if existing tests mock):
// fill.nguoiNhan === fill.nguoiNhanHang
// fill.diaChi === department
// fill.signatureName === `${rankAbbr} ${fullName}`.trim() or name alone
```

- [ ] **Step 2: Run — FAIL**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-pxk-ly-do.util.test.js
```

- [ ] **Step 3: Implement helper + expand `loadRecipientUnitFillMap`**

Select `profile: { fullName, rankAbbr, department }`. Use same join logic as `formatSystemPersonName` for `signatureName` (import/reuse if possible without circular deps).

`mergeRecipientUnitFillFields`: set `nguoiNhan`, `diaChi`, `signatureName` too.

`attachRecipientUnitFillToMonthlyContexts`: attach when mode is `by-unit` **or** `by-day` (remove by-unit-only gate).

- [ ] **Step 4: Tests PASS → Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): PXK ly-do formatter and recipient diaChi fill

EOF
)"
```

---

### Task 2: PXK by-day = unit×day sheets + slice names + reject `full`

**Files:**
- Modify: `chung-tu-data-resolver.service.js` (+ tests)
- Modify: `chung-tu-pdf-batch-slices.util.js` (+ tests)
- Modify: `chung-tu-quyet-toan.validator.js` (+ tests)

**Interfaces:**
- When `categoryKey === "phieu-xuat-kho"` && `BY_DAY`: each sheetContext has `recipientUnitId`, `recipientUnitName`, `periodDate`, `detailRows` for that pair only.
- BKMH `BY_DAY` unchanged (one sheet per calendar day across units).
- Validator: if PXK && `aggregationMode === "full"` → 400.

- [ ] **Step 1: Failing tests**

```js
// Resolver / pure extract of sheet-building: two units same day → 2 contexts; one unit two slips same day → 1 context with merged lines
// slices: fileName/sortKey includes unit + date when recipientUnitId present
// validator rejects phieu-xuat-kho + full
```

Inspect how monthly resolve is invoked with `categoryKey` and branch only PXK inside BY_DAY block:

```js
if (mode === BY_DAY) {
  if (categoryKey === PHIEU_XUAT_KHO) {
    // for each day in month:
    //   load slips; group by recipientUnitId; push context per unit with slips that day
  } else {
    // existing by-day loop
  }
}
```

Skip empty (no detailRows) days/units.

- [ ] **Step 2: Implement slices by-day naming**

When building by-day slice, prefer:

```js
const unitPart = sanitizeFileBaseName(slice.recipientUnitName || `dv-${slice.recipientUnitId}` || "");
const dayPart = periodDate;
const base = [unitPart, dayPart].filter(Boolean).join("-") || dayPart;
```

- [ ] **Step 3: After contexts built, set `lyDoXuatKho` on each PXK context** via `formatLyDoXuatKho` (in resolver or export — prefer resolver/attach so PDF fields see it). Also set `nguoiNhan`/`diaChi` via attach (Task 1).

- [ ] **Step 4: Tests PASS → Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): PXK by-day sheets per unit and reject full mode

EOF
)"
```

---

### Task 3: Catalog + export inject extras + materialize `nguoi_nhan`

**Files:**
- Modify: `chung-tu-pdf-field-catalog.js` (+ test)
- Modify: BE label/alias modules if needed (`chung-tu-pdf-column-alias.util.js`, category derived ranges)
- Modify: FE `chungTuLabelField.js` / `chungTuCategoryConfig.js` derived named ranges for PXK
- Modify: `chung-tu-pdf-export-batch.service.js` (+ test)
- Possibly: data resolve / map util so `lyDoXuatKho`, `xuatTaiKho`, `diaDiem`, `nguoiNhan`, `diaChi` reach document payload

**Interfaces:**
```js
function materializePxkNguoiNhanSignatureBlock(signatureBlock, context) {
  // for slot key nguoi_nhan: set static_name / name from context.signatureName || context.nguoiNhan
}
```

- [ ] **Step 1: Failing tests** — catalog has FIELD_* keys; export batch test with PXK category injects extras and materializes slot.

- [ ] **Step 2: Implement**

Catalog scalars (supportsLabel as appropriate; follow PNK `lyDoNhapKho` / `nhapTaiKho` pattern for which are labelable).

In `createChungTuPdfExportBatch` when `isPxk`:

```js
resolveArgs.xuatTaiKho = savedSignatureSettings?.extraFields?.xuatTaiKho ?? "";
resolveArgs.diaDiem = savedSignatureSettings?.extraFields?.diaDiem ?? "";
```

Per slice:

```js
const sliceSignatureBlock = isPxk
  ? materializePxkNguoiNhanSignatureBlock(finalSignatureBlock, slice.context)
  : /* existing PNK / other */;
```

Ensure `lyDoXuatKho` already on `slice.context` (Task 2) or compute here if missing.

Wire `buildDocumentServicePayload` / field pick so new keys are included when present on template.

- [ ] **Step 3: Tests PASS → Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): PXK PDF fields extras and locked nguoi_nhan materialize

EOF
)"
```

---

### Task 4: FE export defaults + signature settings PXK UI

**Files:**
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx` (+ test)
- Modify: `ChungTuSignatureSettingsWorkspace.jsx` (+ test)

**Interfaces:**
- `isPxkMonthly = categoryKey === "phieu-xuat-kho" && isMonthly`
- `PXK_AGGREGATION_MODE_OPTIONS` = by-unit + by-day only
- Default aggregation when entering PXK: `by-unit` (useEffect or initial state by category)
- Signature: `isPxkCategory` → default locked `thu_kho` + `nguoi_nhan`; `normalizeExtraFields` includes `xuatTaiKho`, `diaDiem`; show inputs when PXK (PNK keeps `lyDoNhapKho`/`nhapTaiKho`)

- [ ] **Step 1: Failing source tests**

```js
assert.match(exportSrc, /phieu-xuat-kho/);
assert.match(exportSrc, /BY_UNIT/); // default
assert.doesNotMatch(pxkOptionsBlock, /FULL|"full"/); // or assert options array length 2

assert.match(sigSrc, /thu_kho/);
assert.match(sigSrc, /nguoi_nhan/);
assert.match(sigSrc, /xuatTaiKho/);
assert.match(sigSrc, /diaDiem/);
```

- [ ] **Step 2: Implement** — mirror `isPnkMonthly` / `DEFAULT_PNK_NGUOI_GIAO_SLOT` patterns.

Locked slot delete prevention: extend existing PNK locked-slot logic to also protect `thu_kho` + `nguoi_nhan` for PXK.

- [ ] **Step 3: Tests PASS → Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(fe): PXK export aggregation options and signature extras UI

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| formatLyDoXuatKho | T1 |
| Recipient diaChi / nguoiNhan / signatureName; attach by-day | T1 |
| PXK by-day unit×day; reject full | T2 |
| Catalog + extras + materialize | T3 |
| FE export + signature UI | T4 |
| Keep nguoiNhanHang/donVi | T1 |
| No PXK summary / no full | T2–T4 |

## Ops

- Re-upload Excel mẫu với Named Ranges mới nếu chưa có.
- Cấu hình Cài đặt chữ ký PXK: nhập Thủ kho static + xuất tại kho + địa điểm.

## Self-review

- BKMH by-day explicitly preserved in Task 2.  
- No placeholders.  
- Materialize depends on Task 1 `signatureName`.  
