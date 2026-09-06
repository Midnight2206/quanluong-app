# Design Spec: Seed template field labels + labels modal

**Date:** 2026-09-06  
**Status:** Draft for review  
**Feature:** (P6) Upload mẫu PDF seed `fieldLabelsJson` từ phiên bản trước cùng name; chỉnh nhãn trong modal

---

## 1. Problem

- Mỗi lần upload version mới, nhãn trống → Superadmin nhập lại từ đầu.
- Form nhãn nằm inline trên trang templates → trang dài, rối.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | **Server seed** lúc `createChungTuPdfTemplate`: copy labels từ bản trước |
| 2 | Bản trước = cùng `categoryKey` + cùng `name`, `updatedAt` mới nhất, khác row mới tạo |
| 3 | Chỉ copy key có trong JSON cũ (normalize); key mới trên Excel chưa có label → để trống |
| 4 | UI nhãn: **modal**; bỏ form inline trên trang chính |
| 5 | Nút mở modal trên row template (vd. “Nhãn field”) |
| 6 | Schema scalar/cột có thể giữ ngoài modal (chỉ chuyển khối nhãn) |
| 7 | Retired: modal read-only như hiện tại |
| 8 | API save labels giữ nguyên |

---

## 3. Backend

`createChungTuPdfTemplate` sau khi có `name` / `categoryKey`:

```js
const previous = await prisma.chungTuPdfTemplate.findFirst({
  where: { categoryKey, name },
  orderBy: { updatedAt: "desc" },
  select: { fieldLabelsJson: true },
});
// create with fieldLabelsJson: normalizeFieldLabels(previous?.fieldLabelsJson)
```

Nếu không có previous → `{}`.

Tests: create with prior row same name → new row gets prior labels; different name → `{}`.

---

## 4. Frontend

- `SuperadminChungTuPdfCategoryTemplates.jsx`: remove inline label editor card section.
- Add button per template (or for selected) → open dialog with label form + Save.
- Prefer existing UI dialog pattern in shared (Dialog from shadcn if present; else simple fixed overlay matching ConfirmProvider style — reuse Dialog if already in project).
- On open: draft from `selectedTemplate.fieldLabels` + template fields list (same logic as today).
- After successful upload, returned template already has seeded labels → modal shows them.

---

## 5. Acceptance

1. Upload version mới cùng `name` → labels đã có từ bản trước (không Save thủ công).
2. Upload `name` mới / lần đầu → labels rỗng.
3. Trang chính không còn form nhãn dài; mở modal để sửa/lưu.
4. Publish/export vẫn dùng `fieldLabelsJson` như cũ.

---

## 6. Out of scope

- Copy theo `displayName` khác `name`.
- Auto-prune labels for keys not on new Excel until user saves from modal.
- P7 NL_FIELD shared fields.
