/**
 * Mẫu Apps Script: tạo Google Sheet trong thư mục midnight-app.
 *
 * Cách dùng nhanh:
 * 1. script.google.com → dự án mới → dán file này.
 * 2. Thay YOUR_FOLDER_ID bằng ID thư mục (lấy từ API / giao diện sau khi liên kết Drive).
 * 3. Chạy hàm `createSampleLedgerInMidnightApp` một lần → cho phép quyền Drive khi được hỏi.
 *
 * Lưu ý: Tạo thư mục gốc midnight-app do backend đảm nhiệm (OAuth Drive API).
 */
function createSampleLedgerInMidnightApp() {
  var folderId = 'YOUR_FOLDER_ID';
  var folder = DriveApp.getFolderById(folderId);
  var ss = SpreadsheetApp.create('So-mau-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  var file = DriveApp.getFileById(ss.getId());
  file.moveTo(folder);
  Logger.log('Created: %s', ss.getUrl());
}
