---
name: next-app-router
description: >-
  Guides Next.js App Router in this monorepo—route groups, Server vs Client Components,
  layouts, middleware, shared package imports, and Docker/dev pitfalls. Use when adding
  or changing routes under apps/web or apps/superadmin, RSC boundaries, next.config, or
  navigation between main app and superadmin.
---

# Purpose

Dùng skill này khi chỉnh **Next.js 15 App Router** trong repo `quanluong-app` (workspace `apps/web`, `apps/superadmin`, UI dùng `packages/shared`).

# Quy ước dự án

- **Hai app Next** cùng pattern: `app/layout.jsx`, `app/(auth)/`, `app/(private)/`, v.v.
- **Shared UI/logic**: `packages/shared/src` — alias `@/` trỏ vào đây qua `next.config.mjs` (`transpilePackages: ["@quanluong/shared"]`).
- **Client boundary**: file có `"use client"` hoặc import từ module client; **không** truyền function/class component từ Server Component xuống client như prop (gây lỗi manifest / RSC). Icon Lucide dạng component phải nằm trong client layout hoặc page client.
- **Env public**: `NEXT_PUBLIC_*` phải đọc bằng **literal** `process.env.NEXT_PUBLIC_...` trong shared (xem `runtimeEnv.js`) để Next inline đúng khi build.
- **Auth cookie + middleware**: `middleware.js` gọi `createAuthMiddleware` từ shared; protected route vẫn dùng `PrivateRoute` / `RouteApiGuard` phía client sau bootstrap.

# Dev Docker

- Compose dev có thể mount volume riêng cho `.next` — tránh bind mount `.next` trùng với host gây ENOENT cache.
- UI chạy port mapped (8080/8081); API thường `localhost:3000` — `NEXT_PUBLIC_API_BASE_URL` phải khớp trình duyệt, không dùng hostname nội bộ container cho request từ browser.

# Checklist khi thêm route

1. Tạo `page.jsx` trong đúng segment; RSC mặc định — chỉ thêm `"use client"` khi cần hooks, event, Zustand, TanStack Query hooks.
2. Bảo vệ quyền: `RouteApiGuard` + `routeAccessKey` hoặc layout private.
3. Thêm permission mới: cập nhật registry + skill `permission-vi-catalog` nếu có route API tương ứng.

# Related skills

- `tanstack-react-query` — fetch/cache sau khi vào client tree
- `zustand-app-state` — auth và state client global
- `react-routing-system` — khái niệm PrivateRoute / redirect (áp dụng trong Next qua shared)
- `react-http-client` — axios client, refresh, cookie
