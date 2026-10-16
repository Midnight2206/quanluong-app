# Design Spec: Cảnh báo hạ tầng qua email

**Date:** 2026-10-07  
**Status:** Draft for review  
**Feature:** API tự gửi một email khi đĩa hoặc container đang cảnh báo hoặc sự cố  
**Phụ thuộc:** `readInfra` của spec bảng sức khỏe hạ tầng  
**Sau bản này:** điều khiển an toàn, backup đáng tin, tín hiệu ứng dụng, rồi runbook. Mỗi mảng một spec.

## 1. Problem

Trang «Hạ tầng» chỉ kiểm tra khi có người mở. Đĩa gần đầy hoặc container dừng giữa đêm không thành một email. Backup đêm đã tự gửi thư riêng từ `backup.sh`. Đĩa và container thì chưa.

## 2. Locked decisions

| # | Quyết định |
|---|------------|
| 1 | Một email tại 02:00, 08:00, 14:00 và 20:00 `Asia/Ho_Chi_Minh`. Mốc 08:00 là một lần trong chu kỳ 6 giờ, không có thư gom thêm |
| 2 | Cron chạy trong process API. Worker email và worker media không đăng ký lịch này |
| 3 | Nguồn dữ liệu là `readInfra()`. Không đọc socket hay đĩa theo đường khác |
| 4 | Chỉ dòng đĩa và container có `status` `warn` hoặc `down`. Bỏ `ok` và `unknown` |
| 5 | Object `backup` không vào thư này, kể cả khi `warn` hoặc `down`. `backup.sh` đã gửi |
| 6 | Không còn dòng nào thì không gửi |
| 7 | Một thư liệt kê mọi dòng còn lại. Không gửi một thư mỗi dòng |
| 8 | Người nhận giống thư backup: user `superadmin` đang hoạt động, cộng `SUPERADMIN_EMAIL`, bỏ địa chỉ không có `@` và địa chỉ kết thúc bằng `.local` |
| 9 | App tắt đúng lúc mốc thì mốc đó mất. Không gửi bù khi process lên lại. Không lưu mốc đã gửi |
| 10 | Không trang mới, không nút, không bảng database, không sửa compose, không sửa container backup |

## 3. What the email contains

Tiêu đề cố định: `[Quân lương] Hạ tầng cần xem`.

Thứ tự dòng:

1. Đĩa, nếu `disk.status` là `warn` hoặc `down`. Câu là `disk.message` nguyên văn.
2. Các container trong đúng thứ tự `containers` của `readInfra`, mỗi dòng khi `status` là `warn` hoặc `down`. Câu là `{name}: {message}`.

Ví dụ khi đĩa 85% và database đã dừng:

```
Đã dùng 34 GB (85%) — còn 6 GB
quanluong-app-db: đã dừng
```

Phần text nối các dòng bằng ký tự xuống dòng. Phần HTML là một đoạn `<p>` đã escape cho mỗi dòng.

Container còn `warn` với câu «đang khởi động» tại thời điểm mốc thì dòng đó có trong thư.

`checkedAt` không đưa vào thư.

## 4. Schedule and delivery

`server.js` đăng ký:

```js
registerSchedule("0 2,8,14,20 * * *", task, { name: "infra-health-mail" })
```

`registerSchedule` đã mặc định múi giờ `Asia/Ho_Chi_Minh`. Task:

1. `report = await readInfra()`
2. `lines = infraAlertLines(report)`
3. Nếu `lines` rỗng, dừng
4. Tải người nhận bằng cùng truy vấn với `deliverBackupReport`: `deletedAt: null`, `isActive: true`, `type.name` là `superadmin`, rồi `backupReportRecipients(users, config.auth.superadminEmail)`
5. Nếu không có người nhận, ghi log cảnh báo và dừng
6. Gửi lần lượt. Một địa chỉ ném lỗi thì ghi log và gửi địa chỉ tiếp theo

Đường gửi là SMTP hoặc Gmail API, cùng nhánh với `sendBackupReportEmail`. Mail chưa cấu hình thì hàm gửi trả `false` và ghi log, cron vẫn còn đăng ký.

`readInfra` đã nuốt lỗi đĩa, log backup và Docker thành `unknown` hoặc một report đủ dòng. Task không bắt thêm các lỗi đó. Nếu `readInfra` vẫn ném, `registerSchedule` ghi log và nuốt, cùng các lịch khác trong `server.js`.

Giả định một process API. Hai process cùng lịch sẽ gửi hai thư. Không có khóa database cho trường hợp đó.

## 5. Code

- `quanluong-app-be/src/modules/system-infra/system-infra.alert.js` — `infraAlertLines(report)` thuần, trả `string[]`
- `system-infra.alert.test.js` — các ca ở mục 6
- `system-infra.alert-mail.js` — `deliverInfraAlert(report, deps)`. `deps.recipients` là danh sách email. `deps.send` là hàm gửi một người. Production truyền người nhận đã lọc và hàm gửi thư hạ tầng
- `quanluong-app-be/src/infra/mail/send-infra-alert-email.js` — tiêu đề, text, html, và cùng cách chọn transport với `send-backup-report-email.js`
- `quanluong-app-be/src/server.js` — thêm lịch `infra-health-mail` cạnh lịch backup

Không sửa `backup.sh`, `system-backup.notify.js` (chỉ gọi `backupReportRecipients`), compose, hay frontend.

## 6. Tests

`node --test` trên `system-infra.alert.test.js`. Không mở socket, không đọc đĩa, không gửi mail thật.

`infraAlertLines`:

- Đĩa `ok`, mọi container `ok`, backup `warn` → `[]`
- Đĩa `unknown`, container `ok` → `[]`
- Đĩa `warn` → một phần tử, đúng `disk.message`
- Một container `down`, một container `warn`, một `unknown`, một `ok` → đúng hai dòng, đúng thứ tự trong mảng, dạng `tên: câu`
- `lines` rỗng → `deliverInfraAlert` không gọi `send`
- `recipients` rỗng và có dòng `warn` → không gọi `send`
- Người nhận đầu khiến `send` ném lỗi, người nhận sau vẫn được gọi với cùng các dòng

## 7. Out of scope

- Email khi trạng thái trở lại `ok`
- Gửi bù mốc đã lỡ
- Đưa backup đêm vào thư này
- Đưa dòng `unknown` vào thư
- Telegram, Slack
- Nút restart, chạy backup, xem log
- Thử khôi phục backup, retention trên trang, checksum
- Tỷ lệ 5xx, độ trễ, runbook
- Sửa image hoặc container `quanluong-backup`
