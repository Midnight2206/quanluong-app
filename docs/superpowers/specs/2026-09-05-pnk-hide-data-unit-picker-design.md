# Design Spec: PNK Hide Data-Unit Picker

**Date:** 2026-09-05  
**Status:** Draft for review  
**Feature:** Phiếu nhập kho không chọn “đơn vị đưa dữ liệu”; nguồn từ BKMH (+ hóa đơn sau)

---

## 1. Problem

- PNK lấy dòng hàng từ snapshot BKMH (theo kho + tháng), không từ LTTP theo danh sách đơn vị.
- UI monthly vẫn hiện và bắt chọn “Đơn vị đưa dữ liệu” → thừa / gây hiểu nhầm.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Giữ picker **đơn vị kho LTTP** (`unitId`) |
| 2 | Ẩn hoàn toàn “Đơn vị đưa dữ liệu” trên PNK |
| 3 | Payload PNK: gửi `unitId` (kho) + `periodMonth`; **không** gửi `unitIds` (hoặc không bắt buộc) |
| 4 | FE không validate / không `canRun`-gate theo `selectedDataUnitIds` cho PNK |
| 5 | BE resolver PNK giữ như hiện tại (đã ignore `unitIds` cho dòng hàng) — không đổi trong scope này |
| 6 | PXK / BKMH monthly vẫn giữ multi-select đơn vị như cũ |

---

## 3. Frontend (`ChungTuExportWorkspace`)

Khi `isPnkMonthly` (`categoryKey === "phieu-nhap-kho"` && monthly):

1. Không render khối checkbox “Đơn vị đưa dữ liệu”.
2. `canRun` / `validateWizardStep0`: không yêu cầu `selectedDataUnitIds.length > 0`.
3. `buildPayloadBase`: không include `unitIds` (omit key).
4. Tóm tắt wizard / mô tả step: nói nguồn BKMH theo kho+tháng, không liệt kê “N đơn vị đưa dữ liệu”.

Giữ: chọn kho, tháng, mẫu PDF, chữ ký, force `by-day`.

---

## 4. Backend

- Không bắt buộc đổi. Batch đã fallback `unitIds` → scope / `unitId` nếu thiếu; PNK resolve chỉ dùng `storageUnitId` + `periodMonth`.
- `unitIdsJson` trên batch history có thể phản ánh fallback kho — chấp nhận trong scope này (metadata, không ảnh hưởng bảng hàng PDF).

---

## 5. Out of scope

- Ẩn picker kho
- Filter / chọn subset slice theo đơn vị nhận
- UI nguồn hóa đơn (Phase 3)
- Đổi hash / `unitIdsJson` semantics trên lịch sử batch

---

## 6. Acceptance

1. Màn xuất PNK không còn UI “Đơn vị đưa dữ liệu”.
2. Vẫn chọn được kho + tháng + mẫu và xuất PDF khi đã có BKMH tháng.
3. Request PNK không gửi `unitIds`; vẫn gửi `unitId`.
4. BKMH / PXK monthly vẫn có multi-select đơn vị.
