# Design Spec: Điều khiển backup và restart

**Date:** 2026-10-07  
**Status:** Draft for review  
**Feature:** Superadmin chạy backup từ trang Backup, xem 80 dòng log, và restart container từ trang Hạ tầng  
**Phụ thuộc:** trang Backup và `queueRestore` hiện có; danh sách 11 container của spec bảng sức khỏe  
**Sau bản này:** backup đáng tin, tín hiệu ứng dụng, rồi runbook. Mỗi mảng một spec.

## 1. Problem

Trang «Hạ tầng» chỉ hiện trạng thái. Trang Backup chỉ khôi phục một ngày đã có. Superadmin muốn chạy backup ngay, đọc đuôi log, và restart một container mà không SSH.

## 2. Locked decisions

| # | Quyết định |
|---|------------|
| 1 | «Chạy backup» và «Xem log» nằm trên trang Backup. Trang Hạ tầng chỉ thêm Restart |
| 2 | Backup ghi `requests/backup.json`. Vòng watch của container backup thấy file thì chạy. Không `docker exec` |
| 3 | Sửa `ops/backup/backup.sh` đang được mount. Không tạo lại container `quanluong-backup`. Không sửa compose |
| 4 | Restart là `POST /containers/{id}/restart?t=10`. Không tạo lại container |
| 5 | Restart được 10 tên. `quanluong-backup` không có nút và không có API |
| 6 | Chỉ superadmin, middleware hiện có. Không mã quyền mới, không sửa `permission-catalog.vi.js` |
| 7 | Log không đưa vào email |

## 3. Trang Backup

«Chạy backup» dùng `useConfirm`, cùng kiểu nút Khôi phục.

| | |
|---|---|
| title | Chạy backup ngay |
| message | Lệnh được xếp hàng. Container backup chạy trong vòng khoảng 20 giây. App vẫn chạy. Nếu lần backup trước chưa xong, lệnh này lỗi và có email. |
| confirmLabel | Chạy backup |
| cancelLabel | Huỷ |

Đồng ý thì `POST /api/system-backup/backup`. Thành công thì toast «Đã nhận lệnh backup.» Nút không đợi backup xong.

«Xem log» không hỏi xác nhận. `GET /api/system-backup/log` rồi hiện các dòng trong một khối trên cùng trang. Mảng rỗng thì câu «Chưa có log.»

## 4. Phiếu backup và log

`queueBackup(root)` ghi `{ "requestedAt": "<ISO>" }` vào `requests/backup.json` với cờ `wx`, cùng cách `queueRestore` ghi file.

| Điều kiện | Kết quả |
|---|---|
| `backup.json` đã có | 409, câu «Đang có một lệnh backup.» |
| `restore.json` đã có | 409, câu «Đang có một lần khôi phục.» |
| Ghi được | 202, câu «Đã nhận lệnh backup» |

`readBackupLogTail(root)` đọc `backup.log` trong thư mục backup. Trả đúng 80 dòng cuối, giữ thứ tự. File không có (`ENOENT`) thì `[]`. Lỗi đọc khác thì ném cho error handler hiện có.

`POST /backup` và `GET /log` gắn trên `system-backup.routes.js`, sau `authMiddleware` và `superadminMiddleware`. `GET /log` trả `{ lines: string[] }` trong `data`.

Trong `watch_loop` của `ops/backup/backup.sh`, ngay sau nhánh `restore.json` và trước `manifest`:

```bash
if [[ -f "$BACKUP_DIR/requests/backup.json" ]]; then
  rm -f "$BACKUP_DIR/requests/backup.json"
  "$0" backup
fi
```

File bị xóa trước khi chạy, nên vòng 20 giây không gọi lại cùng một phiếu. Nhánh này nằm trong vòng đã `set +e`, nên `backup` thoát mã 1 không dừng watch. Lock đang bận thì `do_backup` giữ nguyên hành vi hiện tại: log `BACKUP_FAILED lock bận` và email superadmin.

## 5. Restart

Nút «Restart» trên từng dòng container của trang Hạ tầng, trừ `quanluong-backup`. `useConfirm`:

| | |
|---|---|
| title | Restart {name} |
| message | Site có thể ngắt một lúc. |
| confirmLabel | Restart |
| cancelLabel | Huỷ |
| variant | danger |

`POST /api/system-infra/containers/:name/restart`

Mười tên được phép, đúng thứ tự danh sách sức khỏe, bỏ backup:

1. `quanluong-app-be`
2. `quanluong-app-be-worker-email`
3. `quanluong-app-be-worker-media`
4. `quanluong-app-db`
5. `quanluong-app-redis`
6. `quanluong-document-db`
7. `quanluong-document`
8. `quanluong-app-qdrant`
9. `quanluong-app-ui`
10. `quanluong-app-ui-superadmin`

Tên khác, kể cả `quanluong-backup`, thì 404 câu «Không restart container này.» Không gọi Docker.

Tên hợp lệ nhưng không có trong engine thì 404 câu «Không thấy container.» Không gọi restart.

Container khác `quanluong-app-be`: gọi Docker xong rồi trả 202 câu «Đã nhận lệnh restart».

`quanluong-app-be`: trả 202 trước. Sau sự kiện `finish` của response, chờ 500 ms, rồi mới `POST` restart. Lỗi Docker ở bước trễ này chỉ ghi log.

Lệnh Docker là `POST /containers/{id}/restart?t=10`, timeout 20 giây. Lỗi socket hoặc status khác 204 thì 503 câu «Không restart được container.» Engine Docker trả 204 cho restart không có body.

## 6. Code

- `quanluong-app-be/src/modules/system-backup/system-backup.service.js` — `queueBackup`, `readBackupLogTail`
- `system-backup.controller.js`, `system-backup.routes.js` — `POST /backup`, `GET /log`
- `system-backup.service.test.js` — các ca phiếu và log ở mục 7
- `ops/backup/backup.sh` — nhánh `backup.json` trong `watch_loop`
- `quanluong-app-be/src/modules/system-infra/system-infra.docker.js` — `dockerPost`
- `system-infra.restart.js` — `RESTARTABLE_CONTAINERS`, `restartContainer(name, deps)`
- `system-infra.restart.test.js`
- `system-infra.controller.js`, `system-infra.routes.js` — route restart
- `packages/shared/src/features/system-backup/api/systemBackupApi.js` — mutation backup và query log
- `SuperadminBackupPanel.jsx` — hai nút
- `packages/shared/src/features/system-infra/api/systemInfraApi.js` — mutation restart
- `SuperadminInfraPanel.jsx` — nút Restart từng dòng

## 7. Tests

`node --test` trên `system-backup.service.test.js` và `system-infra.restart.test.js`. Không mở socket, không ghi volume thật, không gửi mail.

- `queueBackup` tạo JSON có `requestedAt`. Lần ghi thứ hai, khi file còn, thì 409 «Đang có một lệnh backup.»
- Có `restore.json` thì 409 «Đang có một lần khôi phục.» và không tạo `backup.json`
- Log 100 dòng trả đúng 80 dòng cuối. Không có file thì `[]`
- Restart `quanluong-backup` và tên `quanluong-app-be-migrate` thì 404, hàm Docker không được gọi
- Restart `quanluong-app-db` gọi `POST /containers/{id}/restart?t=10` với id mà list trả về
- Restart `quanluong-app-be` trả kết quả trước; hàm restart chỉ được gọi sau callback kết thúc response

`backup.sh` không có test runner. Nhánh mới được kiểm tra bằng diff: xóa `backup.json` rồi gọi `"$0" backup`, đặt sau nhánh restore và trước `manifest`.

## 8. Out of scope

- Email nội dung log
- `docker exec`
- Tạo lại container hoặc image `quanluong-backup`
- Sửa compose, mount, cron expression
- Restart hàng loạt
- Thử khôi phục định kỳ, checksum, tín hiệu 5xx, runbook
- Mã quyền mới
