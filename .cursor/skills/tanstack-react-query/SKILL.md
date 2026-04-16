---
name: tanstack-react-query
description: >-
  Guides TanStack Query (React Query) v5 usage in packages/shared—QueryClient defaults,
  query keys, useQuery/useMutation, invalidation, and compatibility with apiRequest axios
  wrapper. Use when adding API hooks, cache invalidation, or refactoring fetches away from
  ad-hoc useEffect.
---

# Purpose

Dự án dùng **@tanstack/react-query** v5; `QueryClientProvider` bọc app trong `AppProviders.jsx` (shared).

# Quy ước dự án

- **Query keys tập trung**: `packages/shared/src/app/query/queryKeys.js` — object `qk` theo domain (`auth`, `users`, `units`, `lttp`, `mealRoster`, …). Invalidate bằng prefix: `queryClient.invalidateQueries({ queryKey: qk.users.root })`.
- **HTTP**: `apiRequest()` trong `services/apiRequest.js` — trả payload đã “unwrap” giống RTK `transformResponse`; lỗi ném object `{ status, data, retryAfterSec? }`.
- **Mutation RTK-style**: `useWrappedMutation` (`lib/useWrappedMutation.js`) trả `[trigger, { isLoading: isPending, ... }]` và `trigger(arg).unwrap()` tương thích code cũ.
- **Mặc định QueryClient**: `staleTime` ~120s, `refetchOnWindowFocus: false` (app nội bộ).
- **Logout / reset session**: `queryClient.clear()` kèm clear Zustand auth (đã gắn trong `useLogoutMutation`).

# Rules

- Đặt `queryKey` ổn định, có tham số (id, unitId, yearMonth) khi query phụ thuộc biến — tránh key quá rộng không invalidate được chính xác.
- Sau mutation: `invalidateQueries` đúng nhánh key; LTTP/meal-roster có thể invalidate cả `root` domain khi dependency phức tạp.
- `enabled` / `skip`: dùng `enabled: skip !== true` cho tương thích option `{ skip: true }` từ hook cũ.

# Related skills

- `react-api-layer` — contract endpoint, mapping lỗi
- `react-http-client` — axios, refresh token
- `zustand-app-state` — đồng bộ user sau login / getCurrentUser
- `next-app-router` — provider chỉ bọc client tree
