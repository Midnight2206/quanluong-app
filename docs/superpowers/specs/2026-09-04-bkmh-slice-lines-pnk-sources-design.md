# Design Spec: BKMH Slice Line Snapshot + PNK From BKMH Sources

**Date:** 2026-09-04  
**Status:** Draft for review  
**Feature:** Lưu bảng hàng BKMH theo slice; PNK lấy dữ liệu từ các nguồn đã chốt (BKMH, sau này hóa đơn)

---

## 1. Problem

- BKMH xuất PDF từ LTTP nhưng Node **không lưu** bảng chi tiết → PNK không thể lấy BKMH làm dữ liệu đầu vào.
- Quy trình thực tế: **LTTP → BKMH (+ hóa đơn sau) → PNK tổng hợp**.
- PNK không cần chọn chế độ gộp: **luôn theo ngày**; ngày nào có nguồn (BKMH/hóa đơn) thì ngày đó mới có PNK.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Luồng: LTTP → BKMH (+ hóa đơn sau) → PNK tổng hợp từ các nguồn đã chốt |
| 2 | Bảng hàng PNK lấy từ **DB đã lưu**, không tái tính LTTP |
| 3 | Lưu chi tiết BKMH **theo từng slice** |
| 4 | Không lưu bản gộp tháng riêng — gộp lúc đọc nếu cần |
| 5 | Storage Phase 1: `detailRowsJson` trên `ChungTuBkmhSlice` (không normalize line table) |
| 6 | Upsert BKMH tháng: ghi đè `detailRowsJson` cùng metadata/PDF slice |
| 7 | PNK: **không** UI chọn aggregation mode — luôn `by-day` |
| 8 | PNK: chỉ xuất ngày có ≥1 nguồn (BKMH slice, sau này hóa đơn) |
| 9 | Gộp mặt hàng: giữ logic BKMH hiện tại — cùng hàng + cùng đơn giá gộp; **khác giá → dòng riêng** (không trung bình) |
| 10 | Phase 1 chỉ persist + API đọc; Phase 2 đổi resolver/export PNK; Phase 3 hóa đơn |

---

## 3. Phase 1 — Persist BKMH slice lines

### 3.1 Schema

```prisma
model ChungTuBkmhSlice {
  // ... existing fields ...
  /// Snapshot detailRows đã dùng render PDF (JSON array).
  detailRowsJson Json?
}
```

### 3.2 Write path

Trong `createChungTuBkmhMonthlyExport`, khi `buildSliceCreateInput`:

- Lấy `slice.context.detailRows` (đã qua `aggregateLinesToDetailRows`)
- Lưu `detailRowsJson: detailRows` (array object: stt, tenHang, maSo, dvt, soLuong, donGia, thanhTien, …)

Upsert tháng: xóa slices cũ + tạo mới → luôn khớp PDF vừa xuất.

### 3.3 Read path

- GET monthly detail / slice list: mỗi slice trả thêm `detailRows` (parse từ JSON, default `[]`).
- Không bắt buộc đổi UI Tổng hợp trong Phase 1 (có thể hiện sau).

### 3.4 Out of scope (Phase 1)

- Đổi PNK export
- Khóa slice chống ghi đè khi PNK đã dùng
- Hóa đơn

---

## 4. Phase 2 — PNK from BKMH slice sources

### 4.1 Aggregation UX

- Wizard PNK tháng: **bỏ** chọn `by-day` / `by-unit` / `full`.
- Backend PNK monthly luôn `aggregationMode = by-day`.

### 4.2 Day selection

Với `storageUnitId` + `periodMonth`:

1. Load `ChungTuBkmhMonthly` của kho + tháng (và sau này nguồn hóa đơn cùng kỳ).
2. Tập ngày = các `slice.periodDate` có `detailRowsJson` không rỗng.
3. Mỗi ngày trong tập → một PDF PNK.

Ngày không có BKMH (và chưa có hóa đơn) → **không** tạo PNK.

### 4.3 Build detail rows for a PNK day

1. Lấy mọi BKMH slice cùng `periodDate` (cùng kho; nếu nhiều monthly/nguồn sau này thì union).
2. Flatten `detailRowsJson` của các slice đó.
3. Re-aggregate bằng **cùng rule** `aggregateLinesToDetailRows` (commodity + unitPrice; khác giá tách dòng).
4. `canCuBkmh` / căn cứ: giữ/adapt từ snapshot hoặc slice metadata (`soChungTu`, người mua, ngày) — không lấy bảng hàng từ LTTP.

### 4.4 Source of truth

| Field PNK | Nguồn |
|-----------|--------|
| Bảng hàng | `ChungTuBkmhSlice.detailRowsJson` (+ hóa đơn Phase 3) |
| Căn cứ văn bản | Metadata slice / snapshot BKMH |
| Header đơn vị, chữ ký… | Giữ profile / signature settings như hiện tại |

### 4.5 Prerequisite

Phase 2 chỉ chạy đúng khi tháng đó đã xuất BKMH (có slices + `detailRowsJson`).  
Nếu chưa có BKMH: báo lỗi rõ / empty — không fallback LTTP.

---

## 5. Phase 3 — Hóa đơn (outline)

- Model nguồn tương tự (slice/ngày + `detailRowsJson`).
- PNK by-day: union dòng từ BKMH + hóa đơn cùng ngày, rồi apply cùng aggregate rule.
- Chi tiết spec riêng khi làm Phase 3.

---

## 6. Implementation Tasks (Phase 1 first)

| Task | Mô tả |
|------|--------|
| T1 | Migration `detailRowsJson` trên `ChungTuBkmhSlice` |
| T2 | Ghi `detailRowsJson` khi tạo/upsert monthly slices |
| T3 | Map API response có `detailRows` |
| T4 | Test: upsert giữ đúng số dòng / gộp giá |

Phase 2 (sau khi Phase 1 xong + review):

| Task | Mô tả |
|------|--------|
| T5 | PNK FE: bỏ chọn aggregation mode |
| T6 | PNK resolve: by-day từ BKMH slices, không LTTP lines |
| T7 | Test: ngày không có BKMH → không slice; khác giá → 2 dòng |

---

## 7. Risks / Notes

- BKMH xuất lại (upsert) ghi đè slice → PNK xuất lại sẽ theo bản mới. Chưa có “lock sau khi PNK đã dùng” (làm sau nếu cần).
- Slice cũ (trước migration) không có `detailRowsJson` → cần xuất lại BKMH tháng trước khi PNK Phase 2.
- `detailRows` là snapshot display-oriented (string `donGia` đã format); Phase 2 aggregate cần parse số hoặc lưu thêm raw `unitPrice`/`quantity`/`amount` trong JSON. **Khuyến nghị Phase 1:** lưu cả raw numeric fields trong mỗi row (`quantity`, `unitPrice`, `amount`, `commodityId`) kèm field display — tránh mất precision khi PNK gộp lại.
