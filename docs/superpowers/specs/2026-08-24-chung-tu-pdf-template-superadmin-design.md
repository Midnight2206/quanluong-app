# Chứng từ PDF — quản lý mẫu trên Superadmin

Ngày: 2026-08-24  
Liên quan: `2026-08-23-chung-tu-pdf-batch-folder-design.md`, `2026-08-23-chung-tu-document-service-pdf-design.md`  
Branch dự kiến: `feat/document-service-p4` (hoặc nhánh con)

## Mục tiêu

Giảm rối trên app nghiệp vụ: **chỉ Superadmin** upload / bật-tắt mẫu Excel PDF và xem Named Range. User đơn vị chỉ **chọn mẫu đã publish** khi xuất; **Cài đặt chữ ký** vẫn trên app chính.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Ai quản lý mẫu | Chỉ Superadmin |
| User app | Chọn 1 trong nhiều mẫu `isActive=true`; không upload/xóa |
| Chữ ký | Tab **Cài đặt chữ ký** giữ trên app chính (user đơn vị) |
| Superadmin UI | Tab dashboard **Mẫu chứng từ**; mỗi loại AVAILABLE = 1 tab con |
| Nội dung tab | Upload + list + deactivate + xem fields/Named Range (+ catalog gợi ý read-only) |
| Mapping dữ liệu đầu vào | **Ngoài phạm vi** — vòng sau khi có yêu cầu chi tiết |
| API | Giữ `/chungtuquyettoan/pdf-templates*`; ghi = `superadminMiddleware` |

## Kiến trúc

```
Superadmin dashboard (:8081)
  /dashboard/chung-tu-pdf-templates
    TabPanel theo categoryKey (AVAILABLE only)
      Upload .xlsx → POST /pdf-templates
      List / deactivate → DELETE /pdf-templates/:id
      Inspect fields → GET /pdf-templates/:id/fields
      Catalog gợi ý → GET /pdf-template-field-catalog (read-only)

App chính — Chứng từ quyết toán
  Xuất: picker mẫu active (GET /pdf-templates) — bỏ UI upload
  Cài đặt chữ ký: giữ nguyên
  Lịch sử / xuất batch: giữ nguyên
```

## Superadmin UI

### Dashboard meta

Thêm vào `DASHBOARD_SUPERADMIN_TAB_META`:

| path | label | routeAccessKey |
|------|-------|----------------|
| `chung-tu-pdf-templates` | Mẫu chứng từ | `dashboard-chung-tu-pdf-templates` |

Registry: `requiredPermissions: []` (cổng superadmin đã hạn chế type); `RouteApiGuard` như các tab khác.

### Page layout

- Route Next: `apps/superadmin/app/(private)/dashboard/chung-tu-pdf-templates/page.jsx`
- Panel shared: `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfTemplatesPanel.jsx`
- Tab cấp 2: chỉ loại `status === AVAILABLE` từ `CHUNG_TU_CATEGORY_CONFIG_LIST` / tabs meta hiện có
- Mỗi tab con tái sử dụng logic upload/list/fields hiện có từ `chungTuPdfApi` (không nhân đôi client nếu có thể)

### Hành vi mỗi loại

1. Form: file `.xlsx`, `displayName`, `name`, `version`, `categoryKey` cố định theo tab  
2. Bảng mẫu: id, displayName, version, isActive, uploadedAt — CTA **Ngừng dùng** (soft `isActive=false`)  
3. Chọn dòng → panel fields: scalar Named Ranges + cột bảng từ document-service; kèm link/help catalog chuẩn (read-only)

**Không** đưa mapping rule / signature layout vào panel này trong MVP.

## App chính — Xuất chứng từ

Trong `ChungTuExportWorkspace`:

- Giữ: dropdown mẫu active, chữ ký (tên/ngày), xuất batch, preview nếu có  
- Gỡ: input file upload, displayName/version upload, nút tải mẫu lên, mọi CTA deactivate trên màn này  
- Empty state: nếu không có mẫu active → thông báo rõ “Chưa có mẫu do quản trị hệ thống cấu hình”

`ChungTuCategoryWorkspace`: không đổi tab chữ ký / lịch sử.

## API / quyền

Pattern sẵn có: Drive `template-catalog` ghi đã dùng `superadminMiddleware`.

| Method | Path | Auth |
|--------|------|------|
| GET | `/pdf-templates?categoryKey=` | `LTTP_ISSUE_SLIPS_READ` (hoặc permission chứng từ hiện tại); chỉ trả `isActive=true` cho non-superadmin. Superadmin list có thể gồm inactive (query `includeInactive=1` hoặc luôn full trên panel SA). |
| GET | `/pdf-templates/:id/fields` | READ như hiện tại |
| POST | `/pdf-templates` | `auth` + **`superadminMiddleware`** (bỏ chỉ dựa WRITE đơn vị) |
| DELETE | `/pdf-templates/:id` | `auth` + **`superadminMiddleware`** |

Cập nhật `route-definitions` description: upload/deactivate = Superadmin.

**List inactive:** Superadmin panel cần thấy mẫu đã tắt. Cách chọn: `GET ?categoryKey=&includeInactive=true` chỉ chấp nhận khi caller là superadmin; user thường bỏ qua param.

## FE shared

| File | Việc |
|------|------|
| `superadminDashboardTabMeta.js` | Thêm tab |
| `routeAccessRegistry.js` | Thêm key |
| `DashboardTabPages.jsx` + superadmin page | Wire panel |
| `SuperadminChungTuPdfTemplatesPanel.jsx` | UI mới |
| `ChungTuExportWorkspace.jsx` | Gỡ upload UI |
| `chungTuPdfApi.js` | Optional: `includeInactive` trên list query |

## Kiểm thử tối thiểu

- Non-superadmin `POST /pdf-templates` → 403  
- Superadmin upload + list + fields + deactivate  
- User app: list chỉ active; không còn upload controls  
- Superadmin dashboard tab mở được trên `:8081`

## Ngoài phạm vi

- Form mapping dữ liệu đầu vào theo loại chứng từ  
- Reactivate / hard-delete blob document-service  
- Tab PLANNED  
- Đổi chỗ tab Cài đặt chữ ký  
- Gỡ hoàn toàn Drive template-catalog (legacy)

## Rủi ro

- User đang quen upload trên app chính — cần empty-state hướng dẫn rõ  
- Superadmin quên publish mẫu → xuất bị chặn (đúng hành vi)  
- `includeInactive` phải không lộ cho non-superadmin
