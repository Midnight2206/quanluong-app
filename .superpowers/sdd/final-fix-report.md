# Final P3 Review Fix — Mobile bottom nav flex

**Status:** completed

## Important fix

- `AppSidebar.jsx` mobile bottom nav items: replaced `shrink-0` with `flex-1` (kept `min-w-[3.25rem]` / `sm:min-w-[4rem]`).
- Container unchanged: no `justify-around`; `overflow-x-auto` retained.
- 6-item main app fills bar; 8-item portal still overflows and scrolls.

## Optional (cheap)

- Removed unused `Building2` import from `DashboardTabPages.jsx`.
- Removed empty `async redirects() { return []; }` from `apps/superadmin/next.config.mjs`.

## Tests

```bash
cd packages/shared && node --test src/layouts/components/AppSidebar.test.js src/pages/dashboard/DashboardTabPages.test.js
```

- 2 passed, 0 failed
- AppSidebar test asserts `overflow-x-auto`, `flex-1` on mobile items, and no `shrink-0` on mobile item shell.

## Commit

`fix(ui): keep flex-1 on mobile bottom nav items`
