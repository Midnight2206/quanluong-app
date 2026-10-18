# API hồ sơ nghiệp vụ đơn vị (trợ lý BA)

Kênh trao đổi giữa các trợ lý business analyst (BA) ở các tài khoản khác nhau, qua app:

- **Bộ nghiệp vụ chung** (kit BA) có phiên bản: mọi trợ lý kéo bản mới nhất ở đầu mỗi lần chạy.
- **Hồ sơ đơn vị** (Markdown) + **trạng thái từng quy tắc** (`rules`): trợ lý đơn vị đẩy lên.
- **Bảng so sánh** quy tắc × đơn vị: trợ lý tổng hợp / superadmin đọc.
- **Đề xuất** thêm/sửa quy tắc CHUNG-xx: đơn vị gửi, superadmin hoặc token GLOBAL_WRITE duyệt.

**Quyền riêng tư:** token đơn vị (`UNIT_PUSH`) **không** đọc được hồ sơ, quy tắc, đề xuất hay bảng so sánh của đơn vị khác. Đơn vị chỉ thấy bộ chung và dữ liệu của chính mình. Chia sẻ giữa các đơn vị chỉ đi qua bộ chung (sau khi đề xuất được nhận và superadmin đăng phiên bản mới).

Base URL: `https://<domain>/api/ba`

## Mã khóa (token)

| Scope | Ai tạo | Làm được gì |
|---|---|---|
| `UNIT_PUSH` | Admin đơn vị (trang **Hồ sơ cá nhân** → «Mã khóa trợ lý nghiệp vụ (BA)») | Đẩy hồ sơ cho **đơn vị của mình**; đọc lịch sử đơn vị mình |
| `GLOBAL_READ` | Superadmin (superadmin → **Hồ sơ nghiệp vụ** › Hồ sơ) | Đọc hồ sơ mọi đơn vị, bảng so sánh, mọi đề xuất |
| `GLOBAL_WRITE` | Superadmin (cùng chỗ) | Như GLOBAL_READ + đăng phiên bản bộ chung + duyệt đề xuất |

Superadmin đăng nhập trên giao diện được coi như `GLOBAL_WRITE` với các route bộ chung / so sánh / đề xuất (không cần token).

- Dạng `qlba_<chuỗi ngẫu nhiên>`. Server chỉ lưu sha256 + 12 ký tự đầu để hiển thị.
- Mã **chỉ hiện một lần** khi tạo. Mất thì thu hồi và tạo mã mới.
- Lưu mã trong **biến môi trường bí mật** của trợ lý (vd. `QLBA_TOKEN`). **Không** ghi vào file, tài liệu, lịch sử chat hay hồ sơ đẩy lên (server từ chối nội dung chứa `qlba_…`).
- Thu hồi bất cứ lúc nào trên cùng trang; mã bị thu hồi trả `401` ngay.

Gửi kèm mỗi request: `Authorization: Bearer $QLBA_TOKEN`.

## Trang khởi động công khai (không token)

`GET /api/ba/start` → `text/markdown`: bản `huong-dan` mới nhất (00) đã thay `{{BASE_URL}}` bằng địa chỉ gốc, kèm phụ lục liệt kê các docKey còn lại (phiên bản, tiêu đề, cách lấy bằng token). `?format=json` → `{success, data:{baseUrl, guide:{version,title}, docs:[{docKey,version,title,url,auth}], contentMarkdown}}`.

- Chỉ `huong-dan` công khai. `nghiep-vu-chung`, `mau-ho-so`, `bo-cau-hoi` vẫn cần token (`GET /api/ba/baseline`).
- Hướng dẫn **không được** chứa bí mật: server chạy bộ dò bí mật trước khi trả; có dấu hiệu thì trả `503`. Chưa đăng `huong-dan` cũng trả `503`.
- Địa chỉ gốc lấy từ env `BA_PUBLIC_BASE_URL`, nếu không có thì `PUBLIC_WEB_URL` (không lấy từ header Host).
- Giới hạn 60 lần / 15 phút / IP (`429`), `Cache-Control: public, max-age=60`.
- Chủ đơn vị chỉ cần gửi trợ lý BA link này. Đăng lại hướng dẫn: sửa kit 00 rồi chạy `scripts/ba-seed-baseline.js`.

## Bộ nghiệp vụ chung (mọi token)

`docKey`: `huong-dan` (00), `nghiep-vu-chung` (01), `mau-ho-so` (02), `bo-cau-hoi` (03).

| Request | Token | Kết quả |
|---|---|---|
| `GET /api/ba/baseline` | bất kỳ | Bản mới nhất mỗi docKey, có `contentMarkdown`, `version`, `ruleIds` (chỉ `nghiep-vu-chung`) |
| `GET /api/ba/baseline/:docKey[?version=n]` | bất kỳ | Một tài liệu (mới nhất hoặc phiên bản n) |
| `GET /api/ba/baseline/:docKey/versions` | bất kỳ | Danh sách phiên bản (không kèm nội dung) |
| `POST /api/ba/baseline/:docKey` `{title, contentMarkdown}` | GLOBAL_WRITE / superadmin | Đăng phiên bản mới (version +1). Với `nghiep-vu-chung`, server trích các `CHUNG-xx` trong nội dung thành `ruleIds` |

Nạp kit ban đầu: `node scripts/ba-seed-baseline.js <thư-mục-kit>` (chỉ đăng khi nội dung đổi).

```bash
curl -sS "https://<domain>/api/ba/baseline" -H "Authorization: Bearer $QLBA_TOKEN"
```

## Đẩy hồ sơ (UNIT_PUSH)

`POST /api/ba/unit-profiles`

```json
{
  "title": "Hồ sơ nghiệp vụ đơn vị X — 2026-10-16",
  "contentMarkdown": "# Hồ sơ đơn vị\n| CHUNG-01 | giống | ... |",
  "schemaVersion": "ba-kit-v1",
  "sourceAgentName": "Trợ lý BA đơn vị X",
  "rules": [
    { "ruleId": "CHUNG-20", "status": "GIONG", "evidence": "QS", "note": "mẫu cktc_DD" },
    { "ruleId": "CHUNG-25", "status": "KHAC", "evidence": "CHAT", "note": "xuất theo giá bình quân" },
    { "ruleId": "RIENG-01", "status": "GIONG", "evidence": "CHU", "note": "gộp sữa vào bữa sáng" }
  ]
}
```

`rules` (tuỳ chọn, tối đa 500, không trùng `ruleId`):

| Trường | Giá trị |
|---|---|
| `ruleId` | `CHUNG-xx` (phải có trong `nghiep-vu-chung` mới nhất) hoặc `RIENG-xx` (quy tắc riêng của đơn vị) |
| `status` | `GIONG` (Giống) · `KHAC` (Khác — mô tả trong `note`) · `NA` (Không áp dụng) · `CHUA_RO` (Chưa rõ) |
| `note` | tuỳ chọn, ≤ 2000 ký tự |
| `evidence` | tuỳ chọn: `QS` · `CHAT` · `SUY` · `CHU` |

- `422` + `details.unknownRuleIds` nếu có `CHUNG-xx` không thuộc bộ chung mới nhất (hoặc chưa có bộ chung). Kéo lại `GET /api/ba/baseline` rồi đẩy lại.
- Phiên bản hồ sơ lưu kèm `baselineVersion` (phiên bản `nghiep-vu-chung` dùng để đối chiếu).

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

## Bảng so sánh (GLOBAL_READ / GLOBAL_WRITE / superadmin)

`GET /api/ba/comparison` — dùng hồ sơ **mới nhất** mỗi đơn vị:

```json
{
  "baselineVersion": 3,
  "units": [{ "unitId": 2, "unitName": "Bếp A", "profileId": 12, "version": 4, "createdAt": "…" }],
  "rules": [
    {
      "ruleId": "CHUNG-25",
      "cells": { "2": { "status": "KHAC", "note": "giá bình quân", "evidence": "CHAT" } },
      "counts": { "GIONG": 0, "KHAC": 1, "NA": 0, "CHUA_RO": 0, "MISSING": 0 },
      "giongPercent": 0
    }
  ],
  "riengByUnit": { "2": [{ "ruleId": "RIENG-01", "status": "GIONG", "note": "…", "evidence": "CHU" }] }
}
```

`giongPercent` = GIONG / (số đơn vị − MISSING − NA), `null` nếu không có đơn vị nào trả lời.

## Đề xuất (kênh trao đổi)

| Request | Token | Kết quả |
|---|---|---|
| `POST /api/ba/proposals` `{title, description?, relatedRuleIds?, proposedText}` | UNIT_PUSH | Tạo đề xuất cho đơn vị của token, `status: OPEN` |
| `GET /api/ba/proposals[?status=OPEN\|ACCEPTED\|REJECTED]` | UNIT_PUSH → chỉ của đơn vị mình; GLOBAL → tất cả | Danh sách, mới nhất trước, kèm `reviewComment`, `reviewedAt` |
| `PATCH /api/ba/proposals/:id` `{status, reviewComment?}` | GLOBAL_WRITE / superadmin | Đổi trạng thái (OPEN/ACCEPTED/REJECTED) |

Nhận đề xuất **không** tự sửa bộ chung: người duyệt sửa `01/02/03` rồi đăng phiên bản mới (`POST /api/ba/baseline/:docKey`). Nội dung đề xuất cũng bị kiểm bí mật như hồ sơ (`422`).

```bash
jq -n '{title:"Thêm quy tắc gộp sữa", relatedRuleIds:["RIENG-01","CHUNG-24"], proposedText:"CHUNG-xx: …"}' \
| curl -sS -X POST "https://<domain>/api/ba/proposals" -H "Authorization: Bearer $QLBA_TOKEN" \
    -H "Content-Type: application/json" --data-binary @-
curl -sS "https://<domain>/api/ba/proposals" -H "Authorization: Bearer $QLBA_TOKEN"
```

## Quản lý token (đăng nhập app, cookie)

- `POST /api/ba/tokens` `{ "name": "...", "scope": "UNIT_PUSH" | "GLOBAL_READ" | "GLOBAL_WRITE" }` → trả `token` (một lần). GLOBAL_* chỉ superadmin.
- `GET /api/ba/tokens` — admin: token UNIT_PUSH của đơn vị mình; superadmin: tất cả.
- `DELETE /api/ba/tokens/:id` — thu hồi.

Superadmin xem hồ sơ trên giao diện qua `GET /api/ba/admin/unit-profiles` và `/api/ba/admin/unit-profiles/:id`.

## Mã lỗi

`401` thiếu/sai/thu hồi token · `403` sai scope hoặc khác đơn vị · `413` quá dung lượng · `422` nghi chứa bí mật · `400` sai dữ liệu.
