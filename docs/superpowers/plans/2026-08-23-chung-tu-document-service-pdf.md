# Chứng từ quyết toán → document-service PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Google Sheets export UX on the 3 AVAILABLE chứng từ tabs with PDF render via document-service, including template upload, signature form, and PDF history.

**Architecture:** Thin adapter on Node BE: keep `resolveChungTuContext`; add mapper + `renderDocumentPdf`; persist PDF under `MEDIA_ROOT` and Prisma `ChungTuPdfTemplate` / `ChungTuPdfExport`. FE swaps Drive picker/history for PDF template picker + download history. Drive/Sheets code stays in repo but is unused by the new UI.

**Tech Stack:** Prisma/MySQL, Express (`quanluong-app-be`), existing `document-service.client.js`, React Query + shared pages (`packages/shared`), document-service Python (unchanged for this plan).

**Spec:** `docs/superpowers/specs/2026-08-23-chung-tu-document-service-pdf-design.md`

## Global Constraints

- Scope: only `bang-ke-mua-hang`, `phieu-xuat-kho`, `phieu-nhap-kho`.
- One PDF per export from resolved `detailRows` (no multi-tab Sheet recreation).
- Permissions: same as existing chứng từ routes — READ `LTTP_ISSUE_SLIPS_READ`, WRITE `LTTP_ISSUE_SLIPS_WRITE` (via `CHUNG_TU_QUYET_TOAN_ROUTE_DEFINITIONS` + `permissionMiddleware`).
- Do not delete Drive/Sheets modules in this plan; FE must stop calling them on AVAILABLE tabs.
- Download PDF only through authenticated `GET .../pdf-exports/:exportKey/file`.
- document-service auth remains service-key inside `document-service.client.js`; product users never call document-service directly.
- Follow repo ponytail: smallest diff; reuse resolver/validators patterns; no new deps.

## File map

| File | Role |
|------|------|
| `quanluong-app-be/prisma/schema.prisma` | `ChungTuPdfTemplate`, `ChungTuPdfExport` |
| `quanluong-app-be/prisma/migrations/…` | Migration |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.js` | camelCase↔snake + context→payload |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js` | Mapper unit tests |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-storage.util.js` | Write/delete under `MEDIA_ROOT/chung-tu-pdf/…` |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.js` | List/upload/soft-delete templates |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export.service.js` | Create/list/file/delete exports |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.validator.js` | Zod for new bodies/params |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.route-definitions.js` | Permission catalog entries |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.controller.js` | Controllers |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.routes.js` | Wire routes |
| `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuPdfApi.js` | FE API hooks |
| `packages/shared/src/app/query/queryKeys.js` (or local qk) | Query keys for pdf templates/exports |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx` | PDF export UX |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuHistoryWorkspace.jsx` | PDF history UX |
| `packages/shared/src/pages/chungTuQuyetToan/chungTuQuyetToanTabsMeta.js` | Subtitles |

---

### Task 1: Prisma models + migration

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma` (after `ChungTuDocument` block ~line 273)
- Create: migration via `npx prisma migrate dev`

**Interfaces:**
- Produces: Prisma models `ChungTuPdfTemplate`, `ChungTuPdfExport` usable as `prisma.chungTuPdfTemplate` / `prisma.chungTuPdfExport`

- [ ] **Step 1: Add models to schema**

Add relations on `User` if the schema requires back-relations for `uploadedBy` / `createdBy` (match existing `ChungTuDocumentCreatedBy` pattern).

```prisma
model ChungTuPdfTemplate {
  id                         Int      @id @default(autoincrement())
  categoryKey                String   @db.VarChar(80)
  displayName                String   @db.VarChar(200)
  documentServiceTemplateId  Int
  name                       String   @db.VarChar(120)
  version                    String   @db.VarChar(64)
  isActive                   Boolean  @default(true)
  uploadedById               Int
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
  uploadedBy                 User     @relation("ChungTuPdfTemplateUploadedBy", fields: [uploadedById], references: [id], onDelete: Restrict)

  @@unique([categoryKey, documentServiceTemplateId])
  @@index([categoryKey, isActive])
}

model ChungTuPdfExport {
  id                         Int      @id @default(autoincrement())
  exportKey                  String   @unique @db.VarChar(200)
  categoryKey                String   @db.VarChar(80)
  unitId                     Int
  periodMonth                String?  @db.VarChar(7)
  periodDate                 DateTime? @db.Date
  issueSlipId                Int?
  unitIdsJson                Json
  aggregationMode            String?  @db.VarChar(32)
  pdfTemplateId              Int
  documentServiceTemplateId  Int
  fileName                   String   @db.VarChar(255)
  storagePath                String   @db.VarChar(512)
  sourceDataHash             String?  @db.VarChar(64)
  signaturesJson             Json?
  createdById                Int
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
  unit                       Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)
  createdBy                  User     @relation("ChungTuPdfExportCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)

  @@index([categoryKey, unitId, createdAt])
}
```

Wire `User` / `Unit` relation arrays the same way other ChungTu models do.

- [ ] **Step 2: Migrate**

Run from `quanluong-app-be`:

```bash
npx prisma migrate dev --name chung_tu_pdf_template_export
npx prisma generate
```

Expected: migration applied; client generates without error.

- [ ] **Step 3: Commit**

```bash
git add quanluong-app-be/prisma
git commit -m "feat(chung-tu): add Prisma models for PDF templates and exports"
```

---

### Task 2: Mapper util (TDD)

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.js`
- Test: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js`

**Interfaces:**
- Produces:
  - `camelToSnake(key: string): string`
  - `pickMappedFields(context: object, fieldKeys: string[]): Record<string, string>`
  - `mapDetailRows(detailRows: object[], columnKeys: string[]): Record<string, string>[]`
  - `buildDocumentServicePayload({ context, fieldKeys, columnKeys, signatures, signatureDates, signatureBlock }): { fields, rows, signatures, signature_dates, signature_block? }`

- [ ] **Step 1: Write failing tests**

```js
import assert from "node:assert/strict";
import {
  camelToSnake,
  pickMappedFields,
  mapDetailRows,
  buildDocumentServicePayload,
} from "./chung-tu-pdf-map.util.js";

assert.equal(camelToSnake("thanhTien"), "thanh_tien");
assert.equal(camelToSnake("soChungTu"), "so_chung_tu");

assert.deepEqual(
  pickMappedFields(
    { thanhTien: "1.000", soChungTu: "A1", extra: "x" },
    ["thanh_tien", "so_chung_tu"],
  ),
  { thanh_tien: "1.000", so_chung_tu: "A1" },
);

assert.deepEqual(
  mapDetailRows(
    [{ stt: "1", tenHang: "Gạo", thanhTien: "10.000", ignoreMe: true }],
    ["stt", "ten_hang", "thanh_tien"],
  ),
  [{ stt: "1", ten_hang: "Gạo", thanh_tien: "10.000" }],
);

const payload = buildDocumentServicePayload({
  context: { donVi: "Bếp A", detailRows: [{ stt: "1", tenHang: "Gạo" }] },
  fieldKeys: ["don_vi"],
  columnKeys: ["stt", "ten_hang"],
  signatures: { nguoi_lap: "A" },
  signatureDates: { nguoi_lap: "ngày 1" },
});
assert.deepEqual(payload.fields, { don_vi: "Bếp A" });
assert.deepEqual(payload.rows, [{ stt: "1", ten_hang: "Gạo" }]);
assert.deepEqual(payload.signatures, { nguoi_lap: "A" });
assert.deepEqual(payload.signature_dates, { nguoi_lap: "ngày 1" });
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js
```

Expected: FAIL (module missing) or assertion fail.

- [ ] **Step 3: Implement util**

```js
export function camelToSnake(key) {
  return String(key ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
}

function valueToCell(value) {
  if (value == null) return "";
  return String(value);
}

function lookupContextValue(context, templateKey) {
  if (Object.prototype.hasOwnProperty.call(context, templateKey)) {
    return context[templateKey];
  }
  for (const [k, v] of Object.entries(context)) {
    if (k === "detailRows" || k === "sheetContexts") continue;
    if (camelToSnake(k) === templateKey) return v;
  }
  return undefined;
}

export function pickMappedFields(context, fieldKeys) {
  const out = {};
  for (const key of fieldKeys) {
    const raw = lookupContextValue(context, key);
    if (raw !== undefined) out[key] = valueToCell(raw);
  }
  return out;
}

export function mapDetailRows(detailRows, columnKeys) {
  const rows = Array.isArray(detailRows) ? detailRows : [];
  return rows.map((row) => {
    const mapped = {};
    for (const key of columnKeys) {
      const raw = lookupContextValue(row, key);
      mapped[key] = valueToCell(raw ?? "");
    }
    return mapped;
  });
}

export function buildDocumentServicePayload({
  context,
  fieldKeys,
  columnKeys,
  signatures = {},
  signatureDates = {},
  signatureBlock,
}) {
  const payload = {
    fields: pickMappedFields(context ?? {}, fieldKeys ?? []),
    rows: mapDetailRows(context?.detailRows, columnKeys ?? []),
    signatures: signatures ?? {},
    signature_dates: signatureDates ?? {},
  };
  if (signatureBlock) payload.signature_block = signatureBlock;
  return payload;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js
```

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js
git commit -m "feat(chung-tu): map resolver context to document-service payload"
```

---

### Task 3: PDF storage helper

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-storage.util.js`
- Test: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-storage.util.test.js` (tmpdir)

**Interfaces:**
- Consumes: `env.mediaRoot` from `../../config/env.js`
- Produces:
  - `buildChungTuPdfRelativePath({ categoryKey, exportKey, year }): string` → `chung-tu-pdf/{categoryKey}/{year}/{exportKey}.pdf`
  - `writeChungTuPdfFile(relativePath, buffer): Promise<string>` absolute path written
  - `readChungTuPdfFile(relativePath): Promise<Buffer>`
  - `deleteChungTuPdfFile(relativePath): Promise<void>` (ignore missing)

- [ ] **Step 1: Implement + one assert test using `os.tmpdir()` by injecting root via optional arg `rootDir = env.mediaRoot`**

Keep signature:

```js
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";

export function buildChungTuPdfRelativePath({ categoryKey, exportKey, year }) {
  return path.posix.join(
    "chung-tu-pdf",
    String(categoryKey),
    String(year),
    `${exportKey}.pdf`,
  );
}

export async function writeChungTuPdfFile(relativePath, buffer, rootDir = env.mediaRoot) {
  const abs = path.join(rootDir, relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return abs;
}
// read + delete similarly; delete catches ENOENT
```

- [ ] **Step 2: Run test PASS; commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-storage.util.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-storage.util.test.js
git commit -m "feat(chung-tu): store PDF exports under MEDIA_ROOT"
```

---

### Task 4: PDF template service + HTTP

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.js`
- Modify: `chung-tu-quyet-toan.validator.js`, `route-definitions.js`, `controller.js`, `routes.js`

**Interfaces:**
- Consumes: `uploadTemplate`, `getTemplateFields` from `../../services/document-service.client.js`
- Produces service fns:
  - `listChungTuPdfTemplates({ categoryKey })`
  - `createChungTuPdfTemplate({ categoryKey, displayName, name, version, buffer, uploadedById })`
  - `deactivateChungTuPdfTemplate({ id })`
  - `getChungTuPdfTemplateFields({ id })` → document-service fields JSON

- [ ] **Step 1: Add Zod**

Reuse category keys already validated in `chungTuDocumentBaseBodySchema`. Add:

```js
const chungTuPdfTemplateListQuerySchema = z.object({
  categoryKey: z.string().min(1).max(80),
});
const chungTuPdfTemplateIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
// upload fields come from multipart: categoryKey, displayName, name, version (+ file)
```

- [ ] **Step 2: Implement service**

```js
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  getTemplateFields,
  uploadTemplate,
} from "../../services/document-service.client.js";

const ALLOWED = new Set(["bang-ke-mua-hang", "phieu-xuat-kho", "phieu-nhap-kho"]);

export async function listChungTuPdfTemplates({ categoryKey }) {
  if (!ALLOWED.has(categoryKey)) {
    throw new AppError({ message: "Loại chứng từ không hỗ trợ PDF.", statusCode: 400, code: ERROR_CODES.BAD_REQUEST });
  }
  return prisma.chungTuPdfTemplate.findMany({
    where: { categoryKey, isActive: true },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function createChungTuPdfTemplate({
  categoryKey, displayName, name, version, buffer, uploadedById,
}) {
  if (!ALLOWED.has(categoryKey)) {
    throw new AppError({ message: "Loại chứng từ không hỗ trợ PDF.", statusCode: 400, code: ERROR_CODES.BAD_REQUEST });
  }
  const uploaded = await uploadTemplate({ buffer, name, version });
  const dsId = Number(uploaded.id ?? uploaded.template_id);
  return prisma.chungTuPdfTemplate.create({
    data: {
      categoryKey,
      displayName: displayName || name,
      documentServiceTemplateId: dsId,
      name,
      version,
      uploadedById,
    },
  });
}

export async function deactivateChungTuPdfTemplate({ id }) {
  const row = await prisma.chungTuPdfTemplate.findUnique({ where: { id } });
  if (!row || !row.isActive) {
    throw new AppError({ message: "Không tìm thấy mẫu PDF.", statusCode: 404, code: ERROR_CODES.NOT_FOUND });
  }
  return prisma.chungTuPdfTemplate.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function getChungTuPdfTemplateFields({ id }) {
  const row = await prisma.chungTuPdfTemplate.findUnique({ where: { id } });
  if (!row || !row.isActive) {
    throw new AppError({ message: "Không tìm thấy mẫu PDF.", statusCode: 404, code: ERROR_CODES.NOT_FOUND });
  }
  const fields = await getTemplateFields(row.documentServiceTemplateId);
  return { template: row, fields };
}
```

Inspect real `uploadTemplate` JSON once (`id` field) and adjust `dsId` accordingly.

- [ ] **Step 3: Route definitions + routes**

Add definitions with READ for list/fields, WRITE for upload/delete. Mirror multer memory pattern from `driveImportUpload` (32MB). Paths:

- `GET /pdf-templates`
- `POST /pdf-templates` (multipart)
- `DELETE /pdf-templates/:id`
- `GET /pdf-templates/:id/fields`

Use `permissionMiddleware` + existing `authMiddleware` stack already on router.

- [ ] **Step 4: Manual smoke or unit with mocked client**

Minimal: mock `uploadTemplate` in a service test if the module already uses that style; otherwise hit health + list empty with auth in existing test harness.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(chung-tu): PDF template list/upload/fields API"
```

---

### Task 5: PDF export service + HTTP

**Files:**
- Create: `chung-tu-pdf-export.service.js`
- Modify: validator, route-definitions, controller, routes

**Interfaces:**
- Consumes: `resolveChungTuContext` (same args as `previewChungTuContext` / create), `getTemplateFields`, `renderDocumentPdf`, mapper, storage, Prisma template row
- Produces:
  - `createChungTuPdfExport({ …same period fields as create document…, pdfTemplateId, signatures, signatureDates, signatureBlock, createdById, effectiveUnitIds })`
  - `listChungTuPdfExports({ unitId, categoryKey, from, to, effectiveUnitIds })`
  - `getChungTuPdfExportFile({ exportKey, effectiveUnitIds })` → `{ buffer, fileName }`
  - `deleteChungTuPdfExport({ exportKey, effectiveUnitIds })`

- [ ] **Step 1: Zod body**

Extend `chungTuDocumentBaseBodySchema` (without `templateDriveFileId`):

```js
const chungTuPdfExportCreateBodySchema = chungTuDocumentBaseBodySchema
  .extend({
    pdfTemplateId: z.coerce.number().int().positive(),
    signatures: z.record(z.string()).optional().default({}),
    signatureDates: z.record(z.string()).optional().default({}),
    signatureBlock: z.record(z.any()).optional(),
  })
  .superRefine(refineChungTuDocumentBody);

const chungTuPdfExportKeyParamSchema = z.object({
  exportKey: z.string().min(8).max(200),
});
```

- [ ] **Step 2: Implement create**

Pseudo-order (must follow):

1. Load `ChungTuPdfTemplate` by `pdfTemplateId` + `isActive` + matching `categoryKey`.
2. `const { context, sourceDataHash } = await resolveChungTuContext({…})` — copy arg list from `previewChungTuContext` in `chung-tu-document.service.js`.
3. `fieldsMeta = await getTemplateFields(dsId)`; derive `fieldKeys` / `columnKeys` from response shape (inspect document-dev / Python `/fields` — typically `fields[].name` / `columns[].key` or similar; normalize in one helper `extractTemplateKeys(fieldsPayload)`).
4. `payload = buildDocumentServicePayload({ context, fieldKeys, columnKeys, signatures, signatureDates, signatureBlock })`.
5. `buffer = await renderDocumentPdf(dsId, payload)`.
6. `exportKey =` random unique string (nanoid or `ctpdf_${Date.now()}_${random}`); `storagePath = buildChungTuPdfRelativePath({ categoryKey, exportKey, year: new Date().getFullYear() })`; write file.
7. Insert `ChungTuPdfExport`; return enriched row + `downloadPath: /chungtuquyettoan/pdf-exports/${exportKey}/file`.

Enforce `effectiveUnitIds` the same way `createOrGetChungTuDocument` does.

- [ ] **Step 3: List / file / delete**

List: filter by category + unit scope like `listChungTuDocuments`.  
File: scope check then `readChungTuPdfFile`. Controller sets `Content-Type: application/pdf` + `Content-Disposition`.  
Delete: scope check, delete file, delete row.

- [ ] **Step 4: Wire routes**

- `POST /pdf-exports` — WRITE + `unitDataScopeMiddleware` like document create  
- `GET /pdf-exports` — READ + list query (reuse documents list query shape: unitId, categoryKey, from, to)  
- `GET /pdf-exports/:exportKey/file` — READ  
- `DELETE /pdf-exports/:exportKey` — WRITE  

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(chung-tu): create/list/download/delete PDF exports"
```

---

### Task 6: FE API layer

**Files:**
- Create: `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuPdfApi.js`
- Modify: query key helper used by chứng từ (find `qk.chungTuQuyetToan` definition and extend)

**Interfaces:**
- Produces hooks:
  - `useChungTuPdfTemplatesQuery(categoryKey)`
  - `useUploadChungTuPdfTemplateMutation()`
  - `useDeactivateChungTuPdfTemplateMutation()`
  - `useChungTuPdfTemplateFieldsQuery(templateId)`
  - `useCreateChungTuPdfExportMutation()`
  - `useChungTuPdfExportsQuery({ unitId, categoryKey })`
  - `useDeleteChungTuPdfExportMutation()`
  - helper `downloadChungTuPdfExport(exportKey)` using `apiRequest` blob or `window.open` with auth pattern already used elsewhere

- [ ] **Step 1: Implement hooks mirroring `chungTuDocumentApi.js` style (`apiRequest`, `useWrappedMutation`, invalidate on success).**

Upload: `FormData` with `file`, `categoryKey`, `displayName`, `name`, `version`; `apiRequest` must not force JSON Content-Type (follow existing catalog upload if present).

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(chung-tu): FE API hooks for PDF templates and exports"
```

---

### Task 7: FE Export workspace

**Files:**
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx`
- Modify: `packages/shared/src/pages/chungTuQuyetToan/chungTuQuyetToanTabsMeta.js`
- Optionally small presentational pieces in same folder if file gets huge: `ChungTuPdfTemplatePicker.jsx`, `ChungTuSignatureFields.jsx`

**Interfaces:**
- Consumes: hooks from Task 6; keeps preview mutation + unit scope + aggregation UI

- [ ] **Step 1: Update tab subtitles** in `chungTuQuyetToanTabsMeta.js` — replace “Google Sheets” with “PDF (document-service)”.

- [ ] **Step 2: Replace Drive template picker + create document CTA**

Keep period/unit/aggregation/preview. Replace:

- `ChungTuTemplateTreePicker` / category Drive templates → select from `useChungTuPdfTemplatesQuery` + file input upload  
- On template select → `useChungTuPdfTemplateFieldsQuery` → render signature inputs for each dynamic slot if fields payload exposes them; if not, two inputs `nguoi_lap` / `thu_truong` as fallback matching document-service default block  
- Primary button: **Xuất PDF** → `useCreateChungTuPdfExportMutation` → trigger browser download via file endpoint + `notifySuccess`  
- Remove/disable: seed Drive, mapping panel entry points, `lastOpenedLink` Google Sheet notice

- [ ] **Step 3: Manual smoke**

With document-service up + one uploaded Named-Range xlsx: export BKMH or PXK → PDF downloads → row appears after Task 8 history.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(chung-tu): export workspace uses PDF templates and signatures"
```

---

### Task 8: FE History workspace

**Files:**
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuHistoryWorkspace.jsx`

- [ ] **Step 1: Swap data source** from `useChungTuDocumentsQuery` to `useChungTuPdfExportsQuery`.

Actions:

- **Tải PDF** → download helper  
- **Xóa** → delete mutation + confirm  
- Remove: Mở Sheet, Đồng bộ, stale-check UI

Columns: thời gian, kỳ, mẫu, người tạo, thao tác.

- [ ] **Step 2: Smoke list after an export; commit**

```bash
git commit -m "feat(chung-tu): history tab lists PDF exports"
```

---

### Task 9: Permission catalog + route-definition sync

**Files:**
- Modify: `chung-tu-quyet-toan.route-definitions.js` (if not fully done in Tasks 4–5)
- Run whatever script/process the repo uses to sync permission VI catalog when route definitions change (see `.cursor/skills/permission-vi-catalog/SKILL.md` if present)

- [ ] **Step 1: Ensure every new route has a definition entry with correct READ/WRITE codes.**

- [ ] **Step 2: Commit any generated permission artifacts**

```bash
git commit -m "chore(chung-tu): register PDF export routes in permission catalog"
```

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Prisma templates/exports | 1 |
| Mapper camel↔snake | 2 |
| MEDIA_ROOT storage | 3 |
| Template list/upload/fields/delete | 4 |
| Export create/list/file/delete | 5 |
| FE API | 6 |
| Export UX + signatures + subtitles | 7 |
| History UX | 8 |
| Permissions | 4–5, 9 |
| Keep resolver/preview; one PDF per export | 5, 7 |
| Don’t delete Drive code | All (FE stop calling only) |

## Out of plan (explicit)

- Deleting Drive/Sheets services  
- MinIO, PLANNED tabs, multi-PDF per month sheets  
- Re-export into same `exportKey`
