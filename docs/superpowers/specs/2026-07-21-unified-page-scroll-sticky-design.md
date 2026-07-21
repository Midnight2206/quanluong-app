# Unified Page Scroll + Sticky UI

Ngày: 2026-07-21

## Mục tiêu

Chuẩn hóa UX cuộn cho cả `apps/web` và `apps/superadmin`:

1. Mỗi app shell chỉ có **một scroll owner dọc** cho nội dung route.
2. Page/layout/panel không tự tạo thêm thanh cuộn dọc.
3. Header trang, tab và action bar cần giữ lại khi cuộn được gom vào sticky stack.
4. Bảng/tab rộng vẫn được phép cuộn ngang.
5. Dialog, dropdown, combobox, mobile drawer, chat và data-grid có chiều cao giới hạn được phép cuộn dọc riêng.
6. Cung cấp HOC dùng chung và quy tắc workspace để mọi tính năng mới tuân theo cùng mô hình.

## Hiện trạng và nguyên nhân

`packages/shared/src/layouts/MainLayout.jsx` đã có scroll owner chính tại vùng content:

```text
body overflow-hidden
└─ MainLayout h-dvh overflow-hidden
   ├─ AppHeader
   ├─ WorkingUnitScopeBar
   └─ main
      └─ route content overflow-y-auto  ← scroll owner chính
```

Nhưng dashboard và một số panel tiếp tục tạo `overflow-y-auto`:

```text
MainLayout scroller
└─ DashboardLayout scroller
   └─ Users/Pending/Permission panel scroller
```

Hệ quả:

- Hai hoặc ba scrollbar dọc cùng xuất hiện.
- Wheel/touch bị giữ ở vùng con và phải cuộn lại ở vùng cha.
- Scroll restoration thay đổi theo route.
- `position: sticky` neo vào overflow ancestor sai.
- Một số panel dùng `overflow-hidden` nhưng không có vertical scroll owner, có thể làm hàng dữ liệu bị cắt.

## Quyết định kiến trúc

### 1. MainLayout là scroll owner dọc duy nhất

Giữ mô hình viewport shell hiện tại:

```text
html/body: full height, không document scroll
MainLayout: h-dvh, overflow-hidden
├─ AppHeader: ngoài scroll owner, luôn hiển thị
├─ WorkingUnitScopeBar: ngoài scroll owner, luôn hiển thị
└─ route content: overflow-y-auto duy nhất
```

Không chuyển sang `body` scroll vì app đang có sidebar, mobile bottom navigation, chat dock, safe-area padding và viewport shell ổn định. Chuyển toàn bộ sang document flow tạo phạm vi thay đổi và rủi ro lớn hơn mà không tăng giá trị UX.

`AppHeader` và `WorkingUnitScopeBar` không cần `position: sticky`: chúng nằm ngoài scroll owner nên luôn cố định. Sticky chỉ áp dụng cho thành phần nằm trong nội dung route.

### 2. HOC `withUnifiedPageScroll`

Tạo:

```text
packages/shared/src/hocs/withUnifiedPageScroll.jsx
```

API:

```jsx
export default withUnifiedPageScroll(MyPage);
```

HOC chịu trách nhiệm:

- Render page root theo natural flow:
  - `min-w-0`
  - `w-full`
  - không `h-full`
  - không `overflow-hidden`
  - không `overflow-y-auto/scroll`
- Cung cấp context cho sticky stack height.
- Đặt CSS variable `--unified-sticky-stack-height`.
- Giữ print mode ở natural flow.
- Cho phép `className` bổ sung nhưng không cho page trở thành vertical scroll owner.

HOC không tự tìm phần tử qua selector và không sửa DOM bằng mutation. Page khai báo rõ phần nào sticky qua primitive bên dưới.

### 3. `UnifiedStickyStack`

Cùng file HOC export:

```jsx
<UnifiedStickyStack>
  <PageHeader />
  <PageTabs />
  <PageActionBar />
</UnifiedStickyStack>
```

Quy tắc:

- Cả nhóm là một sticky container duy nhất: `sticky top-0`.
- Các phần tử trong nhóm xếp theo normal flow, không cần hard-code `top-12`, `top-14`.
- Dùng `ResizeObserver` đo chiều cao thực tế của stack.
- Ghi chiều cao vào context/CSS variable để thành phần sticky phía dưới dùng.
- Background, border, shadow và `backdrop-blur` thống nhất.
- Z-index nằm dưới global header/dock và trên page content.

Gom thành một stack tránh việc nhiều sticky sibling cùng `top-0` đè lên nhau.

### 4. `UnifiedStickyRegion`

Dùng khi một page cần vùng sticky độc lập ngoài primary stack:

```jsx
<UnifiedStickyRegion offset="stack">
  <SecondaryActions />
</UnifiedStickyRegion>
```

`offset="stack"` dùng:

```css
top: var(--unified-sticky-stack-height, 0px);
```

Không cho page tự viết các offset breakpoint như `top-12 sm:top-14`, trừ trường hợp đã được ghi nhận là bounded workspace riêng.

## Quy tắc scroll

### Nội dung route thông thường

Không dùng:

- `overflow-y-auto`
- `overflow-y-scroll`
- `overflow-auto` nếu có khả năng tạo vertical scroll
- `h-full overflow-hidden`
- `h-dvh` / `h-screen`
- `max-h-*` kết hợp vertical overflow

Cho phép:

- `overflow-x-auto` cho bảng/tab rộng.
- `overflow-x-hidden` khi cần chặn layout leak, với điều kiện không nằm giữa sticky element và MainLayout scroll owner.
- `min-h-0` cho flex sizing, nhưng không dùng để dựng viewport con.

### Local vertical scroll hợp lệ

Chỉ các vùng sau được phép có scroll dọc riêng:

- Dialog/modal/sheet/drawer.
- Dropdown/listbox/combobox/autocomplete.
- Chat message/thread.
- Desktop sidebar navigation nếu nội dung vượt viewport.
- Data-grid/spreadsheet có chiều cao giới hạn và sticky header riêng.

Vùng ngoại lệ phải:

- Có chiều cao/max-height rõ ràng.
- Có `data-local-scroll="true"` để dễ audit.
- Có `overscroll-contain`.
- Không được bọc toàn bộ nội dung route.

## Table và sticky `<thead>`

### Giới hạn CSS

`overflow-x-auto` có thể trở thành overflow ancestor của `position: sticky`. Vì vậy `<thead sticky>` bên trong `ResponsiveTableWrap` không đảm bảo neo theo MainLayout scroller.

### Hai pattern được hỗ trợ

#### A. Bảng route thông thường

- Vertical flow thuộc MainLayout.
- `ResponsiveTableWrap` chỉ giải quyết chiều ngang.
- Không hứa sticky `<thead>` theo viewport nếu bảng cần horizontal scroll.
- Sticky page action/filter bar được ưu tiên để giữ context.

#### B. Bounded data-grid

- `max-height` rõ ràng.
- `overflow-auto` hai chiều.
- `<thead sticky top-0>` neo trong chính grid.
- Đây là local-scroll exception có chủ đích.

Không xây cloned/synchronized table header trong đợt này vì chi phí và rủi ro accessibility lớn hơn giá trị hiện tại.

## Thay đổi component chung

### `MainLayout`

Giữ duy nhất content `overflow-y-auto`. Bổ sung định danh:

```jsx
data-page-scroll-owner="true"
```

Không tạo thêm scroll owner trong route descendants.

### `DashboardLayout` và `SuperadminDashboardLayout`

- Bỏ `h-full`.
- Bỏ `overflow-hidden`.
- Bỏ panel `overflow-y-auto`.
- Bọc dashboard heading + route tabs trong `UnifiedStickyStack`.
- Nội dung tab route dùng normal flow.

### `TabPanel`

- Đổi mặc định `scrollablePanel` từ `true` thành `false`.
- Page tab dùng normal flow.
- Chỉ caller trong dialog/bounded workspace mới truyền `scrollablePanel={true}`.
- Sticky tab list độc lập cũ được thay bằng/đặt trong `UnifiedStickyStack` khi có nhiều tầng.

### Dashboard panels

Các panel ordinary-content phải bỏ vertical scroll:

- `SuperadminUsersPanel`
- `AdminPendingRegistrationsPanel`
- `SuperadminPermissionDescriptionsPanel`
- `SimplePlaceholderPage`
- `SuperadminUnitsPanel` (đồng thời sửa nguy cơ table bị clip)

`SuperadminPermissionMatrixPanel` là split-pane/data workspace; được phép giữ bounded local scroll nhưng phải đánh dấu `data-local-scroll="true"` và tránh thêm dashboard scroller bên ngoài.

### Feature pages đã gần đúng

Giữ natural-flow pattern hiện có ở:

- Kitchen books
- LTTP nhập/xuất
- Meal roster
- Chứng từ quyết toán
- Job titles

Chuyển sticky tabs nhiều tầng sang `UnifiedStickyStack` để bỏ offset hard-code và tránh overlap.

### Auth shell

Auth là shell riêng. Vì `body` bị khóa scroll, `AuthLayout` phải có đúng một vertical scroll owner để form dài không bị cắt trên mobile/keyboard.

## Responsive

- Mobile và desktop dùng cùng một vertical scroll owner.
- Mobile bottom navigation tiếp tục fixed; MainLayout giữ safe-area bottom padding.
- Sticky stack cho phép tab cuộn ngang nhưng không cuộn dọc.
- Sticky background phải opaque/blur đủ để nội dung phía dưới không gây nhiễu.
- Khi bàn phím mobile mở, page vẫn cuộn trong MainLayout; input focus phải được browser đưa vào vùng nhìn thấy.

## Z-index

Thiết lập tầng thống nhất:

```text
page content          z-auto
sticky table/grid     z-10
sticky page stack     z-20
mobile navigation     z-30
app header/menu       z-40
progress/overlay      z-45+
modal                 z-50+
verification/chat     giữ z-100 / z-200 hiện tại
```

Không dùng `z-40` cho table cell trong page thường.

## Quy tắc cho tính năng tương lai

Tạo workspace rule:

```text
.cursor/rules/unified-page-scroll.mdc
```

Nội dung bắt buộc:

1. Full route page dùng `withUnifiedPageScroll`.
2. Không tạo vertical scroll owner bên dưới MainLayout.
3. Sticky page chrome dùng `UnifiedStickyStack`.
4. Local vertical scroll phải thuộc danh sách ngoại lệ, có height bound và `data-local-scroll`.
5. Bảng horizontal-scroll không được giả định `<thead sticky>` sẽ neo theo page.
6. Mỗi feature mới phải smoke-test long content trên desktop/mobile.

## Kiểm thử và tiêu chí chấp nhận

### Automated

- Unit test HOC giữ class natural flow.
- Unit test sticky stack cập nhật CSS variable khi height thay đổi (mock `ResizeObserver`).
- Unit test `TabPanel` mặc định không render `overflow-y-auto`.
- Static audit script tìm `overflow-y-auto`, `overflow-y-scroll`, `overflow-auto` trong page/layout và yêu cầu allowlist/`data-local-scroll`.

### Browser smoke

Kiểm tra ít nhất:

- Dashboard users
- Units
- Pending registrations
- Permission descriptions/matrix
- LTTP admin
- Kitchen books
- Meal roster
- Chứng từ quyết toán

Viewport:

- Mobile 390×844
- Tablet 768×1024
- Desktop 1440×900

Đạt khi:

1. Route content chỉ có một scrollbar dọc.
2. Header/scope bar luôn hiển thị.
3. Page header/tab/action sticky không overlap.
4. Bảng/tab rộng vẫn cuộn ngang.
5. Dialog và bounded grid cuộn độc lập, không kéo page phía sau.
6. Không có hàng/table content bị clip.

## Phạm vi triển khai

### Trong phạm vi

- Shared shell, dashboard layouts, HOC/sticky primitives.
- Ordinary dashboard panels gây nested scroll.
- Các feature page có sticky tabs nhiều tầng.
- Workspace rule và audit test cho tính năng mới.

### Ngoài phạm vi

- Thay đổi visual branding, typography hoặc màu sắc.
- Xây virtualized table.
- Cloned/synchronized sticky header cho bảng horizontal-scroll.
- Thay đổi hành vi chat/dialog ngoài việc đánh dấu local-scroll exception.
- Chuyển app sang document/body scrolling.

## Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
|--------|------------|
| Nội dung page dài hơn trước do bỏ panel scroll | Đây là mục tiêu; MainLayout xử lý toàn bộ chiều dài |
| Sticky bị vô hiệu bởi overflow ancestor | Audit/remove overflow wrappers giữa sticky và MainLayout |
| Nhiều sticky bar overlap | Gom vào một `UnifiedStickyStack`, đo height tự động |
| Bảng rộng mất sticky thead | Dùng bounded grid khi sticky thead là yêu cầu nghiệp vụ |
| Mobile bottom nav che nội dung | Giữ safe-area padding hiện tại và smoke-test |
| Panel split-pane mất tính sử dụng | Giữ local scroll có chủ đích, đánh dấu exception |
