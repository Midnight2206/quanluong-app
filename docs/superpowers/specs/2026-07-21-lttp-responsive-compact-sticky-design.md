# LTTP Responsive Compact Sticky

Ngày: 2026-07-21

## Mục tiêu

- Xóa tiêu đề “Nhập xuất LTTP”.
- Tối ưu khối chọn đơn vị và thao tác cho mobile, tablet, desktop.
- Khi cuộn, thanh công cụ đầy đủ chuyển thành thanh sticky thu gọn chỉ còn bộ chọn đơn vị.
- Thanh tab sticky luôn nằm ngay dưới thanh công cụ thu gọn.

## Thiết kế

Khối chọn đơn vị hiện tại trở thành sticky level 0. Một sentinel ngay trước khối được theo dõi bằng `IntersectionObserver` trong page scroll owner:

- Sentinel còn hiển thị: toolbar ở trạng thái đầy đủ.
- Sentinel rời viewport: toolbar chuyển trạng thái compact.

Registry hiện có tiếp tục đo chiều cao level 0; `TabPanel` ở level 1 tự cập nhật offset khi toolbar đổi chiều cao.

### Responsive

- Mobile: toolbar đầy đủ xếp dọc; select và mỗi nút rộng toàn hàng. Compact chỉ giữ select, ẩn label thị giác nhưng giữ accessible label.
- Tablet: select chiếm hàng riêng khi cần; hai nút nằm cùng hàng nếu đủ chỗ.
- Desktop: select bên trái, hai nút bên phải; compact giới hạn chiều rộng select để không chiếm toàn hàng.
- Ba tab tiếp tục chia đều, giữ touch target tối thiểu và không tạo cuộn dọc cục bộ.

## Kiểm thử

- Contract test xác nhận tiêu đề cũ bị xóa, toolbar dùng sticky level 0 và tab dùng level 1.
- Production build web.
- Chrome DevTools ở 390×844, 768×1024 và 1440×900:
  - không tràn ngang;
  - đúng một scroll owner dọc;
  - toolbar chuyển compact đúng lúc;
  - tab không chồng lên toolbar;
  - offset level 1 cập nhật theo chiều cao toolbar.
