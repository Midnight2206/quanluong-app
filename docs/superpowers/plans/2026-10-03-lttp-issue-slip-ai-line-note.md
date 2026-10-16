# Ghi chú dòng AI phiếu xuất Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cột Ghi chú của từng dòng phiếu xuất nhận chuỗi cố định từ phép tính, ngoặc, hoặc rule đổi đơn vị dùng chung kho cấp 1.

**Architecture:** Một hàm thuần chọn ghi chú. Parser giữ token số lượng và phần ngoặc, rồi gọi hàm đó. Chat chỉ bật hoặc tắt một bản ghi `originalQtyOnConvert`. Hộp thoại copy `lineNote` vào form khi bấm Áp dụng.

**Tech Stack:** Node.js ESM, `node:test`, Prisma/MariaDB, React trong `packages/shared`.

## Global Constraints

- Cột được điền là `lineNote`, cắt còn 500 ký tự. Không đụng `slipNote`.
- Phép tính `4+6` cho số lượng tổng `10` và ghi chú `4+6`. Không lưu rule.
- Ngoặc `chuối 3kg (30 quả)` cho ghi chú `30 quả`. Không lưu rule.
- Rule đổi đơn vị chưa có sẵn. Một bản ghi chung mọi kho cấp 1, không gắn mặt hàng hay cặp đơn vị.
- Nói rule trong chat thì điền ngay dòng đang mở và các lần gợi ý sau.
- Dòng có phép tính thì ghi chú chỉ còn phép tính.
- Model không được bịa chuỗi ghi chú. `rule_suggestion.type = "note"` vẫn trả `null`.
- Chỉ kho `depth = 0` đọc rule.

## File Structure

- Create `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-line-note.js` — hàm chọn ghi chú và tách phép cộng.
- Create `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-line-note.test.js` — assert từng ca trong spec.
- Modify `lttp-issue-slip-ai-extract.js` — prompt giữ phép cộng và ngoặc.
- Modify `lttp-issue-slip-ai-parse.js` — tách ngoặc, cộng số trước khi quy đổi, gắn `lineNote`.
- Modify `lttp-issue-slip-ai-uom.js` consumers `quantityForChosenSku` — chọn SKU sau vẫn cộng phép tính.
- Modify `prisma/schema.prisma` và một migration — `parenText` trên dòng nháp, bảng rule một kind.
- Modify `lttp-issue-slip-ai-draft.js` — lưu `parenText`, trả `lineNote` khi đọc nháp.
- Modify `lttp-issue-slip-ai-draft-patch.js` — nhận `line_note`.
- Modify `lttp-issue-slip-ai-draft-chat.js` — bật/tắt rule và hoàn tác.
- Modify `lttp-issue-slip-ai.service.js` — truyền cờ rule vào lần gợi ý.
- Modify `applyIssueSlipAiPreview.js` và `LttpIssueSlipAiSuggestDialog.jsx` — đưa ghi chú ra form và hiện trên dòng đang mở.

---

### Task 1: Hàm chọn ghi chú

**Files:**
- Create: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-line-note.js`
- Test: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-line-note.test.js`

**Interfaces:**
- Consumes: không
- Produces: `parseSumExpression(raw) -> { expression: string, sum: number } | null`, `takeLastParen(name) -> { name: string, parenText: string | null }`, `quantityTokenForConvert(writtenQty) -> string`, `lineNoteForItem({ writtenQty, writtenUom, parenText, stockUom, originalQtyOnConvert }) -> { lineNote: string }`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { lineNoteForItem, parseSumExpression, quantityTokenForConvert, takeLastParen } from "./lttp-issue-slip-ai-line-note.js";

test("addition keeps the expression and sums the parts", () => {
  assert.deepEqual(parseSumExpression("4 + 6"), { expression: "4+6", sum: 10 });
  assert.equal(quantityTokenForConvert("4+6+2"), "12");
  assert.equal(lineNoteForItem({ writtenQty: "4+6", writtenUom: "quả", parenText: "loại 1", stockUom: "kg", originalQtyOnConvert: true }).lineNote, "4+6");
  assert.equal(lineNoteForItem({ writtenQty: "4+6+2", writtenUom: "kg", parenText: "", stockUom: "kg", originalQtyOnConvert: false }).lineNote, "4+6+2");
  assert.equal(parseSumExpression("4*6"), null);
  assert.equal(lineNoteForItem({ writtenQty: "4*6", writtenUom: "kg", parenText: "", stockUom: "kg", originalQtyOnConvert: false }).lineNote, "");
});

test("parentheses fill the note only when there is no addition", () => {
  assert.deepEqual(takeLastParen("chuối (30 quả)"), { name: "chuối", parenText: "30 quả" });
  assert.equal(lineNoteForItem({ writtenQty: "3", writtenUom: "kg", parenText: "30 quả", stockUom: "kg", originalQtyOnConvert: false }).lineNote, "30 quả");
  assert.equal(lineNoteForItem({ writtenQty: "3", writtenUom: "kg", parenText: "   ", stockUom: "kg", originalQtyOnConvert: false }).lineNote, "");
});

test("conversion note waits for the shared rule and loses to an addition", () => {
  assert.equal(lineNoteForItem({ writtenQty: "30", writtenUom: "quả", parenText: "", stockUom: "kg", originalQtyOnConvert: false }).lineNote, "");
  assert.equal(lineNoteForItem({ writtenQty: "30", writtenUom: "quả", parenText: "", stockUom: "kg", originalQtyOnConvert: true }).lineNote, "30 quả");
  assert.equal(lineNoteForItem({ writtenQty: "30", writtenUom: "kg", parenText: "", stockUom: "kg", originalQtyOnConvert: true }).lineNote, "");
  assert.equal(lineNoteForItem({ writtenQty: "4+6", writtenUom: "quả", parenText: "", stockUom: "kg", originalQtyOnConvert: true }).lineNote, "4+6");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `quanluong-app-be`: `node --test src/modules/lttp/lttp-issue-slip-ai-line-note.test.js`  
Expected: FAIL, cannot find module `./lttp-issue-slip-ai-line-note.js`

- [ ] **Step 3: Write minimal implementation**

```js
const NOTE_LIMIT = 500;

function parseSumExpression(raw) {
  const compact = String(raw ?? "").replace(/\s+/g, "");
  if (!/^\d+(?:[.,]\d+)?(?:\+\d+(?:[.,]\d+)?)+$/.test(compact)) return null;
  const sum = compact.split("+").reduce((total, part) => total + Number(part.replace(",", ".")), 0);
  if (!Number.isFinite(sum) || sum <= 0) return null;
  return { expression: compact, sum };
}

function quantityTokenForConvert(writtenQty) {
  const expr = parseSumExpression(writtenQty);
  return expr ? String(expr.sum) : writtenQty;
}

function takeLastParen(name) {
  const text = String(name ?? "");
  const matches = [...text.matchAll(/\(([^)]*)\)/g)];
  if (!matches.length) return { name: text.trim(), parenText: null };
  const last = matches[matches.length - 1];
  const parenText = String(last[1] || "").trim();
  const stripped = text.replace(last[0], " ").replace(/\s+/g, " ").trim();
  return { name: stripped, parenText: parenText || null };
}

function unitsDiffer(a, b) {
  const left = String(a || "").trim().toLowerCase();
  const right = String(b || "").trim().toLowerCase();
  return Boolean(left) && Boolean(right) && left !== right;
}

function lineNoteForItem({ writtenQty, writtenUom, parenText, stockUom, originalQtyOnConvert }) {
  const expr = parseSumExpression(writtenQty);
  if (expr) return { lineNote: expr.expression.slice(0, NOTE_LIMIT) };
  const paren = String(parenText ?? "").trim();
  if (paren) return { lineNote: paren.slice(0, NOTE_LIMIT) };
  const qty = String(writtenQty ?? "").replace(/\s+/g, "");
  const uom = String(writtenUom ?? "").trim();
  if (originalQtyOnConvert && /^\d+(?:[.,]\d+)?$/.test(qty) && unitsDiffer(uom, stockUom)) {
    return { lineNote: `${qty} ${uom}`.slice(0, NOTE_LIMIT) };
  }
  return { lineNote: "" };
}

export { lineNoteForItem, parseSumExpression, quantityTokenForConvert, takeLastParen };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai-line-note.test.js`  
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-line-note.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-line-note.test.js
git commit -m "feat(lttp): choose issue-slip line notes from fixed rules"
```

---

### Task 2: Parser giữ phép tính và ngoặc

**Files:**
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-extract.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-parse.js`
- Test: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.prompt.test.js` if it asserts the extract system string; otherwise add the assertion there

**Interfaces:**
- Consumes: `takeLastParen`, `quantityTokenForConvert`, `lineNoteForItem`
- Produces: mỗi dòng parse có `rawName` đã bỏ ngoặc, `writtenQty` nguyên chuỗi khách viết, `parenText`, `lineNote`. `convertQuantity` nhận tổng của phép tính, không nhận chuỗi `4+6`.

- [ ] **Step 1: Write the failing test**

Trong `lttp-issue-slip-ai.prompt.test.js`, assert system prompt của `buildExtractPrompt` chứa cả hai câu: `quantity giu dung chu 4+6` và `giu ngoac trong name`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai.prompt.test.js`  
Expected: FAIL vì prompt hiện chỉ nói `Giu dung tu khach viet`

- [ ] **Step 3: Write minimal implementation**

Đổi system của `buildExtractPrompt` thành:

```js
"Tach tin dat hang thanh JSON {\"items\":[{\"name\":\"\",\"quantity\":\"\",\"uom\":\"\"}]}. Giu dung tu khach viet. Neu khach viet phep cong nhu 4+6, quantity giu dung chu 4+6, khong tinh tong. Neu co ngoac, giu ngoac trong name. Khong doi ten hang, khong quy doi don vi, khong them dong khach khong viet."
```

Trong `finishLine`, trước `convertQuantity`:

```js
import { lineNoteForItem, quantityTokenForConvert, takeLastParen } from "./lttp-issue-slip-ai-line-note.js";

const paren = takeLastParen(item?.name);
const converted = convertQuantity({
  writtenQty: quantityTokenForConvert(item?.quantity),
  writtenUom: item?.uom,
  // các field còn lại giữ nguyên
});
const note = lineNoteForItem({
  writtenQty: item?.quantity,
  writtenUom: item?.uom,
  parenText: paren.parenText,
  stockUom: commodity?.measureUnit,
  originalQtyOnConvert: Boolean(ctx.originalQtyOnConvert),
});
```

Return thêm `rawName: paren.name`, `parenText: paren.parenText`, `lineNote: note.lineNote`. `writtenQty` vẫn là `item?.quantity`, không thay bằng tổng.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai.prompt.test.js src/modules/lttp/lttp-issue-slip-ai-line-note.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-extract.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-parse.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.prompt.test.js
git commit -m "feat(lttp): keep addition and parentheses on AI issue lines"
```

---

### Task 3: Lưu ngoặc và cờ rule kho cấp 1

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma`
- Create: `quanluong-app-be/prisma/migrations/20261003140000_lttp_ai_line_note/migration.sql`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-learn.js`

**Interfaces:**
- Consumes: `lineNoteForItem`
- Produces: `loadOriginalQtyOnConvert(prisma, storageUnitId) -> Promise<boolean>`, `setOriginalQtyOnConvert(prisma, enabled) -> Promise<{ previous: boolean, created: boolean }>`. Dòng nháp có `parenText`. `getIssueSlipAiDraft` trả mỗi dòng kèm `lineNote`.

- [ ] **Step 1: Add the schema**

Trên `LttpAiDraftLine`, sau `writtenUom`:

```prisma
parenText String? @db.VarChar(500)
```

Model mới:

```prisma
model LttpAiLineNoteRule {
  id      Int     @id @default(autoincrement())
  kind    String  @unique @db.VarChar(64)
  enabled Boolean @default(false)
}
```

`migration.sql`:

```sql
ALTER TABLE `LttpAiDraftLine` ADD COLUMN `parenText` VARCHAR(500) NULL;

CREATE TABLE `LttpAiLineNoteRule` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `kind` VARCHAR(64) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  UNIQUE INDEX `LttpAiLineNoteRule_kind_key`(`kind`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

- [ ] **Step 2: Persist and read**

`buildDraftLineData` thêm `parenText: line.parenText ? String(line.parenText).slice(0, 500) : null`.

Trong `lttp-issue-slip-ai-learn.js`:

```js
const LINE_NOTE_KIND = "originalQtyOnConvert";

async function loadOriginalQtyOnConvert(prisma, storageUnitId) {
  if (!prisma?.lttpAiLineNoteRule || !prisma?.unit?.findUnique) return false;
  const storage = await prisma.unit.findUnique({
    where: { id: Number(storageUnitId) },
    select: { depth: true },
  });
  if (storage?.depth !== 0) return false;
  const row = await prisma.lttpAiLineNoteRule.findUnique({ where: { kind: LINE_NOTE_KIND } });
  return Boolean(row?.enabled);
}

async function setOriginalQtyOnConvert(prisma, enabled) {
  const existing = await prisma.lttpAiLineNoteRule.findUnique({ where: { kind: LINE_NOTE_KIND } });
  const previous = Boolean(existing?.enabled);
  if (existing) {
    await prisma.lttpAiLineNoteRule.update({ where: { id: existing.id }, data: { enabled: Boolean(enabled) } });
    return { previous, created: false };
  }
  await prisma.lttpAiLineNoteRule.create({ data: { kind: LINE_NOTE_KIND, enabled: Boolean(enabled) } });
  return { previous: false, created: true };
}
```

Export hai hàm này cạnh `loadConfirmedQtyRules`.

`getIssueSlipAiDraft` sau khi đọc draft, nếu `storage` depth là 0 và rule bật, map `lines` bằng `lineNoteForItem`. Depth khác 0 hoặc rule tắt thì `originalQtyOnConvert: false`. Gắn `lineNote` lên object trả về, không ghi cột mới.

`quantityForChosenSku` gọi `convertQuantity` với `writtenQty: quantityTokenForConvert(stored.writtenQty ?? stored.quantity)`.

`suggestIssueSlip` truyền `originalQtyOnConvert: await loadOriginalQtyOnConvert(prismaClient, storageUnitId)` vào `parseOrderItems`, và `parseOrderItems` đưa cờ đó vào `ctx`.

- [ ] **Step 3: Run the note tests again**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai-line-note.test.js`  
Expected: PASS. Migration áp khi stack dev chạy `prisma migrate deploy`.

- [ ] **Step 4: Commit**

```bash
git add quanluong-app-be/prisma/schema.prisma quanluong-app-be/prisma/migrations/20261003140000_lttp_ai_line_note/migration.sql quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-learn.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-parse.js
git commit -m "feat(lttp): store shared level-1 line-note rule"
```

---

### Task 4: Chat bật, tắt và hoàn tác rule

**Files:**
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-extract.js` (`buildDraftPatchPrompt`)
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-patch.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-chat.js`
- Test: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-patch.test.js`

**Interfaces:**
- Consumes: `setOriginalQtyOnConvert`, `getIssueSlipAiDraft` đã gắn `lineNote`
- Produces: `normalizeRuleSuggestion({ type: "line_note", enabled: true })` trả `{ type: "line_note", enabled: true }`. Áp dụng lượt chat đổi cờ và trả dòng có `lineNote` mới.

- [ ] **Step 1: Write the failing test**

Thêm vào `lttp-issue-slip-ai-draft-patch.test.js`:

```js
test("line note rule is a boolean and the old note type stays rejected", () => {
  assert.equal(normalizeRuleSuggestion({ type: "note" }), null);
  assert.deepEqual(normalizeRuleSuggestion({ type: "line_note", enabled: true }), {
    type: "line_note",
    enabled: true,
  });
  assert.equal(normalizeRuleSuggestion({ type: "line_note", enabled: "yes" }), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai-draft-patch.test.js`  
Expected: FAIL, `line_note` hiện rơi vào `return null`

- [ ] **Step 3: Write minimal implementation**

Trong `normalizeRuleSuggestion`, trước `return null`:

```js
if (raw.type === "line_note" && typeof raw.enabled === "boolean") {
  return { type: "line_note", enabled: raw.enabled };
}
```

Thêm vào system của `buildDraftPatchPrompt`, sau câu qty hiện có:

```js
" Neu user muon ghi so luong goc vao ghi chu moi khi doi don vi, hoac muon tat viec do, tra rule_suggestion {\"type\":\"line_note\",\"enabled\":true} hoac enabled false. patch de rong. Khong tu viet cau ghi chu."
```

Trong `applyProposedDraftPatch`, cạnh nhánh `rule?.type === "qty"`:

```js
if (rule?.type === "line_note") {
  const saved = await setOriginalQtyOnConvert(prisma, rule.enabled);
  ruleMeta = { rulePrevious: saved.previous, ruleCreated: saved.created, lineNoteEnabled: Boolean(rule.enabled) };
}
```

`acceptRule` tính thêm `rule?.type === "line_note"`.

Trong `undoLastDraftChatApply`, nếu `turn.proposedPatch?.lineNoteEnabled != null`: khi `ruleCreated` thì `delete` bản ghi kind `originalQtyOnConvert`; không thì `update` `enabled` về `rulePrevious`. Sau đó `getIssueSlipAiDraft` tính lại `lineNote`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/modules/lttp/lttp-issue-slip-ai-draft-patch.test.js`  
Expected: PASS, gồm test `line_note` và test `type: "note"` vẫn null

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-extract.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-patch.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-patch.test.js quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-draft-chat.js
git commit -m "feat(lttp): toggle the shared line-note rule from AI chat"
```

---

### Task 5: Đưa ghi chú vào phiếu và hộp thoại

**Files:**
- Modify: `packages/shared/src/pages/lttpNhapXuat/applyIssueSlipAiPreview.js`
- Modify: `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.jsx`
- Create: `packages/shared/src/pages/lttpNhapXuat/applyIssueSlipAiPreview.test.js`

**Interfaces:**
- Consumes: `line.lineNote` trên preview và trên dòng draft sau chat
- Produces: `mapPreviewLineToRow` gán `lineNote`. `mergeDraftLines` copy `lineNote`. `qtyRuleLabel` nói rõ rule ghi chú.

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { applyIssueSlipAiPreview } from "./applyIssueSlipAiPreview.js";

test("apply copies the AI line note into the slip row", () => {
  const { nextRows } = applyIssueSlipAiPreview({
    touched: {},
    preview: {
      lines: [{
        mapped: true,
        commodityId: 10,
        quantity: 10,
        priceKind: "market",
        lttpSupplierId: 3,
        code: "GAO",
        lineNote: "4+6",
      }],
    },
    newEmptyRow: () => ({ lineNote: "", commodityId: null }),
  });
  assert.equal(nextRows[0].lineNote, "4+6");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `packages/shared`: `node --test src/pages/lttpNhapXuat/applyIssueSlipAiPreview.test.js`  
Expected: FAIL, `lineNote` là `""`

- [ ] **Step 3: Write minimal implementation**

Trong `mapPreviewLineToRow`, đổi `lineNote: ""` thành:

```js
lineNote: line.lineNote != null ? String(line.lineNote).trim().slice(0, 500) : "",
```

Trong `mergeDraftLines`, thêm `lineNote: stored.lineNote ?? line.lineNote ?? ""`.

Trong `qtyRuleLabel`:

```js
if (rule?.type === "line_note") {
  return rule.enabled
    ? "Đã lưu cho mọi kho cấp 1: khi đổi đơn vị, ghi số lượng gốc vào ghi chú."
    : "Đã tắt ghi số lượng gốc vào ghi chú.";
}
```

Dưới số lượng trong bảng kết quả (`line.quantity`), thêm:

```jsx
{line.lineNote ? <div className="text-[11px] text-muted-foreground">{line.lineNote}</div> : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/pages/lttpNhapXuat/applyIssueSlipAiPreview.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/pages/lttpNhapXuat/applyIssueSlipAiPreview.js packages/shared/src/pages/lttpNhapXuat/applyIssueSlipAiPreview.test.js packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.jsx
git commit -m "feat(lttp): apply AI line notes onto the issue slip"
```
