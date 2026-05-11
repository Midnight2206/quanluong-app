/**
 * Google Apps Script — mẫu điền dữ liệu vào Google Doc (chứng từ quyết toán).
 *
 * Cách dùng:
 * 1. Mở script.google.com → Dự án mới → dán nội dung file này.
 * 2. Hoặc trong Google Doc: Tiện ích mở rộng → Apps Script → dán → Lưu → chạy thử `fillPlaceholdersSample`.
 * 3. Trong Doc mẫu, đặt token dạng {{TEN_BIEN}} khớp với map trong `REPLACEMENTS`.
 *
 * Vùng (regions): dùng anchor văn bản (ví dụ <<BAT_DAU_BANG>> … <<KET_THUC_BANG>>) rồi xử lý
 * `insertParagraph` / bảng trong phạm vi — tuỳ nghiệp vụ.
 */

/** @type {Record<string, string>} */
const REPLACEMENTS_SAMPLE = {
  "{{MAU_TOKEN}}": "Giá trị thay thế",
  "{{NGAY}}": Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy"),
};

/**
 * Chạy trong Doc đang mở: thay toàn bộ token có trong REPLACEMENTS_SAMPLE.
 */
function fillPlaceholdersSample() {
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();
  Object.keys(REPLACEMENTS_SAMPLE).forEach((token) => {
    body.replaceText(token, REPLACEMENTS_SAMPLE[token]);
  });
}

/**
 * @param {string} docId — ID file Google Doc (từ URL).
 * @param {Record<string, string>} replacements
 */
function fillPlaceholdersByDocId(docId, replacements) {
  const doc = DocumentApp.openById(docId);
  const body = doc.getBody();
  Object.keys(replacements).forEach((token) => {
    body.replaceText(token, replacements[token]);
  });
}
