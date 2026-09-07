# Design Spec: CTQT unified sub-tabs + hide BKMH period date

**Date:** 2026-09-06  
**Status:** Draft for review  
**Feature:** (P1) Thống nhất 4 tab con chứng từ quyết toán; (P2) BKMH không hiện ngày chứng từ  
**Program backlog (later):** P4 confirm · P6 label modal · P7 NL_FIELD shared · P3 Superadmin sidebar · P5 persist

---

## 1. Problem

- Sub-tabs theo loại chứng từ không thống nhất (Tổng hợp chỉ inject cho BKMH; thứ tự/lable khác cảm giác giữa các loại).
- BKMH monthly vẫn hiện label + input **Ngày chứng từ** dù đã có **Tháng chứng từ** → rối.
- Muốn một workspace chung tái sử dụng cho mọi loại available.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Mọi loại **available** dùng cùng `ChungTuCategoryWorkspace` với **4 tab** cố định |
| 2 | Thứ tự: **Xuất chứng từ** → **Tổng hợp** → **Lịch sử** → **Cài đặt chữ ký** |
| 3 | `hasSummary` trên category config; chỉ `bang-ke-mua-hang` = `true` lúc này |
| 4 | Tab Tổng hợp **luôn hiện**; khi `!hasSummary` → **disabled** (không chọn được) |
| 5 | Extend `TabPanel` hỗ trợ `disabled?: boolean` trên tab item |
| 6 | BKMH: **ẩn** khối Ngày chứng từ; giữ Tháng chứng từ |
| 7 | Loại `planned` vẫn `ChungTuPlaceholderWorkspace` (ngoài scope đổi tab) |
| 8 | Không đổi API export / BE trong spec này |

---

## 3. Config

`chungTuCategoryConfig.js`:

```js
hasSummary: categoryKey === "bang-ke-mua-hang"  // hoặc explicit map
```

`getChungTuCategoryConfig` trả thêm `hasSummary: boolean` (default `false`).

---

## 4. UI

### 4.1 `TabPanel`

- Tab shape: `{ id, label, panel, badge?, disabled? }`.
- `disabled: true`: nút `disabled` / `aria-disabled`, không gọi `onTabSelect` / không đổi active.
- Nếu `persistId` restore tab disabled → fallback `defaultTabId` / tab enabled đầu tiên.

### 4.2 `ChungTuCategoryWorkspace`

```text
tabs = [
  export → ChungTuExportWorkspace,
  summary → hasSummary ? ChungTuSummaryWorkspace : <empty/disabled panel unused>,
  history → ChungTuHistoryWorkspace,
  signature-settings → ChungTuSignatureSettingsWorkspace,
]
summary.disabled = !hasSummary
```

Bỏ `isBkmh` special-case cho việc *có/không có* tab; chỉ dùng `config.hasSummary`.

### 4.3 `ChungTuExportWorkspace` (P2)

- Khi `isBkmhMonthly` (hoặc `exportKind === monthly` && category BKMH): **không render** label+input `periodDate` (Ngày chứng từ).
- PNK date range / PXK day logic giữ nguyên.

---

## 5. Tests

1. Source/unit: `ChungTuCategoryWorkspace` luôn 4 tab ids `export|summary|history|signature-settings`.
2. BKMH: summary không `disabled`; PNK/PXK: summary `disabled`.
3. Export workspace: BKMH source không match “Ngày chứng từ” (hoặc assert branch `!isBkmhMonthly`).
4. TabPanel: selecting disabled tab không đổi active (nhẹ).

---

## 6. Out of scope

- Superadmin sidebar, confirm modal migration, global persist, template label modal, NL_FIELD rename.
- Implement summary cho PNK/PXK.
- Đổi copy label tab.

---

## 7. Acceptance

1. Mọi loại available: đúng 4 tab, cùng thứ tự.
2. PNK/PXK: tab Tổng hợp xám / không bấm được; BKMH bấm được và thấy tổng hợp.
3. BKMH Xuất: không còn ô Ngày chứng từ; vẫn chọn tháng.
4. Persist sub-tab: nếu lần trước ở summary trên PNK (disabled) → mở lại vào tab export (hoặc tab enabled hợp lệ).
