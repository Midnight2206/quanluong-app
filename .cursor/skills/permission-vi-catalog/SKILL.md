---
name: permission-vi-catalog
description: Khi thêm API route được bảo vệ bằng permission mới — bổ sung tên và mô tả tiếng Việt vào catalog và đảm bảo đồng bộ DB; dùng sau mỗi thay đổi *-route-definitions.js.
---

# Catalog mô tả quyền (tiếng Việt)

## Nguyên tắc

- **Một quyền = một mã (`code`) duy nhất** — `name` và `description` lưu trong bảng `Permission`, hiển thị thống nhất cho superadmin (tab mô tả) và admin (modal phân quyền chức danh + payload `/auth/current-user`).
- **Nguồn chuẩn tiếng Việt**: file backend `quanluong-app-be/src/shared/constants/permission-catalog.vi.js` (`PERMISSION_CATALOG_VI` / `getPermissionVi`).
- **Đồng bộ khi server bật** (`permissionSyncOnBoot`): cập nhật `name`, `method`, `module`, `pathRoute`; **không ghi đè `description`** nếu đã có nội dung trong DB (superadmin có thể chỉnh tay qua API PATCH). Hàng **mới** hoặc `description` đang **null/rỗng** được điền từ catalog.

## Việc cần làm khi thêm route mới có `permission`

1. Thêm block route trong module `*-route-definitions.js` (giữ `code` ổn định, có thể để `name`/`description` tiếng Anh tạm).
2. Nếu là **mã quyền mới**, thêm vào `quanluong-app-be/src/shared/constants/permissions.js` (hằng `PERMISSIONS`) và gán vào route definition.
3. **Bắt buộc**: thêm entry trong `permission-catalog.vi.js` với cùng `code`:
   - `name`: ngắn, tiếng Việt nghiệp vụ (hiển thị danh sách).
   - `description`: 1–3 câu, rõ **được làm gì** và **trong phạm vi nào** (đơn vị / nhánh / cấp); tránh jargon kỹ thuật; không cần nhét HTTP method vào câu (đã có cột kỹ thuật).
4. Chạy server (hoặc bootstrap) để `syncPermissionsFromRoutes` ghi DB; với môi trường đã có dữ liệu: nếu `description` cũ trống sẽ được điền; nếu đã có nội dung do superadmin sửa thì **giữ nguyên**.
5. Kiểm tra UI: tab «Mô tả quyền» (superadmin) và modal phân quyền (admin, cần `permissions.read` để lấy catalog đầy đủ — khi không có quyền đọc catalog vẫn thấy mô tả từ quyền trong JWT/current-user, cùng nguồn DB).

## Gợi ý văn phong mô tả

- Bắt đầu bằng động từ: «Xem…», «Tạo…», «Cập nhật…», «Ngưng…», «Duyệt…».
- Nhắc phạm vi khi cần: «trong phạm vi đơn vị», «nhánh đơn vị được phép», «theo ma trận cấp đơn vị».
- Một route **PATCH** chung nhiều hành vi (ví dụ `jobTitles.patch`) thì mô tả gộp cả hai (sửa chức danh + gán quyền chức danh).

## Kiểm tra nhanh

- Grep `permission:` trong `quanluong-app-be/src/modules/**/**route-definitions.js` và đối chiếu mọi `code` với key trong `permission-catalog.vi.js` (không được thiếu key mới).
