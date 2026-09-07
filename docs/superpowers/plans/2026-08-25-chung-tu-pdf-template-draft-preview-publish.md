# Chứng từ PDF — Draft → Preview → Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Template lifecycle `draft → preview (real render_pdf) → published` (plus `retired`); only `published` templates can create real chứng từ; Superadmin can preview/publish/retire.

**Architecture:** document-service owns `templates.status` and preview/publish/retire APIs. Node mirrors `status` on `ChungTuPdfTemplate` (replaces `isActive`). Superadmin UI: upload → open preview PDF in new tab → publish; unit picker only `published`.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (document-service), Express + Prisma (Node), React shared package + apps/superadmin.

## Global Constraints

- Enum: `draft` | `published` | `retired` only.
- Upload always creates `draft` (DS + Node).
- Preview uses `load_metadata_from_db` + `generate_placeholder_data` + `render_pdf`; no file persist.
- Publish: only `draft` → `published`; already published/retired → 409 (not idempotent).
- Retire: `draft` or `published` → `retired`; already retired → 409.
- Create-document / folder-document: `status != published` → 409 `TEMPLATE_NOT_PUBLISHED`.
- Unit list: only `published`. Superadmin list: all statuses.
- Preview allowed for every status (including `retired`).
- Out of scope: `field_sources`, persist `signature_block`, Excel skeleton, un-publish, embed PDF UI.
- Migration: DS backfill existing → `published`; Node `isActive=true` → `published`, `false` → `retired`; then sync DS retire for Node-retired rows.

---

## File map

| File | Responsibility |
|------|----------------|
| `services/document-service/alembic/versions/20260825_0006_template_status.py` | Add `templates.status` |
| `services/document-service/app/models.py` | `Template.status` |
| `services/document-service/app/templates/status.py` | Constants + require_published / transition helpers |
| `services/document-service/app/templates/placeholder_data.py` | `generate_placeholder_data(metadata)` |
| `services/document-service/app/import/template_service.py` | New templates `status=draft` |
| `services/document-service/app/main.py` | List filter, preview, publish, retire, document guard |
| `services/document-service/app/folders/folder_service.py` | Published guard before render |
| `services/document-service/tests/test_template_status*.py` | Status + preview + publish tests |
| `quanluong-app-be/prisma/schema.prisma` | `status` replaces `isActive` on `ChungTuPdfTemplate` |
| `quanluong-app-be/prisma/migrations/...` | Data map + drop `isActive` |
| `quanluong-app-be/src/services/document-service.client.js` | preview/publish/retire + 409 mapping |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.js` | status list/publish/retire/preview |
| `chung-tu-pdf-template.service.test.js` | Unit tests |
| `chung-tu-pdf-export*.service.js` | `status: "published"` instead of `isActive: true` |
| `chung-tu-quyet-toan.{routes,controller,validator,route-definitions}.js` | New routes |
| `packages/shared/.../chungTuPdfApi.js` | FE hooks |
| `SuperadminChungTuPdfCategoryTemplates.jsx` | Preview / Publish / Retire UI |
| `scripts/sync-chung-tu-pdf-template-status-to-ds.mjs` (optional one-shot) | Retire DS templates matching Node `retired` |

---

### Task 1: DS — `status` column + model + upload draft

**Files:**
- Create: `services/document-service/alembic/versions/20260825_0006_template_status.py`
- Modify: `services/document-service/app/models.py`
- Modify: `services/document-service/app/import/template_service.py`
- Modify: `services/document-service/app/main.py` (`_template_item`)
- Create: `services/document-service/app/templates/__init__.py` (empty or re-exports)
- Create: `services/document-service/app/templates/status.py`

**Interfaces:**
- Produces: `TEMPLATE_STATUSES = ("draft", "published", "retired")`
- Produces: `STATUS_DRAFT`, `STATUS_PUBLISHED`, `STATUS_RETIRED`
- Produces: `Template.status: str` default `"draft"`

- [ ] **Step 1: Add Alembic migration**

```python
"""Add templates.status draft|published|retired."""

from alembic import op
import sqlalchemy as sa

revision = "20260825_0006"
down_revision = "20260823_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "templates",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
    )
    op.create_check_constraint(
        "templates_status_check",
        "templates",
        "status IN ('draft', 'published', 'retired')",
    )
    op.execute("UPDATE templates SET status = 'published'")


def downgrade() -> None:
    op.drop_constraint("templates_status_check", "templates", type_="check")
    op.drop_column("templates", "status")
```

- [ ] **Step 2: Model + status helpers**

In `models.py` on `Template`:

```python
status: Mapped[str] = mapped_column(
    String(20), nullable=False, default="draft", server_default="draft"
)
```

Create `app/templates/status.py`:

```python
STATUS_DRAFT = "draft"
STATUS_PUBLISHED = "published"
STATUS_RETIRED = "retired"
TEMPLATE_STATUSES = (STATUS_DRAFT, STATUS_PUBLISHED, STATUS_RETIRED)

def is_published(status: str) -> bool:
    return status == STATUS_PUBLISHED
```

- [ ] **Step 3: Upload creates draft; list item includes status**

In `template_service.py` when constructing `Template(...)`, add `status="draft"`.

In `main.py` `_template_item`:

```python
"status": template.status,
```

- [ ] **Step 4: Commit**

```bash
git add services/document-service/alembic/versions/20260825_0006_template_status.py \
  services/document-service/app/models.py \
  services/document-service/app/import/template_service.py \
  services/document-service/app/main.py \
  services/document-service/app/templates/
git commit -m "feat(document): add template status column default draft"
```

---

### Task 2: DS — `generate_placeholder_data` + preview endpoint

**Files:**
- Create: `services/document-service/app/templates/placeholder_data.py`
- Create: `services/document-service/tests/test_placeholder_data.py`
- Modify: `services/document-service/app/main.py`
- Create: `services/document-service/tests/test_template_preview_http.py` (or extend `test_templates_http.py`)

**Interfaces:**
- Produces: `generate_placeholder_data(metadata: TemplateMetadata) -> tuple[dict, list[dict], dict[str, str]]`  
  Returns `(fields, rows, signatures)`.
- Produces: `GET /v1/templates/{id}/preview` → `application/pdf`

- [ ] **Step 1: Failing unit test for placeholder**

```python
from app.templates.placeholder_data import generate_placeholder_data
from app.render.signature_block import default_signature_block
# build minimal TemplateMetadata with 2 fields + 2 columns (reuse fixtures from test_pdf_renderer / demo_metadata)

def test_generate_placeholder_data_labels_fields_and_long_row():
    # metadata.fields = [FieldMeta(field_name="don_vi", ...), ...]
    # metadata.table.columns = [ColumnMeta(key="stt"), ColumnMeta(key="ten_hang"), ...]
    fields, rows, signatures = generate_placeholder_data(metadata)
    assert fields["don_vi"] == "don_vi (mẫu)"
    assert 20 <= len(rows) <= 30
    assert any(len(str(r.get("ten_hang", ""))) >= 80 for r in rows)
    assert signatures.get("nguoi_lap") == "(Tên người ký mẫu)"
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd services/document-service && python -m pytest tests/test_placeholder_data.py -v`  
Expected: import/collection failure or assert fail.

- [ ] **Step 3: Implement `generate_placeholder_data`**

```python
from app.render.signature_block import default_signature_block

PLACEHOLDER_ROW_COUNT = 25
LONG_TEXT = (
    "Hàng mẫu tên rất dài để kiểm tra wrap và shrink trên cột bảng chứng từ "
    "quyết toán — không được tràn ô, không được cắt mất nghĩa khi render PDF."
)

def generate_placeholder_data(metadata):
    fields = {f.field_name: f"{f.field_name} (mẫu)" for f in metadata.fields}
    col_keys = [c.key for c in metadata.table.columns]
    rows = []
    for i in range(PLACEHOLDER_ROW_COUNT):
        row = {}
        for key in col_keys:
            if key in ("stt", "so_tt"):
                row[key] = str(i + 1)
            elif "ten" in key or key in ("ten_hang", "ten_mat_hang"):
                row[key] = LONG_TEXT if i == 0 else f"Hàng mẫu {i + 1}"
            elif "so_luong" in key or key == "sl":
                row[key] = str((i + 1) * 1.5)
            else:
                row[key] = f"{key}-{i + 1}"
        rows.append(row)
    block = metadata.signature_block or default_signature_block()
    signatures = {}
    for slot in block.slots:
        if slot.source == "static" and slot.static_name:
            signatures[slot.key] = slot.static_name
        else:
            signatures[slot.key] = "(Tên người ký mẫu)"
    return fields, rows, signatures
```

- [ ] **Step 4: Preview route in `main.py`**

```python
@app.get("/v1/templates/{template_id}/preview")
async def preview_template(template_id: int, _: None = Depends(require_service_key)):
    try:
        with get_session() as session:
            metadata = load_metadata_from_db(session, template_id)
    except (SQLAlchemyError, RuntimeError):
        raise _database_unavailable()
    if metadata is None:
        raise HTTPException(status_code=404, detail=error_detail("NOT_FOUND", NOT_FOUND_MESSAGE))
    fields, rows, signatures = generate_placeholder_data(metadata)
    content = await run_in_threadpool(
        render_pdf, metadata=metadata, fields=fields, rows=rows, signatures=signatures
    )
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="preview-{template_id}.pdf"'},
    )
```

- [ ] **Step 5: HTTP test — upload fixture → GET preview → 200 + `%PDF`**

- [ ] **Step 6: Commit**

```bash
git add services/document-service/app/templates/placeholder_data.py \
  services/document-service/app/main.py \
  services/document-service/tests/test_placeholder_data.py \
  services/document-service/tests/test_template_preview_http.py
git commit -m "feat(document): template PDF preview with placeholder data"
```

---

### Task 3: DS — publish / retire + list `?status=`

**Files:**
- Modify: `services/document-service/app/templates/status.py`
- Modify: `services/document-service/app/main.py`
- Create: `services/document-service/tests/test_template_publish_http.py`

**Interfaces:**
- Produces: `publish_template(session, template) -> Template` raises ValueError with code semantics
- Produces: `POST /v1/templates/{id}/publish`, `POST /v1/templates/{id}/retire`
- Produces: `GET /v1/templates?status=draft`

- [ ] **Step 1: Failing HTTP tests**

```python
def test_publish_draft_then_second_publish_409(client, auth_headers, uploaded_draft_id):
    r1 = client.post(f"/v1/templates/{uploaded_draft_id}/publish", headers=auth_headers)
    assert r1.status_code == 200
    assert r1.json()["status"] == "published"
    r2 = client.post(f"/v1/templates/{uploaded_draft_id}/publish", headers=auth_headers)
    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "TEMPLATE_NOT_DRAFT"

def test_retire_published(client, auth_headers, published_id):
    r = client.post(f"/v1/templates/{published_id}/retire", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "retired"
```

- [ ] **Step 2: Implement helpers + routes**

```python
# status.py
def publish_template(template: Template) -> None:
    if template.status != STATUS_DRAFT:
        raise TemplateStatusError("TEMPLATE_NOT_DRAFT", "Chỉ mẫu nháp mới được publish")
    template.status = STATUS_PUBLISHED

def retire_template(template: Template) -> None:
    if template.status == STATUS_RETIRED:
        raise TemplateStatusError("TEMPLATE_ALREADY_RETIRED", "Mẫu đã ngừng dùng")
    if template.status not in (STATUS_DRAFT, STATUS_PUBLISHED):
        raise TemplateStatusError("TEMPLATE_STATUS_INVALID", "Không retire được trạng thái này")
    template.status = STATUS_RETIRED
```

Map `TemplateStatusError` → HTTP 409 in routes. List:

```python
status_filter = request.query_params.get("status")
q = select(Template).order_by(Template.id)
if status_filter:
    if status_filter not in TEMPLATE_STATUSES:
        raise HTTPException(400, detail=error_detail("BAD_REQUEST", "status không hợp lệ"))
    q = q.where(Template.status == status_filter)
```

(Use FastAPI `status: str | None = None` query param.)

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(document): publish and retire template status transitions"
```

---

### Task 4: DS — guard create-document + folder documents

**Files:**
- Modify: `services/document-service/app/main.py` (`create_document`)
- Modify: `services/document-service/app/folders/folder_service.py`
- Modify: `services/document-service/tests/test_templates_http.py` (or new)

**Interfaces:**
- Produces: before render, load `Template` row; if `status != published` → 409 `TEMPLATE_NOT_PUBLISHED`

- [ ] **Step 1: Failing test** — upload (draft) → POST documents → 409

- [ ] **Step 2: Helper**

```python
def require_published_template(session, template_id: int) -> Template:
    template = session.get(Template, template_id)
    if template is None:
        raise TemplateMetadataNotFoundError(...)  # or return None pattern matching callers
    if template.status != STATUS_PUBLISHED:
        raise TemplateNotPublishedError()
    return template
```

In `create_document`: after load metadata (or alongside), check status via `session.get(Template, template_id)`.

In `add_folder_document`: after `load_metadata_from_db`, also `session.get(Template, template_id)` and raise a typed error that `main.py` maps to 409.

- [ ] **Step 3: Tests PASS + Commit**

```bash
git commit -m "fix(document): block PDF render unless template published"
```

---

### Task 5: Node client — preview / publish / retire + 409

**Files:**
- Modify: `quanluong-app-be/src/services/document-service.client.js`

**Interfaces:**
- Produces: `previewTemplatePdf(templateId) -> Buffer`
- Produces: `publishTemplate(templateId) -> object`
- Produces: `retireTemplate(templateId) -> object`
- Change: `requestDocument` maps HTTP **409** → `AppError` status 409 (not 502)

- [ ] **Step 1: Update `requestDocument` error mapping**

```javascript
const isConflict = response.status === 409;
// ...
statusCode: isBadRequest ? 400 : isNotFound ? 404 : isConflict ? 409 : isAuthFailure ? ... : 502,
code: isConflict ? ERROR_CODES.CONFLICT : ...
```

(Use existing `ERROR_CODES.CONFLICT` if present; else add/reuse.)

- [ ] **Step 2: Add client methods**

```javascript
async function previewTemplatePdf(templateId) {
  const response = await requestDocument(`/v1/templates/${templateId}/preview`);
  return Buffer.from(await response.arrayBuffer());
}

async function publishTemplate(templateId) {
  const response = await requestDocument(`/v1/templates/${templateId}/publish`, {
    method: "POST",
  });
  return readJsonResponse(response);
}

async function retireTemplate(templateId) {
  const response = await requestDocument(`/v1/templates/${templateId}/retire`, {
    method: "POST",
  });
  return readJsonResponse(response);
}
```

Export them from the module.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(be): document-service client preview publish retire + 409"
```

---

### Task 6: Prisma — replace `isActive` with `status` + DS sync script

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma` (`ChungTuPdfTemplate`)
- Create: `quanluong-app-be/prisma/migrations/20260825120000_chung_tu_pdf_template_status/migration.sql`
- Create: `quanluong-app-be/scripts/sync-chung-tu-pdf-template-status-to-ds.mjs`

**Interfaces:**
- Produces: `status String @db.VarChar(20) @default("draft")`
- Produces: index `[categoryKey, status]`
- Drops: `isActive` on this model only

- [ ] **Step 1: Schema**

```prisma
model ChungTuPdfTemplate {
  // ...
  status                     String   @default("draft") @db.VarChar(20)
  // remove isActive
  @@index([categoryKey, status])
}
```

- [ ] **Step 2: SQL migration**

```sql
ALTER TABLE `ChungTuPdfTemplate` ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'draft';
UPDATE `ChungTuPdfTemplate` SET `status` = IF(`isActive` = true, 'published', 'retired');
DROP INDEX `ChungTuPdfTemplate_categoryKey_isActive_idx` ON `ChungTuPdfTemplate`;
ALTER TABLE `ChungTuPdfTemplate` DROP COLUMN `isActive`;
CREATE INDEX `ChungTuPdfTemplate_categoryKey_status_idx` ON `ChungTuPdfTemplate`(`categoryKey`, `status`);
```

- [ ] **Step 3: Sync script** — for each Prisma row with `status=retired`, call `retireTemplate(documentServiceTemplateId)`; ignore 409 if already retired. Document in script header: run after DS migration + Prisma migrate.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(be): ChungTuPdfTemplate status replaces isActive"
```

---

### Task 7: Node service — list/publish/retire/preview; export uses published

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export.service.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.js`
- Modify matching `*.test.js` mocks `isActive` → `status: "published"`

**Interfaces:**
- Produces: `listChungTuPdfTemplates({ categoryKey, includeNonPublished?: boolean })`  
  — default `where: { status: "published" }`; if `includeNonPublished` omit status filter
- Produces: `getChungTuPdfTemplateFields({ id, allowNonPublished?: boolean })` — reject if not published unless allowed
- Produces: `publishChungTuPdfTemplate({ id })` — DS publish then Prisma `status: published`
- Produces: `retireChungTuPdfTemplate({ id })` — DS retire then Prisma `status: retired` (replace deactivate)
- Produces: `previewChungTuPdfTemplate({ id })` → Buffer (any status if row exists)

- [ ] **Step 1: Rewrite failing tests** for list published-only, includeNonPublished, publish, retire

- [ ] **Step 2: Implement service** (create stays `status` default draft via Prisma)

```javascript
async function publishChungTuPdfTemplate({ id }) {
  const row = await prisma.chungTuPdfTemplate.findUnique({ where: { id: Number(id) } });
  if (!row) throw notFound();
  if (row.status !== "draft") {
    throw new AppError({ message: "Chỉ mẫu nháp mới publish được.", statusCode: 409, code: ERROR_CODES.CONFLICT });
  }
  await publishTemplate(row.documentServiceTemplateId);
  return prisma.chungTuPdfTemplate.update({
    where: { id: row.id },
    data: { status: "published" },
  });
}
```

Same pattern for retire (allow draft|published).

- [ ] **Step 3: Export services** — change `isActive: true` → `status: "published"`

- [ ] **Step 4: Tests PASS + Commit**

```bash
git commit -m "feat(chung-tu): PDF template publish retire preview service"
```

---

### Task 8: Node routes / controller / validator

**Files:**
- Modify: `chung-tu-quyet-toan.routes.js`
- Modify: `chung-tu-quyet-toan.controller.js`
- Modify: `chung-tu-quyet-toan.validator.js`
- Modify: `chung-tu-quyet-toan.route-definitions.js`

**Interfaces:**
- List query: replace `includeInactive` with `includeNonPublished` (boolean, SA-only applied in controller like before)
- `GET /pdf-templates/:id/preview` — `superadminMiddleware`, stream PDF
- `POST /pdf-templates/:id/publish` — superadmin
- `POST /pdf-templates/:id/retire` — superadmin (replace DELETE deactivate; keep DELETE as alias calling retire **or** remove DELETE and update FE only to POST retire — prefer **replace DELETE handler with retire** for fewer FE breakages during transition, or add POST and change FE; **plan: DELETE calls retire**, also expose POST `/retire` for clarity)

- [ ] **Step 1: Validator**

```javascript
includeNonPublished: z.union([z.boolean(), z.enum(["true","false","1","0"])]).optional()
  .transform((v) => v === true || v === "true" || v === "1"),
```

- [ ] **Step 2: Controllers**

```javascript
async function previewChungTuPdfTemplateController(req, res) {
  const buf = await previewChungTuPdfTemplate({ id: req.validatedParams.id });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="preview-${req.validatedParams.id}.pdf"`);
  return res.send(buf);
}
```

- [ ] **Step 3: Routes + definitions descriptions** — Superadmin-only for publish/retire/preview

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(chung-tu): PDF template lifecycle HTTP routes"
```

---

### Task 9: FE API layer

**Files:**
- Modify: `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuPdfApi.js`
- Modify: `packages/shared/src/app/query/queryKeys.js` if needed (`pdfTemplates(key, "all"|"published")`)

**Interfaces:**
- `useChungTuPdfTemplatesQuery(categoryKey, { includeNonPublished?: boolean })` — maps old `includeInactive`
- `previewChungTuPdfTemplate(id)` — blob download + `window.open`
- `usePublishChungTuPdfTemplateMutation`, `useRetireChungTuPdfTemplateMutation`
- Remove or alias `useDeactivateChungTuPdfTemplateMutation` → retire

- [ ] **Step 1: Implement**

```javascript
export async function openChungTuPdfTemplatePreview(templateId) {
  const { data: blob } = await apiRequest({
    url: `/chungtuquyettoan/pdf-templates/${encodeURIComponent(templateId)}/preview`,
    method: "get",
    responseType: "blob",
    returnHeaders: true,
  });
  const pdfBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(pdfBlob);
  const w = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!w) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Trình duyệt chặn cửa sổ mới.");
  }
  setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(chung-tu): FE API for template preview publish retire"
```

---

### Task 10: Superadmin UI — badges + preview / publish / retire

**Files:**
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx`

**Interfaces:**
- Consumes: Task 9 hooks; list with `includeNonPublished: true`

- [ ] **Step 1: Replace isActive badge with status**

| status | Badge VI |
|--------|----------|
| draft | Nháp |
| published | Đã duyệt |
| retired | Đã ngừng |

- [ ] **Step 2: Actions column**

- Mọi row: nút **Xem trước** → `openChungTuPdfTemplatePreview(id)`
- `draft`: **Xuất bản** (confirm) → publish mutation
- `draft` hoặc `published`: **Ngừng dùng** → retire mutation (confirm)
- Remove deactivate/`isActive` paths

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(superadmin): draft preview publish retire for PDF templates"
```

---

### Task 11: Unit export list — published only + smoke

**Files:**
- Verify: `ChungTuExportWorkspace.jsx` uses `useChungTuPdfTemplatesQuery` **without** `includeNonPublished`
- Fix any remaining `isActive` / `includeInactive` references under chung-tu PDF paths

- [ ] **Step 1: Grep**

```bash
rg -n "includeInactive|isActive" packages/shared/src/pages/chungTuQuyetToan packages/shared/src/features/chung-tu-quyet-toan quanluong-app-be/src/modules/chung-tu-quyet-toan --glob '*pdf*'
```

Fix leftovers.

- [ ] **Step 2: Dev smoke checklist**

1. Migrate DS + Prisma; run sync script for retired.
2. Rebuild `document` + `app` (+ superadmin hot reload).
3. Superadmin: upload → status Nháp → Xem trước opens PDF → Xuất bản → Đã duyệt.
4. Unit app: picker shows only published.
5. Export with published works; attempt render draft at DS → 409.
6. Retire → unit no longer lists it; preview still works for SA.

- [ ] **Step 3: Commit** any leftover fixes

```bash
git commit -m "chore(chung-tu): align export UI with published-only templates"
```

---

## Plan self-review

| Spec requirement | Task |
|------------------|------|
| DS `status` + default draft upload | 1 |
| Preview + placeholder | 2 |
| Publish / retire / list filter | 3 |
| Guard documents + folders | 4 |
| Node client | 5 |
| Prisma replace isActive + hybrid migrate + DS sync | 6 |
| Node service lifecycle | 7 |
| HTTP routes | 8 |
| FE API | 9 |
| Superadmin UI | 10 |
| Unit published-only + smoke | 11 |
| field_sources / skeleton / unpublish / embed | Explicitly out of scope |

No TBD placeholders in task steps.
