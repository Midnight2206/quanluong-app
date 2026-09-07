# Template Field Labels from Excel FIELD_* Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmin form nhãn field chỉ liệt kê scalar `FIELD_*` có trên mẫu Excel đang chọn; mọi field đó đều lưu được nhãn (bỏ gate `supportsLabel`).

**Architecture:** Backend `normalizeFieldLabels` chấp nhận mọi key string (không whitelist catalog). Frontend build list từ `GET template fields` scalarFields, resolve key bằng helper mirror `resolveScalarFieldKey`, prune khi save. Catalog chỉ enrich mô tả.

**Tech Stack:** Node ESM + `node:test`, React (`packages/shared`)

**Spec:** `docs/superpowers/specs/2026-09-05-template-field-labels-from-excel-fields-design.md`

## Global Constraints

- List form nhãn = scalar fields trên mẫu (document-service), không full catalog
- Mọi `FIELD_*` scalar trên mẫu đều sửa nhãn được
- Bỏ gate `supportsLabel` trên UI list và `normalizeFieldLabels`
- Key lưu = `resolveScalarFieldKey(field_name)` (camelCase / alias như export)
- Save prune: chỉ keys đang hiện trên mẫu
- Tab tra cứu catalog không đổi
- No new dependencies

---

## File Map

| File | Role |
|------|------|
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.js` | Bỏ `LABELABLE_FIELD_KEYS` filter |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js` | Expect keep non-supportsLabel keys |
| `packages/shared/src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.js` | Mirror `resolveScalarFieldKey` for FE |
| `packages/shared/src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.test.js` | Alias tests (`so` → `soChungTu`) |
| `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx` | List từ template scalars + prune save |
| `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.test.js` | Source asserts |

---

### Task 1: Backend accept any fieldLabels keys

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js`

**Interfaces:**
- Produces: `normalizeFieldLabels` keeps any string key (no catalog whitelist)

- [ ] **Step 1: Update failing expectation**

In `chung-tu-pdf-template.service.test.js`, change test `updateChungTuPdfTemplateFieldLabels keeps only supported label keys` to:

```js
test("updateChungTuPdfTemplateFieldLabels keeps non-catalog keys and coerces values", async () => {
  const row = {
    id: 23,
    status: "published",
    categoryKey: "phieu-nhap-kho",
    documentServiceTemplateId: 77,
  };
  const updated = {
    ...row,
    fieldLabelsJson: {
      soChungTu: "Số: ",
      donVi: "Đơn vị: ",
      ghiChu: "Ghi chú: ",
      unknownKey: "Giữ",
    },
  };
  prismaFindUnique.mock.mockImplementation(async () => row);
  prismaUpdate.mock.mockImplementation(async () => updated);

  const result = await updateChungTuPdfTemplateFieldLabels({
    id: "23",
    fieldLabels: {
      soChungTu: "Số: ",
      donVi: "Đơn vị: ",
      ghiChu: "Ghi chú: ",
      unknownKey: "Giữ",
      bad: 12,
    },
  });

  assert.deepEqual(prismaUpdate.mock.calls[0].arguments[0], {
    where: { id: 23 },
    data: {
      fieldLabelsJson: {
        soChungTu: "Số: ",
        donVi: "Đơn vị: ",
        ghiChu: "Ghi chú: ",
        unknownKey: "Giữ",
        bad: "12",
      },
    },
  });
  assert.deepEqual(result.fieldLabels, {
    soChungTu: "Số: ",
    donVi: "Đơn vị: ",
    ghiChu: "Ghi chú: ",
    unknownKey: "Giữ",
  });
});
```

(Adjust `result.fieldLabels` expectation to match whatever `mapChungTuPdfTemplate` returns after normalize — if `bad` is included from `updated` mock, either put `bad` on `updated.fieldLabelsJson` or assert only keys from mock.)

Simpler expected normalize behavior for the update `data` call:

```js
fieldLabelsJson: {
  soChungTu: "Số: ",
  donVi: "Đơn vị: ",
  ghiChu: "Ghi chú: ",
  unknownKey: "Giữ",
  bad: "12",
},
```

And set `updated.fieldLabelsJson` to the same object so `result.fieldLabels` matches.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js
```

Expected: FAIL — `donVi` / `ghiChu` stripped by `LABELABLE_FIELD_KEYS`.

- [ ] **Step 3: Implement**

In `chung-tu-pdf-template.service.js`:

1. Remove `LABELABLE_FIELD_KEYS` and the `CHUNG_TU_PDF_FIELD_CATALOG` import if unused.
2. Replace `normalizeFieldLabels`:

```js
function normalizeFieldLabels(fieldLabels) {
  if (!fieldLabels || typeof fieldLabels !== "object" || Array.isArray(fieldLabels)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(fieldLabels).map(([key, value]) => [
      String(key),
      typeof value === "string" ? value : String(value ?? ""),
    ]),
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js
```

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js
git commit -m "$(cat <<'EOF'
fix(chung-tu): allow any PDF template fieldLabels keys

EOF
)"
```

---

### Task 2: FE list labels from template FIELD_* + prune save

**Files:**
- Create: `packages/shared/src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.js`
- Create: `packages/shared/src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.test.js`
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx`
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.test.js`

**Interfaces:**
- Consumes: Task 1 backend (any keys accepted)
- Produces: `resolvePdfScalarFieldKey(templateFieldKey, { categoryKey }?)` → string
- Produces: UI `templateLabelFields` from `templateSchema.scalarFields`

- [ ] **Step 1: Failing FE key + source tests**

`chungTuPdfScalarFieldKey.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { resolvePdfScalarFieldKey } from "./chungTuPdfScalarFieldKey.js";

test("resolvePdfScalarFieldKey maps so aliases and snake_case", () => {
  assert.equal(resolvePdfScalarFieldKey("so"), "soChungTu");
  assert.equal(resolvePdfScalarFieldKey("FIELD_so"), "soChungTu");
  assert.equal(resolvePdfScalarFieldKey("don_vi"), "donVi");
  assert.equal(resolvePdfScalarFieldKey("FIELD_don_vi"), "donVi");
});
```

Update `SuperadminChungTuPdfCategoryTemplates.test.js`:

```js
test("superadmin PDF templates screen saves per-template field labels", () => {
  assert.match(apiSource, /useUpdateChungTuPdfTemplateFieldLabelsMutation/);
  assert.match(
    apiSource,
    /\/chungtuquyettoan\/pdf-templates\/\$\{encodeURIComponent\(templateId\)\}\/field-labels/,
  );
  assert.match(superadminTemplatesSource, /Nhãn field/);
  assert.match(superadminTemplatesSource, /templateLabelFields/);
  assert.match(superadminTemplatesSource, /resolvePdfScalarFieldKey/);
  assert.match(superadminTemplatesSource, /Lưu nhãn field/);
  assert.match(superadminTemplatesSource, /Mẫu không có Named Range FIELD_/);
  assert.match(superadminTemplatesSource, /Mẫu đã ngừng dùng chỉ xem được nhãn đã lưu/);
  assert.doesNotMatch(superadminTemplatesSource, /supportsLabel/);
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd packages/shared && node --test \
  src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.test.js \
  src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.test.js
```

Expected: FAIL — missing module / still `labelableFields` + `supportsLabel`.

- [ ] **Step 3: Implement helper**

Create `chungTuPdfScalarFieldKey.js` mirroring BE `resolveScalarFieldKey` (scalar aliases only):

```js
const STATIC_ALIASES = Object.freeze({
  tong_tien_bang_chu: "tongTienBangChu",
  ngay_thang_nam: "ngayThangNam",
  ho_ten_nguoi_mua: "hoTenNguoiMua",
  nguoi_mua: "hoTenNguoiMua",
  can_cu_bkmh: "canCuBkmh",
});

const SCALAR_ALIASES = Object.freeze({
  so: "soChungTu",
  so_phieu: "soChungTu",
  soPhieu: "soChungTu",
});

function snakeToCamel(key) {
  return String(key ?? "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(key) {
  return String(key ?? "").replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Mirror BE resolveScalarFieldKey for PDF template label keys. */
export function resolvePdfScalarFieldKey(templateFieldKey, { categoryKey } = {}) {
  const raw = String(templateFieldKey ?? "").trim();
  const key = raw.startsWith("FIELD_") ? raw.slice("FIELD_".length) : raw;
  if (!key) return "";
  if (
    String(categoryKey ?? "").trim() === "phieu-nhap-kho" &&
    (key === "dia_chi" || key === "diaChi")
  ) {
    return "diaChi";
  }
  if (SCALAR_ALIASES[key]) return SCALAR_ALIASES[key];
  if (STATIC_ALIASES[key]) return STATIC_ALIASES[key];
  if (camelToSnake(key) === key) return snakeToCamel(key);
  return key;
}
```

- [ ] **Step 4: Implement UI**

In `SuperadminChungTuPdfCategoryTemplates.jsx`:

1. Import `resolvePdfScalarFieldKey`.
2. Replace `labelableFields` useMemo with:

```js
const catalogByFieldKey = useMemo(() => {
  const map = new Map();
  for (const field of fieldCatalog?.scalarFields ?? []) {
    if (field?.fieldKey) map.set(String(field.fieldKey), field);
  }
  return map;
}, [fieldCatalog]);

const templateLabelFields = useMemo(() => {
  const seen = new Set();
  const rows = [];
  for (const field of templateSchema.scalarFields) {
    const rawName = String(field.field_name ?? field.key ?? "").trim();
    if (!rawName) continue;
    const fieldKey = resolvePdfScalarFieldKey(rawName, { categoryKey });
    if (!fieldKey || seen.has(fieldKey)) continue;
    seen.add(fieldKey);
    const catalog = catalogByFieldKey.get(fieldKey);
    rows.push({
      fieldKey,
      namedRange: catalog?.namedRange ?? (rawName.startsWith("FIELD_") ? rawName : `FIELD_${rawName}`),
      description: catalog?.description ?? catalog?.label ?? rawName,
    });
  }
  return rows;
}, [catalogByFieldKey, categoryKey, templateSchema.scalarFields]);
```

3. Wire draft / dirty / render / empty copy to `templateLabelFields` (empty: `Mẫu không có Named Range FIELD_*`).
4. `handleSaveFieldLabels`: build payload **only** from `templateLabelFields` keys (prune):

```js
const fieldLabels = Object.fromEntries(
  templateLabelFields.map((field) => [field.fieldKey, fieldLabelsDraft[field.fieldKey] ?? ""]),
);
await updateFieldLabels({ id: selectedTemplate.id, fieldLabels }).unwrap();
```

5. Remove any `supportsLabel` filter usage from this file.

- [ ] **Step 5: Run — expect PASS**

```bash
cd packages/shared && node --test \
  src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.test.js \
  src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.test.js
```

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.js \
  packages/shared/src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.test.js \
  packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx \
  packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.test.js
git commit -m "$(cat <<'EOF'
fix(chung-tu): scope PDF field labels to template FIELD_*

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| List from template scalars | T2 |
| All template FIELD_* editable | T1 + T2 |
| Drop supportsLabel gate | T1 + T2 |
| resolveScalarFieldKey keys | T2 |
| Catalog enrich only | T2 |
| Save prune | T2 |
| Tra cứu unchanged | (no task — out of change) |
| normalize accepts non-labelable | T1 |

## Ops

None (BE + FE only; no document-service rebuild).
