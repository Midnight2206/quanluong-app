# Excel microservice (Python) — khung nền tảng

Ngày: 2026-08-16

## Mục tiêu

Dựng **microservice Python chuyên Excel** làm nền tảng dùng chung: Node BE gọi nội bộ để parse / export `.xlsx`. Phase này chỉ khung (health + 2 API generic), **chưa** gắn module nghiệp vụ (LTTP, chấm cơm, bếp…).

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Vai trò | Nền tảng Excel dùng chung (parse / export); module gọi dần sau |
| MVP | Khung: health + parse + export — không gắn nghiệp vụ |
| Gọi | HTTP nội bộ Docker; FE không gọi trực tiếp |
| Auth | Header `X-Service-Key` = `EXCEL_SERVICE_KEY` |
| Stack | FastAPI + Uvicorn + openpyxl |
| Vị trí | `services/excel-service/` ở root monorepo |
| Compose | Service `excel`, không publish port ra host mặc định |
| Node | Client mỏng + env; chưa migrate ExcelJS hiện có |

## Kiến trúc

```
FE → Node BE (quanluong-app-be)
         │  X-Service-Key
         ▼
    excel:8000  (FastAPI, mạng Docker only)
```

- `services/excel-service/`: `app/main.py`, `app/auth.py`, `app/parse.py`, `app/export.py`, `tests/`, `requirements.txt`, `Dockerfile`
- Không dùng pandas / queue / fill-template trong khung

## API

### `GET /health`
- Không cần key (Docker healthcheck)
- `{ "ok": true, "service": "excel" }`

### `POST /v1/parse`
- Header: `X-Service-Key` (bắt buộc)
- Body: `multipart/form-data`, field `file` (`.xlsx`, max **5 MB**)
- Query: `sheet` (optional; mặc định sheet đầu)
- Response:

```json
{
  "sheet": "Sheet1",
  "sheets": ["Sheet1", "Sheet2"],
  "rows": [
    { "r": 1, "c": ["Mã", "Tên", "SL"] },
    { "r": 2, "c": ["A01", "Gạo", 10] }
  ]
}
```

- Ô trống → `null`. Đọc giá trị ô (cached formula value nếu có).
- Sai key → `401`. Không phải xlsx / quá lớn / sheet không tồn tại → `400` `{ "error": { "code", "message" } }`.

### `POST /v1/export`
- Header: `X-Service-Key`
- Body JSON: `{ "sheet": "Sheet1", "rows": [ ["Mã","Tên"], ["A01","Gạo"] ] }`
- Response: binary `.xlsx`, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="export.xlsx"`
- `rows` rỗng / không phải mảng 2D → `400`

## Node BE

Env:
- `EXCEL_SERVICE_URL` — Docker mặc định `http://excel:8000`; trống = tắt
- `EXCEL_SERVICE_KEY` — shared secret (cùng giá trị trên service `excel`)

Client: `quanluong-app-be/src/services/excel-service.client.js`
- `parseWorkbook(buffer, { sheet? })` → JSON
- `exportWorkbook({ sheet, rows })` → `Buffer`
- Timeout ~15s; 4xx → `AppError` 400; 5xx/network → 502
- URL trống → lỗi rõ «chưa cấu hình», không treo

Document trong `.env.example` / `.env.docker.example`. Compose: `app` depends_on `excel` (healthy).

## Giới hạn & ngoài phạm vi

- Không: `.xls` legacy, multi-sheet export, style/merge, streaming lớn, fill template, Redis queue, FE gọi trực tiếp
- Không migrate LTTP / meal-roster / chứng từ sang service trong phase này
- Không log nội dung file

## Nghiệm thu

1. Compose lên → `excel` healthy; Node gọi được `GET /health`
2. Parse `.xlsx` mẫu 2 hàng → JSON đúng
3. Export JSON đó → mở được bằng Excel/LibreOffice
4. Sai key → 401; file >5 MB → 400
5. `EXCEL_SERVICE_URL` trống → client báo chưa cấu hình
6. Self-check Python: parse/export round-trip trong `tests/` (pytest hoặc unittest)

## Phase sau (không làm ở khung)

Fill template; gắn LTTP/meal-roster; queue job lớn; auth JWT nếu cần expose.
