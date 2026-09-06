# Design Spec: NL_FIELD for shared don_vi / don_vi_cap_tren / ngay_thang_nam

**Date:** 2026-09-06  
**Status:** Draft for review  
**Feature:** (P7) Ba field dùng chung → `NL_FIELD_*`, không nhãn admin; value từ resolver như hiện tại

---

## 1. Problem

- `FIELD_don_vi`, `FIELD_don_vi_cap_tren`, `FIELD_ngay_thang_nam` đang labelable / dễ lẫn với field cần prefix admin.
- User muốn chúng là **NL_FIELD** (format/value cố định từ code, không nhãn).

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Named ranges: `NL_FIELD_don_vi`, `NL_FIELD_don_vi_cap_tren`, `NL_FIELD_ngay_thang_nam` |
| 2 | Keys giữ: `donVi`, `donViCapTren`, `ngayThangNam` |
| 3 | Value: resolver hiện tại (không thêm prefix trong NL module) |
| 4 | `supportsLabel: false`; không hiện modal nhãn |
| 5 | **Không** nhận legacy `FIELD_don_vi` / `FIELD_don_vi_cap_tren` / `FIELD_ngay_thang_nam` |
| 6 | Catalog: chuyển 3 entry sang `NL_FIELD_CATALOG_SCALARS`; xóa `FIELD_*` cũ |
| 7 | Resolve: `resolveNlFieldKey` + strip `NL_FIELD_`; remove SCALAR aliases that mapped old FIELD names if any conflict |
| 8 | FE `chungTuNlField` mirror keys |

---

## 3. Changes

### BE `chung-tu-nl-field.js`

Add to `NL_FIELD_KEY_BY_NAME` and `NL_FIELD_CATALOG_SCALARS`.

### Catalog / alias / FE resolve

- Remove three `FIELD_*` buildScalarField rows.
- `resolveScalarFieldKey`: for these names only via NL path (or reject FIELD_ prefix versions → empty / not these keys).
- Update tests that assert `FIELD_ngay_thang_nam` / `FIELD_don_vi`.

### Derived named ranges / Drive fill

- Update category derived lists if they list camelCase keys only — keys unchanged (`donVi` still fine).
- Docs/README hint if needed.

---

## 4. Acceptance

1. Template với `NL_FIELD_don_vi` → PDF hiện tên đơn vị, không prefix nhãn.
2. Modal Superadmin không liệt kê 3 field này.
3. Mẫu còn `FIELD_don_vi` → không map (cần đổi Excel).
4. Catalog tra cứu hiện `NL_FIELD_*`.

---

## 5. Ops

Re-upload templates renaming Named Ranges. Document-service already imports `NL_FIELD_*`.
