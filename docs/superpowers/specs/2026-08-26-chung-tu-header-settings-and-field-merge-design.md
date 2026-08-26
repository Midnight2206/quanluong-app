# Header chứng từ PDF — tùy biến đơn vị / BKMH + căn giữa Named Range

Ngày: 2026-08-26  
Liên quan: `2026-08-25-chung-tu-pdf-template-draft-preview-publish-design.md`, import/static cells PDF  
Branch: `feat/document-service-p4`

## Vấn đề

1. Header BKMH (Sư đoàn, Trung đoàn, người mua, bộ phận) đang cứng trong Excel → PDF không theo user/settings.  
2. `FIELD_ngay_thang_nam` (và FIELD_* trong merge) lệch khỏi giữa vì importer chỉ lấy width một ô, không lấy cả vùng merge.

## Mục tiêu

- User tùy **giá trị** các dòng header; **nhãn + font + vị trí** giữ theo Excel.  
- Đơn vị cấp trên / đơn vị: settings **hồ sơ user**, dùng chung nhiều chứng từ PDF.  
- Người mua / bộ phận: settings **cứng BKMH** (`bang-ke-mua-hang`) thôi.  
- Người mua: phiếu/snapshot **ưu tiên**; settings chỉ fallback.  
- FIELD_* thuộc merge → box geometry = toàn merge → căn giữa đúng.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Cách đổ giá trị | Named Range `FIELD_*` (không override static cell) |
| Sư đoàn / Trung đoàn | `Profile.donViCapTren`, `Profile.donVi` — mỗi user |
| Người mua / bộ phận | Settings category `bang-ke-mua-hang` only |
| Nội dung sửa | Chỉ giá trị (A); nhãn Excel giữ nguyên |
| Người mua vs phiếu | Settings = mặc định; phiếu/snapshot có → dùng phiếu (B) |
| Loại CT khác | Ngoài phạm vi — làm sau |
| Unit profile (`ChungTuUnitProfile`) | Không còn nguồn chính cho 2 dòng đơn vị trên PDF path này |

## Named Range bắt buộc (mẫu Excel)

| Named Range | Ô | Ghi chú |
|-------------|---|---------|
| `FIELD_don_vi_cap_tren` | Giá trị Sư đoàn… | Cả dòng là giá trị |
| `FIELD_don_vi` | Giá trị Trung đoàn… | Map context `donVi` / `don_vi` |
| `FIELD_ho_ten_nguoi_mua` | Phần sau `:` | Nhãn tĩnh: `- Họ và tên người mua:` |
| `FIELD_bo_phan` | Phần sau `:` | Nhãn tĩnh: `- Bộ phận:` |
| `FIELD_ngay_thang_nam` | Ngày | Align center trong merge nếu có |

Operator phải **xóa text cứng** trong ô giá trị (để trống/placeholder) và **import lại** mẫu. Alias `FIELD_nguoi_mua` → cùng key `ho_ten_nguoi_mua` nếu cần tương thích.

## Kiến trúc dữ liệu

```
Profile (user)
  donViCapTren, donVi
       │
       ▼
PDF export resolver ──► fields.don_vi_cap_tren, fields.don_vi
       ▲
BKMH header settings (categoryKey=bang-ke-mua-hang)
  hoTenNguoiMua, boPhan
       │
       ▼  (fallback nếu slip/snapshot trống)
fields.ho_ten_nguoi_mua, fields.bo_phan
```

### Profile

- Prisma `Profile`: thêm `donViCapTren String?`, `donVi String?` (@db.VarChar(255)).  
- `PATCH /auth/me/profile` nhận/trả hai field.  
- UI hồ sơ cá nhân: 2 input.

### BKMH header settings

- Persist scoped `categoryKey = bang-ke-mua-hang` only (bảng mới hoặc JSON row riêng — tránh nhét vào signature block).  
  Gợi ý model: `ChungTuBkmhHeaderSettings` với `categoryKey` unique, `hoTenNguoiMua`, `boPhan`, `updatedById`.  
- API: `GET/PUT /api/chungtuquyettoan/bkmh-header-settings` (permission cùng nhóm settings chứng từ PDF).  
- UI: section trên workspace PDF BKMH, cạnh cài đặt chữ ký.

### Resolver

```
don_vi_cap_tren ← user.profile.donViCapTren ?? ""
don_vi          ← user.profile.donVi ?? ""   // đồng bộ alias donViSo nếu export còn dùng
ho_ten_nguoi_mua ← fromSlips/snapshot nếu non-empty, else bkmhSettings.hoTenNguoiMua
bo_phan         ← from existing slip/doc settings nếu non-empty, else bkmhSettings.boPhan
```

Không lấy `donViCapTren` / `donVi` từ `ChungTuUnitProfile` cho path PDF document-service này.

## Document-service — merge geometry

Trong `_build_fields` / import:

1. Resolve Named Range (vẫn cho phép tên trỏ một ô gốc).  
2. Nếu ô thuộc `merged_cells` → `width_pt` / `height_pt` = toàn merge; `x,y` = top-left merge.  
3. Vẽ field trong box với align Excel (`h`/`v`) như đã làm với `draw_static_cell`.

Áp dụng mọi `FIELD_*`, không chỉ ngày.

## Catalog

- Đảm bảo catalog có `FIELD_ho_ten_nguoi_mua` (`hoTenNguoiMua`) nếu thiếu.  
- `don_vi` / `don_vi_cap_tren` đã có.

## Ngoài phạm vi

- Settings header cho category khác ngoài BKMH  
- Đổi nhãn “Họ và tên người mua” / “Bộ phận”  
- Override static cell không có Named Range  
- Drive Sheets path (trừ khi đã map cùng field keys)

## Tiêu chí xong

1. User sửa hồ sơ → PDF (có FIELD đơn vị) hiện đúng Sư đoàn / Trung đoàn.  
2. Settings BKMH → người mua / bộ phận fallback đúng; phiếu có người mua thì phiếu thắng.  
3. Mẫu đủ FIELD_* + re-import → không còn text cứng đè giá trị.  
4. `ngay_thang_nam` căn giữa trong merge dưới tiêu đề.  
5. Format/vị trí giữ theo Excel.
