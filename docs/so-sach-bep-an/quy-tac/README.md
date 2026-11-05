# Quy tắc trợ lý làm sổ

Bộ rule dùng chung cho các trợ lý làm sổ bếp ăn. Thư mục này chưa chứa cả bộ `Quy tắc/` trên máy trợ lý — mới có phụ lục cuối sổ.

| File | docKey baseline | Nội dung |
|---|---|---|
| [10_phu_luc_cuoi_so.md](10_phu_luc_cuoi_so.md) | `quy-tac-phu-luc` | Phụ lục cuối Sổ nhập xuất LTTP, sau trang ngày cuối tháng (nguồn 05/11/2026, gồm quy tắc in kcal gần chuẩn). Mục 13 là cấu hình ví dụ một bếp. Chỗ «(cần xác nhận)» chưa chốt. |

Trợ lý kéo bản mới nhất qua `GET /api/ba/baseline/quy-tac-phu-luc` (cần token). Nạp từ repo: `node scripts/ba-seed-baseline.js` trong `quanluong-app-be/` — xem [ba-profiles-api.md](../../ba-profiles-api.md). Thêm file quy tắc sau: docKey kebab-case mới trong `BA_DOC_KEYS` và một dòng trong `QUY_TAC_FILES` (cột `docKey` đã là chuỗi, không migration).
