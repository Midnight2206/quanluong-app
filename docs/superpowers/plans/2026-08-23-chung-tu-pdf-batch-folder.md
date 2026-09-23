# Chứng từ PDF batch + folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa mapper cột PDF, xuất nhiều PDF theo aggregation mode, lưu folder trên document-service, tab cài đặt chữ ký, lịch sử folder với zip/in gộp.

**Architecture:** Node orchestrates `resolveChungTuContext` → loop `sheetContexts` → document-service folder API render/store PDF. Prisma lưu batch metadata mỏng. FE folder tree proxy download.

**Tech Stack:** Node/Express/Prisma, Python/FastAPI/SQLAlchemy/Alembic, React/Next.js shared package, pypdf (đã có), reportlab.

## Global Constraints

- Document-service owns folder + PDF blobs; **no new MEDIA_ROOT writes** for batch exports.
- Skip empty days/units (`detailRows.length === 0`).
- `by-day`: one PDF per day with data, aggregated selected units.
- `by-unit`: one PDF per unit with data, all days in month.
- `full`: one PDF from `rootContext`.
- Signature settings tab per `categoryKey` in Chứng từ quyết toán.
- Download folder = `.zip`; print folder = merged PDF + browser print dialog.
- Reuse existing permissions (`LTTP_ISSUE_SLIPS_READ` / `WRITE`).
- Named Range scalars: `FIELD_<snake_case>`; table columns from `TABLE_HEADER` titles.

---

## File map

| File | Responsibility |
|------|----------------|
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.js` | Template column slug → catalog fieldKey |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.js` | Use alias-aware row/field mapping |
| `services/document-service/app/models.py` | `Folder`, `FolderFile` models |
| `services/document-service/app/folders/folder_service.py` | CRUD, render-to-folder, zip, merge |
| `services/document-service/app/main.py` | `/v1/folders/*` routes |
| `quanluong-app-be/src/services/document-service.client.js` | Folder client methods |
| `quanluong-app-be/prisma/schema.prisma` | Batch + signature settings models |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.js` | Batch orchestration |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-signature-settings.service.js` | CRUD signature_block |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.js` | Static catalog JSON |
| `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuPdfApi.js` | Batch + settings API |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuSignatureSettingsWorkspace.jsx` | Settings UI |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuHistoryWorkspace.jsx` | Folder tree UI |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx` | Batch export CTA |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuCategoryWorkspace.jsx` | Add settings tab |

---

### Task 1: Column alias mapper (fix tên mặt hàng)

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.js`
- Test: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js`
- Test: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js`

**Interfaces:**
- Produces: `resolveColumnFieldKey(templateColumnKey: string): string`, `mapDetailRowsForTemplate(detailRows, templateColumnKeys): object[]`

- [ ] **Step 1: Write failing alias test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { resolveColumnFieldKey } from "./chung-tu-pdf-column-alias.util.js";

test("resolveColumnFieldKey maps ten_mat_hang to tenHang", () => {
  assert.equal(resolveColumnFieldKey("ten_mat_hang"), "tenHang");
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `node --test quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js`

- [ ] **Step 3: Implement alias util**

```javascript
import { guessDetailFieldKeyFromLabel } from "./chung-tu-detail-field-catalog.js";
import { CHUNG_TU_DETAIL_FIELD_KEYS } from "./chung-tu-detail-field-catalog.js";
import { camelToSnake } from "./chung-tu-pdf-map.util.js";

const STATIC_ALIASES = Object.freeze({
  ten_mat_hang: "tenHang",
  ten_hang: "tenHang",
  ten_hang_hoa: "tenHang",
  thanh_tien_vnd: "thanhTien",
  tong_tien_bang_chu: "tongTienBangChu",
  ngay_thang_nam: "ngayThangNam",
});

export function resolveColumnFieldKey(templateColumnKey) {
  const key = String(templateColumnKey ?? "").trim();
  if (!key) return "";
  if (STATIC_ALIASES[key]) return STATIC_ALIASES[key];
  if (CHUNG_TU_DETAIL_FIELD_KEYS.has(key)) return key;
  const snakeAsCamel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (CHUNG_TU_DETAIL_FIELD_KEYS.has(snakeAsCamel)) return snakeAsCamel;
  const fromLabel = guessDetailFieldKeyFromLabel(key.replace(/_/g, " "));
  if (fromLabel) return fromLabel;
  return camelToSnake(key) === key ? snakeAsCamel : "";
}
```

- [ ] **Step 4: Update `mapDetailRows` → `mapDetailRowsForTemplate`**

```javascript
export function mapDetailRowsForTemplate(detailRows, templateColumnKeys) {
  const rows = Array.isArray(detailRows) ? detailRows : [];
  return rows.map((row) => {
    const mapped = {};
    for (const templateKey of templateColumnKeys ?? []) {
      const fieldKey = resolveColumnFieldKey(templateKey);
      const raw = fieldKey
        ? lookupContextValue(row, fieldKey) ?? lookupContextValue(row, camelToSnake(fieldKey))
        : lookupContextValue(row, templateKey);
      mapped[templateKey] = valueToCell(raw ?? "");
    }
    return mapped;
  });
}
```

Wire `buildDocumentServicePayload` to call `mapDetailRowsForTemplate`.

- [ ] **Step 5: Extend map util test for ten_mat_hang**

```javascript
test("mapDetailRowsForTemplate writes ten_mat_hang column", () => {
  const rows = mapDetailRowsForTemplate(
    [{ stt: 1, tenHang: "Gạo" }],
    ["stt", "ten_mat_hang"],
  );
  assert.equal(rows[0].ten_mat_hang, "Gạo");
});
```

- [ ] **Step 6: Run all mapper tests — expect PASS**

Run: `node --test quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js`

- [ ] **Step 7: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js
git commit -m "fix(chung-tu): map PDF table columns via template slug aliases"
```

---

### Task 2: Document-service folder schema + storage

**Files:**
- Create: `services/document-service/alembic/versions/20260823_0005_folders.py`
- Create: `services/document-service/app/folders/__init__.py`
- Create: `services/document-service/app/folders/folder_service.py`
- Create: `services/document-service/app/folders/local_storage.py`
- Modify: `services/document-service/app/models.py`
- Test: `services/document-service/tests/test_folder_service.py`

**Interfaces:**
- Produces: `create_folder(session, name) -> int`, `add_folder_document(session, folder_id, template_id, payload, file_name, sort_key) -> dict`, `get_folder(session, folder_id) -> dict`, `delete_folder(session, folder_id)`, `build_zip(folder_id) -> bytes`, `build_merged_pdf(folder_id) -> bytes`

- [ ] **Step 1: Add models `Folder`, `FolderFile` to `models.py`**

- [ ] **Step 2: Alembic migration `folders` + `folder_files` tables**

- [ ] **Step 3: Write failing test — create folder + add document**

```python
def test_create_folder_and_add_pdf(client, template_id):
    r = client.post("/v1/folders", json={"name": "test-batch"})
    assert r.status_code == 201
    folder_id = r.json()["id"]
    r2 = client.post(
        f"/v1/folders/{folder_id}/documents",
        json={
            "template_id": template_id,
            "file_name": "2026-06-01.pdf",
            "sort_key": "2026-06-01",
            "fields": {"ngay_thang_nam": "Ngày 01 tháng 06 năm 2026"},
            "rows": [{"stt": "1", "ten_hang": "Gạo"}],
        },
    )
    assert r2.status_code == 201
    assert r2.json()["file_name"] == "2026-06-01.pdf"
```

- [ ] **Step 4: Implement `folder_service.py` + local disk under `DOCUMENT_STORAGE_ROOT/folders/{id}/`**

Reuse `render_pdf` from existing import; after render, write bytes to disk, insert `FolderFile` row.

- [ ] **Step 5: Run pytest — expect PASS**

Run: `cd services/document-service && pytest tests/test_folder_service.py -v`

- [ ] **Step 6: Commit**

---

### Task 3: Document-service folder HTTP routes

**Files:**
- Modify: `services/document-service/app/main.py`
- Test: extend `services/document-service/tests/test_folder_service.py`

**Interfaces:**
- Produces REST: `POST/GET/DELETE /v1/folders/{id}`, `POST .../documents`, `GET .../zip`, `GET .../merged.pdf`, `GET .../files/{file_id}`

- [ ] **Step 1: Wire routes in `main.py` with `require_service_key`**

- [ ] **Step 2: Implement zip (`zipfile` stdlib) and merge (`pypdf.PdfWriter`)**

- [ ] **Step 3: Run full document-service tests**

Run: `cd services/document-service && pytest -v`

- [ ] **Step 4: Rebuild docker `document` service for dev**

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file quanluong-app-be/.env.docker build document && docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file quanluong-app-be/.env.docker up -d document`

- [ ] **Step 5: Commit**

---

### Task 4: Node document-service folder client

**Files:**
- Modify: `quanluong-app-be/src/services/document-service.client.js`
- Test: `quanluong-app-be/src/services/document-service.client.test.js` (mock fetch)

**Interfaces:**
- Produces: `createDocumentFolder({ name })`, `renderToFolder(folderId, { templateId, fileName, sortKey, ...payload })`, `getDocumentFolder(folderId)`, `streamFolderZip(folderId)`, `streamFolderMergedPdf(folderId)`, `deleteDocumentFolder(folderId)`

- [ ] **Step 1: Add client functions mirroring `/v1/folders/*`**

- [ ] **Step 2: Test mock fetch paths and error mapping**

- [ ] **Step 3: Commit**

---

### Task 5: Prisma batch + signature settings

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma`
- Create: migration via `prisma migrate diff` / `migrate deploy` pattern used in repo

**Interfaces:**
- Produces models: `ChungTuPdfExportBatch`, `ChungTuSignatureSettings`; `ChungTuPdfExport.batchId`, `documentServiceFileId`, `sortKey`

- [ ] **Step 1: Add models to schema**

- [ ] **Step 2: Generate migration, deploy on dev DB**

Run: `docker compose ... exec -T app npx prisma migrate deploy`

- [ ] **Step 3: Commit**

---

### Task 6: Batch export service

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-batch-slices.util.js`

**Interfaces:**
- Consumes: `resolveChungTuContext`, `buildDocumentServicePayload`, document-service folder client, `getSignatureSettings(categoryKey)`
- Produces: `createChungTuPdfExportBatch(params) -> { batchKey, folderId, fileCount, files }`

- [ ] **Step 1: Write failing test — by-day produces 2 slices, skips empty**

```javascript
test("pickExportSlices by-day skips empty contexts", () => {
  const slices = pickExportSlices({
    aggregationMode: "by-day",
    context: {
      sheetContexts: [
        { periodDate: "2026-06-01", detailRows: [{ tenHang: "A" }] },
        { periodDate: "2026-06-02", detailRows: [] },
        { periodDate: "2026-06-03", detailRows: [{ tenHang: "B" }] },
      ],
    },
  });
  assert.equal(slices.length, 2);
});
```

- [ ] **Step 2: Implement `pickExportSlices` + `buildSliceFileName`**

- [ ] **Step 3: Implement `createChungTuPdfExportBatch` — create folder, loop render, Prisma rows**

- [ ] **Step 4: Mock document-service in test — expect PASS**

- [ ] **Step 5: Commit**

---

### Task 7: Signature settings service + field catalog

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-signature-settings.service.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.js`

- [ ] **Step 1: CRUD `ChungTuSignatureSettings` by categoryKey**

- [ ] **Step 2: Static catalog array for `GET /pdf-template-field-catalog`**

- [ ] **Step 3: Commit**

---

### Task 8: Node routes + controller + validator

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.routes.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.controller.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.validator.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.route-definitions.js`

- [ ] **Step 1: Register batch + signature + catalog routes**

- [ ] **Step 2: Stream proxies for zip/merged/single file (pipe document-service response)**

- [ ] **Step 3: Commit**

---

### Task 9: FE API layer

**Files:**
- Modify: `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuPdfApi.js`

- [ ] **Step 1: Add RTK/hooks: `createPdfExportBatch`, `usePdfExportBatchesQuery`, `downloadBatchZip`, `openBatchMergedPdf`, signature settings queries/mutations, `usePdfFieldCatalogQuery`**

- [ ] **Step 2: Commit**

---

### Task 10: FE Signature settings tab

**Files:**
- Create: `packages/shared/src/pages/chungTuQuyetToan/ChungTuSignatureSettingsWorkspace.jsx`
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuCategoryWorkspace.jsx`

- [ ] **Step 1: Form for signature_block (columns, labels, date line gap — mirror document-service shape)**

- [ ] **Step 2: Add third sub-tab "Cài đặt chữ ký"**

- [ ] **Step 3: Commit**

---

### Task 11: FE Export + History folder UX

**Files:**
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx`
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuHistoryWorkspace.jsx`

- [ ] **Step 1: Export — call batch API; toast "Đã tạo N file trong folder"; show field catalog collapsible**

- [ ] **Step 2: History — accordion folder rows; expand lists files; buttons Tải zip / In tất cả / Tải từng file / Xóa**

- [ ] **Step 3: Print all — fetch merged PDF blob → `window.open(URL.createObjectURL(blob))` → `print()`**

- [ ] **Step 4: Commit**

---

### Task 12: Dev smoke

- [ ] **Step 1: Rebuild `app` + `document` containers**

- [ ] **Step 2: Upload template with column "Tên mặt hàng"; export by-day month with 2+ days data**

- [ ] **Step 3: Verify PDF rows have item names; history shows folder with N files; zip + merged work**

- [ ] **Step 4: Update `.superpowers/sdd/progress.md`**

---

## Plan self-review

| Spec requirement | Task |
|------------------|------|
| Fix tenHang / column slug | Task 1 |
| by-day / by-unit batch | Task 6 |
| Skip empty slices | Task 6 |
| Named range catalog | Task 7 |
| Signature settings tab | Task 7, 10 |
| Folder on document-service | Task 2, 3 |
| Zip download | Task 3, 8, 11 |
| Merged print | Task 3, 8, 11 |
| ngayThangNam / tongTienBangChu | Already in resolver; Task 6 uses per-slice context |

No TBD placeholders in task steps above.
