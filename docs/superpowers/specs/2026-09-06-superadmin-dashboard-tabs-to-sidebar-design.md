# Design Spec: Superadmin dashboard tabs → sidebar (portal admin-only)

**Date:** 2026-09-06  
**Status:** Draft for review  
**Feature:** (P3) Cổng Superadmin chỉ quản trị hệ thống; chuyển tab dashboard vào sidebar có section; bỏ link app chính và xóa route nghiệp vụ trùng  
**Program backlog (remaining):** P5 persist selections

---

## 1. Problem

- Cổng `apps/superadmin` đang mirror nhiều mục nghiệp vụ (LTTP, Users, sổ sách) + link «Ứng dụng chính», trong khi quản trị hệ thống nằm ở **tab ngang** trong `SuperadminDashboardLayout`.
- Mong muốn: UI Superadmin **chỉ** quản trị hệ thống, nav gọn (sidebar có nhóm), không còn lối sidebar sang app chính / màn nghiệp vụ trùng.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Cách triển khai: **meta → sidebar** (không nested shell mới, không đổi URL segment) |
| 2 | Path giữ `/dashboard/<path>` như hiện tại |
| 3 | Xóa page private ngoài dashboard trên `apps/superadmin` (LTTP, `/users`, sổ sách, meal-roster, …) |
| 4 | Giữ `/profile` + `/settings` (header / user menu) |
| 5 | **Không** link sidebar về app chính; vào cổng từ app chính (`superadminNavItems` external) |
| 6 | Sidebar: **section** + `shortLabel` + `icon`; `title`/hover = label đầy đủ |
| 7 | Bỏ hoàn toàn horizontal tab strip trong `SuperadminDashboardLayout` |
| 8 | `WorkingUnitScopeBar` giữ nguyên |
| 9 | Ngoài scope: redesign AppHeader; đụng dashboard tabs `apps/web`; đổi path URL |

---

## 3. Nav IA

Nguồn: `DASHBOARD_SUPERADMIN_TAB_META` — thêm `section`, `shortLabel`, `icon`.

| Section | shortLabel | path | routeAccessKey (giữ) |
|---------|------------|------|----------------------|
| Hệ thống | Đơn vị | `units` | `dashboard-units` |
| Hệ thống | Người dùng | `users` | `dashboard-users` |
| Hệ thống | Đăng ký | `pending-registrations` | `dashboard-pending` |
| Danh mục | Nhóm LTTP | `lttp-groups` | `dashboard-lttp-groups` |
| Danh mục | Mức tiền ăn | `meal-allowance-rates` | `dashboard-meal-allowance-rates` |
| Quyền | Ma trận | `permission-matrix` | `dashboard-permission-matrix` |
| Quyền | Mô tả quyền | `permission-descriptions` | `dashboard-permission-descriptions` |
| Chứng từ | Mẫu CT | `chung-tu-pdf-templates` | `dashboard-chung-tu-pdf-templates` |

Label đầy đủ hiện tại (vd. «Đơn vị (toàn hệ thống)») dùng cho `title` / a11y dài; sidebar hiện `shortLabel`.

Landing: `/dashboard` → `DashboardIndexRedirect` → `/dashboard/units` (persist `dashboard.primary` giữ như cũ).

`superadminPortalNavItems` = map từ meta trên. **Không** gồm: origin app chính, `/lttp-nhap-xuat`, `/users`, `/so-sach-bep-an`.

App chính: giữ `superadminNavItems` → `${superadminOrigin}/dashboard` (external).

---

## 4. UI / components

### 4.1 `AppSidebar`

- Hỗ trợ tùy chọn `section` trên item: desktop render nhãn nhóm nhỏ (muted) trước mục đầu tiên của mỗi section; không collapse/expand.
- Mobile bottom nav: flat list `shortLabel` (+ icon); cho phép scroll/shrink ngang nếu 8 mục chật — **không** drawer mới trong P3.
- Active theo từng `to` (`/dashboard/<path>`), **không** dùng một `activePathPrefix: "/dashboard"` gộp cả cụm.

### 4.2 `SuperadminDashboardLayout`

- Guard user / `type === "superadmin"` giữ nguyên.
- Bỏ `ScrollableHorizontalStrip` / `role="tablist"`.
- Giữ header gọn («Quản lý hệ thống») + `children`.
- Persist `writePersistedNavTab("dashboard.primary", …)` từ pathname (hoặc tương đương khi đổi sidebar).

### 4.3 `DashboardUsersPage`

- Bỏ (hoặc không render trên cổng) link «Mở trang Người dùng» → `/users` vì route đó bị xóa trên `apps/superadmin`. Panel `SuperadminUsersPanel` vẫn là nội dung chính.

---

## 5. Routes to delete (`apps/superadmin`)

Xóa các page/group sau (và asset chỉ phục vụ chúng nếu orphan):

- `(private)/lttp-nhap-xuat/**`
- `(private)/users`
- `(private)/so-sach-bep-an`
- `(private)/meal-roster`

Giữ: `(private)/dashboard/**`, `(private)/profile`, `(private)/settings`, auth/main groups.

Gõ URL cũ → Next 404 (không bắt buộc thêm redirect).

---

## 6. Tests

1. Meta: đủ 8 path; mỗi item có `section`, `shortLabel`, `icon`, `routeAccessKey`.
2. `superadminPortalNavItems`: không match `/lttp-nhap-xuat`, `/users`, `/so-sach-bep-an`, `getMainAppOrigin()`.
3. `SuperadminDashboardLayout` source: không còn `ScrollableHorizontalStrip` / `role="tablist"`.
4. `DashboardUsersPage` (shared): không còn `href="/users"` (hoặc không còn copy «Mở trang Người dùng»).

---

## 7. Manual acceptance

1. Login cổng → `/dashboard` → units; sidebar 4 section, active đúng mục.
2. Không còn mục LTTP / Users ngoài dashboard / Sổ sách / «Ứng dụng chính» trên sidebar.
3. URL cũ nghiệp vụ → 404.
4. Profile / settings từ header OK.
5. Từ app chính, «Quản trị hệ thống» mở cổng.
6. Mobile bottom nav dùng được, không vỡ layout nghiêm trọng.

---

## 8. Out of scope

- P5 persist lựa chọn form/filter rộng hơn.
- Đổi cookie/auth cross-app.
- Thêm lại deep-link về app chính trong header (đã chốt không sidebar; không bắt buộc header link).
