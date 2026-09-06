# Design Spec: Replace window.confirm with useConfirm

**Date:** 2026-09-06  
**Status:** Draft for review  
**Feature:** Mọi `window.confirm` còn lại dùng modal `ConfirmProvider` / `useConfirm`

---

## 1. Problem

- Một số flow vẫn dùng `window.confirm` (native) → UI không đồng bộ với modal app (`ConfirmProvider`).
- User muốn modal chung cho confirm (xoá và các confirm khác còn sót).

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Thay **tất cả** `window.confirm` trong `packages/shared` |
| 2 | Dùng `useConfirm()` đã có — không thêm provider / lib |
| 3 | Confirm **xoá** → `variant: "danger"` |
| 4 | Confirm **bỏ thay đổi / tiếp tục** → `variant: "default"` |
| 5 | Giữ nội dung tiếng Việt; tách `title` ngắn + `message` khi hợp lý |
| 6 | Handler async: `const ok = await confirm(...); if (!ok) return;` |

---

## 3. Call sites

| File | Context | Variant |
|------|---------|---------|
| `ChungTuHistoryWorkspace.jsx` | Xóa folder PDF / xóa tháng BKMH | danger |
| `ProfilePage.jsx` | Xóa ảnh đại diện | danger |
| `KitchenMenuTab.jsx` | Đổi buổi / đổi ngày / mở AI khi có draft | default |
| `KitchenMenuAiSuggestDialog.jsx` | Confirm trước khi apply/discard (nếu còn `window.confirm`) | default |

Sau merge: `rg 'window\.confirm' packages/shared` → **0** hits.

---

## 4. Tests

Source asserts: mỗi file trên không còn `window.confirm`; có `useConfirm` / `await confirm`.

---

## 5. Out of scope

- Đổi API / copy lớn; redesign ConfirmProvider UI.
- Confirm đã dùng `useConfirm` sẵn (Superadmin, LTTP, …).

---

## 6. Acceptance

1. Xóa lịch sử CTQT / xóa avatar → modal app (nút đỏ nếu danger).
2. Kitchen menu unsaved → modal app, không native dialog.
3. Không còn `window.confirm` trong packages/shared.
