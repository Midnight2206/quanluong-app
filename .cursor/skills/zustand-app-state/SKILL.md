---
name: zustand-app-state
description: >-
  Guides Zustand for client global state in packages/shared—auth store, derived route
  access map, actions callable outside React, and hooks for components. Use when changing
  login session, permissions UI, route guards, or splitting client state from TanStack
  Query server cache.
---

# Purpose

**Server state** (API list/detail) thuộc **TanStack Query**. **Zustand** dùng cho phiên đăng nhập, quyền hiển thị, và map `routeAccessByKey` (đồng bộ khi `setAuthState` / `clearAuthState`).

# Quy ước dự án

- **Store auth**: `features/auth/model/authStore.js` — `useAuthStore`, `user`, `permissions`, `status`, `initialized`, `routeAccessByKey`.
- **Facade hooks**: `features/auth/model/authSlice.js` re-export `useCurrentUser`, `useAuthInitialized`, `useIsAuthenticated`, `useHasPermission`, … và actions `setAuthState`, `clearAuthState`, …
- **Route access hooks**: `features/route-access/routeAccessHooks.js` — `useRouteDecision`, `useRouteAccessByKey` (không còn Redux slice).
- **Gọi ngoài React** (sau mutation API): `useAuthStore.getState().setAuthState({ user, permissions })` hoặc các helper export từ `authStore.js`.

# Rules

- Không nhét response API lớn vào Zustand nếu đã có Query cache — chỉ giữ user/profile/permissions cần cho guard và header.
- `useHasPermission(code)` dùng trong component; superadmin bypass giống backend (mảng quyền đầy đủ).
- Khi thêm `routeAccessKey` mới, cập nhật `routeAccessRegistry` và đảm bảo `buildRouteAccessByKey` trong store vẫn đúng.

# Related skills

- `tanstack-react-query` — fetch `current-user`, invalidate sau đổi profile
- `react-auth-system` — luồng bootstrap, guard, session
- `next-app-router` — layout client bọc providers
