# Design Spec: Bảng sức khỏe hạ tầng

**Date:** 2026-10-07  
**Status:** Draft for review  
**Feature:** Trang superadmin xem đĩa máy chủ, backup đêm, và container trong stack  
**Sau bản này:** cảnh báo email, rồi nút restart. Hai mảng đó có spec riêng.

## 1. Problem

Superadmin không thấy hạ tầng nếu không SSH. Container backup có thể vẫn Up trong khi cron 02:15 không chạy. API `/health` chỉ trả một câu backend còn sống. Đĩa VPS đầy không hiện ở đâu trong app.

## 2. Locked decisions

| # | Quyết định |
|---|------------|
| 1 | Bản này chỉ xem. Không email, không start/stop/restart, không `docker exec` |
| 2 | Chỉ superadmin, cổng `apps/superadmin`, mục sidebar «Hạ tầng» cạnh Backup |
| 3 | `GET /api/system-infra`, middleware giống backup: đăng nhập rồi superadmin |
| 4 | Container lấy từ Docker socket gắn vào service `app` |
| 5 | Đĩa lấy từ mount chỉ đọc `/` của máy chủ tại `/host` trong container app. Engine API không có `df /` |
| 6 | Backup đêm đọc `backup.log` trên volume `backup_data` đã gắn tại `/var/backups/quanluong` |
| 7 | Container đang chạy không làm dòng backup thành `ok` |
| 8 | Response không chứa env, bản inspect thô, hay log thô |
| 9 | `quanluong-app-be-migrate` không có trong bảng |

## 3. What the page shows

Một bảng. Mỗi dòng có `status` là `ok`, `warn`, `down`, hoặc `unknown`, cộng một câu tiếng Việt. Mở trang thì gọi API một lần. Query của trang này tải lại mỗi 30 giây khi trang còn mở.

### Đĩa

Đọc dung lượng `/host`. `usedPercent = usedBytes / totalBytes * 100`.

| Điều kiện | status |
|---|---|
| Không đọc được, hoặc `totalBytes <= 0` | `unknown` |
| `usedPercent >= 90` | `down` |
| `usedPercent >= 80` | `warn` |
| Còn lại | `ok` |

Câu hiện phần trăm, số đã dùng và số còn trống.

### Backup đêm

Mốc là 02:15 `Asia/Ho_Chi_Minh`. Nếu giờ địa phương đã qua 02:15 hôm nay, ngày mốc là hôm nay. Nếu chưa tới 02:15, ngày mốc là hôm qua.

Đọc `/var/backups/quanluong/backup.log`. Không đọc được file thì `unknown`.

Mỗi dòng log bắt đầu bằng thời điểm ISO, như `2026-10-07T02:16:01+07:00`. Một lần chạy bắt đầu ở dòng `backup bắt đầu day=YYYY-MM-DD`. Lần đó kết thúc ở dòng `backup xong` sau đó (thành công) hoặc dòng `BACKUP_FAILED` sau đó (lỗi). Dòng bắt đầu chưa có dòng kết thúc là lần đang mở. Dòng bắt đầu không có thời điểm ISO thì không được tính là đang chạy.

Chấm theo sự kiện mới nhất:

| Sự kiện mới nhất | status | Câu |
|---|---|---|
| Lần đang mở, ngày của lần đó >= ngày mốc, và dòng bắt đầu cách lúc kiểm tra dưới 3 giờ | `warn` | Backup đang chạy |
| Lần đang mở đã quá 3 giờ, hoặc ngày của lần đó cũ hơn ngày mốc | `warn` | Backup bắt đầu nhưng không thấy kết thúc |
| Lần kết thúc là lỗi | `warn` | Backup lỗi, kèm ngày `day=` của lần đó |
| Lần thành công có `day` >= ngày mốc | `ok` | Backup xong, kèm ngày đó |
| Lần thành công có `day` cũ hơn ngày mốc, hoặc log không có lần nào | `warn` | Chưa có backup xong cho mốc 02:15 gần nhất |

`status.json` không đổi các quy tắc trên. Trường `lastSuccessDay` lấy từ lần `backup xong` mới nhất, `null` nếu chưa có.

### Container

Đúng các tên này, đúng thứ tự:

1. `quanluong-app-be`
2. `quanluong-app-be-worker-email`
3. `quanluong-app-be-worker-media`
4. `quanluong-app-db`
5. `quanluong-app-redis`
6. `quanluong-document-db`
7. `quanluong-document`
8. `quanluong-app-qdrant`
9. `quanluong-backup`
10. `quanluong-app-ui`
11. `quanluong-app-ui-superadmin`

Mỗi lần gọi socket timeout 2 giây. Danh sách container và các lần inspect chạy song song. Socket lỗi hoặc quá hạn thì mọi dòng container là `unknown` với câu «Không đọc được Docker». Các dòng đĩa và backup vẫn trả bình thường.

Khi socket đọc được:

| State | status | Câu |
|---|---|---|
| Không có trong danh sách engine | `down` | không thấy container |
| status khác `running` | `down` | đã dừng |
| `running` và `State.Health.Status` là `healthy` | `ok` | đang chạy khỏe |
| `running` và health là `unhealthy` | `down` | lỗi healthcheck |
| `running` và health là `starting` | `warn` | đang khởi động |
| `running` và không có healthcheck | `ok` | đang chạy |

## 4. API

`GET /api/system-infra`

```json
{
  "checkedAt": "2026-10-07T03:15:00.000Z",
  "disk": {
    "status": "ok",
    "message": "Đã dùng 40% — còn 20 GB",
    "totalBytes": 100,
    "usedBytes": 40,
    "freeBytes": 60,
    "usedPercent": 40
  },
  "backup": {
    "status": "ok",
    "message": "Backup xong ngày 2026-10-07",
    "lastSuccessDay": "2026-10-07"
  },
  "containers": [
    { "name": "quanluong-app-db", "status": "ok", "message": "đang chạy khỏe" }
  ]
}
```

`containers` luôn đủ 11 tên ở mục 3 khi socket lỗi (tất cả `unknown`) và khi socket đọc được. Không có trường env, args, mounts, hay nội dung log.

Người chưa đăng nhập hoặc không phải superadmin nhận lỗi từ middleware hiện có, cùng cách với `/api/system-backup`.

## 5. Code

Backend, cùng kiểu `system-backup`:

- `quanluong-app-be/src/modules/system-infra/system-infra.classify.js` — hàm thuần `classifyDisk`, `classifyBackupLog`, `classifyContainer`
- `system-infra.classify.test.js` — các ca ở mục 6
- `system-infra.docker.js` — HTTP qua unix socket `/var/run/docker.sock`, list và inspect, timeout 2 giây. Không gọi endpoint nào khác
- `system-infra.service.js` — đọc `/host`, đọc log, gọi docker, ghép response
- `system-infra.controller.js`, `system-infra.routes.js`
- Gắn router trong `quanluong-app-be/src/app/routes.js` tại `/system-infra`

Frontend:

- `routeAccessRegistry.js`: key `dashboard-infra`, `requiredPermissions: []`, mô tả trang giám sát hạ tầng
- `superadminDashboardTabMeta.js`: path `infra`, nhãn «Hạ tầng», section «Hệ thống»
- `SuperadminInfraPanel.jsx` và `DashboardInfraPage` trong `DashboardTabPages.jsx`
- API React Query `GET /system-infra`, `refetchInterval: 30000`
- `apps/superadmin/app/(private)/dashboard/infra/page.jsx` bọc `RouteApiGuard` với `dashboard-infra`

Docker:

- Service `app` trong `docker-compose.yml` thêm:
  - `/var/run/docker.sock:/var/run/docker.sock`
  - `/:/host:ro`
- `docker-compose.dev.yml` khai báo lại `volumes` của `app`. Sau khi thêm mount ở file gốc, chạy `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` và xác nhận service `app` vẫn có socket, `/host`, và `backup_data:/var/backups/quanluong`. Mount nào biến mất thì thêm vào file dev. Không nhân đôi một target.

Socket này tương đương quyền root trên máy. Bản này chỉ list và inspect.

Trên OrbStack, `/host` là đĩa của máy Linux mà Docker đang chạy, không phải đĩa macOS bên ngoài VM.

## 6. Tests

`node --test` trên `system-infra.classify.test.js`. Không mở socket, không đọc đĩa thật.

- Đĩa: 79% `ok`, 80% `warn`, 90% `down`, total 0 `unknown`
- Backup, giả định `now` là 2026-10-07 10:00 +07 (ngày mốc 2026-10-07):
  - log kết thúc bằng `backup bắt đầu day=2026-10-07` rồi `backup xong` → `ok`, `lastSuccessDay` là ngày đó
  - log kết thúc bằng `BACKUP_FAILED` → `warn`
  - lần `backup xong` cuối là `day=2026-10-06` → `warn`
  - `backup bắt đầu day=2026-10-07` lúc 09:00, chưa có dòng kết thúc → `warn` đang chạy
  - cùng dòng bắt đầu lúc 06:00, chưa kết thúc → `warn` không thấy kết thúc
  - dòng bắt đầu không có thời điểm ISO, chưa kết thúc → `warn` không thấy kết thúc
  - log rỗng → `warn` chưa có backup xong
- Backup, `now` là 2026-10-07 01:00 +07 (ngày mốc 2026-10-06): `backup xong` của `day=2026-10-06` → `ok`
- Container: health `healthy` → `ok` câu «đang chạy khỏe»; `unhealthy` → `down`; `starting` → `warn`; `running` không health → `ok` câu «đang chạy»; `exited` → `down` câu «đã dừng»; không có trong danh sách engine → `down` câu «không thấy container»
- Hàm ghép response, khi docker throw, trả 11 dòng `unknown` và vẫn trả đĩa cùng backup nếu hai nguồn đó có dữ liệu

## 7. Out of scope

- Email khi backup lỗi, dịch vụ chết, hoặc đĩa gần đầy
- Nút chạy backup, xem log đầy đủ, restart dịch vụ
- Container migrate
- `docker system df`
- Tạo lại image hoặc container `quanluong-backup`
