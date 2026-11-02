---
name: mobile-first
description: >-
  Quy tắc giao diện mobile/tablet cho Quân lương (apps/web, apps/superadmin,
  packages/shared). Dùng khi sửa layout, form, bảng, modal, chatbot, hoặc trang sổ
  trên màn hình hẹp. Mọi thay đổi chỉ áp dụng dưới breakpoint lg (max-width 1023px);
  desktop từ lg trở lên giữ nguyên pixel.
---

# Mobile-first — Quân lương

Skill này khóa cách sửa UI cho điện thoại và máy tính bảng. Desktop (`lg` trở lên, từ 1024px) không được đổi.

## Breakpoint

Tailwind mặc định của repo: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

- **Vùng được sửa:** chiều rộng ≤ 1023px (điện thoại và tablet dọc, gồm 360, 390, 768).
- **Vùng đóng băng:** chiều rộng ≥ 1024px (kiểm bằng 1440×900). Ảnh desktop trước/sau phải trùng pixel.
- Cách viết đúng:
  - CSS: mọi rule mới nằm trong `@media (max-width: 1023px)`.
  - Tailwind: chỉ thêm tiện ích không tiền tố hoặc `max-lg:`. Không sửa class đang áp dụng từ `lg:` trở lên, không đổi giá trị mặc định nếu class đó cũng ăn ở desktop.
- In ấn và PDF: thêm `@media print` để gỡ rule mobile (cỡ chữ, min-height, overflow). Không đổi bố cục bảng sổ hay pipeline PDF.

## Vùng chạm

- Control bấm được (nút, tab, mục nav, checkbox, radio) tối thiểu **44×44px** CSS dưới 1023px.
- Link trong đoạn văn giữ inline. Chỉ ép 44px với link trong `header` và `nav`.
- Nút phủ toàn màn hình (lớp đóng modal) không cần co lại.
- Trong `.ledger-paper` không phóng nút hay ô nhập: trang sổ giữ hình dạng tờ giấy.

## Không tràn ngang

- `documentElement.scrollWidth` không được lớn hơn khung nhìn.
- Nội dung rộng (bảng, dải tab) cuộn **trong khung** (`overflow-x: auto`, `overscroll-behavior-x: contain`), không đẩy cả trang.
- Không dùng `overflow-x: hidden` để cắt mất dữ liệu bảng. Hidden chỉ để chặn leak khi phần rộng đã có khung cuộn riêng.
- Chữ đoạn văn có thể `overflow-wrap: anywhere`. Không bẻ chữ trong ô bảng sổ.

## Trang sổ

Sổ nhập xuất LTTP và sổ cùng kiểu (`.ledger-paper`) là một tờ giấy, không phải layout thẻ mobile.

- Giữ cột, viền, cỡ chữ bảng, chữ ký, và bản in PDF.
- Dưới 1023px: tờ giấy nằm trong khung cuộn ngang (và thu phóng nếu trình duyệt cho phép). Không `user-scalable=no`.
- Modal nhập liệu và chatbot là lớp phủ, không nằm trong dòng trang sổ.

## Modal và chatbot

- Dưới 1023px, panel `[role="dialog"]` trong lớp `.fixed.inset-0` chiếm full viewport: hết padding overlay, `width/height: 100%`, `max-height: 100dvh`, `border-radius: 0`.
- Nội dung dialog tự cuộn bên trong (`data-local-scroll`), không cuộn cả trang nền.
- Chatbot vẫn là lớp phủ. Trên mobile panel chat được phép full màn hình; không nhét chat vào layout trang.

## Form và iOS

- `input`, `select`, `textarea` (trừ checkbox, radio, file, hidden, button) có `font-size` **≥ 16px** dưới 1023px để Safari không zoom khi focus.
- Không áp dụng 16px bên trong `.ledger-paper`, `.bkmh-print-root`, `.bkmh-a4-print-host`. Dùng `font-size: revert-layer` để trả lại class Tailwind của tờ giấy.
- Nhãn gắn với control. Lỗi form nói rõ việc cần sửa.

## Safe area

- Viewport: `width=device-width`, `initial-scale=1`, `viewport-fit=cover`. Không khóa zoom.
- Thanh dưới và header chừa `env(safe-area-inset-*)`. Padding safe-area dùng `max(khoảng cách hiện có, env(...))` để máy không tai thỏ không đổi ảnh.
- Vùng nội dung chính đã có padding đáy cho nav dưới. Đừng che nút cuối trang.

## Kiểm tra lại

```bash
npm run test:mobile-shell
npm run test:mobile-visual
```

`test:mobile-visual` chụp `apps/web` và `apps/superadmin` ở 360×740, 390×844, 768×1024, 1440×900. Desktop so pixel với lần chụp `before`. Chi tiết trong `tests/mobile-visual/run.mjs`.
