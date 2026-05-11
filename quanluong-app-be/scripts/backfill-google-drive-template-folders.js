/**
 * (Đã lỗi thời) Trước đây tạo thư mục `chung-tu-quyet-toan-template` dưới `midnight-app` trên Drive của từng user đã liên kết.
 * Mẫu chứng từ hiện lấy từ Drive tài khoản hệ thống (env CHUNG_TU_SYSTEM_DRIVE_REFRESH_TOKEN); script này không còn tác dụng.
 *
 * Giữ file để `npm run db:backfill-drive-template` báo rõ và thoát 0.
 */
console.log(
  "[backfill-google-drive-template-folders] Bỏ qua: không còn folder template per-user — cấu hình CHUNG_TU_SYSTEM_DRIVE_REFRESH_TOKEN và tùy chọn CHUNG_TU_SYSTEM_TEMPLATE_FOLDER_ID.",
);
