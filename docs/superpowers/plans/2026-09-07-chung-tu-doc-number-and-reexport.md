# Chứng từ — Số chạy trong quyển & Xuất lại tại chỗ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cấp `quyenSo` (`mmyy`) + `soChungTu` (pad 4) ổn định cho BKMH/PNK/PXK qua sổ DB; thêm Xuất lại ghi đè cùng folder/batch, giữ số, đổi mẫu/chữ ký và tuỳ chọn đọc lại dữ liệu.

**Architecture:** Service cấp số (`allocateDocNumber`) + `sheetKey` helpers gắn vào resolver/export; document-service `DELETE .../files` clear folder; Node re-export endpoints update batch/monthly in place. FE dialog trên History/Summary.

**Tech Stack:** Prisma/MySQL, Node ESM (`quanluong-app-be`), FastAPI document-service, React Query (`packages/shared`), `node:test` / `pytest`

**Spec:** `docs/superpowers/specs/2026-09-07-chung-tu-doc-number-and-reexport-design.md`

## Global Constraints

- `quyenSo` = `mmyy`; `soChungTu` = pad 4; counter `(unitId, categoryKey, quyenSo)`
- Sheet mới cấp số tiếp; sheet mất **không** thu hồi số
- Xuất lại: không batch/folder mới; clear files cùng `folderId`; số + quyển không đổi
- PNK `sheetKey` = `bkmhSlice:{sourceSliceId}` (id slice BKMH nguồn)
- Ngoài scope: backfill hàng loạt lịch sử; sửa số tay; thu hồi số; version history

---

## File Map

| File | Role |
|------|------|
| `quanluong-app-be/prisma/schema.prisma` + migration | Counter + Assignment (+ optional `contextJson` on export) |
| `chung-tu-doc-number.util.js` (+ test) | `padDocNumber`, `quyenSoFromPeriodMonth`, `buildSheetKey` |
| `chung-tu-doc-number.service.js` (+ test) | `allocateDocNumber` transactional |
| `chung-tu-data-resolver.service.js` (+ test) | Dừng `mmyydd`/settings trống; gắn số từ allocate |
| `chung-tu-pdf-export-batch.service.js` (+ test) | First export + `reExportPdfBatch` |
| `chung-tu-bkmh-monthly.service.js` (+ test) | First export số chạy; `reExportBkmhMonthly` (không xóa folder) |
| `chung-tu-quyet-toan.controller.js` / routes / validator | `POST .../re-export` |
| `services/document-service/.../folder_service.py` + `main.py` (+ test) | `clear_folder_files` |
| `document-service.client.js` | `clearDocumentFolderFiles` |
| `chungTuPdfApi.js` / `chungTuBkmhMonthlyApi.js` | Mutations re-export |
| `ChungTuReExportDialog.jsx` (+ test) | UI dialog |
| `ChungTuHistoryWorkspace.jsx` / Summary panels | Nút Xuất lại |
| Help/copy BKMH `mmyydd` | Cập nhật mô tả số chứng từ |

---

### Task 1: Prisma models + `allocateDocNumber`

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma`
- Create: migration `quanluong-app-be/prisma/migrations/20260907160000_chung_tu_doc_number/migration.sql`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-doc-number.util.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-doc-number.util.test.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-doc-number.service.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-doc-number.service.test.js`
- Modify: `ChungTuPdfExport` — add `contextJson Json?` (payload đủ để re-render khi `refreshData=false`)

**Interfaces:**
```js
export function padDocNumber(seq) // "0001"
export function quyenSoFromPeriodMonth(periodMonth) // "2026-09" → "0926"
export function buildSheetKey({ kind, recipientUnitId, periodDate, issueSlipId, bkmhSliceId })
// kind: "by-unit" | "by-day-pxk" | "by-day-bkmh" | "slip" | "bkmh-slice"

export async function allocateDocNumber(
  { unitId, categoryKey, quyenSo, sheetKey },
  db = prisma,
)
// → { quyenSo, seq, soChungTu }  // idempotent on sheetKey
```

- [ ] **Step 1: Failing util tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  padDocNumber,
  quyenSoFromPeriodMonth,
  buildSheetKey,
} from "./chung-tu-doc-number.util.js";

test("padDocNumber pads to 4", () => {
  assert.equal(padDocNumber(1), "0001");
  assert.equal(padDocNumber(12), "0012");
});

test("quyenSoFromPeriodMonth", () => {
  assert.equal(quyenSoFromPeriodMonth("2026-09"), "0926");
});

test("buildSheetKey variants", () => {
  assert.equal(buildSheetKey({ kind: "by-unit", recipientUnitId: 5 }), "unit:5");
  assert.equal(
    buildSheetKey({ kind: "by-day-pxk", recipientUnitId: 5, periodDate: "2026-09-07" }),
    "unit:5|day:2026-09-07",
  );
  assert.equal(buildSheetKey({ kind: "by-day-bkmh", periodDate: "2026-09-07" }), "day:2026-09-07");
  assert.equal(buildSheetKey({ kind: "slip", issueSlipId: 99 }), "slip:99");
  assert.equal(buildSheetKey({ kind: "bkmh-slice", bkmhSliceId: 42 }), "bkmhSlice:42");
});
```

- [ ] **Step 2: Run — FAIL**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-doc-number.util.test.js
```

Expected: FAIL (module missing)

- [ ] **Step 3: Implement util + Prisma models**

```prisma
model ChungTuDocNumberCounter {
  id           Int      @id @default(autoincrement())
  unitId       Int
  categoryKey  String   @db.VarChar(80)
  quyenSo      String   @db.VarChar(8)
  nextSeq      Int      @default(1)
  updatedAt    DateTime @updatedAt
  unit         Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@unique([unitId, categoryKey, quyenSo])
  @@index([unitId, categoryKey])
}

model ChungTuDocNumberAssignment {
  id          Int      @id @default(autoincrement())
  unitId      Int
  categoryKey String   @db.VarChar(80)
  quyenSo     String   @db.VarChar(8)
  sheetKey    String   @db.VarChar(191)
  seq         Int
  soChungTu   String   @db.VarChar(16)
  createdAt   DateTime @default(now())
  unit        Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@unique([unitId, categoryKey, quyenSo, sheetKey])
  @@index([unitId, categoryKey, quyenSo])
}
```

Also add `contextJson Json?` on `ChungTuPdfExport`. Wire `Unit` reverse relations. Create SQL migration matching schema.

Util:

```js
export function padDocNumber(seq) {
  return String(Math.trunc(Number(seq))).padStart(4, "0");
}

export function quyenSoFromPeriodMonth(periodMonth) {
  const m = String(periodMonth || "").trim();
  const [y, mo] = m.split("-");
  if (!y || !mo) return "";
  return `${mo}${y.slice(-2)}`;
}

export function buildSheetKey(input) {
  switch (input.kind) {
    case "by-unit":
      return `unit:${Number(input.recipientUnitId)}`;
    case "by-day-pxk":
      return `unit:${Number(input.recipientUnitId)}|day:${input.periodDate}`;
    case "by-day-bkmh":
      return `day:${input.periodDate}`;
    case "slip":
      return `slip:${Number(input.issueSlipId)}`;
    case "bkmh-slice":
      return `bkmhSlice:${Number(input.bkmhSliceId)}`;
    default:
      throw new Error(`Unknown sheetKey kind: ${input.kind}`);
  }
}
```

- [ ] **Step 4: Failing service test (mock db)**

```js
test("allocateDocNumber returns same soChungTu for same sheetKey", async () => {
  // in-memory fake or prisma mock map
  const first = await allocateDocNumber({
    unitId: 1, categoryKey: "phieu-xuat-kho", quyenSo: "0926", sheetKey: "unit:5",
  }, fakeDb);
  const second = await allocateDocNumber({
    unitId: 1, categoryKey: "phieu-xuat-kho", quyenSo: "0926", sheetKey: "unit:5",
  }, fakeDb);
  assert.equal(first.soChungTu, "0001");
  assert.deepEqual(first, second);
});

test("allocateDocNumber increments for new sheetKey", async () => {
  await allocateDocNumber({ unitId: 1, categoryKey: "phieu-xuat-kho", quyenSo: "0926", sheetKey: "unit:5" }, fakeDb);
  const next = await allocateDocNumber({
    unitId: 1, categoryKey: "phieu-xuat-kho", quyenSo: "0926", sheetKey: "unit:6",
  }, fakeDb);
  assert.equal(next.soChungTu, "0002");
});

test("counters are independent per categoryKey", async () => {
  await allocateDocNumber({ unitId: 1, categoryKey: "phieu-xuat-kho", quyenSo: "0926", sheetKey: "unit:5" }, fakeDb);
  const bkmh = await allocateDocNumber({
    unitId: 1, categoryKey: "bang-ke-mua-hang", quyenSo: "0926", sheetKey: "unit:5",
  }, fakeDb);
  assert.equal(bkmh.soChungTu, "0001");
});
```

- [ ] **Step 5: Implement `allocateDocNumber`**

```js
export async function allocateDocNumber({ unitId, categoryKey, quyenSo, sheetKey }, db = prisma) {
  const u = Number(unitId);
  const cat = String(categoryKey);
  const book = String(quyenSo).trim();
  const key = String(sheetKey).trim();
  if (!u || !cat || !book || !key) {
    throw new AppError({ message: "Thiếu tham số cấp số chứng từ", statusCode: 400, code: ERROR_CODES.VALIDATION_ERROR });
  }
  return db.$transaction(async (tx) => {
    const existing = await tx.chungTuDocNumberAssignment.findUnique({
      where: { unitId_categoryKey_quyenSo_sheetKey: { unitId: u, categoryKey: cat, quyenSo: book, sheetKey: key } },
    });
    if (existing) {
      return { quyenSo: book, seq: existing.seq, soChungTu: existing.soChungTu };
    }
    const counter = await tx.chungTuDocNumberCounter.upsert({
      where: { unitId_categoryKey_quyenSo: { unitId: u, categoryKey: cat, quyenSo: book } },
      create: { unitId: u, categoryKey: cat, quyenSo: book, nextSeq: 2 },
      update: { nextSeq: { increment: 1 } },
    });
    // create path allocated seq=1 (nextSeq left at 2); update path allocated (nextSeq-1)
    const seq = counter.nextSeq === 2 && !(await tx.chungTuDocNumberAssignment.count({
      where: { unitId: u, categoryKey: cat, quyenSo: book },
    }))
      ? 1
      : counter.nextSeq - 1;
    // ponytail: clearer — use updateMany with select after lock; prefer:
    // read nextSeq BEFORE increment via raw or find+update
    const soChungTu = padDocNumber(seq);
    await tx.chungTuDocNumberAssignment.create({
      data: { unitId: u, categoryKey: cat, quyenSo: book, sheetKey: key, seq, soChungTu },
    });
    return { quyenSo: book, seq, soChungTu };
  });
}
```

**Implement cleaner seq logic (required):**

```js
const counter = await tx.chungTuDocNumberCounter.upsert({
  where: { unitId_categoryKey_quyenSo: { unitId: u, categoryKey: cat, quyenSo: book } },
  create: { unitId: u, categoryKey: cat, quyenSo: book, nextSeq: 1 },
  update: {},
});
const seq = counter.nextSeq;
await tx.chungTuDocNumberCounter.update({
  where: { id: counter.id },
  data: { nextSeq: seq + 1 },
});
```

(If two concurrent upserts race, unique on assignment + retry once on P2002.)

- [ ] **Step 6: Run util + service tests — PASS**

```bash
cd quanluong-app-be && node --test \
  src/modules/chung-tu-quyet-toan/chung-tu-doc-number.util.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-doc-number.service.test.js
```

- [ ] **Step 7: Commit**

```bash
git add quanluong-app-be/prisma quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-doc-number.*
git commit -m "feat(chung-tu): doc number counter and allocateDocNumber"
```

---

### Task 2: Wire numbering into resolver (first export contexts)

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.js`
- Modify: `chung-tu-data-resolver.service.test.js`
- Modify: `chung-tu-template-fill-config.service.js` help strings if they say `mmyydd`

**Interfaces:**
- Consumes: `allocateDocNumber`, `buildSheetKey`, `quyenSoFromPeriodMonth`
- Produces: each sheet context has `quyenSo`, `soChungTu`, `so`, `soPhieu`, `sheetKey`

- [ ] **Step 1: Failing tests**

```js
test("resolveDocumentNumberFields for PXK uses allocated book numbers when provided", () => {
  // After refactor: prefer helper applyAllocatedNumbers(context, allocation)
});

test("BKMH no longer builds mmyydd soChungTu", () => {
  // defaultBangKeSoChungTuFromParts unused for PDF soChungTu OR returns empty;
  // allocation supplies soChungTu
  assert.notEqual(
    /* context after monthly build with mocked allocate */ "062601",
    /* expected pattern */ undefined,
  );
});
```

Replace `resolveDocumentNumberFields` PXK/BKMH branches:

```js
function resolveDocumentNumberFields({ settings, parts, categoryKey, allocation }) {
  const quyenSo =
    allocation?.quyenSo ||
    defaultBookMmyyFromParts(parts) ||
    String(settings?.quyenSo ?? "").trim();
  const soChungTu = allocation?.soChungTu || "";
  return { quyenSo, soChungTu };
}
```

Add async helper used by monthly / batch builders:

```js
export async function attachDocNumbersToContexts({
  contexts,
  unitId,
  categoryKey,
  periodMonth,
  sheetKeyForContext, // (ctx) => string
}) {
  const quyenSo = quyenSoFromPeriodMonth(periodMonth) || defaultBookMmyyFromParts(ymdParts(contexts[0]?.periodDate));
  for (const ctx of contexts) {
    const sheetKey = sheetKeyForContext(ctx);
    const allocation = await allocateDocNumber({ unitId, categoryKey, quyenSo, sheetKey });
    ctx.sheetKey = sheetKey;
    ctx.quyenSo = allocation.quyenSo;
    ctx.soChungTu = allocation.soChungTu;
    ctx.so = allocation.soChungTu;
    ctx.soPhieu = allocation.soChungTu;
  }
  return contexts;
}
```

`sheetKeyForContext` rules:
- PXK by-unit: `buildSheetKey({ kind: "by-unit", recipientUnitId: ctx.recipientUnitId })`
- PXK by-day: `buildSheetKey({ kind: "by-day-pxk", recipientUnitId: ctx.recipientUnitId, periodDate: ctx.periodDate })`
- BKMH by-day: `buildSheetKey({ kind: "by-day-bkmh", periodDate: ctx.periodDate })`
- BKMH by-unit: `buildSheetKey({ kind: "by-unit", recipientUnitId: ctx.recipientUnitId })`
- single slip: `buildSheetKey({ kind: "slip", issueSlipId })`
- PNK: `buildSheetKey({ kind: "bkmh-slice", bkmhSliceId: ctx.sourceSliceId ?? ctx.bkmhSliceId })`

Call `attachDocNumbersToContexts` at end of monthly resolve / before return from `resolveChungTuContext` paths that emit sheets.

- [ ] **Step 2: Run resolver tests — FAIL then implement — PASS**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(chung-tu): attach allocated doc numbers on resolve contexts"
```

---

### Task 3: Document-service clear folder files + Node client

**Files:**
- Modify: `services/document-service/app/folders/folder_service.py`
- Modify: `services/document-service/app/folders/local_storage.py` (delete file paths)
- Modify: `services/document-service/app/main.py`
- Modify: `services/document-service/tests/test_folder_service.py`
- Modify: `quanluong-app-be/src/services/document-service.client.js` (+ test if present)

**Interfaces:**
```python
def clear_folder_files(session: Session, folder_id: int) -> dict:
    # deletes FolderFile rows + pdf files on disk; folder row remains
    # returns { "folder_id", "deleted_count" }
```

```js
async function clearDocumentFolderFiles(folderId)
// DELETE /v1/folders/${folderId}/files
```

- [ ] **Step 1: Failing pytest**

```python
def test_clear_folder_files_keeps_folder_removes_pdfs(session, tmp_path, monkeypatch):
    # create folder + 2 documents → clear → get_folder files == []
    # folder id unchanged
    pass
```

- [ ] **Step 2: Implement**

```python
def clear_folder_files(session: Session, folder_id: int) -> dict:
    folder = _require_folder(session, folder_id)
    files = list(_folder_files(session, folder_id))
    for f in files:
        path = _absolute_pdf_path(f)
        if path.exists():
            path.unlink()
        session.delete(f)
    session.flush()
    return {"folder_id": folder.id, "deleted_count": len(files)}
```

Route:

```python
@app.delete("/v1/folders/{folder_id}/files")
def clear_folder_files_route(...):
    ...
```

Node:

```js
async function clearDocumentFolderFiles(folderId) {
  const response = await requestDocument(`/v1/folders/${folderId}/files`, { method: "DELETE" });
  return readJsonResponse(response);
}
```

Export from client.

- [ ] **Step 3: Run pytest + any client test — PASS**

```bash
cd services/document-service && pytest tests/test_folder_service.py -k clear_folder -v
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(document-service): clear folder files without deleting folder"
```

---

### Task 4: Persist `contextJson` on first batch export + BKMH first-export numbers

**Files:**
- Modify: `chung-tu-pdf-export-batch.service.js` (+ test)
- Modify: `chung-tu-bkmh-monthly.service.js` (+ test) — stop `deleteDocumentFolder` + new folder on upsert path when row exists; use clear+re-add **only** via re-export task; first create still creates folder
- Ensure slice `soChungTu` comes from allocated context (not `mmyydd`)

- [ ] **Step 1: Failing tests**

```js
test("createPdfExportBatch stores contextJson and allocated soChungTu on each export", async () => {
  // mock allocate → 0001; assert prisma export create data.summaryJson.soChungTu === "0001"
  // assert contextJson.detailRows present
});

test("createBkmhMonthly uses pad soChungTu not mmyydd", async () => {
  // assert slice.soChungTu === "0001" style
});
```

- [ ] **Step 2: Implement** — when creating each `ChungTuPdfExport`, set:

```js
contextJson: {
  sheetKey: slice.context.sheetKey,
  periodDate: slice.context.periodDate,
  quyenSo: slice.context.quyenSo,
  soChungTu: slice.context.soChungTu,
  detailRows: slice.context.detailRows,
  // scalars needed for fields (donVi, tongTienSo, recipient*, lyDo*, …) — pickMappedFields sources
  fields: pickRelevantScalars(slice.context),
},
summaryJson: buildExportSummaryFromContext(slice.context),
```

BKMH: already has `detailRowsJson`; ensure `soChungTu` column = allocated.

- [ ] **Step 3: Tests PASS + commit**

```bash
git commit -am "feat(chung-tu): persist export context and use allocated numbers on create"
```

---

### Task 5: `reExportPdfBatch` API

**Files:**
- Modify: `chung-tu-pdf-export-batch.service.js` (+ test)
- Modify: `chung-tu-quyet-toan.controller.js`
- Modify: `chung-tu-quyet-toan.route-definitions.js`
- Modify: `chung-tu-quyet-toan.validator.js` (+ test)
- Wire router registration if separate from definitions

**Interfaces:**
```js
export async function reExportPdfBatch({
  batchKey,
  pdfTemplateId,
  refreshData,
  userId,
})
// returns same shape as get batch detail; folderId unchanged; batch.id unchanged
```

Body zod: `{ pdfTemplateId: z.number().int().positive(), refreshData: z.boolean().default(false) }`

Route: `POST /pdf-export-batches/:batchKey/re-export`

- [ ] **Step 1: Failing service test**

```js
test("reExportPdfBatch keeps folderId and soChungTu; updates template", async () => {
  // seed batch folderId=700, export soChungTu 0001
  // reExport refreshData=false new template
  // assert clearDocumentFolderFiles called with 700
  // assert no createDocumentFolder
  // assert export.soChungTu still 0001
  // assert pdfTemplateId updated
});

test("reExportPdfBatch refreshData=false without contextJson → 400", async () => {
  ...
});

test("reExportPdfBatch refreshData=true adds new sheet with next number", async () => {
  // mock resolve returning old unit:5 + new unit:6
  // unit:5 → 0001, unit:6 → 0002
});
```

- [ ] **Step 2: Implement pipeline**

1. Load batch + exports by `batchKey`
2. Load published template `pdfTemplateId`; load latest signature settings
3. Build contexts:
   - `refreshData=false`: from each export `contextJson` (400 if missing)
   - `refreshData=true`: call same resolve as create (periodMonth/unitIds/aggregation from batch)
4. `attachDocNumbersToContexts` (idempotent)
5. `clearDocumentFolderFiles(batch.documentServiceFolderId)`
6. Delete prisma exports whose `sheetKey` not in new set; insert missing; update kept rows’ file ids / hashes / contextJson / summaryJson
7. Re-render each via `renderToDocumentFolder`
8. Update batch: template ids, fileCount, sourceDataHash, signaturesJson, updatedAt — **same** `documentServiceFolderId`

- [ ] **Step 3: Controller + route + PASS tests**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(chung-tu): re-export PDF batch in place"
```

---

### Task 6: `reExportBkmhMonthly` API

**Files:**
- Modify: `chung-tu-bkmh-monthly.service.js` (+ test)
- Modify: controller / routes / validator (mirror batch)

**Interfaces:**
```js
export async function reExportBkmhMonthly({ monthlyId, pdfTemplateId, refreshData, userId })
```

Route: `POST /bkmh-monthly/:id/re-export`

- [ ] **Step 1: Failing test** — existing upsert that deletes folder must **not** run on re-export; re-export keeps `documentServiceFolderId`

```js
test("reExportBkmhMonthly does not call deleteDocumentFolder or createDocumentFolder", async () => {
  ...
});
```

- [ ] **Step 2: Implement** — same clear → render → update slices pattern; PNK-unrelated. sheetKey `by-day-bkmh` / `by-unit`.

- [ ] **Step 3: If `createBkmhMonthly` currently deletes old folder on conflict, change **create** path: when monthly row exists, either reject with “dùng Xuất lại” **or** redirect internally to re-export. Prefer **400** with message hướng dẫn Xuất lại (YAGNI: tránh hai semantics). Update FE create button behavior in Task 7 if needed.

- [ ] **Step 4: PASS + commit**

```bash
git commit -am "feat(chung-tu): re-export BKMH monthly in place"
```

---

### Task 7: FE — API hooks + ReExport dialog + History/Summary buttons

**Files:**
- Modify: `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuPdfApi.js`
- Modify: `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuBkmhMonthlyApi.js`
- Create: `packages/shared/src/pages/chungTuQuyetToan/ChungTuReExportDialog.jsx`
- Create: `ChungTuReExportDialog.test.js` (source asserts or RTL if project uses it)
- Modify: `ChungTuHistoryWorkspace.jsx` (+ test)
- Modify: `ChungTuSummaryWorkspace.jsx` / `ChungTuBkmhSliceSummaryPanel.jsx` / `ChungTuPnkBatchSummaryPanel.jsx` as needed so **mọi** loại CT có nút
- Modify: help text mentioning BKMH `mmyydd` (template fill / derived named ranges docs in shared)

**Interfaces:**
```js
useReExportPdfBatchMutation() // POST .../pdf-export-batches/:batchKey/re-export
useReExportBkmhMonthlyMutation() // POST .../bkmh-monthly/:id/re-export
```

Dialog props: `{ open, onOpenChange, templates, defaultTemplateId, onSubmit({ pdfTemplateId, refreshData }) }`

- [ ] **Step 1: Failing FE tests**

```js
assert.match(historySource, /Xuất lại/);
assert.match(dialogSource, /Đọc lại dữ liệu/);
assert.match(dialogSource, /refreshData/);
assert.match(apiSource, /re-export/);
```

- [ ] **Step 2: Implement dialog + wire buttons** — checkbox default **unchecked**; template select required; submit calls mutation; invalidate list queries on success.

- [ ] **Step 3: PASS + commit**

```bash
git commit -am "feat(fe): chứng từ Xuất lại dialog and history actions"
```

---

### Task 8: Smoke acceptance (manual / thin automated)

**Files:** none required beyond fixing gaps found

- [ ] **Step 1: Checklist against spec §9**

1. PXK by-unit → `0926` + `0001`, `0002`
2. Re-export no refresh → same folderId, same numbers
3. Re-export refresh + new unit → new `000N+1`
4. Refresh drop unit → file gone; number not reused
5. BKMH new export not `mmyydd`
6. PNK vs PXK independent counters
7. (Optional) two parallel allocate calls — unique holds

- [ ] **Step 2: Commit any fixes**

```bash
git commit -am "fix(chung-tu): doc number / re-export acceptance fixes"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Format mmyy + pad 4 | T1–T2 |
| Counter per unit×category×quyen | T1 |
| sheetKey rules + PNK `bkmhSlice:` | T1–T2 |
| No reclaim numbers | T1 (no delete assignment) |
| First export allocate | T2–T4 |
| BKMH drop mmyydd | T2–T4 |
| Clear folder API | T3 |
| Re-export batch in place | T5 |
| Re-export BKMH | T6 |
| FE all categories button + dialog | T7 |
| refreshData default off; 400 if no snapshot | T5–T7 |
| Acceptance | T8 |
| Out of scope backfill | — skipped |

**PNK sheetKey locked:** `bkmhSlice:{sourceSliceId}` only (no buyer fallback in this plan).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-07-chung-tu-doc-number-and-reexport.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
