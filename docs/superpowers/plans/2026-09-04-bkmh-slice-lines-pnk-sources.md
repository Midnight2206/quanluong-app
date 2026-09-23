# BKMH Slice Lines + PNK Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist BKMH slice line snapshots (`detailRowsJson`) on export so PNK can later read chốt hàng từ DB; Phase 2 wires PNK by-day from those slices.

**Architecture:** Extend `ChungTuBkmhSlice` with JSON snapshot of aggregated detail rows (display + raw numeric fields). Write on monthly upsert; expose on GET. Phase 2 switches PNK monthly resolve off LTTP lines onto slice snapshots, always `by-day`, only days with sources.

**Tech Stack:** Prisma/MySQL, Node ESM, Vitest/node:test, React (Phase 2 FE)

**Spec:** `docs/superpowers/specs/2026-09-04-bkmh-slice-lines-pnk-sources-design.md`

## Global Constraints

- No new dependencies
- ESM only
- Snapshot must include raw `commodityId`, `quantity`, `unitPrice`, `amount` for later re-aggregate (same rule: same commodity + same price merge; different price = separate row)
- Upsert BKMH replaces slices entirely (existing behavior)
- Phase 1 does not change PNK export behavior
- Phase 2: PNK no aggregation-mode UI; always by-day; no LTTP line fallback

---

## File Map

| File | Role |
|------|------|
| `quanluong-app-be/prisma/schema.prisma` | Add `detailRowsJson` |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.js` | Snapshot builder + parse helper |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.test.js` | Tests for snapshot |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.js` | Persist + map API |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.js` | Phase 2: PNK from slices |
| `packages/shared/.../ChungTuExportWorkspace.jsx` | Phase 2: hide PNK aggregation picker |

---

### Task 1: Migration — `detailRowsJson` on ChungTuBkmhSlice

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma`
- Create: migration via prisma

**Interfaces:**
- Produces: `ChungTuBkmhSlice.detailRowsJson Json?`

- [ ] **Step 1: Add field to schema**

In `model ChungTuBkmhSlice`, after `tongTien`:

```prisma
  /// Snapshot detailRows lúc xuất PDF (display + raw numeric).
  detailRowsJson Json?
```

- [ ] **Step 2: Migrate**

```bash
cd quanluong-app-be
# Prefer in Docker app container if that's how DB is reached:
docker compose exec app npx prisma migrate dev --name bkmh-slice-detail-rows-json
# or: npx prisma migrate deploy + generate after writing SQL manually if migrate dev blocked by drift
npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
git add quanluong-app-be/prisma/
git commit -m "feat(db): add ChungTuBkmhSlice.detailRowsJson for line snapshots"
```

---

### Task 2: Snapshot util — build/parse detailRowsJson

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.test.js`

**Interfaces:**
- Consumes: `context.detailRows` array from resolver (mapLineRow shape)
- Produces:
  - `buildBkmhSliceDetailRowsSnapshot(context) → object[]`
  - `parseBkmhSliceDetailRowsJson(json) → object[]`

Each snapshot row MUST include at least:

```js
{
  // display (existing mapLineRow fields, pass through if present)
  stt, tenHang, maSo, dvt, soLuong, donGia, thanhTien, ghiChu, ...
  // raw for re-aggregate
  commodityId: number | null,
  quantity: number | null,
  unitPrice: number | null,
  amount: number | null,
}
```

- [ ] **Step 1: Write failing tests**

Append to `chung-tu-bkmh-slice-metadata.util.test.js`:

```js
import {
  buildBkmhSliceDetailRowsSnapshot,
  parseBkmhSliceDetailRowsJson,
} from "./chung-tu-bkmh-slice-metadata.util.js";

test("buildBkmhSliceDetailRowsSnapshot keeps display fields and adds raw numerics", () => {
  const rows = buildBkmhSliceDetailRowsSnapshot({
    detailRows: [
      {
        stt: 1,
        tenHang: "Gạo",
        maSo: "G01",
        dvt: "Kg",
        soLuong: 2,
        donGia: "10.000",
        thanhTien: "20.000",
        commodityId: 7,
        quantity: 2,
        unitPrice: 10000,
        amount: 20000,
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tenHang, "Gạo");
  assert.equal(rows[0].commodityId, 7);
  assert.equal(rows[0].quantity, 2);
  assert.equal(rows[0].unitPrice, 10000);
  assert.equal(rows[0].amount, 20000);
});

test("buildBkmhSliceDetailRowsSnapshot derives raw from soLuong/donGia/thanhTien when raw missing", () => {
  const rows = buildBkmhSliceDetailRowsSnapshot({
    detailRows: [
      {
        stt: 1,
        tenHang: "Thịt",
        soLuong: 3,
        donGia: "50.000",
        thanhTien: "150.000",
      },
    ],
  });
  assert.equal(rows[0].quantity, 3);
  assert.equal(rows[0].unitPrice, 50000);
  assert.equal(rows[0].amount, 150000);
  assert.equal(rows[0].commodityId, null);
});

test("parseBkmhSliceDetailRowsJson returns [] for null/invalid", () => {
  assert.deepEqual(parseBkmhSliceDetailRowsJson(null), []);
  assert.deepEqual(parseBkmhSliceDetailRowsJson({}), []);
  assert.deepEqual(parseBkmhSliceDetailRowsJson([{ tenHang: "A" }]), [{ tenHang: "A" }]);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd quanluong-app-be
node --test src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.test.js
```

- [ ] **Step 3: Implement**

In `chung-tu-bkmh-slice-metadata.util.js`, reuse `parseTongTien` for VND strings:

```js
function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildBkmhSliceDetailRowsSnapshot(context = {}) {
  const rows = Array.isArray(context.detailRows) ? context.detailRows : [];
  return rows.map((row, index) => {
    const quantity =
      toFiniteNumber(row?.quantity) ?? toFiniteNumber(row?.soLuong) ?? toFiniteNumber(row?.thucNhap);
    const unitPrice =
      toFiniteNumber(row?.unitPrice) ?? parseTongTien(row?.donGia);
    const amount =
      toFiniteNumber(row?.amount) ?? parseTongTien(row?.thanhTien);
    const commodityId = toFiniteNumber(row?.commodityId);
    return {
      ...row,
      stt: row?.stt ?? index + 1,
      commodityId: commodityId != null && commodityId > 0 ? commodityId : null,
      quantity,
      unitPrice,
      amount,
    };
  });
}

function parseBkmhSliceDetailRowsJson(json) {
  return Array.isArray(json) ? json : [];
}
```

Also enrich `mapLineRow` in data-resolver OR snapshot-only: prefer enriching at snapshot time. For Phase 2 re-aggregate, commodityId must exist — update `mapLineRow` / aggregation output to include `commodityId`, `quantity`, `unitPrice`, `amount` as raw fields (extra keys OK for PDF mapping).

In `chung-tu-data-resolver.service.js` `mapLineRow`:

```js
  return {
    stt: index + 1,
    // ... existing display fields ...
    commodityId: line.commodity?.id != null ? Number(line.commodity.id) : null,
    quantity: Number.isFinite(qty) ? qty : null,
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
    amount: Number.isFinite(amount) ? amount : null,
  };
```

Export new helpers from slice-metadata util.

- [ ] **Step 4: Run tests — expect PASS**

```bash
node --test src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.test.js
node --test src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js
```

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.js \
        quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.test.js \
        quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.js
git commit -m "feat(chung-tu): snapshot BKMH detail rows with raw numerics"
```

---

### Task 3: Persist detailRowsJson on monthly upsert + API map

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.js`
- Modify/extend: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.test.js` (or slice util tests if monthly hard to mock)

**Interfaces:**
- Consumes: `buildBkmhSliceDetailRowsSnapshot`, `parseBkmhSliceDetailRowsJson`
- Produces: slice create includes `detailRowsJson`; `mapSliceRow` returns `detailRows`

- [ ] **Step 1: Update `buildSliceCreateInput`**

```js
import {
  buildBkmhSliceMetadata,
  buildBkmhSliceDetailRowsSnapshot,
  parseBkmhSliceDetailRowsJson,
  sumSliceTongTien,
} from "./chung-tu-bkmh-slice-metadata.util.js";

function buildSliceCreateInput({ renderedFile, slice }) {
  const meta = buildBkmhSliceMetadata(slice.context);
  return {
    sortKey: slice.sortKey,
    soChungTu: meta.soChungTu,
    periodDate: toDateOnly(meta.periodDate),
    recipientUnitId: meta.recipientUnitId,
    recipientUnitName: meta.recipientUnitName,
    ngayThangNam: meta.ngayThangNam,
    tongTien: meta.tongTien,
    detailRowsJson: buildBkmhSliceDetailRowsSnapshot(slice.context),
    documentServiceFileId: Number(renderedFile.file_id),
    fileName: renderedFile.file_name,
  };
}
```

- [ ] **Step 2: Update `mapSliceRow`**

```js
function mapSliceRow(monthlyId, row) {
  return {
    // ... existing fields ...
    detailRows: parseBkmhSliceDetailRowsJson(row.detailRowsJson),
  };
}
```

- [ ] **Step 3: Unit test buildSliceCreateInput path**

If monthly service test already mocks create — assert `detailRowsJson` length. Minimal: add test in slice-metadata that monthly wiring uses the builder (already covered). Optional assert in `chung-tu-bkmh-monthly.service.test.js` if create payload is inspected.

- [ ] **Step 4: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.js \
        quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.test.js
git commit -m "feat(chung-tu): persist and return BKMH slice detailRowsJson"
```

---

### Task 4: Phase 1 smoke check

- [ ] **Step 1: Apply migration in running env** (`prisma migrate deploy` + `generate` in app container; restart app if needed)

- [ ] **Step 2: Export one BKMH month** — GET monthly detail, confirm each slice has `detailRows` with raw fields

- [ ] **Step 3: Note** slices created before this change have `detailRows: []` until re-export

---

## Phase 2 Tasks (after Phase 1 verified)

### Task 5: PNK FE — force by-day, hide aggregation picker

**Files:** `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx` (and any PNK-specific aggregation UI)

- When `categoryKey === phieu-nhap-kho`, do not show aggregation mode control; always send `aggregationMode: "by-day"`.

### Task 6: PNK resolve from BKMH slice snapshots

**Files:**
- New util or extend: `chung-tu-pnk-from-bkmh.service.js`
- Modify: `chung-tu-data-resolver.service.js` / batch export for PNK monthly

Behavior:
1. Load BKMH monthly for storage unit + periodMonth
2. Group slices by `periodDate` where `detailRowsJson` non-empty
3. For each day: flatten rows → re-aggregate with shared helper accepting snapshot rows (`commodityId`/`unitPrice`/`quantity`/`amount`) using same merge rule
4. Build sheetContexts only for those days; set `canCuBkmh` from slice metadata
5. **No** `loadSlipsForDate` for PNK monthly line body
6. Empty sources → clear error: yêu cầu xuất BKMH tháng trước

Extract aggregate-from-snapshot so both BKMH LTTP path and PNK snapshot path share one rule (refactor `aggregateLinesToDetailRows` or add `aggregateSnapshotDetailRows`).

### Task 7: Phase 2 tests

- Day without BKMH slice → no PNK slice
- Two slices same day different prices same commodity → 2 rows
- Same commodity same price → 1 row summed qty/amount

---

## Self-Review

- [x] Spec Phase 1 covered by Tasks 1–4
- [x] Spec Phase 2 covered by Tasks 5–7
- [x] Raw numerics called out for re-aggregate
- [x] No placeholder TBD steps in Phase 1
- [x] PNK always by-day / no LTTP fallback documented in Phase 2
