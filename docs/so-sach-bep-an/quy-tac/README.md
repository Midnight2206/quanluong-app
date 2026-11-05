# Quy tắc trợ lý làm sổ

Bộ rule dùng chung cho các trợ lý làm sổ bếp ăn. Đồng bộ từ thư mục `Quy tắc/` trên máy trợ lý sổ sách (05/11/2026).

| File | docKey baseline | Nội dung |
|---|---|---|
| [07_dinh_luong_muc_an.md](07_dinh_luong_muc_an.md) | *(chưa seed)* | Định lượng mức ăn, gạo/chất đốt; kcal chuẩn 3200/3500; mức khác hỏi chủ. |
| [08_cac_so_khac.md](08_cac_so_khac.md) | *(chưa seed)* | Các sổ khác + chi tiết báo cáo lương thực (Cộng gộp ô, căn giữa, `Cộng: 0 kg`, hàng ×1,3…). |
| [10_phu_luc_cuoi_so.md](10_phu_luc_cuoi_so.md) | `quy-tac-phu-luc` | Phụ lục cuối Sổ nhập xuất LTTP. II/A từng lần nhận theo ngày; kcal in gần chuẩn; Cộng bảng 2–3 gộp ô căn giữa. Mục 13 cấu hình ví dụ. |

Trợ lý kéo bản phụ lục qua `GET /api/ba/baseline/quy-tac-phu-luc` (cần token). Nạp từ repo: `node scripts/ba-seed-baseline.js` trong `quanluong-app-be/` — xem [ba-profiles-api.md](../../ba-profiles-api.md). Thêm docKey sau: dòng trong `BA_DOC_KEYS` và `QUY_TAC_FILES`.
