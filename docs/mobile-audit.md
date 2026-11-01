# Audit mobile — Impeccable (chỉ giao diện hẹp)

Phạm vi: `apps/web`, `apps/superadmin`, UI dùng chung `packages/shared`. Chế độ Operate. Không chấm desktop (≥1024px) và không chấm logic API.

Lệnh đã chạy: skill `impeccable` / `reference/audit.md`, rồi `impeccable detect --json` trên `packages/shared/src/mobile-shell.css` và layout viewport (detector trả `[]`). Bằng chứng render: Playwright 360×740, 390×844, 768×1024, 1440×900, có mock phiên để vào trang private.

## Audit Health Score (trước khi sửa, riêng chiều mobile)

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | Focus ring và nhãn có sẵn; input < 16px và nút header 40px |
| 2 | Performance | 3 | Không thấy layout thrash mới; chưa profile runtime |
| 3 | Theming | 3 | Token HSL dùng nhất quán; màu giấy sổ cố ý cứng |
| 4 | Responsive Design | 2 | Bảng `min-w` tràn khỏi khung; modal chưa full màn hình |
| 5 | Implementation Integrity | 3 | Hệ vỏ (nav dưới, tab cuộn, sổ giấy) có chủ đích |
| **Total** | | **14/20** | **Good — sửa các mục P1 bên dưới** |

## Implementation integrity

Pass. Nav dưới, `ScrollableHorizontalTable`, và `.ledger-paper` là hệ của sản phẩm này, không phải khung dashboard generic. Detector không báo slop trên lớp CSS mobile mới.

## Tóm tắt

- P0: 0
- P1: vùng chạm < 44px, chữ ô nhập < 16px, bảng rộng không nằm trong khung cuộn
- P2: modal/chat chưa full màn hình, safe-area header
- P3: không xếp hàng dài

Việc sửa nằm trong `@media (max-width: 1023px)` và `@media print` để gỡ khi in. Desktop 1440×900 được so pixel với ảnh trước khi sửa.

## Findings

### [P1] Nút header và nút compact thấp hơn 44px

- Location: `AppHeader.jsx` (`h-10 w-10`), `Button` / `IconButton` (`h-9`, `h-8`), tab `min-h-9`
- Category: Responsive
- Impact: Khó bấm trên điện thoại, dưới mức 44px của skill mobile-first (WCAG 2.5.8 AA là 24px; dự án chọn 44)
- Recommendation: `min-height/min-width: 44px` dưới 1023px, trừ `.ledger-paper` và `.sr-only`
- Suggested command: `/impeccable adapt`

### [P1] Input dưới 16px làm iOS zoom khi focus

- Location: `fieldClassSm` (`text-xs` / `sm:text-sm`), login `text-sm`, input file `text-[11px]` trên `/dashboard/lttp/import`
- Category: Responsive
- Impact: Safari phóng trang khi chạm ô nhập
- Recommendation: `font-size: 16px` cho input/select/textarea/file dưới 1023px; `revert-layer` trong `.ledger-paper` và khối in
- Suggested command: `/impeccable adapt`

### [P1] Bảng `min-w-[520px|640px|880px|56rem]` vượt viewport

- Location: `AdminLttpPanel.jsx`, `AdminJobTitlesPanel.jsx`, `SuperadminUnitsPanel.jsx`, bảng trong `StickyResponsiveTable` khi header clone bị cắt
- Category: Responsive
- Impact: Cột bị khuất nếu không có khung cuộn. Phần thân bảng trong `overflow-x-auto` đã đúng; bảng không bọc thì cần khung
- Recommendation: `div:has(> table)` cuộn ngang dưới 1023px; `.ledger-paper` tự cuộn, không đổi cột
- Suggested command: `/impeccable adapt`

### [P2] Modal nhập liệu không full màn hình

- Location: dialog `fixed inset-0` + panel `max-w-* rounded-*` (`LedgerModal`, `JobTitlePermissionsModal`, chat hub)
- Category: Responsive
- Impact: Bàn phím iOS che panel nổi giữa màn hình
- Recommendation: panel `[role="dialog"]` = 100dvh, bỏ bo góc, dưới 1023px. Chat vẫn là lớp phủ
- Suggested command: `/impeccable adapt`

### [P2] Safe area

- Location: nav dưới đã có `env(safe-area-inset-bottom)`; header chỉ `px-4`
- Category: Responsive
- Impact: Máy tai thỏ có thể dính mép
- Recommendation: `viewport-fit=cover` và padding header `max(1rem, env(safe-area-inset-*))`
- Suggested command: `/impeccable harden`

## Việc không đụng

- Bố cục cột `.ledger-paper` và CSS `@media print` của chứng từ
- API, DB, quyền
- Class desktop từ `lg` trở lên

## Việc đã làm sau audit

Xem `packages/shared/src/mobile-shell.css` và `tests/mobile-visual/run.mjs`.

## Kết quả sau sửa

- Playwright mobile: 177 ảnh (3 cỡ × web + superadmin) không còn tràn ngang, input dưới 16px, hay control dưới 44px (trừ trang sổ và `.sr-only`).
- Desktop 1440×900: 59/59 ảnh trùng pixel với lần chụp trước khi sửa.
- `impeccable detect` trên `mobile-shell.css` và hai `layout.jsx`: không có finding.

Có thể chạy lại `/impeccable audit` sau các thay đổi UI tiếp theo.
