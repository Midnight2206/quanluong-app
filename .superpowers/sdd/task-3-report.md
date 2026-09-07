# Task 3 Report: Strip dashboard tab strip + remove `/users` deep link

## Status: Complete

## Summary

Removed the horizontal tab strip from `SuperadminDashboardLayout` (sidebar now owns navigation per Tasks 1–2). Simplified `DashboardUsersPage` to render only `SuperadminUsersPanel` — no Card link to `/users`.

### Changes

**`packages/shared/src/pages/dashboard/SuperadminDashboardLayout.jsx`**
- Removed `ScrollableHorizontalStrip`, `GuardedNavLink`, `visibleTabs`, tablist/tabpanel ARIA.
- Kept: superadmin auth guard, sticky header «Quản lý hệ thống», pathname → `writePersistedNavTab("dashboard.primary", …)`, `{children}` wrapper.

**`packages/shared/src/pages/dashboard/DashboardTabPages.jsx`**
- `DashboardUsersPage`: panel-only layout; removed `Link href="/users"` Card and unused `linkCardClass` / `Users` import.

**`packages/shared/src/pages/dashboard/SuperadminDashboardLayout.test.js`** (new)
- Source-assert: no `ScrollableHorizontalStrip` / `role="tablist"`; retains `writePersistedNavTab` and «Quản lý hệ thống».

**`packages/shared/src/pages/dashboard/DashboardTabPages.test.js`** (new)
- Source-assert on `DashboardUsersPage` region: no `/users` href or «Mở trang Người dùng»; file still imports `SuperadminUsersPanel`.

## TDD

| Step | Result |
|------|--------|
| Write failing tests | FAIL (2/2 — strip and deep link still present) |
| Implement layout + users page | — |
| Re-run tests | PASS (2/2) |

```bash
cd packages/shared && node --test \
  src/pages/dashboard/SuperadminDashboardLayout.test.js \
  src/pages/dashboard/DashboardTabPages.test.js
# ✔ SuperadminDashboardLayout has header and persist without tab strip
# ✔ DashboardUsersPage renders SuperadminUsersPanel without /users deep link
```

## Commit

```
refactor(superadmin): remove dashboard horizontal tabs and users deep link
```

## Self-review

- Did not delete `apps/superadmin` routes (Task 4 scope).
- `Building2` import in `DashboardTabPages.jsx` was pre-existing unused import — left untouched.
- Nav persistence unchanged: visiting `/dashboard/units` still writes `dashboard.primary`.

## Concerns

None. Sidebar navigation from Tasks 1–2 replaces the removed tab strip.
