# Design Spec: Phiếu xuất kho (PXK) — LTTP aggregation, fields, signatures

**Date:** 2026-09-07  
**Status:** Draft for review  
**Feature:** PXK xuất từ Nhập xuất LTTP; gộp by-unit / by-day; auto-fill người nhận / địa chỉ / lý do xuất; extraFields xuất tại kho + địa điểm; chữ ký khóa Thủ kho + Người nhận  

---

## 1. Problem

- PXK đã có khung monthly + `nguoiNhanHang` / `donVi`, nhưng thiếu field mẫu mới (`FIELD_nguoi_nhan`, `FIELD_dia_chi`, `FIELD_ly_do_xuat_kho`, `FIELD_xuat_tai_kho`, `FIELD_dia_diem`), rule gộp by-day theo **đơn vị × ngày**, và chữ ký cố định Thủ kho / Người nhận.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Cách 1: mở rộng pipeline monthly / batch hiện có (không pipeline PXK riêng) |
| 2 | Aggregation: chỉ `by-unit` \| `by-day`; **default `by-unit`**; **không `full`** |
| 3 | by-day: 1 PDF / (`recipientUnitId` × `issueDate`); gộp nhiều phiếu cùng đơn vị trong ngày; không gộp khác đơn vị |
| 4 | `FIELD_nguoi_nhan` (`nguoiNhan`) = họ tên user nhận LTTP (cùng nguồn `nguoiNhanHang`) |
| 5 | `FIELD_dia_chi` (`diaChi`) = `profile.department` của user nhận |
| 6 | Giữ `nguoiNhanHang` + `donVi` (tên đơn vị) cho template cũ |
| 7 | `lyDoXuatKho`: by-unit → `Cấp tiếp phẩm tháng MM năm YYYY`; by-day → `Cấp tiếp phẩm ngày DD tháng MM năm YYYY` |
| 8 | `xuatTaiKho` + `diaDiem` từ `extraFields` Cài đặt chữ ký (user nhập) |
| 9 | Slot khóa: `thu_kho` (static) + `nguoi_nhan` (materialize `rankAbbr` + họ tên lúc xuất); không xoá được |
| 10 | Ngoài scope: tab Tổng hợp PXK; mode `full`; đổi document-service layout; backfill settings cũ |

---

## 3. Aggregation

**Nguồn:** `lttp_issue_slip` + lines (resolver monthly hiện có).

| Mode | Sheet / PDF |
|------|-------------|
| `by-unit` | 1 context / `recipientUnitId` trong tháng đã chọn |
| `by-day` | 1 context / (`recipientUnitId`, `issueDate`); detailRows = gộp lines các slip cùng cặp |

`pickExportSlices`: mỗi sheetContext có `detailRows` → 1 PDF. File name / sortKey by-day nên phân biệt đơn vị + ngày (tránh trùng tên khi nhiều đơn vị cùng ngày).

**API / FE validation:** PXK reject `aggregationMode === "full"`; UI ẩn option full; default `by-unit`.

---

## 4. Fields

| Named Range | fieldKey | Nguồn |
|-------------|----------|--------|
| `FIELD_nguoi_nhan` | `nguoiNhan` | Họ tên người nhận (LTTP default user / slip display) |
| `FIELD_dia_chi` | `diaChi` | `User.profile.department` |
| `FIELD_ly_do_xuat_kho` | `lyDoXuatKho` | Formatter theo `aggregationMode` + period |
| `FIELD_xuat_tai_kho` | `xuatTaiKho` | `signatureSettings.extraFields.xuatTaiKho` |
| `FIELD_dia_diem` | `diaDiem` | `signatureSettings.extraFields.diaDiem` |
| (giữ) | `nguoiNhanHang` | Cùng họ tên như `nguoiNhan` |
| (giữ) | `donVi` | Tên đơn vị nhận |

**Recipient fill:** mở rộng `loadRecipientUnitFillMap` (select `department`, `rankAbbr`) → `{ nguoiNhanHang, nguoiNhan, donVi, diaChi, signatureName? }` với `signatureName = [rankAbbr, fullName].filter(Boolean).join(" ")` (reuse `formatSystemPersonName` nếu tiện).

**Attach:** by-unit và by-day đều gắn fill theo `recipientUnitId` của context (không chỉ by-unit như hiện tại nếu đang gate).

**`formatLyDoXuatKho({ aggregationMode, periodMonth, periodDate })`:** pure helper; pad MM/DD 2 chữ số.

Catalog / resolve / FE `chungTuLabelField` (hoặc NL nếu cần): đăng ký các field mới; `xuatTaiKho` / `diaDiem` / `lyDoXuatKho` / `nguoiNhan` / `diaChi` theo pattern PNK `nhapTaiKho` / `lyDoNhapKho`.

---

## 5. Signatures & extraFields

**Default PXK signature block** (khi chưa cấu hình hoặc normalize):

1. `thu_kho` — label Thủ kho (hoặc «THỦ KHO»); `source: static`; `locked: true`  
2. `nguoi_nhan` — label Người nhận; `locked: true`; lúc xuất materialize `static_name` / signature value từ `signatureName` của recipient context  

Cho phép thêm slot khác (không khóa) nếu UI hiện cho phép — **không** xoá được hai slot khóa (mirror PNK `nguoi_giao`).

**extraFields UI (PXK):** `xuatTaiKho`, `diaDiem` (song song PNK `lyDoNhapKho`, `nhapTaiKho`).

**Export batch:** đọc saved settings → inject `xuatTaiKho` / `diaDiem` vào resolve context; `materializePxkNguoiNhanSignatureBlock(block, slice.context)` trước render (pattern PNK).

---

## 6. Frontend

- `ChungTuExportWorkspace`: PXK monthly — aggregation options chỉ by-unit / by-day; default by-unit.  
- `ChungTuSignatureSettingsWorkspace`: nhánh PXK — locked slots + extra field inputs.  
- Không bắt buộc đổi History/Summary trong spec này.

---

## 7. Tests

1. `formatLyDoXuatKho` by-unit / by-day.  
2. Recipient fill includes `diaChi` + `nguoiNhan`.  
3. by-day contexts: same unit+day merge; different units separate.  
4. PXK rejects `full`.  
5. Materialize `nguoi_nhan` uses rankAbbr + name.  
6. Export injects `xuatTaiKho` / `diaDiem` from extraFields.  
7. FE source: PXK no `full` option; signature extras present.

---

## 8. Manual acceptance

1. by-unit export → 1 PDF/đơn vị; lý do tháng/năm; người nhận + địa chỉ đúng.  
2. by-day → 1 PDF/(đơn vị×ngày); lý do có ngày.  
3. Cài đặt: xuất tại kho + địa điểm lên PDF; Thủ kho static; Người nhận auto; không xoá 2 slot.  
4. BKMH / PNK không regress.

---

## 9. Out of scope

- Tổng hợp folder PXK  
- Aggregation `full`  
- Đổi schema Excel document-service  
- Migrate/backfill signature settings PXK cũ  
