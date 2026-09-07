# Chứng từ aggregate-by-price Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Node gộp dòng LTTP theo mặt hàng + `unitPrice` exact (không giá trung bình); PDF `soChungTu`/`so`/`soPhieu` mang prefix `Số: ` từ Node.

**Architecture:** Đổi `aggregateLinesToDetailRows` trong resolver (mọi category dùng chung). Format số chứng từ idempotent trong `formatDerivedNamedRangeValue`, rồi gọi từ `pickMappedFields` khi build PDF payload. Python không đổi.

**Tech Stack:** Node.js, `node:test`, Prisma LTTP lines (không đổi schema), `chung-tu-named-range-display.js`.

## Global Constraints

- Cùng giá = `Number(unitPrice)` hữu hạn và bằng nhau (dùng `String(price)` làm phần key).
- Không `amount/qty` làm đơn giá.
- Người bán nối `", "` theo thứ tự xuất hiện (Set).
- STT đánh lại `1…n` sau gộp.
- Prefix `Số: ` qua `formatDerivedNamedRangeValue`; rỗng → `""`; không double-prefix.
- Out of scope: Python gộp, Excel import, mang trang / chữ tiền.

---

## File map

| File | Responsibility |
|------|----------------|
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.js` | `aggregateLinesToDetailRows` key = commodity + price |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js` | Tests gộp / tách giá / STT / NCC |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-named-range-display.js` | Idempotent `Số:` (và label khác nếu đã có) |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-named-range-display.test.js` | Double-prefix + empty |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.js` | `pickMappedFields` format labeled scalars |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js` | PDF fields có `Số: ` |

---

### Task 1: Gộp theo mặt hàng + đơn giá

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.js` (`aggregateLinesToDetailRows`, ~276–340)
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js`

**Interfaces:**
- Consumes: `commodityGroupKey(line)`, `mapLineRow(line, index)`, `formatVndNumber`
- Produces: `aggregateLinesToDetailRows(rawLines) -> detailRow[]` — một dòng mỗi (commodity, unitPrice); `donGia` từ `unitPrice` nhóm

- [ ] **Step 1: Write the failing tests**

Replace/extend tests in `chung-tu-data-resolver.service.test.js`:

```js
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
```

Keep existing `renumbers stt after merge` test.

- [ ] **Step 2: Run tests to verify fail**

Run:

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js
```

Expected: new test FAIL (length 1 or averaged `donGia`) vì implementation cũ gộp theo commodity và `amount/qty`.

- [ ] **Step 3: Implement aggregation**

Replace `aggregateLinesToDetailRows` body with:

```js
/** Gộp dòng cùng hàng hóa + cùng unitPrice; khác giá → dòng mới (không trung bình). */
function aggregateLinesToDetailRows(rawLines) {
  const groups = new Map();
  for (const line of rawLines ?? []) {
    const unitPrice = Number(line.unitPrice);
    const priceKey = Number.isFinite(unitPrice) ? String(unitPrice) : "__no_price__";
    const key = `${commodityGroupKey(line)}|${priceKey}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        commodity: line.commodity ?? null,
        lttpSupplier: line.lttpSupplier ?? null,
        supplierNames: new Set(),
        quantity: 0,
        requiredQuantity: 0,
        hasRequiredQuantity: false,
        amount: 0,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
        lineNotes: new Set(),
      };
      groups.set(key, group);
    }
    const qty = Number(line.quantity);
    const amount = Number(line.amount);
    const requiredQty = Number(line.requiredQuantity);
    if (Number.isFinite(qty)) group.quantity += qty;
    if (Number.isFinite(amount)) group.amount += amount;
    if (Number.isFinite(requiredQty)) {
      group.requiredQuantity += requiredQty;
      group.hasRequiredQuantity = true;
    }
    const supplierName = String(line.lttpSupplier?.name ?? "").trim();
    if (supplierName) group.supplierNames.add(supplierName);
    const lineNote = String(line.lineNote ?? "").trim();
    if (lineNote) group.lineNotes.add(lineNote);
  }

  return [...groups.values()].map((group, index) => {
    const supplierNames = [...group.supplierNames];
    const lttpSupplier =
      supplierNames.length === 1
        ? { name: supplierNames[0] }
        : supplierNames.length > 1
          ? { name: supplierNames.join(", ") }
          : group.lttpSupplier;
    return mapLineRow(
      {
        commodity: group.commodity,
        lttpSupplier,
        quantity: group.quantity,
        requiredQuantity: group.hasRequiredQuantity ? group.requiredQuantity : null,
        unitPrice: group.unitPrice,
        amount: group.amount,
        lineNote: [...group.lineNotes].join("; "),
      },
      index,
    );
  });
}
```

- [ ] **Step 4: Run tests to verify pass**

Run same command as Step 2. Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js
git commit -m "$(cat <<'EOF'
fix(chung-tu): aggregate detail rows by commodity and unitPrice

Same price merges qty/amount and joins sellers; different prices
stay separate rows without averaging.
EOF
)"
```

---

### Task 2: PDF `Số: ` prefix trên số chứng từ

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-named-range-display.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-named-range-display.test.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js`

**Interfaces:**
- Consumes: `formatDerivedNamedRangeValue(fieldKey, rawValue) -> string`
- Produces: `pickMappedFields` áp formatter cho scalar đã resolve (`soChungTu` / `so` / `soPhieu` / `quyenSo` / `tongTienBangChu` nếu có trong LABELED_FIELD_FORMATTERS)

- [ ] **Step 1: Write failing tests for idempotent formatter + PDF map**

In `chung-tu-named-range-display.test.js` add:

```js
test("formatDerivedNamedRangeValue does not double Số prefix", () => {
  assert.equal(formatDerivedNamedRangeValue("soChungTu", "Số: 062615"), "Số: 062615");
  assert.equal(formatDerivedNamedRangeValue("so", "Số: 1"), "Số: 1");
});
```

In `chung-tu-pdf-map.util.test.js` change/add:

```js
test("pickMappedFields prefixes so_chung_tu with Số:", () => {
  assert.deepEqual(
    pickMappedFields({ soChungTu: "062615" }, ["so_chung_tu", "so", "so_phieu"]),
    {
      so_chung_tu: "Số: 062615",
      so: "Số: 062615",
      so_phieu: "Số: 062615",
    },
  );
});

test("pickMappedFields leaves empty soChungTu empty", () => {
  assert.deepEqual(pickMappedFields({ soChungTu: "  " }, ["so_chung_tu"]), {
    so_chung_tu: "",
  });
});
```

Update the top-level assert that currently expects `so_chung_tu: "A1"` — move into a test or change expectation to `Số: A1` if that assert still runs for `soChungTu: "A1"`.

- [ ] **Step 2: Run tests to verify fail**

```bash
cd quanluong-app-be && node --test \
  src/modules/chung-tu-quyet-toan/chung-tu-named-range-display.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js
```

Expected: PDF map test FAIL (`A1` / bare number without `Số: `); double-prefix test may FAIL if formatter always prepends.

- [ ] **Step 3: Make formatter idempotent**

Replace `formatDerivedNamedRangeValue` in `chung-tu-named-range-display.js`:

```js
const LABELED_FIELD_PREFIXES = Object.freeze({
  quyenSo: "Quyển số: ",
  so: "Số: ",
  soChungTu: "Số: ",
  soPhieu: "Số: ",
  tongTienBangChu: "Tổng số tiền (Viết bằng chữ): ",
});

export function formatDerivedNamedRangeValue(fieldKey, rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";
  const prefix = LABELED_FIELD_PREFIXES[fieldKey];
  if (!prefix) return value;
  if (value.startsWith(prefix.trimEnd()) || value.startsWith(prefix)) return value;
  return `${prefix}${value}`;
}
```

(Keep `LABELED_FIELD_FORMATTERS` removed or unused — one source of truth via prefixes.)

Update existing tests that still pass (`Quyển số:`, `Số:`, tong tiền).

- [ ] **Step 4: Apply formatter in `pickMappedFields`**

In `chung-tu-pdf-map.util.js`:

```js
import { formatDerivedNamedRangeValue } from "./chung-tu-named-range-display.js";

export function pickMappedFields(context, fieldKeys) {
  const out = {};
  for (const key of fieldKeys) {
    const fieldKey = resolveScalarFieldKey(key);
    const raw = fieldKey
      ? lookupContextValue(context, fieldKey) ?? lookupContextValue(context, camelToSnake(fieldKey))
      : lookupContextValue(context, key);
    if (raw === undefined) continue;
    const formatKey = fieldKey || resolveScalarFieldKey(key) || key;
    // Prefer camel fieldKey for LABELED prefixes (soChungTu), not snake template key.
    const labeledKey =
      fieldKey && ["soChungTu", "so", "soPhieu", "quyenSo", "tongTienBangChu"].includes(fieldKey)
        ? fieldKey
        : null;
    out[key] = labeledKey
      ? formatDerivedNamedRangeValue(labeledKey, raw)
      : valueToCell(raw);
  }
  return out;
}
```

Simpler equivalent:

```js
    if (raw === undefined) continue;
    const cell = valueToCell(raw);
    out[key] = fieldKey ? formatDerivedNamedRangeValue(fieldKey, cell) : cell;
```

Because `formatDerivedNamedRangeValue` returns unchanged value when `fieldKey` not in prefix map — safe for all scalars.

- [ ] **Step 5: Run tests to verify pass**

```bash
cd quanluong-app-be && node --test \
  src/modules/chung-tu-quyet-toan/chung-tu-named-range-display.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-named-range-display.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-named-range-display.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js
git commit -m "$(cat <<'EOF'
feat(chung-tu): prefix PDF document number fields with Số:

Reuse idempotent named-range formatter in pickMappedFields so
soChungTu/so/soPhieu match Sheets labeling without double prefix.
EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Key commodity + exact unitPrice | Task 1 |
| No average price | Task 1 |
| Join sellers `", "` | Task 1 (existing behavior kept) |
| STT renumber | Task 1 |
| All categories via shared fn | Task 1 (same call sites) |
| PDF `Số: ` via formatter | Task 2 |
| No double-prefix / empty → `""` | Task 2 |
| Python unchanged | (no task) |

## Self-review

- No TBD placeholders.
- `formatDerivedNamedRangeValue` signature unchanged for Sheets callers.
- Existing top-level assert in `chung-tu-pdf-map.util.test.js` for `so_chung_tu: "A1"` **must** be updated in Task 2 Step 1 (called out explicitly).
