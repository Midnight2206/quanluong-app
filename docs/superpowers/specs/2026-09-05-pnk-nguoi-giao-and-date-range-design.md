# Design Spec: PNK Người giao + Nhập tại kho + Gộp theo khoảng ngày / tách buyer

**Date:** 2026-09-05  
**Status:** Draft for review  
**Feature:** Field người giao hàng / địa chỉ (bộ phận) trên PNK; khung ký khóa NGƯỜI GIAO; nhập tại kho trong cài đặt chữ ký; PNK chọn khoảng ngày + tách phiếu theo người mua

---

## 1. Problem

- PNK cần điền **người giao** (= người mua trên BKMH / sau này hóa đơn): họ tên, bộ phận, và khung ký “NGƯỜI GIAO”.
- Cần field **nhập tại kho** (tạm thời cấu hình ở cài đặt chữ ký).
- PNK không còn “chỉ by-day cả tháng”: user chọn **khoảng ngày**; gộp theo ngày hoặc nhiều ngày; **người mua khác nhau luôn tách phiếu**.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Người giao = người mua nguồn (BKMH hiện tại; hóa đơn Phase sau) |
| 2 | Persist buyer snapshot trên `ChungTuBkmhSlice` lúc xuất BKMH (`buyerUserId`, name, signatureName, title/bộ phận, `buyerKey`) |
| 3 | `buyerKey` = `user:{id}` hoặc `name:{normalized}` nếu không có user |
| 4 | PNK luôn tách theo `buyerKey` trước khi gộp thời gian |
| 5 | Aggregation PNK: chỉ `by-day` (“Theo ngày”) và `full` (“Nhiều ngày”); **không** `by-unit` |
| 6 | Cả hai mode: UI chọn **from–to** (không bắt buộc cả tháng) |
| 7 | `by-day`: 1 PDF / (buyer × ngày có nguồn trong khoảng) |
| 8 | `full`: 1 PDF / buyer (gộp mọi ngày của buyer trong khoảng) |
| 9 | `FIELD_nguoi_giao_hang` ← `buyerName`; `FIELD_dia_chi` ← bộ phận người giao **chỉ trên category PNK** |
| 10 | Slot ký khóa `nguoi_giao`, label `NGƯỜI GIAO`, luôn đầu block, không xóa/đổi source; tên ký = `buyerSignatureName` |
| 11 | `nhapTaiKho`: text trên Cài đặt chữ ký PNK → `extraFieldsJson.nhapTaiKho` → `FIELD_nhap_tai_kho` |
| 12 | Slice thiếu buyer snapshot → lỗi rõ, yêu cầu xuất lại BKMH (không đoán) |

---

## 3. Schema

### 3.1 `ChungTuBkmhSlice` — buyer snapshot

```prisma
buyerUserId         Int?
buyerKey            String?  @db.VarChar(191)  // user:123 | name:...
buyerName           String?  @db.VarChar(191)  // họ tên (không rank)
buyerSignatureName  String?  @db.VarChar(255)  // rankAbbr + tên
buyerTitle          String?  @db.VarChar(255)  // bộ phận
```

Ghi khi upsert slice trong `createChungTuBkmhMonthlyExport`, từ `SIGNATURE_CATALOG["bkmh.nguoiMua"].resolve` (cùng nguồn header BKMH).

### 3.2 `ChungTuSignatureSettings`

```prisma
extraFieldsJson Json?  // { nhapTaiKho?: string } cho PNK; mở rộng sau
```

---

## 4. PNK resolve & export

### 4.1 Input

- `unitId` (kho)
- `dateFrom`, `dateTo` (ISO `YYYY-MM-DD`, inclusive)
- `aggregationMode`: `by-day` | `full`
- Không bắt `unitIds` (đã chốt trước)

Nguồn: slices BKMH của kho có `periodDate` ∈ [from, to] và `detailRowsJson` không rỗng. Thiếu `buyerKey` → 400 hướng dẫn re-export BKMH.

### 4.2 Grouping

1. Group slices by `buyerKey`.
2. Trong mỗi buyer:
   - `by-day`: subgroup by `periodDate` → mỗi subgroup = 1 sheetContext / PDF.
   - `full`: gộp mọi ngày → 1 sheetContext / PDF (dòng hàng merge rule cũ; `canCuBkmh` từ mọi slice trong nhóm).

### 4.3 Context fields per PDF

| fieldKey / slot | Nguồn |
|-----------------|--------|
| `nguoiGiaoHang` | `buyerName` |
| `diaChi` (PNK only via `FIELD_dia_chi`) | `buyerTitle` |
| `nhapTaiKho` | signature settings `extraFieldsJson.nhapTaiKho` |
| Signature slot `nguoi_giao` | `buyerSignatureName` |
| `canCuBkmh`, `detailRows` | như hiện tại trong nhóm |

### 4.4 FE export workspace (PNK)

- Hiện aggregation picker: 2 options (Theo ngày / Nhiều ngày).
- Thay (hoặc bổ sung thay cho) month-only: **from + to** date inputs.
- Giữ picker kho; không “đơn vị đưa dữ liệu”.
- Ensure signature block merge: inject locked `nguoi_giao` ở đầu nếu thiếu.

---

## 5. Signature settings UI (PNK)

- Ô **Nhập tại kho** (text), lưu `extraFieldsJson.nhapTaiKho`.
- Slot list: slot có `locked: true` không hiện nút xóa; key/source disabled; label cố định `NGƯỜI GIAO` (hoặc cho sửa label layout nhưng mặc định khóa label — **khóa label + key + source**).
- Khi load settings trống / reset PNK: seed block có `nguoi_giao` locked đầu tiên + các slot mặc định khác.

---

## 6. Catalog

Thêm scalar:

- `FIELD_nguoi_giao_hang` / `nguoiGiaoHang` — “Họ tên người giao (từ người mua BKMH)”
- `FIELD_dia_chi` / `diaChi` — “Bộ phận người giao (PNK); không dùng cho donVi”
- `FIELD_nhap_tai_kho` / `nhapTaiKho` — “Nhập tại kho”

Alias resolve: `nguoi_giao_hang`, `nhap_tai_kho`; PNK-only override: `dia_chi` → `diaChi` (không map `donVi`).

---

## 7. Out of scope

- Hóa đơn làm nguồn PNK / buyer từ hóa đơn
- `by-unit` trên PNK
- Đổi aggregation BKMH / PXK
- Auto-fill nhập tại kho từ master data kho

---

## 8. Acceptance

1. Xuất lại BKMH → slice có buyer snapshot.
2. PNK chọn from–to + Theo ngày → nhiều PDF theo buyer×ngày trong khoảng.
3. PNK + Nhiều ngày → 1 PDF / buyer trong khoảng.
4. PDF có `FIELD_nguoi_giao_hang`, `FIELD_dia_chi` (bộ phận), khung NGƯỜI GIAO (rank+tên), `FIELD_nhap_tai_kho` từ settings.
5. Không xóa được slot NGƯỜI GIAO trong cài đặt chữ ký PNK.
6. Slice cũ thiếu buyer → lỗi rõ, không xuất mơ hồ.
