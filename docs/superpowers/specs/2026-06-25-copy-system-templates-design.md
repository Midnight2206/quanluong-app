# Sao chép mẫu chứng từ từ Drive hệ thống sang Drive user

Ngày: 2026-06-25

## Mục tiêu

User mới liên kết Google Drive không phải tự tạo lại mẫu chứng từ quyết toán. App sao chép
mẫu từ Drive tài khoản hệ thống (`CHUNG_TU_SYSTEM_DRIVE_REFRESH_TOKEN`) sang thư mục mẫu trên
Drive của chính user, để user sở hữu và chỉnh sửa bản sao của mình.

## Quyết định đã chốt

- **Kích hoạt:** cả hai — tự động sau khi liên kết Drive lần đầu (best-effort) + nút bấm thủ công
  để đồng bộ lại sau này.
- **Trùng lặp:** bỏ qua mẫu đã có cùng tên trong folder loại của user (không đè chỉnh sửa của user).
- **Phạm vi:** sao chép tất cả loại chứng từ (`bang-ke-mua-hang`, `phieu-xuat-kho`, `phieu-nhap-kho`).
- **Cross-account:** token hệ thống chia sẻ quyền `reader` cho email Google đã liên kết của user
  trên từng file mẫu; sau đó token user `files.copy` vào Drive của user (user sở hữu bản sao).

## Kiến trúc

### Backend

`shared/utils/google-drive-fetch.api.js` — bổ sung cho `createDriveClient`:
- `permissions.create({ fileId, requestBody, ...query })`
- `about.get({ fields })`

`modules/chung-tu-quyet-toan/chung-tu-template-seed.service.js` (mới):
- `seedUserTemplatesFromSystem({ userId })`:
  1. System context: `createSystemChungTuDriveOAuthClient()` + `resolveSystemChungTuTemplateFolder()`
     + resolve folder con theo từng loại (`ensureChildFolder`).
  2. User context: `getUserChungTuDriveContext(userId)` (template root + folder con loại) +
     email user qua `about.get`.
  3. Mỗi loại: liệt kê mẫu Sheets/Docs ở hệ thống → share `reader` cho email user (bỏ qua nếu đã
     share) → nếu folder user chưa có mẫu trùng tên thì `files.copy` (bằng token user) vào folder loại.
  4. Trả `{ summary: { [categoryKey]: { copied, skipped, available } }, totals: {...} }`.

`modules/auth/google-drive-link.service.js` — trong `exchangeCodeAndLinkDrive`, sau khi tạo
workspace folders, gọi `seedUserTemplatesFromSystem({ userId })` trong try/catch best-effort
(lỗi seeding chỉ log cảnh báo, không làm hỏng việc liên kết). Tránh import vòng: import động hoặc
đặt seed service phụ thuộc vào link service (một chiều).

`modules/chung-tu-quyet-toan/`:
- route mới `POST /api/chungtuquyettoan/templates/seed-from-system` (permission
  `LTTP_ISSUE_SLIPS_WRITE`, không thêm permission mới).
- controller `seedTemplatesFromSystemController` → gọi service → `respondSuccess` kèm summary.

### Frontend

`features/chung-tu-quyet-toan/api/chungTuTemplateSeedApi.js` (mới): mutation gọi endpoint.

`pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx`: nút **«Sao chép mẫu từ hệ thống»** cạnh
khu vực picker; sau khi chạy hiện toast tóm tắt (đã chép / bỏ qua) rồi invalidate query
`template-tree` để refetch danh sách mẫu. Chỉ hiện khi user có quyền ghi.

## Xử lý lỗi

- Auto (lúc link): best-effort, log `warn`, không chặn liên kết.
- Thủ công: trả lỗi rõ ràng:
  - chưa liên kết Drive (`getUserChungTuDriveContext` ném 400),
  - chưa cấu hình token hệ thống (`createSystemChungTuDriveOAuthClient` ném 503),
  - không có mẫu nào ở hệ thống → summary `available: 0`, toast thông báo.

## Ngoài phạm vi (YAGNI)

- Không đồng bộ ngược (user → hệ thống).
- Không ghi đè/xoá mẫu user.
- Không sao chép fillRules/catalog metadata theo file (giữ nguyên cơ chế hiện có dựa trên tên
  hiển thị + folder path).
