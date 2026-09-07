# Design Spec: Field labels scoped to Excel `FIELD_*` on template

**Date:** 2026-09-05  
**Status:** Draft for review  
**Feature:** Superadmin form nhãn field chỉ lấy Named Range `FIELD_*` thật trên mẫu Excel; mọi field đó đều sửa được nhãn (không còn gate `supportsLabel`)

---

## 1. Problem

- Form **Nhãn field** (Superadmin PDF template) hiện lấy **toàn bộ** scalar catalog có `supportsLabel: true` → rối, hiện cả field không có trên mẫu đang chọn.
- Backend `normalizeFieldLabels` cũng **chỉ giữ** key trong `LABELABLE_FIELD_KEYS` → admin không lưu được nhãn cho `FIELD_*` có trên Excel nếu catalog chưa đánh `supportsLabel`.

Mong muốn: đọc mẫu Excel → lấy các `FIELD_*` trên mẫu đó → admin sửa nhãn đúng tập đó.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Nguồn list form nhãn = scalar fields từ schema mẫu (document-service `GET …/fields`), không phải full catalog |
| 2 | Mọi `FIELD_*` (scalar) có trên mẫu đều cho sửa nhãn |
| 3 | Bỏ gate `supportsLabel` trên UI form nhãn và trên `normalizeFieldLabels` khi save |
| 4 | Key lưu trong `fieldLabelsJson` = `resolveScalarFieldKey(field_name)` (camelCase / alias như export) |
| 5 | Catalog vẫn dùng để enrich mô tả / namedRange hiển thị khi khớp; tab **Tra cứu** không đổi (full catalog + search) |
| 6 | Khi save từ UI: chỉ gửi keys đang hiện (theo mẫu); **prune** key cũ không còn trên mẫu khỏi payload lưu |
| 7 | `supportsLabel` trong catalog: giữ field (không bắt buộc xóa) nhưng **không** quyết định list/API labels nữa; có thể dùng làm hint UI catalog sau này |

---

## 3. Data flow

```text
Select template
  → GET template fields (document-service via BE)
  → scalarFields[]  (field_name, cell_ref, …)
  → for each: fieldKey = resolveScalarFieldKey(field_name)
  → optional catalog lookup by fieldKey / FIELD_* for description
  → render one label input per unique fieldKey
  → PUT fieldLabels = { [fieldKey]: string }  // only those keys
```

Export path không đổi: `pickMappedFields` / `formatDerivedNamedRangeValue(..., { label })` đọc `fieldLabelsJson` theo `fieldKey` đã resolve.

---

## 4. Backend

**File:** `chung-tu-pdf-template.service.js`

- `normalizeFieldLabels(fieldLabels)`:
  - Vẫn: object → string values, trim, drop empty optional behavior giữ như hiện tại (hoặc keep empty string if UI sends clear — **keep empty string as “no label”**, strip non-string).
  - **Bỏ** filter `LABELABLE_FIELD_KEYS.has(key)`.
  - Có thể bỏ hẳn constant `LABELABLE_FIELD_KEYS` nếu không còn chỗ dùng.
- Validator: giữ `z.record(z.string().max(120))` — không thêm whitelist catalog.
- Không bắt buộc validate key ∈ template fields trên server (YAGNI; UI prune đủ). Server tin payload sau auth Superadmin.

---

## 5. Frontend

**File:** `SuperadminChungTuPdfCategoryTemplates.jsx`

- `labelableFields` (đổi tên nếu cần → `templateLabelFields`):
  - Build từ `templateSchema.scalarFields`, không từ `fieldCatalog.filter(supportsLabel)`.
  - Dedupe theo `fieldKey`.
  - Hiển thị: `FIELD_*` / `field_name` + mô tả catalog nếu có.
- Empty state: mẫu không có scalar `FIELD_*` → “Mẫu không có Named Range FIELD_*”.
- Không phụ thuộc `useChungTuPdfFieldCatalogQuery` cho **list** (vẫn có thể dùng catalog map để enrich description).

Phần “Scalar fields” / “Cột bảng” bên dưới giữ nguyên (đã là schema mẫu).

---

## 6. Tests

1. `normalizeFieldLabels` chấp nhận key không có trong catalog / không `supportsLabel` (vd. `donVi`, `ghiChu`).
2. UI unit/source assert (nếu đã có pattern): list nhãn derive từ template fields, không từ full catalog `supportsLabel`.
3. Regression: export vẫn prefix khi `fieldLabelsJson` có key khớp.

---

## 7. Out of scope

- Đổi Google Sheets `listSpreadsheetNamedRanges` (Drive template fill).
- Đổi document-service import rules cho `FIELD_*`.
- Bắt buộc rename/remove `supportsLabel` khỏi catalog JSON API.
- Validate server-side keys against live template fields.

---

## 8. Acceptance

1. Mẫu chỉ có `FIELD_so` + `FIELD_don_vi` → form nhãn đúng **2** ô (không hiện đủ catalog labelable).
2. Lưu nhãn cho `donVi` thành công dù catalog `supportsLabel: false`.
3. Save prune: label cũ cho field đã xóa khỏi Excel không còn trong JSON sau lần lưu mới.
4. Tab tra cứu catalog vẫn full; không regress export khi có label.
