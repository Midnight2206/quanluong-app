# Apps Script — mở rộng sổ sách trong `midnight-app`

Backend đã tạo thư mục **midnight-app** trên Google Drive của người dùng (sau OAuth, scope `drive.file`). Mã trong repo dùng **Google Drive API từ Node.js**, không bắt buộc Apps Script cho bước tạo thư mục.

Apps Script phù hợp khi bạn muốn:

- Sinh Google Sheets / mẫu sổ trong đúng thư mục
- Trigger theo giờ, form, hoặc nút menu
- Logic phức tạp gắn với từng bảng tính

## Gợi ý tích hợp

1. Trên UI (sau khi liên kết), copy **folder ID** hiển thị trên trang chủ khi đã liên kết Drive.
2. Trong Apps Script (dự án độc lập hoặc bound spreadsheet), dùng `DriveApp.getFolderById('<ID>')` để tạo file con — **chỉ chạy được khi tài khoản Google chạy script có quyền vào folder đó** (thường là cùng user đã OAuth cho app).

## File mẫu

- `Code.gs` — ví dụ tạo một Google Sheet trống trong folder (cần thay `FOLDER_ID` hoặc đọc từ `PropertiesService`).

Đặt **Origin / OAuth consent** của Google Cloud giống hướng dẫn backend (`GOOGLE_*` trong `.env.example`).
