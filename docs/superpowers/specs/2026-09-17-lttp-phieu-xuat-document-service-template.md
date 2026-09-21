# Mẫu PDF phiếu xuất LTTP (`lttp-phieu-xuat`)

Phiếu xuất **Nhập xuất LTTP** (1 phiếu) dùng document-service, **tách** khỏi CTQT `phieu-xuat-kho`.

## Upload / publish

1. Upload file `.xlsx` qua API mẫu PDF CTQT với `categoryKey=lttp-phieu-xuat` (được phép trong `ALLOWED_CHUNG_TU_PDF_CATEGORIES`; **không** hiện tab CTQT).
2. Publish mẫu (status `published`). In vận hành lấy bản published mới nhất.
3. Rebuild/restart `app` + đảm bảo `document` healthy.

## Named ranges (scalar) — khuyến nghị

| Named range | fieldKey | Nội dung |
|-------------|----------|----------|
| `FIELD_print_line_1` | `donViCapTren` | Cùng `NL_FIELD_don_vi_cap_tren` — hồ sơ user |
| `FIELD_print_line_2` | `donVi` | Cùng `NL_FIELD_don_vi` — hồ sơ user |
| `NL_FIELD_don_vi_cap_tren` | `donViCapTren` | Đơn vị cấp trên (hồ sơ) |
| `NL_FIELD_don_vi` | `donVi` | Đơn vị (hồ sơ) |
| `FIELD_form_mau_so` | `formMauSo` | Mẫu số |
| `FIELD_quyen_so` | `quyenSo` | Quyển MMYY |
| `FIELD_so` / `FIELD_so_chung_tu` / `FIELD_so_phieu` | `soChungTu` | Số phiếu (0001…) |
| `FIELD_ngay` / `FIELD_thang` / `FIELD_nam` | `ngay` / `thang` / `nam` | Thành phần ngày |
| `NL_FIELD_ngay_thang_nam` hoặc `FIELD_ngay_thang_nam` | `ngayThangNam` | «Ngày DD tháng M năm YYYY» |
| `FIELD_nguoi_nhan` | `nguoiNhan` | Họ tên người nhận |
| `FIELD_nhan_tai_kho` | `nhanTaiKho` | Nhận tại kho |
| `FIELD_tong_tien` | `tongTien` | Tổng tiền (VN format) |
| `FIELD_tong_tien_bang_chu` | `tongTienBangChu` | Tổng bằng chữ |
| `FIELD_nguoi_viet_phieu` | `nguoiVietPhieu` | Người viết phiếu |
| `FIELD_nguoi_duyet` | `nguoiDuyet` | Người duyệt |

Chữ ký cũng gửi qua `signatures.nguoi_viet_phieu` / `nguoi_nhan` / `nguoi_duyet` nếu mẫu dùng signature block.

## Cột bảng (TABLE_*)

Thứ tự gợi ý: `stt`, `tenHang`, `maSo`, `dvt`, `muaTt`, `tgsx`, `donGia`, `thanhTien`, `ghiChu`.

- **Mua TT** / **TGSX**: số lượng theo `priceKind` của dòng (market → cột Mua TT, tgsx → cột TGSX).

## Kiểm tra nhanh

```bash
# Sau khi publish mẫu:
curl -H "Authorization: …" \
  "http://localhost:3000/api/lttp/issue-slips/<id>/print-pdf" \
  -o /tmp/pxk.pdf
```

Thiếu mẫu published → API 404 với message hướng dẫn upload `lttp-phieu-xuat`.
