# BKMH monthly ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BKMH xuất PDF theo kho LTTP + tháng với upsert (một bản ghi/tháng), tab Tổng hợp + bảng slice (xem/tải/in), Lịch sử chỉ folder-level actions.

**Architecture:** Thêm `ChungTuBkmhMonthly` + `ChungTuBkmhSlice` (Prisma). Service mới `chung-tu-bkmh-monthly.service.js` tái dùng `resolveChungTuContext`, `pickExportSlices`, `buildDocumentServicePayload` từ batch hiện tại; upsert xóa folder cũ trên document-service rồi render lại. FE BKMH gọi API mới; PXK/PNK vẫn dùng `pdf-export-batches`.

**Tech Stack:** Node.js (`node:test`), Prisma/MySQL, document-service folder API, React + TanStack Query, shadcn/ui patterns có sẵn trong `ChungTuHistoryWorkspace`.

## Global Constraints

- Phạm vi: **chỉ** `categoryKey === bang-ke-mua-hang`; PXK/PNK không đổi.
- Khóa duy nhất: `storageUnitId` (kho LTTP = `unitId` wizard) + `periodMonth` (`YYYY-MM`).
- Xuất lại cùng kỳ: **upsert** — thay slice rows + folder PDF; không nhân đôi folder.
- Chế độ gộp: `by-day` | `by-unit` | `full`; mỗi slice = 1 PDF + 1 dòng tổng hợp.
- Metadata slice lấy từ **Node context** (`soChungTu`, `ngayThangNam`, `recipientUnitName`, `tongTienSo`).
- Permission: reuse `lttp.issue-slips.read` / `.write` (giống batch).
- Google Sheet / `ChungTuBkmhSnapshot`: **không đổi**.
- `ChungTuPdfExportBatch`: giữ cho PXK/PNK + lịch sử BKMH cũ (read-only).

---

## File map

| File | Responsibility |
|------|----------------|
| `quanluong-app-be/prisma/schema.prisma` | Models `ChungTuBkmhMonthly`, `ChungTuBkmhSlice` |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.js` | Trích metadata slice từ resolver context |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.test.js` | Tests metadata + rollup |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.js` | create/upsert, list, get, delete, stream proxies |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.test.js` | Tests upsert + slice count |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.validator.js` | Schemas list/create/id params |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.route-definitions.js` | Route permission keys |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.routes.js` | Wire routes |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.controller.js` | Controllers |
| `packages/shared/src/app/query/queryKeys.js` | `bkmhMonthly`, `bkmhMonthlyDetail` |
| `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuBkmhMonthlyApi.js` | Hooks + download/print helpers |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuSummaryWorkspace.jsx` | Tab Tổng hợp (cấp tháng) |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuBkmhSliceSummaryPanel.jsx` | Bảng slice modal/panel |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuCategoryWorkspace.jsx` | Thêm tab Tổng hợp (BKMH) |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx` | BKMH monthly → API mới |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuHistoryWorkspace.jsx` | BKMH: monthly cards, không accordion file |

---

### Task 1: Prisma models + migration

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma` (thêm models; relation trên `Unit`, `User`)
- Create: `quanluong-app-be/prisma/migrations/YYYYMMDDHHMMSS_chung_tu_bkmh_monthly/migration.sql` (via `prisma migrate`)

**Interfaces:**
- Produces: Prisma client types `ChungTuBkmhMonthly`, `ChungTuBkmhSlice`

- [ ] **Step 1: Add models to schema**

Add after `ChungTuBkmhSnapshot`:

```prisma
model ChungTuBkmhMonthly {
  id                        Int                  @id @default(autoincrement())
  storageUnitId             Int
  periodMonth               String               @db.VarChar(7)
  aggregationMode           String               @db.VarChar(32)
  unitIdsJson               Json
  pdfTemplateId             Int
  documentServiceTemplateId Int
  documentServiceFolderId   Int
  displayName               String               @db.VarChar(255)
  tongTienThang             Decimal?             @db.Decimal(18, 2)
  sliceCount                Int
  sourceDataHash            String?              @db.VarChar(64)
  signaturesJson            Json?
  createdById               Int
  updatedById               Int
  createdAt                 DateTime             @default(now())
  updatedAt                 DateTime             @updatedAt
  storageUnit               Unit                 @relation(fields: [storageUnitId], references: [id], onDelete: Cascade)
  createdBy                 User                 @relation("ChungTuBkmhMonthlyCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  updatedBy                 User                 @relation("ChungTuBkmhMonthlyUpdatedBy", fields: [updatedById], references: [id], onDelete: Restrict)
  slices                    ChungTuBkmhSlice[]

  @@unique([storageUnitId, periodMonth])
  @@index([storageUnitId, updatedAt])
}

model ChungTuBkmhSlice {
  id                    Int                @id @default(autoincrement())
  monthlyId             Int
  sortKey               String             @db.VarChar(128)
  soChungTu             String?            @db.VarChar(64)
  periodDate            DateTime?          @db.Date
  recipientUnitId       Int?
  recipientUnitName     String?            @db.VarChar(255)
  ngayThangNam          String?            @db.VarChar(128)
  tongTien              Decimal?           @db.Decimal(18, 2)
  documentServiceFileId Int
  fileName              String             @db.VarChar(255)
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt
  monthly               ChungTuBkmhMonthly @relation(fields: [monthlyId], references: [id], onDelete: Cascade)

  @@unique([monthlyId, sortKey])
  @@index([monthlyId])
}
```

On `Unit` model add: `bkmhMonthlyExports ChungTuBkmhMonthly[]`  
On `User` model add:
- `chungTuBkmhMonthlyCreated ChungTuBkmhMonthly[] @relation("ChungTuBkmhMonthlyCreatedBy")`
- `chungTuBkmhMonthlyUpdated ChungTuBkmhMonthly[] @relation("ChungTuBkmhMonthlyUpdatedBy")`

- [ ] **Step 2: Run migration**

Run: `cd quanluong-app-be && npx prisma migrate dev --name chung_tu_bkmh_monthly`  
Expected: migration SQL created; client regenerated.

- [ ] **Step 3: Commit**

```bash
git add quanluong-app-be/prisma/schema.prisma quanluong-app-be/prisma/migrations/
git commit -m "feat(db): add ChungTuBkmhMonthly and ChungTuBkmhSlice models"
```

---

### Task 2: Slice metadata util

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.test.js`

**Interfaces:**
- Consumes: slice `context` từ `pickExportSlices`
- Produces:
  - `buildBkmhSliceMetadata(context) -> { soChungTu, periodDate, recipientUnitId, recipientUnitName, ngayThangNam, tongTien }`
  - `sumSliceTongTien(metadataList) -> number`

- [ ] **Step 1: Write failing tests**

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBkmhSliceMetadata,
  sumSliceTongTien,
} from "./chung-tu-bkmh-slice-metadata.util.js";

test("buildBkmhSliceMetadata prefers soChungTu and tongTienSo", () => {
  const meta = buildBkmhSliceMetadata({
    soChungTu: "062615",
    so: "ignored",
    ngayThangNam: "Ngày 01 tháng 06 năm 2026",
    periodDate: "2026-06-01",
    recipientUnitId: 5,
    recipientUnitName: "Tiểu đoàn 1",
    tongTienSo: 1500000,
    tongTien: "1.500.000",
  });
  assert.equal(meta.soChungTu, "062615");
  assert.equal(meta.ngayThangNam, "Ngày 01 tháng 06 năm 2026");
  assert.equal(meta.recipientUnitName, "Tiểu đoàn 1");
  assert.equal(meta.tongTien, 1500000);
  assert.equal(meta.periodDate, "2026-06-01");
});

test("sumSliceTongTien rolls up decimals", () => {
  assert.equal(
    sumSliceTongTien([
      { tongTien: 1000 },
      { tongTien: 2500.5 },
      { tongTien: null },
    ]),
    3500.5,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.test.js`  
Expected: FAIL module not found

- [ ] **Step 3: Implement util**

```js
function parseTongTien(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const digits = String(value).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function buildBkmhSliceMetadata(context = {}) {
  const soChungTu =
    String(context.soChungTu ?? context.so ?? context.soPhieu ?? "").trim() || null;
  const periodDateRaw = String(context.periodDate ?? "").trim();
  const periodDate = periodDateRaw || null;
  const recipientUnitId =
    context.recipientUnitId != null ? Number(context.recipientUnitId) : null;
  const recipientUnitName =
    String(context.recipientUnitName ?? "").trim() || null;
  const ngayThangNam = String(context.ngayThangNam ?? "").trim() || null;
  const tongTien =
    parseTongTien(context.tongTienSo) ?? parseTongTien(context.tongTien);
  return {
    soChungTu,
    periodDate,
    recipientUnitId: Number.isFinite(recipientUnitId) ? recipientUnitId : null,
    recipientUnitName,
    ngayThangNam,
    tongTien,
  };
}

function sumSliceTongTien(items) {
  return items.reduce((sum, item) => sum + (Number(item?.tongTien) || 0), 0);
}

export { buildBkmhSliceMetadata, parseTongTien, sumSliceTongTien };
```

- [ ] **Step 4: Run test — PASS**

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-slice-metadata.util.*
git commit -m "feat: extract BKMH slice metadata from resolver context"
```

---

### Task 3: BKMH monthly service (create/upsert + CRUD)

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.test.js`
- Reference: `chung-tu-pdf-export-batch.service.js` (copy render loop, không tạo `ChungTuPdfExportBatch`)

**Interfaces:**
- Consumes: `buildBkmhSliceMetadata`, `sumSliceTongTien`, `pickExportSlices`, `resolveChungTuContext`, document-service client
- Produces:
  - `createChungTuBkmhMonthlyExport({ storageUnitId, periodMonth, unitIds, aggregationMode, pdfTemplateId, signatures, signatureDates, signatureBlock, settings, exportingUserProfile, createdById, effectiveUnitIds }) -> mappedMonthlyRow`
  - `listChungTuBkmhMonthly({ storageUnitId, periodMonth?, effectiveUnitIds }) -> mappedMonthlyRow[]`
  - `getChungTuBkmhMonthly({ id, effectiveUnitIds }) -> mappedMonthlyRow`
  - `deleteChungTuBkmhMonthly({ id, effectiveUnitIds }) -> { id, deleted: true }`
  - `streamChungTuBkmhMonthlyZip/MergedPdf/SliceFile({ id, sliceId?, effectiveUnitIds })`

Mapped row shape (API):

```js
{
  id, storageUnitId, periodMonth, aggregationMode, unitIds,
  displayName, tongTienThang, sliceCount, folderId,
  createdById, updatedById, createdAt, updatedAt,
  zipPath: `/chungtuquyettoan/bkmh-monthly/${id}/zip`,
  mergedPdfPath: `/chungtuquyettoan/bkmh-monthly/${id}/merged.pdf`,
  slices: [{
    id, sortKey, soChungTu, periodDate, recipientUnitId, recipientUnitName,
    ngayThangNam, tongTien, fileId, fileName,
    filePath: `/chungtuquyettoan/bkmh-monthly/${monthlyId}/slices/${sliceId}/file`,
  }],
}
```

- [ ] **Step 1: Write failing upsert test**

Mirror mocking style from `chung-tu-pdf-export-batch.service.test.js`. Key assertions:

```js
test("createChungTuBkmhMonthlyExport upserts same storageUnitId+periodMonth", async () => {
  // First call: prisma findUnique -> null, create monthly + 2 slices (by-day skips empty)
  // Second call: findUnique -> existing row, deleteDocumentFolder called, update monthly, slice deleteMany + create
  const first = await createChungTuBkmhMonthlyExport({ storageUnitId: 1, periodMonth: "2026-06", ... });
  assert.equal(first.sliceCount, 2);
  const second = await createChungTuBkmhMonthlyExport({ storageUnitId: 1, periodMonth: "2026-06", ... });
  assert.equal(second.id, first.id);
  assert.equal(prismaMonthlyCreate.mock.callCount(), 1);
  assert.equal(prismaMonthlyUpdate.mock.callCount(), 1);
  assert.equal(deleteDocumentFolder.mock.callCount(), 1);
});
```

- [ ] **Step 2: Run test — FAIL**

- [ ] **Step 3: Implement service**

Core upsert logic:

```js
async function createChungTuBkmhMonthlyExport(params) {
  const categoryKey = CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG;
  assertKnownCategoryKey(categoryKey);
  const storageUnitId = Number(params.storageUnitId);
  const safePeriodMonth = normalizePeriodMonth(params.periodMonth);
  // ... template lookup, resolveChungTuContext, pickExportSlices (same as batch)
  const existing = await prisma.chungTuBkmhMonthly.findUnique({
    where: { storageUnitId_periodMonth: { storageUnitId, periodMonth: safePeriodMonth } },
  });

  let folder;
  if (existing?.documentServiceFolderId) {
    await deleteDocumentFolder(existing.documentServiceFolderId).catch(() => {});
  }
  folder = await createDocumentFolder({ name: `bkmh_${storageUnitId}_${safePeriodMonth}_${Date.now()}` });

  const sliceRows = [];
  for (const slice of slices) {
    // renderToDocumentFolder ... same as batch
    const meta = buildBkmhSliceMetadata(slice.context);
    sliceRows.push({ sortKey: slice.sortKey, ...meta, documentServiceFileId, fileName: slice.fileName });
  }
  const tongTienThang = sumSliceTongTien(sliceRows);

  if (existing) {
    await prisma.chungTuBkmhSlice.deleteMany({ where: { monthlyId: existing.id } });
    return mapMonthlyRow(await prisma.chungTuBkmhMonthly.update({
      where: { id: existing.id },
      data: { /* folder, rollup, slices.create */, updatedById: params.createdById },
      include: { slices: { orderBy: [{ sortKey: "asc" }, { id: "asc" }] } },
    }));
  }
  return mapMonthlyRow(await prisma.chungTuBkmhMonthly.create({ data: { /* ... */, createdById, updatedById: createdById, slices: { create: sliceRows } }, include: ... }));
}
```

Display name helper: `` `BKMH ${safePeriodMonth.slice(5, 7)}/${safePeriodMonth.slice(0, 4)} — ${context.donVi || "Kho"}` ``

Reject if `categoryKey !== bang-ke-mua-hang` is implicit (endpoint BKMH-only).

On render failure: `deleteDocumentFolder(folder.id)` in catch (same as batch).

- [ ] **Step 4: Run tests — PASS**

Run: `cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.test.js`

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.*
git commit -m "feat: BKMH monthly export with upsert and slice persistence"
```

---

### Task 4: Routes, validators, controllers

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.validator.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.route-definitions.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.routes.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.controller.js`

**Interfaces:**
- Consumes: service functions from Task 3
- Produces: REST paths under `/chungtuquyettoan/bkmh-monthly`

- [ ] **Step 1: Add validators**

```js
const chungTuBkmhMonthlyListQuerySchema = z.object({
  storageUnitId: z.coerce.number().int().positive(),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

const chungTuBkmhMonthlyCreateBodySchema = chungTuPdfExportBatchCreateBodySchema
  .extend({})
  .refine((body) => body.categoryKey === "bang-ke-mua-hang", {
    message: "Chỉ áp dụng cho bảng kê mua hàng.",
  })
  .refine((body) => Boolean(body.periodMonth), {
    message: "BKMH monthly yêu cầu periodMonth.",
  });

const chungTuBkmhMonthlyIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const chungTuBkmhMonthlySliceFileParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  sliceId: z.coerce.number().int().positive(),
});
```

Export schemas; map `storageUnitId` from body `unitId` in controller.

- [ ] **Step 2: Add route definitions** (mirror batch keys)

| key | method | path |
|-----|--------|------|
| `bkmhMonthlyList` | GET | `/bkmh-monthly` |
| `bkmhMonthlyCreate` | POST | `/bkmh-monthly-exports` |
| `bkmhMonthlyDetail` | GET | `/bkmh-monthly/:id` |
| `bkmhMonthlyZip` | GET | `/bkmh-monthly/:id/zip` |
| `bkmhMonthlyMergedPdf` | GET | `/bkmh-monthly/:id/merged.pdf` |
| `bkmhMonthlySliceFile` | GET | `/bkmh-monthly/:id/slices/:sliceId/file` |
| `bkmhMonthlyDelete` | DELETE | `/bkmh-monthly/:id` |

Permissions: read = `LTTP_ISSUE_SLIPS_READ`, write/delete/create = `LTTP_ISSUE_SLIPS_WRITE`.

- [ ] **Step 3: Wire routes + controllers**

Controller create maps:

```js
const data = await createChungTuBkmhMonthlyExport({
  storageUnitId: body.unitId,
  periodMonth: body.periodMonth,
  unitIds: body.unitIds,
  aggregationMode: body.aggregationMode,
  pdfTemplateId: body.pdfTemplateId,
  signatures: body.signatures,
  signatureDates: body.signatureDates,
  signatureBlock: body.signatureBlock,
  settings: req.chungTuSettings,
  exportingUserProfile: req.userProfile,
  createdById: req.user.id,
  effectiveUnitIds: req.effectiveUnitIds,
});
return res.json({ item: data });
```

List returns `{ items: [...] }`. Stream controllers pipe upstream like batch (same `streamDocumentFolder*` helpers).

- [ ] **Step 4: Smoke test API**

Run backend tests: `cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.test.js`

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.*
git commit -m "feat: BKMH monthly export HTTP routes and controllers"
```

---

### Task 5: FE API layer

**Files:**
- Modify: `packages/shared/src/app/query/queryKeys.js`
- Create: `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuBkmhMonthlyApi.js`

**Interfaces:**
- Produces hooks:
  - `useChungTuBkmhMonthlyListQuery({ storageUnitId, periodMonth? })`
  - `useChungTuBkmhMonthlyDetailQuery(id)`
  - `useCreateChungTuBkmhMonthlyExportMutation()`
  - `useDeleteChungTuBkmhMonthlyMutation()`
- Helpers (mirror batch):
  - `downloadChungTuBkmhMonthlyZip(id)`
  - `openChungTuBkmhMonthlyMergedPdf(id, { targetWindow })`
  - `downloadChungTuBkmhMonthlySliceFile(id, sliceId, fileName)`
  - `openChungTuBkmhMonthlySliceFile(id, sliceId, { targetWindow })`

- [ ] **Step 1: Add query keys**

```js
bkmhMonthly: (storageUnitId, periodMonth) => [
  "chungTuQuyetToan", "bkmhMonthly", String(storageUnitId ?? ""), periodMonth ?? "_all",
],
bkmhMonthlyDetail: (id) => ["chungTuQuyetToan", "bkmhMonthlyDetail", String(id ?? "")],
```

- [ ] **Step 2: Implement API module**

Copy patterns from `chungTuPdfApi.js` batch section; invalidate `bkmhMonthly` + `bkmhMonthlyDetail` on mutate.

POST body: same shape as batch create (`categoryKey`, `unitId`, `periodMonth`, `unitIds`, `aggregationMode`, `pdfTemplateId`, signatures).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/app/query/queryKeys.js packages/shared/src/features/chung-tu-quyet-toan/api/chungTuBkmhMonthlyApi.js
git commit -m "feat(fe): BKMH monthly export API hooks"
```

---

### Task 6: Tab Tổng hợp + slice summary panel

**Files:**
- Create: `packages/shared/src/pages/chungTuQuyetToan/ChungTuSummaryWorkspace.jsx`
- Create: `packages/shared/src/pages/chungTuQuyetToan/ChungTuBkmhSliceSummaryPanel.jsx`
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuCategoryWorkspace.jsx`

**Interfaces:**
- Consumes: `useChungTuBkmhMonthlyListQuery`, `useChungTuBkmhMonthlyDetailQuery`, slice file helpers

- [ ] **Step 1: Build `ChungTuBkmhSliceSummaryPanel`**

Props: `{ monthlyId, aggregationMode, open, onOpenChange }`.  
Fetch detail when open. Table columns:

| Cột | When |
|-----|------|
| Số chứng từ | always |
| Ngày tháng năm | always (`ngayThangNam` or formatted `periodDate`) |
| Tên đơn vị | `aggregationMode === "by-unit"` |
| Tổng tiền | always (VND format) |
| Thao tác | Xem · Tải · In |

Reuse print/download patterns from `ChungTuHistoryWorkspace` (`openChungTuPdfBatchMergedPdf` → slice file open + `print()`).

- [ ] **Step 2: Build `ChungTuSummaryWorkspace`**

Unit filter (same as History). Table of monthly rows:

| Tháng | Chế độ gộp | Số slice | Tổng tiền tháng | Cập nhật lúc | Thao tác |

Action **Mở tổng hợp** → opens `ChungTuBkmhSliceSummaryPanel`.

- [ ] **Step 3: Add tab to `ChungTuCategoryWorkspace` (BKMH only)**

```jsx
const isBkmh = categoryKey === "bang-ke-mua-hang";
const tabs = useMemo(() => {
  const base = [
    { id: "export", label: "Xuất chứng từ", panel: ... },
    ...(isBkmh ? [{ id: "summary", label: "Tổng hợp", panel: <ChungTuSummaryWorkspace categoryKey={categoryKey} /> }] : []),
    { id: "history", label: "Lịch sử", panel: ... },
    { id: "signature-settings", label: "Cài đặt chữ ký", panel: ... },
  ];
  return base;
}, [categoryKey, isBkmh, config?.exportKind]);
```

- [ ] **Step 4: Manual check**

Start dev server; BKMH tabs show Xuất → Tổng hợp → Lịch sử → Cài đặt.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/pages/chungTuQuyetToan/ChungTuSummaryWorkspace.jsx packages/shared/src/pages/chungTuQuyetToan/ChungTuBkmhSliceSummaryPanel.jsx packages/shared/src/pages/chungTuQuyetToan/ChungTuCategoryWorkspace.jsx
git commit -m "feat(fe): BKMH Tổng hợp tab and slice summary panel"
```

---

### Task 7: Export wizard + History BKMH cutover

**Files:**
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx`
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuHistoryWorkspace.jsx`

**Interfaces:**
- Consumes: `useCreateChungTuBkmhMonthlyExportMutation`, `useChungTuBkmhMonthlyListQuery`, monthly delete/zip/print helpers

- [ ] **Step 1: Route BKMH monthly export to new API**

In `ChungTuExportWorkspace`:

```jsx
const isBkmhMonthly = categoryKey === "bang-ke-mua-hang" && isMonthly;
const [createBkmhMonthly, { isLoading: creatingBkmh }] = useCreateChungTuBkmhMonthlyExportMutation();
const [createPdfExportBatch, { isLoading: creatingBatch }] = useCreateChungTuPdfExportBatchMutation();

const handleCreate = async () => {
  // ... validation unchanged
  const mutate = isBkmhMonthly ? createBkmhMonthly : createPdfExportBatch;
  const result = await mutate({ ...buildPayloadBase(), pdfTemplateId, signatures, ... }).unwrap();
  if (isBkmhMonthly) {
    setLastBatchInfo({ monthlyId: result?.id, sliceCount: result?.sliceCount, displayName: result?.displayName });
  } else {
    // existing batch success UI
  }
};
```

Success toast: «Đã lưu BKMH tháng MM/YYYY (N chứng từ)».

- [ ] **Step 2: Refactor BKMH History**

When `categoryKey === "bang-ke-mua-hang"`:

- Query `useChungTuBkmhMonthlyListQuery({ storageUnitId: effectiveUnitId })` instead of batches.
- Render **one card per month** (no file accordion).
- Buttons per card: **In tất cả** | **Tải zip** | **Xem tổng hợp** | Xóa
- **Xem tổng hợp** opens same `ChungTuBkmhSliceSummaryPanel`.
- Hide legacy `ChungTuPdfExportBatch` rows for BKMH (optional: filter `categoryKey !== bang-ke-mua-hang` if still querying batches — prefer skip batch query entirely for BKMH).

PXK/PNK: keep existing batch history UI unchanged (`exportKind !== monthly` or category !== BKMH).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx packages/shared/src/pages/chungTuQuyetToan/ChungTuHistoryWorkspace.jsx
git commit -m "feat(fe): BKMH export upsert and monthly history UX"
```

---

### Task 8: End-to-end verification

**Files:** none (manual + existing tests)

- [ ] **Step 1: Run backend unit tests**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-bkmh-*.test.js src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js
```

Expected: all PASS (batch tests unchanged for PXK).

- [ ] **Step 2: Manual E2E checklist (BKMH)**

1. Xuất BKMH 06/2026 lần 1 → tab Tổng hợp có 1 row, N slice trong panel.
2. Xuất lại cùng kho + tháng → vẫn 1 row monthly; slice thay thế.
3. Lịch sử: In tất cả / Zip / Xem tổng hợp hoạt động; **không** có accordion file lẻ.
4. Bảng slice: Xem / Tải / In từng PDF.
5. PXK export vẫn tạo `pdf-export-batches` bình thường.

- [ ] **Step 3: Commit SDD progress** (if using `.superpowers/sdd/progress.md`)

```bash
git add .superpowers/sdd/progress.md
git commit -m "docs: BKMH monthly ledger implementation complete"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Unique storageUnitId + periodMonth | 1, 3 |
| Upsert re-export | 3 |
| Tab Tổng hợp | 6 |
| Slice table view/download/print | 6, 7 |
| History folder actions only | 7 |
| PXK/PNK batch unchanged | 3 (BKMH-only endpoint), 7 |
| API list/get/zip/merged/file/delete | 4 |
| Metadata from Node context | 2, 3 |
| Google Sheet / Snapshot unchanged | — (no tasks) |
