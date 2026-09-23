# Design Spec: Catalog Named Range Tab + FIELD_can_cu_bkmh

**Date:** 2026-09-04  
**Status:** Draft for review  
**Feature:** Named range chuẩn cho căn cứ PNK; tách catalog field keys thành tab tra cứu (user + admin)

---

## 1. Problem

- PNK đã có `canCuBkmh` trong context xuất PDF, nhưng catalog PDF **không liệt kê** named range → khó đặt vị trí trên mẫu Excel.
- Catalog Named Range đang nhét trong `<details>` trên màn Xuất / upload mẫu → khó tìm; cần **tab tra cứu riêng**.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Named range chuẩn: `FIELD_can_cu_bkmh` → `fieldKey` `canCuBkmh` |
| 2 | Vẫn nhận legacy tên `canCuBkmh` (Drive / mẫu cũ) |
| 3 | User: tab ngang cấp loại CT trên trang Chứng từ quyết toán |
| 4 | Admin: tab ngang cấp loại CT trong khu tải template chứng từ |
| 5 | Gỡ hẳn khối `<details>` catalog trên màn Xuất và trang upload mẫu |
| 6 | Một component UI dùng chung; API catalog hiện có (chỉ thêm 1 scalar) |
| 7 | Không filter catalog theo category trong phạm vi này |

---

## 3. Backend — căn cứ + catalog

### 3.1 Catalog

Trong `chung-tu-pdf-field-catalog.js`, thêm scalar:

- `namedRange`: `FIELD_can_cu_bkmh`
- `fieldKey`: `canCuBkmh`
- `label`: mô tả căn cứ theo BKMH (số, ngày…); hint ngắn: chủ yếu PNK; legacy `canCuBkmh` vẫn được nhận

### 3.2 Resolve

- `resolveScalarFieldKey`: alias `can_cu_bkmh` → `canCuBkmh` (sau khi strip `FIELD_`).
- Legacy Drive: giữ mapping `cancubkmh` → `canCuBkmh` trong `chung-tu-named-range-display.js` (đã có).
- Nguồn text: không đổi — `canCuBkmh` từ resolver PNK / slices như hiện tại.
- Named range thiếu trên mẫu = không vẽ field (giống scalar khác); không bắt buộc.

### 3.3 Tests

- Unit: `resolveScalarFieldKey("FIELD_can_cu_bkmh")` / `"can_cu_bkmh"` → `canCuBkmh`.
- Catalog GET chứa `FIELD_can_cu_bkmh` (nếu đã có assert catalog).

---

## 4. Frontend — tab tra cứu

### 4.1 Shared panel

Component mới (vd. `ChungTuPdfFieldCatalogPanel`):

- `useChungTuPdfFieldCatalogQuery`
- Hint: `FIELD_*`, `TABLE_HEADER` / `TABLE_DATA_ROW`
- Hai khối: scalar (mono namedRange + fieldKey · label) và gợi ý cột bảng
- Read-only; không bắt buộc nút copy

### 4.2 User — `ChungTuQuyetToanPage`

- Thêm tab id `field-catalog`, label **Tra cứu field** (hoặc tương đương ngắn), ngang cấp BKMH/PNK/…
- Panel = shared component (không dùng `ChungTuCategoryWorkspace`)
- Gỡ `<details>` catalog khỏi `ChungTuExportWorkspace`

### 4.3 Admin — `SuperadminChungTuPdfTemplatesPanel`

- Thêm tab cùng id/label ngang cấp các category template
- Panel = cùng shared component
- Gỡ `<details>` khỏi `SuperadminChungTuPdfCategoryTemplates`
- Upload / publish / fields của từng mẫu giữ trên tab loại CT

---

## 5. Out of scope

- Catalog động theo từng file mẫu đã upload
- Filter field theo category
- Đổi format text căn cứ / bổ sung tên người mua vào `canCuBkmh`
- Nút copy clipboard (có thể thêm sau nếu cần)

---

## 6. Acceptance

1. Mẫu PNK đặt Named Range `FIELD_can_cu_bkmh` → PDF hiện đúng text căn cứ khi xuất.
2. Legacy `canCuBkmh` vẫn map được.
3. User thấy tab tra cứu trên Chứng từ quyết toán; admin thấy tab tương tự trong tải template.
4. Không còn khối catalog gập trên màn Xuất / upload mẫu.
5. Catalog API trả `FIELD_can_cu_bkmh`.
