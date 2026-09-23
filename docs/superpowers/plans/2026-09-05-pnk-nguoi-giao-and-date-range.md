# PNK Người giao + Date Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist BKMH buyer on slices; PNK export by date range with by-day/full aggregation, always split by buyer; fill người giao / địa chỉ / nhập tại kho; lock NGƯỜI GIAO signature slot.

**Architecture:** Extend `ChungTuBkmhSlice` with buyer snapshot columns; rewrite PNK resolve to filter slices by `[dateFrom,dateTo]`, group by `buyerKey` then day/full; catalog + PNK-only `dia_chi` map; signature settings `extraFieldsJson.nhapTaiKho` + locked slot; FE date-range + 2-mode aggregation for PNK.

**Tech Stack:** Prisma/MySQL, Node ESM + `node:test`, React (packages/shared)

**Spec:** `docs/superpowers/specs/2026-09-05-pnk-nguoi-giao-and-date-range-design.md`

## Global Constraints

- Persist buyer on BKMH slice: `buyerUserId`, `buyerKey`, `buyerName`, `buyerSignatureName`, `buyerTitle`
- `buyerKey` = `user:{id}` or `name:{normalized}`
- PNK always split by `buyerKey` first
- PNK modes only: `by-day` | `full` (UI: Theo ngày / Nhiều ngày); no `by-unit`
- Both modes: `dateFrom` + `dateTo` inclusive (not whole-month-only)
- `by-day` → 1 PDF/(buyer×day); `full` → 1 PDF/buyer in range
- Fields: `FIELD_nguoi_giao_hang`, `FIELD_dia_chi`→bộ phận (PNK only), `FIELD_nhap_tai_kho`
- Locked slot `nguoi_giao` / label `NGƯỜI GIAO` first; name = `buyerSignatureName`
- Missing `buyerKey` on slice → 400 ask re-export BKMH
- No new dependencies

---

## File Map

| File | Role |
|------|------|
| `quanluong-app-be/prisma/schema.prisma` | Slice buyer cols; signature `extraFieldsJson` |
| Migration | Apply schema |
| `chung-tu-bkmh-buyer-snapshot.util.js` | buildBuyerKey + snapshot from catalog person |
| `chung-tu-bkmh-monthly.service.js` | Persist buyer on slice create |
| `chung-tu-pdf-field-catalog.js` | New FIELD_* entries |
| `chung-tu-pdf-column-alias.util.js` | Aliases; PNK `dia_chi`→`diaChi` |
| `chung-tu-data-resolver.service.js` | Rewrite PNK resolve (date range + buyer groups) |
| `chung-tu-quyet-toan.validator.js` | `dateFrom`/`dateTo` for PNK; allow `full` |
| `chung-tu-pdf-export-batch.service.js` | Stop forcing PNK to by-day; pass dates |
| Signature settings BE + FE | `extraFieldsJson` + locked slot |
| `ChungTuExportWorkspace.jsx` | PNK from–to + aggregation picker |

---

### Task 1: Schema — buyer on slice + extraFieldsJson

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma`
- Create: migration (manual `db execute` + `migrate resolve` if kitchen_receipt drift blocks migrate deploy)

**Interfaces:**
- Produces: `ChungTuBkmhSlice` buyer fields; `ChungTuSignatureSettings.extraFieldsJson Json?`

- [ ] **Step 1: Edit schema**

On `ChungTuBkmhSlice` after `detailRowsJson`:

```prisma
  buyerUserId        Int?
  buyerKey           String?  @db.VarChar(191)
  buyerName          String?  @db.VarChar(191)
  buyerSignatureName String?  @db.VarChar(255)
  buyerTitle         String?  @db.VarChar(255)
```

On `ChungTuSignatureSettings` after `signatureBlockJson`:

```prisma
  extraFieldsJson Json?
```

- [ ] **Step 2: Create and apply migration**

Prefer `npx prisma migrate dev --name chung_tu_bkmh_slice_buyer_and_signature_extra`. If blocked by known drift, apply equivalent SQL via `prisma db execute` then `migrate resolve --applied <name>`.

- [ ] **Step 3: `prisma generate`**

- [ ] **Step 4: Commit**

```bash
git add quanluong-app-be/prisma
git commit -m "$(cat <<'EOF'
feat(chung-tu): add BKMH slice buyer snapshot and signature extraFields

EOF
)"
```

---

### Task 2: Persist buyer snapshot on BKMH export

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-buyer-snapshot.util.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-buyer-snapshot.util.test.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.js`

**Interfaces:**
- `buildBkmhBuyerKey({ buyerUserId, buyerName })` → `user:N` | `name:...` | `""`
- `buildBkmhBuyerSnapshotFromPerson(person, buyerUserId?)` → `{ buyerUserId, buyerKey, buyerName, buyerSignatureName, buyerTitle }`
- person from `formatSystemPersonName`: `{ name, signatureName, title }`

- [ ] **Step 1: Failing tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBkmhBuyerKey,
  buildBkmhBuyerSnapshotFromPerson,
} from "./chung-tu-bkmh-buyer-snapshot.util.js";

test("buildBkmhBuyerKey prefers user id", () => {
  assert.equal(buildBkmhBuyerKey({ buyerUserId: 7, buyerName: "A" }), "user:7");
});

test("buildBkmhBuyerKey falls back to normalized name", () => {
  assert.equal(
    buildBkmhBuyerKey({ buyerUserId: null, buyerName: "  Nguyễn Văn A " }),
    "name:nguyen van a",
  );
});

test("buildBkmhBuyerSnapshotFromPerson maps catalog person", () => {
  const snap = buildBkmhBuyerSnapshotFromPerson(
    { name: "Nguyễn Văn A", signatureName: "Th/tá Nguyễn Văn A", title: "Tài vụ" },
    7,
  );
  assert.equal(snap.buyerUserId, 7);
  assert.equal(snap.buyerKey, "user:7");
  assert.equal(snap.buyerName, "Nguyễn Văn A");
  assert.equal(snap.buyerSignatureName, "Th/tá Nguyễn Văn A");
  assert.equal(snap.buyerTitle, "Tài vụ");
});

test("buildBkmhBuyerSnapshotFromPerson empty person returns empty key fields", () => {
  const snap = buildBkmhBuyerSnapshotFromPerson(null, null);
  assert.equal(snap.buyerKey, "");
  assert.equal(snap.buyerName, "");
});
```

Normalize name: trim, NFD strip combining marks, lower case, collapse spaces.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-bkmh-buyer-snapshot.util.test.js
```

- [ ] **Step 3: Implement util; wire monthly service**

When building each slice create payload, use already-resolved `resolvedBkmhBuyer` plus `defaultBuyerUserId` from `lttpUnitIssueFormDefaults` if loaded; spread `buildBkmhBuyerSnapshotFromPerson(...)` onto slice create input.

- [ ] **Step 4: Tests PASS + commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-buyer-snapshot.util.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-buyer-snapshot.util.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.js
git commit -m "$(cat <<'EOF'
feat(chung-tu): persist buyer snapshot on BKMH slices

EOF
)"
```

---

### Task 3: Catalog + resolve aliases for PNK fields

**Files:**
- Modify: `chung-tu-pdf-field-catalog.js`
- Modify: `chung-tu-pdf-column-alias.util.js` (+ test)
- Modify: `chung-tu-pdf-field-catalog.test.js`
- Modify: `pickMappedFields` / PDF map callers to pass `categoryKey` when resolving scalars

**Rules:**
- Catalog scalars: `FIELD_nguoi_giao_hang`/`nguoiGiaoHang`, `FIELD_dia_chi`/`diaChi` (label notes PNK bộ phận), `FIELD_nhap_tai_kho`/`nhapTaiKho`
- `resolveScalarFieldKey(key, { categoryKey } = {})`:
  - `nguoi_giao_hang` → `nguoiGiaoHang`
  - `nhap_tai_kho` → `nhapTaiKho`
  - if PNK and `dia_chi`/`diaChi` → `diaChi`
  - else existing aliases / snakeToCamel
- Do **not** change Drive legacy `diachi`→`donVi` in named-range-display for non-PDF Sheets path

- [ ] **Step 1:** Failing alias + catalog tests  
- [ ] **Step 2:** Implement  
- [ ] **Step 3:** Commit

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): catalog nguoi giao, dia chi PNK, nhap tai kho

EOF
)"
```

---

### Task 4: Rewrite PNK resolve — date range + buyer split + context fields

**Files:**
- Modify: `chung-tu-data-resolver.service.js`
- Modify: `chung-tu-pnk-from-bkmh.service.test.js` (expand/rewrite)
- Update callers in `resolveChungTuContext`

**Interface:**

```js
resolvePnkFromBkmhSlices({
  storageUnitId,
  dateFrom, // YYYY-MM-DD
  dateTo,
  aggregationMode, // by-day | full
  resolveSettingsForSlips,
  nhapTaiKho,
})
```

Each `sheetContext` includes: `nguoiGiaoHang`, `diaChi`, `nhapTaiKho`, `buyerKey`, `buyerSignatureName`, `canCuBkmh`, `detailRows`, `periodDate`, `aggregationMode`.

**Rules:**
- Load slices for storage unit with `periodDate` in `[dateFrom, dateTo]` and non-empty detail rows
- Empty `buyerKey` → 400: `BKMH thiếu thông tin người mua trên slice. Vui lòng xuất lại BKMH trước khi xuất PNK.`
- Group by `buyerKey`; then `by-day` or `full` per spec
- Line merge rule unchanged

- [ ] **Step 1:** Tests — two buyers same day → 2 contexts; full one buyer two days → 1; missing buyerKey throws; fields set  
- [ ] **Step 2:** Implement  
- [ ] **Step 3:** Commit

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): PNK resolve by date range and buyer split

EOF
)"
```

---

### Task 5: API validator + batch — dateFrom/dateTo, stop force by-day

**Files:**
- Modify: `chung-tu-quyet-toan.validator.js` (+ tests in `chung-tu-pdf-template.validator.test.js` or sibling)
- Modify: `chung-tu-pdf-export-batch.service.js` (+ update former force-by-day test)
- Preview schema same rules
- Pass `nhapTaiKho` from signature settings `extraFieldsJson` into resolve

**Rules:**
- PNK: require `dateFrom`, `dateTo` (ISO, from≤to); `aggregationMode` ∈ `by-day|full`; no `unitIds`; no required `periodMonth`
- Other monthly: unchanged
- Remove batch force `PNK → by-day`
- History `periodMonth`: set to `dateFrom.slice(0, 7)` for display YAGNI unless range columns already exist

- [ ] TDD + implement + commit

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): PNK export API date range and aggregation modes

EOF
)"
```

---

### Task 6: Signature settings — nhapTaiKho + locked NGƯỜI GIAO

**Files:**
- BE signature settings get/upsert: accept/return `extraFields` / persist `extraFieldsJson`
- FE: `ChungTuSignatureSettingsWorkspace.jsx`
- Batch export: for each PDF context, materialize slot `nguoi_giao` as static name from `context.buyerSignatureName`

**Locked slot seed (PNK default/reset, always ensure first):**

```js
{
  key: "nguoi_giao",
  label: "NGƯỜI GIAO",
  col: 0,
  col_span: 1,
  source: "static",
  static_name: "",
  locked: true,
  show_date_line: false,
}
```

UI: no delete for locked; disable key/source/label; show **Nhập tại kho** when category is PNK.

- [ ] Implement + commit

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): PNK nhap tai kho settings and locked nguoi giao slot

EOF
)"
```

---

### Task 7: FE export workspace — PNK date range + aggregation UI

**Files:**
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx`
- Modify: `ChungTuBkmhMonthlySummary.test.js` (replace obsolete “force by-day / hide aggregation” asserts)
- API payload helpers if needed

**Behavior:**
- PNK: aggregation picker only Theo ngày / Nhiều ngày (`by-day` / `full`)
- Date inputs `dateFrom` + `dateTo` (not month-only)
- Payload: `{ categoryKey, unitId, dateFrom, dateTo, aggregationMode }` — no `unitIds` / no `periodMonth`
- Validate: kho + from/to + from≤to + template
- Ensure outgoing `signatureBlock` has locked `nguoi_giao` first

- [ ] Update tests; implement; commit

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): PNK export UI date range and buyer-aware aggregation

EOF
)"
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Slice buyer columns | T1–T2 |
| extraFieldsJson | T1, T6 |
| Catalog fields | T3 |
| Resolve date range + buyer split | T4 |
| API dateFrom/to + modes | T5 |
| Locked slot + nhapTaiKho | T6 |
| FE from–to + picker | T7 |
| Missing buyer → 400 | T4 |
| Invoices | Out of scope |

## Ops note

Re-export BKMH months before PNK after T2. Prisma kitchen_receipt migrate drift may need manual SQL workaround.
