from __future__ import annotations

COL_TEN = "ten_quy_cach_pham_chat_vat_tu_hang_hoa_dung_cu"
COL_NCC = "ten_nguoi_ban_hoac_dia_chi_mua_hang"

_DEMO_ITEMS: list[tuple[str, str, str, int, int]] = [
    ("Gạo tẻ nguyên liệu", "kg", "HTX Nông sản An Phú", 120, 18_500),
    ("Gạo nếp", "kg", "HTX Nông sản An Phú", 40, 22_000),
    ("Thịt heo nạc vai", "kg", "Cơ sở Hùng Vương", 35, 95_000),
    ("Thịt heo ba chỉ", "kg", "Cơ sở Hùng Vương", 28, 88_000),
    ("Thịt bò thăn", "kg", "Siêu thị MM Mega", 18, 245_000),
    ("Gà ta nguyên con", "con", "Trại gia cầm Bình Minh", 25, 165_000),
    ("Cá thu đông lạnh", "kg", "Chợ đầu mối Hóc Môn", 22, 72_000),
    ("Cá basa fillet", "kg", "Chợ đầu mối Hóc Môn", 30, 58_000),
    ("Tôm sú size 40", "kg", "Chợ đầu mối Hóc Môn", 15, 185_000),
    ("Trứng gà ta", "quả", "Trại gia cầm Bình Minh", 500, 4_200),
    ("Sữa tươi tiệt trùng", "hộp", "Siêu thị MM Mega", 80, 9_500),
    ("Dầu ăn Neptune", "chai", "Siêu thị MM Mega", 24, 42_000),
    ("Nước mắm Phú Quốc", "chai", "Siêu thị MM Mega", 18, 38_000),
    ("Muối i-ốt", "kg", "Siêu thị MM Mega", 20, 6_500),
    ("Đường trắng tinh luyện", "kg", "Siêu thị MM Mega", 50, 19_000),
    ("Bột ngọt", "kg", "Siêu thị MM Mega", 10, 85_000),
    ("Hạt nêm", "kg", "Siêu thị MM Mega", 12, 72_000),
    ("Tương ớt Cholimex", "chai", "Siêu thị MM Mega", 15, 18_000),
    ("Cà chua", "kg", "Chợ rau quả Bến Thành", 45, 22_000),
    ("Khoai tây", "kg", "Chợ rau quả Bến Thành", 60, 18_000),
    ("Cà rốt", "kg", "Chợ rau quả Bến Thành", 40, 16_000),
    ("Bắp cải trắng", "kg", "Chợ rau quả Bến Thành", 35, 12_000),
    ("Rau muống", "kg", "Chợ rau quả Bến Thành", 30, 8_000),
    ("Rau cải ngọt", "kg", "Chợ rau quả Bến Thành", 28, 9_500),
    ("Hành lá", "kg", "Chợ rau quả Bến Thành", 15, 25_000),
    ("Tỏi Lý Sơn", "kg", "Chợ rau quả Bến Thành", 12, 68_000),
    ("Gừng tươi", "kg", "Chợ rau quả Bến Thành", 8, 45_000),
    ("Chanh không hạt", "kg", "Chợ rau quả Bến Thành", 10, 28_000),
    ("Ớt sừng", "kg", "Chợ rau quả Bến Thành", 6, 32_000),
    ("Chuối tiêu", "kg", "Chợ rau quả Bến Thành", 25, 15_000),
    ("Dưa hấu", "kg", "Chợ rau quả Bến Thành", 40, 12_000),
    ("Thơm (dứa)", "kg", "Chợ rau quả Bến Thành", 20, 18_000),
    ("Bún tươi", "kg", "Cơ sở bún Thanh Xuân", 30, 14_000),
    ("Bánh phở tươi", "kg", "Cơ sở bún Thanh Xuân", 25, 16_000),
    ("Mì gói Hảo Hảo", "thùng", "Siêu thị MM Mega", 10, 115_000),
    ("Đậu phụ tươi", "kg", "Cơ sở đậu phụ Tân Phú", 20, 22_000),
    ("Giá đỗ", "kg", "Chợ rau quả Bến Thành", 15, 7_000),
    ("Nấm rơm", "kg", "HTX Nông sản An Phú", 12, 35_000),
    ("Bí đỏ", "kg", "Chợ rau quả Bến Thành", 18, 11_000),
    ("Mướp hương", "kg", "Chợ rau quả Bến Thành", 14, 13_000),
    ("Khổ qua", "kg", "Chợ rau quả Bến Thành", 10, 19_000),
    ("Đậu cove", "kg", "Chợ rau quả Bến Thành", 16, 24_000),
    ("Bột mì đa dụng", "kg", "Siêu thị MM Mega", 25, 21_000),
    ("Bột năng", "kg", "Siêu thị MM Mega", 8, 26_000),
    ("Giấy gói thực phẩm", "cuộn", "Siêu thị MM Mega", 30, 12_000),
]


def build_bien_ban_test_v2_demo(*, row_count: int = 45) -> dict:
    """Dữ liệu demo dài cho mẫu bien_ban_test v2 — keys khớp column_defs trong DB."""
    rows = []
    for index in range(row_count):
        ten, dvt, ncc, qty, price = _DEMO_ITEMS[index % len(_DEMO_ITEMS)]
        amount = qty * price
        rows.append(
            {
                "tt": str(index + 1),
                COL_TEN: ten,
                "dvt": dvt,
                COL_NCC: ncc,
                "so_luong": str(qty),
                "don_gia": f"{price:,}".replace(",", "."),
                "thanh_tien": f"{amount:,}".replace(",", "."),
            }
        )
    return {
        "demo_key": "bien_ban_test_v2",
        "fields": {},
        "rows": rows,
    }


__all__ = ["COL_NCC", "COL_TEN", "build_bien_ban_test_v2_demo"]
