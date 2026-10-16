# Hệ số thập phân AI phiếu xuất Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Câu user nói «1 quả = 0,0625 kg» hoặc «16 quả = 1 kg» đổi số lượng phiếu thành số thập phân và lưu tỷ lệ đó cho mặt hàng ở mọi kho cấp 1.

**Architecture:** Một hàm thuần đọc câu nói ra hệ số. Chat dùng hàm đó trước model. `convertQuantity` áp hệ số và cờ «thiếu đơn vị thì dùng đơn vị này» ở lần gợi ý sau. Ô tích trên hộp thoại đẩy dòng vào hàng hỏi sẵn có.

**Tech Stack:** Node.js ESM, `node:test`, Prisma/MariaDB, React trong `packages/shared`.

## Global Constraints

- Hàm cố định đọc tỷ lệ. Model không ghi đè hệ số khi hàm đã đọc được câu.
- «1 quả = 0,0625 kg» và «16 quả = 1 kg» ra cùng hệ số 0,0625. Trứng 10 quả thành 0,625 kg.
- Dòng không ghi đơn vị mặc định dùng đơn vị kho. «Trứng 10» là 10 kg cho đến khi user nói đơn vị ngầm.
- Cờ đơn vị ngầm chỉ bật khi cùng một câu có tỷ lệ và nói đơn vị thiếu là đơn vị đó.
- Lưu theo mặt hàng, `sharedLevel1`, mọi kho cấp 1 (`depth = 0`). Đổi ngay dòng đang mở.
- Lần sau «trứng 10» thành 0,625 kg, không hỏi lại.
- Hàng hỏi: dòng AI đã đánh dấu lệch, sau khi đã chọn mặt hàng. User tích thêm dòng chưa đúng ý. Dòng thiếu đơn vị không tự vào hàng.
- Ghi chú dòng vẫn theo `originalQtyOnConvert`. Hàm tỷ lệ không tự viết ghi chú.
- Làm tròn 4 chữ số thập phân. Hệ số sau làm tròn lớn hơn 0 và không quá 500.
- «Trứng» không khớp mặt hàng «trứng gà». Hai dòng cùng khớp thì không lưu.
- `proposeUomFactor` giữ cổng hệ số nguyên. Không đụng `slipNote`.

## File Structure

- Create `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-spoken-qty.js` — đọc câu và chọn dòng đích.
- Create `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-spoken-qty.test.js` — các ca trong spec mục 6.
- Modify `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-uom.js` — nhân hệ số làm tròn 4 số; thiếu đơn vị thì dùng quy tắc có cờ.
- Modify `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-match.test.js` — ca 0,625 và ca thiếu đơn vị.
- Modify `quanluong-app-be/prisma/schema.prisma` và migration mới — cột `omitUsesFromUom`.
- Modify `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-learn.js` — ghi cờ, tắt cờ cũ, trả hệ số trước đó.
- Modify `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-patch.js` — `qtyRuleOps` làm tròn 4 số và mang `writtenUom`.
- Modify `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-chat.js` — ưu tiên câu nói, hoàn tác hệ số và cờ.
- Modify `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-parse.js` — dòng thiếu đơn vị nhận `writtenUom` từ kết quả quy đổi.
- Create `packages/shared/src/pages/lttpNhapXuat/lttpIssueSlipAskQueue.js` và test — ô tích thêm câu hỏi.
- Modify `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.jsx` — nút «Chưa đúng» và hiện hệ số 4 số.

---

### Task 1: Hàm đọc câu nói

**Files:**
- Create: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-spoken-qty.js`
- Test: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-spoken-qty.test.js`

**Interfaces:**
- Consumes: `normUom` từ `lttp-issue-slip-ai-uom.js`, `normalizeCommodityName` từ `kitchen-books-menu-ai-map.js`
- Produces:
  - `parseSpokenQtyRule(text, stockUom)` → `null` hoặc `{ error: "unit" }` hoặc `{ fromUom, factor, omitUsesFromUom }`
  - `resolveSpokenQtyRule({ message, lines, commodities })` → `{ rule }` hoặc `{ error: "unit" | "commodity" | "none" }`
  - `rule` là `{ type: "qty", fromUom, factor, omitUsesFromUom, lineId, commodityId, commodityNameNorm }`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { parseSpokenQtyRule, resolveSpokenQtyRule } from "./lttp-issue-slip-ai-spoken-qty.js";

test("both sentence shapes become 0.0625 kg per quả", () => {
  assert.deepEqual(parseSpokenQtyRule("1 quả = 0,0625 kg", "kg"), {
    fromUom: "quả",
    factor: 0.0625,
    omitUsesFromUom: false,
  });
  assert.deepEqual(parseSpokenQtyRule("16 quả = 1 kg", "kg"), {
    fromUom: "quả",
    factor: 0.0625,
    omitUsesFromUom: false,
  });
  assert.deepEqual(parseSpokenQtyRule("1 kg = 16 quả", "kg"), {
    fromUom: "quả",
    factor: 0.0625,
    omitUsesFromUom: false,
  });
  assert.equal(parseSpokenQtyRule("1 thùng = 12 cái", "cái").factor, 12);
  assert.equal(parseSpokenQtyRule("2 lo", "kg"), null);
});

test("the same sentence can name the omitted unit", () => {
  const parsed = parseSpokenQtyRule(
    "trứng chat không có đơn vị tính phía sau thì đơn vị tính là quả và 16 quả = 1 kg",
    "kg",
  );
  assert.equal(parsed.omitUsesFromUom, true);
  assert.equal(parsed.fromUom, "quả");
  assert.equal(parseSpokenQtyRule("16 quả = 1 kg", "kg").omitUsesFromUom, false);
});

test("a ratio whose units miss the stock unit is an error", () => {
  assert.deepEqual(parseSpokenQtyRule("16 quả = 1 hộp", "kg"), { error: "unit" });
  assert.equal(parseSpokenQtyRule("1 kg = 1 kg", "kg"), null);
});

test("resolve uses the asked line, otherwise one whole commodity name", () => {
  const lines = [
    { id: 1, commodityId: 8, commodityName: "Trứng gà", measureUnit: "kg" },
    { id: 2, commodityId: 9, commodityName: "Trứng vịt", measureUnit: "kg" },
  ];
  const commodities = [
    { id: 8, name: "Trứng gà", measureUnit: "kg" },
    { id: 9, name: "Trứng vịt", measureUnit: "kg" },
  ];
  const asked = resolveSpokenQtyRule({
    message: "16 quả = 1 kg",
    lines: [lines[0]],
    commodities,
  });
  assert.equal(asked.rule.commodityId, 8);
  assert.equal(asked.rule.factor, 0.0625);
  assert.equal(asked.rule.lineId, 1);
  assert.deepEqual(
    resolveSpokenQtyRule({ message: "trứng 16 quả = 1 kg", lines, commodities }),
    { error: "commodity" },
  );
  const named = resolveSpokenQtyRule({
    message: "trứng gà 16 quả = 1 kg",
    lines,
    commodities,
  });
  assert.equal(named.rule.commodityId, 8);
  assert.equal(named.rule.commodityNameNorm.includes("trung"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `quanluong-app-be`: `node --test src/modules/lttp/lttp-issue-slip-ai-spoken-qty.test.js`  
Expected: FAIL, cannot find module `lttp-issue-slip-ai-spoken-qty.js`

- [ ] **Step 3: Write minimal implementation**

```js
import { normalizeCommodityName } from "../kitchen-books/kitchen-books-menu-ai-map.js";
import { normUom } from "./lttp-issue-slip-ai-uom.js";

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function parseSpokenQtyRule(text, stockUom) {
  const stock = normUom(stockUom);
  const raw = String(text ?? "").replace(/,/g, ".").replace(/\s+/g, " ").trim();
  if (!stock || !raw) return null;
  const match = /(\d+(?:\.\d+)?)\s*(\p{L}+)\s*=\s*(\d+(?:\.\d+)?)\s*(\p{L}+)/u.exec(raw);
  if (!match) return null;
  const leftQty = Number(match[1]);
  const rightQty = Number(match[3]);
  const leftUom = match[2];
  const rightUom = match[4];
  if (!(leftQty > 0) || !(rightQty > 0)) return null;
  const left = normUom(leftUom);
  const right = normUom(rightUom);
  if (left === right) return null;
  let fromUom;
  let factor;
  if (right === stock && left !== stock) {
    fromUom = leftUom;
    factor = rightQty / leftQty;
  } else if (left === stock && right !== stock) {
    fromUom = rightUom;
    factor = leftQty / rightQty;
  } else {
    return { error: "unit" };
  }
  factor = round4(factor);
  if (!(factor > 0) || factor > 500) return null;
  const omit = /không\s+(?:có|ghi)\s+đơn\s+vị(?:\s+tính)?[\s\S]{0,80}?(?:là|=)\s*(\p{L}+)/iu.exec(raw);
  return {
    fromUom,
    factor,
    omitUsesFromUom: Boolean(omit && normUom(omit[1]) === normUom(fromUom)),
  };
}

function resolveSpokenQtyRule({ message, lines, commodities }) {
  const open = (lines || []).filter((line) => Number(line.commodityId) > 0);
  let target = null;
  if (open.length === 1) target = open[0];
  else {
    const text = normalizeCommodityName(message);
    const hits = open.filter((line) => {
      const name = normalizeCommodityName(line.commodityName || "");
      return name && text.includes(name);
    });
    if (hits.length !== 1) return { error: "commodity" };
    target = hits[0];
  }
  const commodity = (commodities || []).find((item) => item.id === target.commodityId);
  const stockUom = commodity?.measureUnit || target.measureUnit;
  const parsed = parseSpokenQtyRule(message, stockUom);
  if (!parsed) return { error: "none" };
  if (parsed.error) return { error: parsed.error };
  return {
    rule: {
      type: "qty",
      fromUom: parsed.fromUom,
      factor: parsed.factor,
      omitUsesFromUom: parsed.omitUsesFromUom,
      lineId: target.id,
      commodityId: target.commodityId,
      commodityNameNorm: normalizeCommodityName(target.commodityName || "") || null,
    },
  };
}

export { parseSpokenQtyRule, resolveSpokenQtyRule };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai-spoken-qty.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-spoken-qty.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-spoken-qty.test.js
git commit -m "feat(lttp): read spoken decimal quantity rules"
```

---

### Task 2: Cột cờ và ghi quy tắc

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma` model `LttpAiUomRule`
- Create: `quanluong-app-be/prisma/migrations/20261005120000_lttp_ai_uom_omit_uses_from/migration.sql`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-learn.js` hàm `confirmUomRule`
- Test: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-spoken-qty.test.js` thêm một test gọi `confirmUomRule` với prisma giả

**Interfaces:**
- Consumes: `confirmUomRule` hiện có
- Produces: `confirmUomRule` nhận thêm `omitUsesFromUom`. Trả `{ id, created, previous: { factor, omitUsesFromUom } | null, cleared: [{ id, omitUsesFromUom: true }] }`

- [ ] **Step 1: Write the failing test**

Thêm vào file test của Task 1:

```js
import { confirmUomRule } from "./lttp-issue-slip-ai-learn.js";

test("confirming an omitted unit clears the flag on the other shared rule", async () => {
  const rows = [
    { id: 1, recipientUnitId: 4, commodityId: 8, fromUom: "qua", factor: 1, confirmed: true, sharedLevel1: true, commodityNameNorm: "trung ga", omitUsesFromUom: false },
    { id: 2, recipientUnitId: 4, commodityId: 8, fromUom: "hop", factor: 2, confirmed: true, sharedLevel1: true, commodityNameNorm: "trung ga", omitUsesFromUom: true },
  ];
  const prisma = {
    lttpAiUomRule: {
      async findFirst({ where }) {
        return rows.find((row) => row.fromUom === where.fromUom && row.commodityNameNorm === where.commodityNameNorm) || null;
      },
      async findMany({ where }) {
        return rows.filter((row) => row.omitUsesFromUom && row.commodityNameNorm === where.commodityNameNorm && row.id !== where.NOT.id);
      },
      async update({ where, data }) {
        const row = rows.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
      async create({ data }) {
        const row = { ...data, id: 3 };
        rows.push(row);
        return row;
      },
    },
  };
  const saved = await confirmUomRule({
    prisma,
    recipientUnitId: 4,
    commodityId: 8,
    fromUom: "qua",
    factor: 0.0625,
    sharedLevel1: true,
    commodityNameNorm: "trung ga",
    omitUsesFromUom: true,
  });
  assert.equal(saved.created, false);
  assert.equal(saved.previous.factor, 1);
  assert.equal(saved.previous.omitUsesFromUom, false);
  assert.equal(rows[0].factor, 0.0625);
  assert.equal(rows[0].omitUsesFromUom, true);
  assert.equal(rows[1].omitUsesFromUom, false);
  assert.deepEqual(saved.cleared, [{ id: 2, omitUsesFromUom: true }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai-spoken-qty.test.js`  
Expected: FAIL, `previous` undefined hoặc prisma giả không được gọi đúng

- [ ] **Step 3: Write minimal implementation**

Trong `schema.prisma`, model `LttpAiUomRule`, thêm sau `commodityNameNorm`:

```prisma
omitUsesFromUom Boolean @default(false)
```

`migration.sql`:

```sql
ALTER TABLE `LttpAiUomRule` ADD COLUMN `omitUsesFromUom` BOOLEAN NOT NULL DEFAULT false;
```

`confirmUomRule`: thêm tham số `omitUsesFromUom = false`. Khi cập nhật bản ghi đã có, `previous` là `{ factor: Number(existing.factor), omitUsesFromUom: Boolean(existing.omitUsesFromUom) }`. Chỉ ghi `omitUsesFromUom: true` khi đối số true; đối số false giữ cờ cũ. Khi tạo mới, cờ là giá trị đối số. Nếu đối số true và `commodityNameNorm` có giá trị, `findMany` với `where` đúng `{ sharedLevel1: true, commodityNameNorm: nameNorm, omitUsesFromUom: true, NOT: { id: row.id } }`, rồi `update` từng bản về false. `cleared` là các id đó với `omitUsesFromUom: true`. `created: false` khi đã có bản ghi.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai-spoken-qty.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/prisma/schema.prisma quanluong-app-be/prisma/migrations/20261005120000_lttp_ai_uom_omit_uses_from/migration.sql quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-learn.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-spoken-qty.test.js
git commit -m "feat(lttp): store the omitted-unit flag on quantity rules"
```

---

### Task 3: Lần gợi ý sau dùng cờ và 4 chữ số

**Files:**
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-uom.js` hàm `convertQuantity`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-parse.js` chỗ gán `writtenUom` trong `finishLine`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-match.test.js`

**Interfaces:**
- Consumes: quy tắc `{ omitUsesFromUom: true, fromUom, factor, confirmed, commodityId }`
- Produces: `convertQuantity` thiếu đơn vị và đúng một cờ thì `quantity` làm tròn 4 số, `fromUom` là đơn vị ngầm, `source` là `"rule"`. Phép nhân hệ số khác cũng làm tròn 4 số, không còn 1 số.

- [ ] **Step 1: Write the failing test**

Thêm vào `lttp-issue-slip-ai-match.test.js`:

```js
test("an omitted-unit flag converts trứng 10 into 0.625 kg", () => {
  const converted = convertQuantity({
    writtenQty: "10",
    writtenUom: "",
    stockUom: "kg",
    commodityId: 8,
    rules: [{ commodityId: 8, fromUom: "quả", factor: 0.0625, confirmed: true, omitUsesFromUom: true }],
  });
  assert.equal(converted.quantity, 0.625);
  assert.equal(converted.measureUnit, "kg");
  assert.equal(converted.fromUom, "quả");
  assert.equal(converted.source, "rule");
});

test("two omitted-unit flags do not guess, and a written quả still multiplies", () => {
  const ambiguous = convertQuantity({
    writtenQty: "10",
    writtenUom: "",
    stockUom: "kg",
    commodityId: 8,
    rules: [
      { commodityId: 8, fromUom: "quả", factor: 0.0625, confirmed: true, omitUsesFromUom: true },
      { commodityId: 8, fromUom: "hộp", factor: 0.5, confirmed: true, omitUsesFromUom: true },
    ],
  });
  assert.equal(ambiguous.quantity, 10);
  assert.equal(ambiguous.source, "as-written");
  const written = convertQuantity({
    writtenQty: "10",
    writtenUom: "quả",
    stockUom: "kg",
    commodityId: 8,
    rules: [{ commodityId: 8, fromUom: "quả", factor: 0.0625, confirmed: true, omitUsesFromUom: false }],
  });
  assert.equal(written.quantity, 0.625);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai-match.test.js`  
Expected: FAIL, quantity `10` hoặc `0.6` thay vì `0.625`

- [ ] **Step 3: Write minimal implementation**

Trong `convertQuantity`, thay `round1` ở các nhánh nhân `factor` bằng:

```js
function round4(value) {
  return Math.round(value * 10000) / 10000;
}
```

Nhánh `!from`, trước quy tắc `*`: nếu đúng một rule `confirmed && omitUsesFromUom` khớp `commodityId` theo `findRule` (cùng mặt hàng, rồi rule `commodityId == null`), gọi đệ quy nội bộ bằng cách đặt `writtenUom` thành `rule.fromUom` rồi đi tiếp nhánh có đơn vị. Không đệ quy vô hạn: chỉ nhảy một lần. Hai rule cùng cờ thì bỏ qua và giữ luồng cũ.

Trong `finishLine`, đổi dòng `writtenUom`:

```js
writtenUom: item?.uom ? item.uom : converted.fromUom || "",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai-match.test.js src/modules/lttp/lttp-issue-slip-ai-parse.line-note.test.js`  
Expected: PASS. Ca «2 lô = 24 chai» và ca thiếu đơn vị dùng rule `*` vẫn đúng.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-uom.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-parse.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-match.test.js
git commit -m "feat(lttp): apply omitted-unit factors with four decimals"
```

---

### Task 4: Chat áp câu nói và hoàn tác

**Files:**
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-patch.js` `qtyRuleOps`, `lineBefore`, `validateAndResolvePatch`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-chat.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-chat.test.js`

**Interfaces:**
- Consumes: `resolveSpokenQtyRule` từ Task 1, `confirmUomRule` từ Task 2
- Produces: lượt chat có `ruleSuggestion.factor` thập phân. `after.writtenUom` được ghi khi cờ bật và dòng chưa có đơn vị. Hoàn tác trả `factor` và `omitUsesFromUom`.

- [ ] **Step 1: Write the failing test**

Thay `lttpAiUomRule` trong `memoryPrisma` bằng object có `rows: []` và các hàm sau. `findMany` vẫn trả rule `lo` × 12 khi nạp rule của đơn vị, để test «2 lo» thành 24 không gãy:

```js
lttpAiUomRule: {
  rows: [],
  async findFirst({ where }) {
    return (
      this.rows.find(
        (row) =>
          row.fromUom === where.fromUom &&
          row.commodityNameNorm === where.commodityNameNorm &&
          row.sharedLevel1 === where.sharedLevel1,
      ) || null
    );
  },
  async findMany({ where } = {}) {
    if (where?.omitUsesFromUom) {
      return this.rows.filter(
        (row) => row.omitUsesFromUom && row.id !== where.NOT?.id && row.commodityNameNorm === where.commodityNameNorm,
      );
    }
    if (where?.sharedLevel1 === false) {
      return [{ commodityId: 10, fromUom: "lo", factor: 12, confirmed: true, sharedLevel1: false }];
    }
    return this.rows.filter((row) => row.sharedLevel1);
  },
  async update({ where, data }) {
    const row = this.rows.find((item) => item.id === where.id);
    Object.assign(row, data);
    return row;
  },
  async create({ data }) {
    const row = { ...data, id: this.rows.length + 7 };
    this.rows.push(row);
    return row;
  },
  async delete({ where }) {
    this.rows = this.rows.filter((row) => row.id !== where.id);
  },
},
```

Test mới:

```js
test("spoken 16 quả = 1 kg beats a model factor of 1", async () => {
  const db = memoryPrisma();
  db.lines[0].commodityName = "Trứng gà";
  db.lines[0].measureUnit = "kg";
  db.lttpCommodity.findMany = async () => [
    {
      id: 10,
      name: "Trứng gà",
      code: "TRUNG",
      measureUnit: "kg",
      lttpCommodityDefaultSupplier: { lttpSupplierId: 3 },
    },
  ];
  db.lines[0].quantity = 10;
  db.lines[0].writtenQty = "10";
  db.lines[0].writtenUom = null;
  const proposed = await proposeIssueSlipAiDraftChat(
    db,
    { id: 1, storageUnitId: 9, message: "16 quả = 1 kg", lineIds: [5], actorUserId: 1 },
    { complete: async () => { throw new Error("model phải không được gọi"); } },
  );
  assert.equal(proposed.ruleSuggestion.factor, 0.0625);
  assert.equal(proposed.ruleSuggestion.omitUsesFromUom, false);
  assert.equal(proposed.diff[0].after.quantity, 0.625);
  const applied = await applyProposedDraftPatch(db, {
    id: 1,
    storageUnitId: 9,
    version: 1,
    turnId: proposed.turnId,
    actorUserId: 1,
  });
  assert.equal(Number(applied.lines[0].quantity), 0.625);
  assert.equal(applied.lines[0].writtenUom, null);
  const again = await proposeIssueSlipAiDraftChat(
    db,
    {
      id: 1,
      storageUnitId: 9,
      message: "không có đơn vị tính thì đơn vị tính là quả và 16 quả = 1 kg",
      lineIds: [5],
      actorUserId: 1,
    },
    { complete: async () => { throw new Error("model phải không được gọi"); } },
  );
  assert.equal(again.ruleSuggestion.omitUsesFromUom, true);
  assert.equal(again.diff[0].after.writtenUom, "quả");
});
```

Sửa `getIssueSlipAiDraft` nếu test đọc `applied.lines[0].writtenUom` từ mapper hiện có. Mapper đã trả `writtenUom`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai-draft-chat.test.js`  
Expected: FAIL vì model vẫn được gọi hoặc quantity không phải 0.625

- [ ] **Step 3: Write minimal implementation**

`qtyRuleOps`: `Math.round(qty * rule.factor * 10000) / 10000`. Khi `rule.omitUsesFromUom` và dòng không có `writtenUom`, thêm `writtenUom: rule.fromUom` vào op.

`lineBefore` thêm `writtenUom` và `writtenQty`. `validateAndResolvePatch` copy `raw.writtenUom` vào `after.writtenUom` khi có.

`proposeIssueSlipAiDraftChat`: sau khi có `lines` và `loadPatchContext`, gọi `resolveSpokenQtyRule`. Nếu `rule`, không gọi `complete`. `ruleSuggestion` là rule đó, `ruleOps` từ `qtyRuleOps`. `explanation` là `Quy ước ${fromUom} × ${factor}.`. Nếu `error` là `"unit"`, explanation `Đơn vị không khớp mặt hàng.` và không gọi model. Nếu `"commodity"`, explanation `Chưa khớp một mặt hàng.` và không gọi model. Nếu `"none"`, giữ luồng model hiện tại.

`applyProposedDraftPatch`: `update` dòng thêm `writtenUom` khi `op.after.writtenUom` có giá trị. `confirmUomRule` truyền `omitUsesFromUom: Boolean(rule.omitUsesFromUom)`. Lưu vào `proposedPatch`: `rulePrevious: saved.previous`, `ruleCleared: saved.cleared`, `ruleCreated`.

`undoLastDraftChatApply`: nếu không `ruleCreated` và có `ruleId`, `update` rule về `rulePrevious.factor` và `rulePrevious.omitUsesFromUom`. Với mỗi phần tử `ruleCleared`, `update` lại `omitUsesFromUom: true`. Vẫn xóa rule khi `ruleCreated`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai-draft-chat.test.js src/modules/lttp/lttp-issue-slip-ai-draft-patch.test.js`  
Expected: PASS, gồm test «2 lo» thành 24

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-patch.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-chat.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-chat.test.js
git commit -m "feat(lttp): apply spoken quantity rules from AI chat"
```

---

### Task 5: Ô tích trên hộp gợi ý

**Files:**
- Create: `packages/shared/src/pages/lttpNhapXuat/lttpIssueSlipAskQueue.js`
- Create: `packages/shared/src/pages/lttpNhapXuat/lttpIssueSlipAskQueue.test.js`
- Modify: `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.jsx`

**Interfaces:**
- Consumes: dòng preview có `commodityId`, `draftLineId`, `commodityName`
- Produces: `withUserAsk(lines, index)`, `userAskQuestions(lines)` với `text` kết thúc bằng `chưa đúng chỗ nào?`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { userAskQuestions, withUserAsk } from "./lttpIssueSlipAskQueue.js";

test("ticking a chosen line queues one question", () => {
  const lines = withUserAsk(
    [
      { draftLineId: 5, commodityId: 8, commodityName: "Trứng gà" },
      { draftLineId: 6, commodityId: null, commodityName: "gạo" },
    ],
    0,
  );
  assert.equal(lines[0].askUser, true);
  assert.equal(withUserAsk(lines, 1)[1].askUser, undefined);
  assert.deepEqual(userAskQuestions(lines), [
    {
      key: "user:5",
      lineIndex: 0,
      draftLineId: 5,
      text: "Trứng gà chưa đúng chỗ nào?",
    },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `packages/shared`: `node --test src/pages/lttpNhapXuat/lttpIssueSlipAskQueue.test.js`  
Expected: FAIL, cannot find module

- [ ] **Step 3: Write minimal implementation**

`lttpIssueSlipAskQueue.js` như test mô tả: `withUserAsk` chỉ gắn `askUser: true` khi `lines[index].commodityId` có giá trị. `userAskQuestions` bỏ dòng không có `askUser` hoặc không có `commodityId`.

Trong dialog, import hai hàm. `askNext` ghép `userAskQuestions(lines)` ngay sau `ruleQuestions(lines)`. Nút trên mỗi dòng đã có `commodityId`:

```jsx
<button
  type="button"
  className="text-[11px] text-primary"
  disabled={busy}
  onClick={() => {
    const lines = withUserAsk(preview.lines, i);
    const next = { ...preview, lines };
    setPreview(next);
    if (!activeRef.current) askNext(lines);
  }}
>
  Chưa đúng
</button>
```

`mergeDraftLines` giữ `askUser` vì đã spread `...line`. `formatFactor` đổi thành `String(Math.round(n * 10000) / 10000)` để câu hỏi quy đổi không hiện 0,1 thay cho 0,0625.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/pages/lttpNhapXuat/lttpIssueSlipAskQueue.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/pages/lttpNhapXuat/lttpIssueSlipAskQueue.js packages/shared/src/pages/lttpNhapXuat/lttpIssueSlipAskQueue.test.js packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.jsx
git commit -m "feat(lttp): let the user queue a wrong issue-slip line"
```
