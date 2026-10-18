# API hồ sơ nghiệp vụ đơn vị (trợ lý BA)

Kho lưu hồ sơ nghiệp vụ dạng Markdown, có phiên bản theo đơn vị. Trợ lý business analyst (bot) của từng đơn vị **đẩy** hồ sơ; trợ lý tổng hợp **đọc** bản mới nhất của mọi đơn vị.

Base URL: `https://<domain>/api/ba`

## Mã khóa (token)

| Scope | Ai tạo | Làm được gì |
|---|---|---|
| `UNIT_PUSH` | Admin đơn vị (trang **Hồ sơ cá nhân** → «Mã khóa trợ lý nghiệp vụ (BA)») | Đẩy hồ sơ cho **đơn vị của mình**; đọc lịch sử đơn vị mình |
| `GLOBAL_READ` | Superadmin (superadmin → **Hồ sơ nghiệp vụ**) | Đọc hồ sơ mọi đơn vị |

- Dạng `qlba_<chuỗi ngẫu nhiên>`. Server chỉ lưu sha256 + 12 ký tự đầu để hiển thị.
- Mã **chỉ hiện một lần** khi tạo. Mất thì thu hồi và tạo mã mới.
- Lưu mã trong **biến môi trường bí mật** của trợ lý (vd. `QLBA_TOKEN`). **Không** ghi vào file, tài liệu, lịch sử chat hay hồ sơ đẩy lên (server từ chối nội dung chứa `qlba_…`).
- Thu hồi bất cứ lúc nào trên cùng trang; mã bị thu hồi trả `401` ngay.

Gửi kèm mỗi request: `Authorization: Bearer $QLBA_TOKEN`.

## Đẩy hồ sơ (UNIT_PUSH)

`POST /api/ba/unit-profiles`

```json
{
  "title": "Hồ sơ nghiệp vụ đơn vị X — 2026-10-16",
  "contentMarkdown": "# Hồ sơ đơn vị\n| CHUNG-01 | giống | ... |",
  "schemaVersion": "ba-kit-v1",
  "sourceAgentName": "Trợ lý BA đơn vị X"
}
```

- `unitId` lấy từ token, **không** nhận từ body.
- Mỗi lần đẩy tạo phiên bản mới (`version` tăng dần theo đơn vị). Không sửa/xoá bản cũ.
- Nội dung tối đa ~950 KB (body JSON toàn app giới hạn 1 MB).
- `422` nếu nội dung có vẻ chứa bí mật: `password/mật khẩu: …`, `Bearer <token>`, khóa riêng `-----BEGIN … PRIVATE KEY-----`, mã `qlba_…`. Xoá phần đó rồi đẩy lại. Hồ sơ cũng không nên chứa họ tên người, số điện thoại, mã máy.

```bash
# Nội dung lấy từ file hồ sơ; token lấy từ biến môi trường bí mật
jq -n --rawfile md 02-ho-so-don-vi.md \
  '{title:"Hồ sơ đơn vị X", contentMarkdown:$md, schemaVersion:"ba-kit-v1", sourceAgentName:"Trợ lý BA"}' \
| curl -sS -X POST "https://<domain>/api/ba/unit-profiles" \
    -H "Authorization: Bearer $QLBA_TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary @-
# → 201 {"success":true,"data":{"id":12,"unitId":3,"version":4}}
```

## Đọc

| Request | Token | Kết quả |
|---|---|---|
| `GET /api/ba/unit-profiles?latest=1` | GLOBAL_READ | Bản mới nhất mỗi đơn vị (không kèm nội dung): `id, unitId, unitName, version, title, schemaVersion, sourceAgentName, createdAt` |
| `GET /api/ba/unit-profiles?unitId=3` | GLOBAL_READ, hoặc UNIT_PUSH của đơn vị 3 | Lịch sử phiên bản, mới nhất trước |
| `GET /api/ba/unit-profiles` | UNIT_PUSH | Lịch sử đơn vị của token |
| `GET /api/ba/unit-profiles/:id` | GLOBAL_READ, hoặc UNIT_PUSH cùng đơn vị | Đầy đủ, có `contentMarkdown` |

```bash
curl -sS "https://<domain>/api/ba/unit-profiles?latest=1" -H "Authorization: Bearer $QLBA_TOKEN"
curl -sS "https://<domain>/api/ba/unit-profiles/12"       -H "Authorization: Bearer $QLBA_TOKEN"
```

## Quản lý token (đăng nhập app, cookie)

- `POST /api/ba/tokens` `{ "name": "...", "scope": "UNIT_PUSH" | "GLOBAL_READ" }` → trả `token` (một lần).
- `GET /api/ba/tokens` — admin: token UNIT_PUSH của đơn vị mình; superadmin: tất cả.
- `DELETE /api/ba/tokens/:id` — thu hồi.

Superadmin xem hồ sơ trên giao diện qua `GET /api/ba/admin/unit-profiles` và `/api/ba/admin/unit-profiles/:id`.

## Mã lỗi

`401` thiếu/sai/thu hồi token · `403` sai scope hoặc khác đơn vị · `413` quá dung lượng · `422` nghi chứa bí mật · `400` sai dữ liệu.
