# LTTP phiếu xuất — PDF field map, chữ ký theo đơn vị, fix capture Đặt hàng

Ngày: 2026-09-21  
Liên quan: `2026-09-17-lttp-phieu-xuat-document-service-template.md`, CTQT `ChungTuSignatureSettings`  
Phạm vi: Nhập xuất LTTP (phiếu xuất + cài đặt chữ ký + Đặt hàng mobile capture)

## Vấn đề

1. Mẫu Excel `lttp-phieu-xuat` cần map field rõ nguồn (người viết / người nhận / phiếu / cài đặt đơn vị).  
2. Cài đặt chữ ký LTTP cần UI/logic giống CTQT nhưng **theo đơn vị kho** (không global category).  
3. Tab Đặt hàng trên mobile không chụp được toàn bộ bảng.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Scope chữ ký | Theo **đơn vị kho** (`unitId` storage) |
| Lưu settings | Bảng mới `LttpIssueSlipSignatureSettings` (không nhét vào form defaults, không đụng CTQT global) |
| UI settings | Tab mới trong Nhập xuất LTTP |
| `ngay_nhan` | Trên **từng phiếu** (`receivedDate`), mặc định = `issueDate` |
| `bo_phan` | `recipientUser.profile.department` |
| Tên chữ ký | Hybrid: mặc định đơn vị + **ghi đè trên phiếu** |
| Lịch sử / Đặt hàng nghiệp vụ | Giữ nguyên; Đặt hàng chỉ fix capture |

## Mục tiêu

- Form + data phiếu giữ nguyên luồng nhập; in = map data → mẫu Excel.  
- 4 slot chữ ký mặc định: người viết phiếu, thủ kho, người nhận, người duyệt.  
- Extra fields đơn vị: `lyDoSuDung`, `nhanTaiKho`.  
- Mobile Đặt hàng capture full table.

## Ngoài phạm vi

- Đổi logic lịch sử xuất kho / sinh số phiếu / tab Đặt hàng nghiệp vụ.  
- Migrate drop cột margin/font legacy trên form defaults.  
- Đổi CTQT `ChungTuSignatureSettings` schema.

---

## 1. Map field PDF

| Named range | fieldKey | Nguồn khi in |
|-------------|----------|--------------|
| `FIELD_bo_phan` | `boPhan` | `slip.recipientUser.profile.department` (rỗng nếu không có user/profile) |
| `FIELD_ly_do_su_dung` | `lyDoSuDung` | `LttpIssueSlipSignatureSettings.extraFields.lyDoSuDung` theo `slip.unitId` |
| `FIELD_ngay_giao` | `ngayGiao` | Format từ `slip.issueDate` (ngày giao = ngày phiếu UI) |
| `FIELD_ngay_nhan` | `ngayNhan` | Format từ `slip.receivedDate ?? slip.issueDate` |
| `FIELD_nguoi_nhan` | `nguoiNhan` | Logic `resolveRecipientName` hiện tại |
| `FIELD_nhan_tai_kho` | `nhanTaiKho` | Settings đơn vị `extraFields.nhanTaiKho` (không còn ưu tiên `slip.warehouseFrom` cho PDF) |
| `FIELD_quyen_so` | `quyenSo` | `slip.bookMmyy` (MMYY, vd `0926`) |
| `FIELD_so_chung_tu` | `soChungTu` | `slipNo` pad 4 số — logic hiện tại |
| `NL_FIELD_don_vi` | `donVi` | `req.user.profile.donVi` (người đang viết/in) |
| `NL_FIELD_don_vi_cap_tren` | `donViCapTren` | `req.user.profile.donViCapTren` |
| `FIELD_print_line_1/2` | alias → `donViCapTren` / `donVi` | Cùng giá trị NL_FIELD ở trên |

`FIELD_ngay` / `thang` / `nam` / `ngayThangNam`: giữ từ `issueDate` như hiện tại (ngày giao).

Recipient list API phải trả thêm `department` (từ profile) để FE hiển thị nếu cần; PDF BE load profile người nhận khi build context.

---

## 2. Model & API

### `LttpIssueSlipSignatureSettings`

- `id`, `unitId` **unique** (FK Unit = kho storage)
- `signatureBlockJson` Json
- `extraFieldsJson` Json — shape `{ lyDoSuDung?: string, nhanTaiKho?: string }`
- `updatedById`, `createdAt`, `updatedAt`

### `LttpIssueSlip` (bổ sung)

- `receivedDate` `DateTime?` `@db.Date` (null ⇒ coi bằng `issueDate` khi in/UI)
- `signerStorekeeper` `String?` (thủ kho — ghi đè)

Giữ `signerWriter`, `signerRecipient`, `signerApprover`, `warehouseFrom` (warehouseFrom có thể còn trên form/defaults nhưng **không** map PDF `nhanTaiKho`).

### API

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/lttp/issue-slip-signature-settings?unitId=` | Scope kho như form-defaults |
| PUT | `/api/lttp/issue-slip-signature-settings` | Body `{ unitId, signatureBlock, extraFields }` |

Permission: cùng nhóm write/read phiếu xuất LTTP.  
Empty row → trả default block + `extraFields: {}` (không bắt buộc seed DB).

Create/update slip: nhận `receivedDate`, `signerStorekeeper` optional.

---

## 3. Default signature block

Giống CTQT workspace (columns, gap, slots, source static/dynamic/system, date line):

| key | label gợi ý |
|-----|----------------|
| `nguoi_viet_phieu` | Người viết phiếu |
| `thu_kho` | Thủ kho |
| `nguoi_nhan` | Người nhận |
| `nguoi_duyet` | Người duyệt |

Default: 4 cột, mỗi slot một cột; source mặc định `dynamic` (điền từ map `signatures` lúc in).  
Cho phép static name trong settings làm mặc định đơn vị.

**Khi in — merge tên (hybrid C)**

```
signatures[key] =
  slipOverride[key]     // signerWriter / signerStorekeeper / resolveRecipientName|signerRecipient / signerApprover
  ?? settingsStaticName[key]
  ?? ""
```

Pass `signatureBlock` (sau materialize static names nếu cần) + `signatures` vào `buildDocumentServicePayload` như CTQT.

---

## 4. UI

### Tab «Cài đặt chữ ký» (`LttpNhapXuatPage`)

- `unitId` = đơn vị kho đang chọn trên trang (đã pin = đơn vị user)
- Clone UX `ChungTuSignatureSettingsWorkspace`: layout slots + extraFields `lyDoSuDung`, `nhanTaiKho`
- Không mount vào CTQT category tabs

### Form phiếu xuất

- Thêm `receivedDate` (date input); khi đổi `issueDate` và `receivedDate` đang trống hoặc đang bằng ngày giao cũ → đồng bộ = `issueDate`
- Ô tên ký: người viết, thủ kho, người nhận, người duyệt — seed từ settings đơn vị khi tạo mới; lưu trên phiếu
- Settings modal phiếu: bỏ phụ thuộc PDF vào `warehouseFrom` cho `nhanTaiKho` (có thể giữ field kho cho tương thích nội bộ / không bắt buộc xóa ngay)

### Lịch sử / Đặt hàng

- Lịch sử: không đổi  
- Đặt hàng: chỉ fix capture (dưới)

---

## 5. Print pipeline

`buildIssueSlipDocumentPdfBuffer(slip, { exportingUserProfile })`:

1. Load `LttpIssueSlipSignatureSettings` by `slip.unitId`
2. Build context theo bảng map §1  
3. Build `signatures` theo merge §3  
4. `buildDocumentServicePayload({ context, fieldKeys, columnKeys, fieldLabels, signatures, signatureBlock })`  
5. `renderDocumentPdf`

Catalog named ranges: thêm `boPhan`, `lyDoSuDung`, `ngayGiao`, `ngayNhan` (và alias `ly_do_su_dung`, …).

---

## 6. Fix mobile Đặt hàng capture

Root cause: bảng `hidden lg:block` + scroll `max-height` khi capture.

Fix:

1. Mọi capture mobile (và desktop nếu cần full matrix) set `forceShowTableForCapture=true`, `await` layout (rAF / ~80–150ms)  
2. Trước `toBlob`: nới overflow/max-height trên `[data-lttp-ordering-table-scroll]` (đã có một phần trong capture core — đảm bảo gọi đúng ref và không capture lúc vẫn `display:none`)  
3. Capture root nên là `#lttp-daily-order-print` **sau khi** bảng đã unhide, hoặc luôn unhide trước khi capture `tableCardRef`  
4. Smoke: assertion/source check rằng mobile path luôn bật `forceShowTableForCapture` trước capture

---

## 7. Kiểm tra

- Context builder: `boPhan` từ department; `donVi*` từ profile writer; `nhanTaiKho`/`lyDoSuDung` từ settings; `ngayNhan` fallback `issueDate`  
- Signature settings GET empty → default 4 slots; PUT round-trip theo `unitId`  
- Slip create với `receivedDate`  
- FE: tab cài đặt chữ ký tồn tại; ordering capture dùng force-show  
- Không regress lịch sử / print-pdf document-service path

## Rủi ro

- Phiếu cũ không có `receivedDate` / `signerStorekeeper` → fallback an toàn  
- Template Excel phải có named range mới — thiếu field thì PDF bỏ trống ô đó (engine hiện tại)
