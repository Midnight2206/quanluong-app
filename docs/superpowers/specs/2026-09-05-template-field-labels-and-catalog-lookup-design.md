# Design Spec: Template Field Labels + Scalar Catalog Lookup

**Date:** 2026-09-05  
**Status:** Draft for review  
**Feature:** Label theo phiên bản mẫu PDF (Superadmin); value từ code; tab tra cứu scalar dạng bảng + search realtime

---

## 1. Problem

- Prefix nhãn field đang hardcode (`Số: `, `- Bộ phận: `…) → không chỉnh theo từng phiên bản mẫu.
- Tab tra cứu catalog dạng card list, lẫn gợi ý cột bảng → khó tìm scalar Named Range.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Một Named Range `FIELD_*` = một ô: xuất `label + value` nếu có label; không thì **value thuần** |
| 2 | Value luôn từ code/resolver |
| 3 | Label khai trên Superadmin **theo từng** `ChungTuPdfTemplate` (phiên bản) |
| 4 | Chỉ field `supportsLabel: true` trong catalog code mới hiện form label |
| 5 | Không fallback prefix cứng khi thiếu/empty label |
| 6 | Tra cứu: **chỉ scalar**; một bảng (tên + mô tả) + search lọc realtime |
| 7 | Lưu `fieldLabelsJson` trên `ChungTuPdfTemplate` |

---

## 3. Catalog (code)

Mỗi scalar:

```js
{
  namedRange: "FIELD_so_chung_tu",
  fieldKey: "soChungTu",
  description: "Số chứng từ (value từ hệ thống)",
  supportsLabel: true, // optional, default false
}
```

`supportsLabel: true` (ban đầu, khớp prefix cũ): `quyenSo`, `soChungTu` (và alias so/soPhieu nếu cùng key resolve), `tongTienBangChu`, `hoTenNguoiMua`, `boPhan`, và các field tương tự đã từng có prefix — liệt kê explicit trong catalog.

API `GET /pdf-template-field-catalog` trả thêm `description`, `supportsLabel` (giữ `label` cũ = description hoặc deprecate dần).

---

## 4. Storage & API

```prisma
model ChungTuPdfTemplate {
  // ...
  fieldLabelsJson Json?  // { [fieldKey]: string }
}
```

- `PUT/PATCH` (hoặc endpoint riêng) cập nhật `fieldLabelsJson` trên template draft (và cho phép sửa draft; published: chỉ đọc hoặc fork — **cho phép sửa labels trên draft; published read-only labels trừ khi reopen draft** — YAGNI: cho save trên mọi status non-retired nếu UI hiện cho edit metadata; mặc định: save khi template `draft`, published giữ JSON đã có lúc publish).
- Locked simpler: **mọi status trừ `retired` có thể cập nhật fieldLabelsJson** (nhãn không đổi binary Excel).

Export batch/single: load template’s `fieldLabelsJson`, truyền vào `pickMappedFields` / `formatDerivedNamedRangeValue(fieldKey, value, { label })`.

---

## 5. Format path

Thay `LABELED_FIELD_PREFIXES` cứng trong PDF path:

```js
formatDerivedNamedRangeValue(fieldKey, rawValue, { label } = {}) {
  const value = trim(rawValue);
  if (!value) return "";
  const prefix = String(label ?? "").trim();
  if (!prefix) return value;
  if (value.startsWith(prefix)) return value;
  // optional: ensure spacing — if label doesn't end with space/punctuation, join with single space or use label as-is (admin includes "Số: ")
  return `${prefix}${value}`; // admin responsible for trailing space / ": "
}
```

Drive/Sheets path: cùng rule nếu dùng chung formatter + labels từ template; nếu Sheets không có template labels → value thuần (bỏ prefix cứng toàn cục theo quyết định 5).

---

## 6. Superadmin UI

Trên `SuperadminChungTuPdfCategoryTemplates` khi đã chọn template:

- Section **Nhãn field (supportsLabel)**
- Rows: namedRange, description, input label
- Nút Lưu labels → API

---

## 7. Tra cứu UI (`ChungTuPdfFieldCatalogPanel`)

- Bỏ cột/gợi ý table columns khỏi panel này
- Bảng scalar: Tên (`namedRange` + `fieldKey`), Mô tả
- Search box: filter client-side theo tên/mô tả (debounce nhẹ optional; mặc định onChange)
- Dùng chung user + admin tabs hiện có

---

## 8. Out of scope

- Named Range riêng cho label
- Label cột bảng chi tiết
- Copy labels giữa versions
- Document-service Excel schema change

---

## 9. Acceptance

1. Superadmin lưu label khác nhau trên 2 version mẫu → xuất ra prefix khác nhau.
2. Label trống → PDF chỉ value (không còn `Số: ` cứng).
3. Field không `supportsLabel` không hiện trong form nhãn.
4. Tab tra cứu: bảng scalar + search lọc realtime; không còn list cột bảng trong panel đó.
