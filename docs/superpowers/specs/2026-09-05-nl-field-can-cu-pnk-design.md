# Design Spec: NL_FIELD_can_cu_pnk — fixed căn cứ text

**Date:** 2026-09-05  
**Status:** Draft for review  
**Feature:** Named Range không-nhãn `NL_FIELD_can_cu_pnk`; câu căn cứ PNK hardcode trong code; nhiều căn cứ nối bằng dấu phẩy

---

## 1. Problem

- `canCuBkmh` / `FIELD_can_cu_bkmh` format cũ (`Theo BKMH số: …`, nối `; `) không đúng câu nghiệp vụ.
- Field kiểu này **không** nên chỉnh nhãn trên Superadmin — phải setup sẵn trong code.
- Document-service chỉ import `FIELD_*` → cần prefix riêng cho field format cố định.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Named Range chuẩn: **`NL_FIELD_can_cu_pnk`** |
| 2 | **Không** còn nhận `FIELD_can_cu_bkmh` / `canCuBkmh` / legacy Drive tên cũ (mẫu Excel phải đổi) |
| 3 | `field_name` = `can_cu_pnk` → context/export key **`canCuPnk`** (thay `canCuBkmh` trên path PNK) |
| 4 | Một căn cứ: `Căn cứ vào BKMH số {so} ngày {dd} tháng {mm} năm {yyyy} của đ/c {buyerName}` (không ngoặc kép quanh tên) |
| 5 | Thiếu ngày hợp lệ: `Căn cứ vào BKMH số {so} của đ/c {buyerName}` |
| 6 | `so` trống → `—`; `buyerName` trống → `—` |
| 7 | Nhiều căn cứ (sau dedup): nối bằng **`, `** → `A, B, C` (không dùng `; ` hay ` và `) |
| 8 | `NL_FIELD_*`: document-service import như scalar; **không** hiện form nhãn Superadmin |
| 9 | `FIELD_*`: vẫn labelable theo flow mẫu (spec field-labels-from-excel) |
| 10 | Catalog: namedRange `NL_FIELD_can_cu_pnk`, `supportsLabel: false` (hoặc tương đương) |
| 11 | **Tách module:** code `NL_FIELD_*` (format cố định) một file; code `FIELD_*` (hỗ trợ nhãn) một file — dùng chung nhiều nơi, không nhét vào service dài |

---

## 2.1 Module layout (dùng chung)

Mục tiêu: thêm `NL_FIELD_*` mới sau này chỉ sửa file NL; thêm field labelable chỉ sửa file FIELD.

### Backend (Node) — `quanluong-app-be/.../chung-tu-quyet-toan/`

| File | Trách nhiệm |
|------|-------------|
| `chung-tu-nl-field.js` | Prefix `NL_FIELD_`; parse/strip; catalog entries NL; **formatters cố định** (vd. `formatCanCuPnkLine` / `formatCanCuPnkText`); `isNlFieldNamedRange(name)`; resolve key NL (`can_cu_pnk` → `canCuPnk`) |
| `chung-tu-label-field.js` | Prefix `FIELD_`; parse/strip; `isLabelFieldNamedRange(name)`; `formatDerivedNamedRangeValue` (label + value); alias/resolve labelable scalars nếu tách khỏi column-alias (hoặc re-export mỏng từ đây) |
| `chung-tu-named-range-prefix.js` *(optional nhỏ)* | Hằng `FIELD_` / `NL_FIELD_`; `splitNamedRangePrefix(name) → { prefix, fieldName }` — chỉ nếu hai file trên cần tránh trùng 5 dòng parse |

Callers (`data-resolver`, `pdf-map`, `template labels`, catalog GET) **import** từ hai file trên, không copy câu format.

### Frontend (shared)

| File | Trách nhiệm |
|------|-------------|
| `packages/shared/.../chungTuNlField.js` | `isNlFieldNamedRange`, strip `NL_FIELD_`, (optional) mirror resolve `canCuPnk` nếu FE cần |
| `packages/shared/.../chungTuLabelField.js` | `isLabelFieldNamedRange`, strip `FIELD_`, `resolvePdfScalarFieldKey` (chuyển từ `chungTuPdfScalarFieldKey.js` hoặc re-export) |

Superadmin form nhãn: chỉ giữ named range thỏa `isLabelFieldNamedRange`.

### Document-service (Python)

| File | Trách nhiệm |
|------|-------------|
| `app/import/field_named_ranges.py` *(hoặc tương đương)* | Hằng prefix; `iter_field_defined_names`; phân loại `labelable` vs `nl`; `_build_fields` gọi module này |

Không bắt buộc mirror toàn bộ formatter Node sang Python — Python chỉ import geometry/metadata.

### Quy ước

- Một ô Excel: đúng **một** prefix (`FIELD_` hoặc `NL_FIELD_`), không chồng.
- Thêm NL field mới: thêm formatter + catalog row trong `chung-tu-nl-field.js` (+ test file cạnh).
- Thêm FIELD labelable: catalog + alias trong nhánh label-field / catalog hiện có.

---

## 3. Document-service

### 3.1 Import

Trong `_build_fields` (và skip coords cho cả `FIELD_` / `NL_FIELD_` trong static_cells):

- Nhận tên bắt đầu bằng `FIELD_` **hoặc** `NL_FIELD_`.
- `field_name` = phần sau prefix (`can_cu_pnk` cho `NL_FIELD_can_cu_pnk`).
- Validate `field_name` snake như hiện tại.
- Metadata có thể gắn `labelable: false` khi prefix `NL_FIELD_` (optional; BE/FE cũng có thể suy từ tên `NL_FIELD_` / catalog).

### 3.2 Ops

Rebuild document image sau merge. Re-upload / re-publish mẫu PNK dùng `NL_FIELD_can_cu_pnk`.

---

## 4. Backend (Node)

### 4.1 Format (single source — trong `chung-tu-nl-field.js`)

Gộp / thay `formatCanCuBkmhLine*` thành:

```text
line = Căn cứ vào BKMH số {so} [ngày {dd} tháng {mm} năm {yyyy} ]của đ/c {buyerName}
text = unique lines join ", "
```

Nguồn: `soChungTu`, `periodDate` → dd/mm/yyyy, `buyerName` (không dùng `buyerSignatureName`).

### 4.2 Resolve / map

- Resolve NL trong `chung-tu-nl-field.js`: `NL_FIELD_can_cu_pnk` / `can_cu_pnk` → `canCuPnk`.
- Strip prefix: `splitNamedRangePrefix` (hoặc tương đương) hỗ trợ `FIELD_` và `NL_FIELD_`.
- Context PNK: đổi property `canCuBkmh` → **`canCuPnk`**.
- Xóa alias `can_cu_bkmh` / `cancubkmh` → `canCuBkmh`.

### 4.3 Catalog

- Entry NL sống trong `chung-tu-nl-field.js` (hoặc catalog import từ đó).
- namedRange `NL_FIELD_can_cu_pnk` / `canCuPnk`, `supportsLabel: false`.

### 4.4 Superadmin labels

- Chỉ named range `FIELD_*` (`isLabelFieldNamedRange`) — dùng `chungTuLabelField.js`.
- `NL_FIELD_*` loại khỏi form nhãn.

---

## 5. Tests

1. Format 1 dòng đủ ngày + buyerName.
2. Format thiếu ngày; thiếu so/tên → `—`.
3. 3 căn cứ dedup → `A, B, C`.
4. Importer: `NL_FIELD_can_cu_pnk` → field `can_cu_pnk`; không lỗi.
5. Resolve `NL_FIELD_can_cu_pnk` → `canCuPnk`; `FIELD_can_cu_bkmh` **không** còn map (hoặc không resolve đúng key mới).
6. PNK sheetContext có `canCuPnk` đúng câu mới.
7. Superadmin: `NL_FIELD_*` không vào list nhãn (source/unit assert nếu có).

---

## 6. Out of scope

- Đổi format các field fixed khác (chỉ căn cứ PNK lần này; convention `NL_FIELD_` sẵn cho sau).
- Google Sheets Drive named ranges.
- Giữ tương thích mẫu Excel cũ `FIELD_can_cu_bkmh`.

---

## 7. Acceptance

1. Mẫu PNK ô `NL_FIELD_can_cu_pnk` → PDF hiện đúng câu `Căn cứ vào BKMH số … của đ/c …`.
2. Nhiều BKMH → một chuỗi `A, B, C`.
3. Form Superadmin nhãn **không** hiện field này.
4. Mẫu vẫn dùng `FIELD_can_cu_bkmh` → không còn fill căn cứ (cần đổi Named Range).
5. `docker compose build document && docker compose up -d document` sau deploy.
