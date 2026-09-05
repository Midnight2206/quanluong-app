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

---

## 3. Document-service

### 3.1 Import

Trong `_build_fields` (và skip coords `FIELD_` trong static_cells):

- Nhận tên bắt đầu bằng `FIELD_` **hoặc** `NL_FIELD_`.
- `field_name` = phần sau prefix (`can_cu_pnk` cho `NL_FIELD_can_cu_pnk`).
- Validate `field_name` snake như hiện tại.
- Metadata có thể gắn `labelable: false` khi prefix `NL_FIELD_` (optional; BE/FE cũng có thể suy từ tên `NL_FIELD_` / catalog).

### 3.2 Ops

Rebuild document image sau merge. Re-upload / re-publish mẫu PNK dùng `NL_FIELD_can_cu_pnk`.

---

## 4. Backend (Node)

### 4.1 Format (single source)

Gộp / thay `formatCanCuBkmhLine*` thành helper mới (vd. `formatCanCuPnkLine` / `formatCanCuPnkText`):

```text
line = Căn cứ vào BKMH số {so} [ngày {dd} tháng {mm} năm {yyyy} ]của đ/c {buyerName}
text = unique lines join ", "
```

Nguồn: `soChungTu`, `periodDate` → dd/mm/yyyy, `buyerName` (không dùng `buyerSignatureName`).

### 4.2 Resolve / map

- `resolveScalarFieldKey`: `NL_FIELD_can_cu_pnk` / `can_cu_pnk` → `canCuPnk`.
- Strip prefix: hỗ trợ cả `FIELD_` và `NL_FIELD_` trước alias.
- Context PNK: đổi property `canCuBkmh` → **`canCuPnk`** (export map, tests, derived named ranges).
- Xóa alias `can_cu_bkmh` / `cancubkmh` → `canCuBkmh` (breaking theo decision 2).

### 4.3 Catalog

- Thay entry `FIELD_can_cu_bkmh` bằng `NL_FIELD_can_cu_pnk` / `canCuPnk`.
- `supportsLabel: false`.
- Mô tả: câu hardcode căn cứ BKMH cho PNK.

### 4.4 Superadmin labels

- Form nhãn: chỉ scalar từ mẫu có prefix `FIELD_` (hoặc không phải `NL_FIELD_`).  
  Cách đơn giản: nếu `field_name` đến từ `NL_FIELD_*` (metadata / tên raw) thì bỏ khỏi `templateLabelFields`; hoặc skip keys trong set `fixedFormat` / catalog `supportsLabel: false` **chỉ khi** đã biết là NL — **ưu tiên:** document-service trả `field_name` + optional `named_range` / `prefix`; FE bỏ nếu `named_range` starts with `NL_FIELD_` hoặc catalog `supportsLabel === false` **không** đủ một mình (mọi field supportsLabel false trên mẫu FIELD_ vẫn cho label theo spec trước).  
  **Locked:** loại khỏi form nhãn khi Named Range gốc bắt đầu bằng `NL_FIELD_`.

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
