# Superadmin Dashboard Tabs → Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cổng Superadmin chỉ còn quản trị hệ thống: sidebar nhóm 8 mục dashboard, bỏ tab ngang, xóa route nghiệp vụ trùng và link «Ứng dụng chính».

**Architecture:** Một nguồn `DASHBOARD_SUPERADMIN_TAB_META` (thêm `section` / `shortLabel` / `icon`) → `superadminPortalNavItems`. `AppSidebar` render section headers + short labels. `SuperadminDashboardLayout` chỉ còn header + children. Xóa page private ngoài dashboard trên `apps/superadmin`.

**Tech Stack:** React / Next App Router (`apps/superadmin`), `packages/shared`, lucide-react, `node:test` source asserts

**Spec:** `docs/superpowers/specs/2026-09-06-superadmin-dashboard-tabs-to-sidebar-design.md`

## Global Constraints

- Path giữ `/dashboard/<path>` — không đổi URL segment
- Không link sidebar về app chính; giữ `superadminNavItems` trên app chính → cổng
- Giữ `/profile` + `/settings`
- Xóa LTTP / `/users` / sổ sách / meal-roster trên `apps/superadmin` (404 nếu gõ URL)
- Không drawer mobile mới; bottom nav flat + scroll nếu chật
- Không redesign AppHeader; không đụng dashboard tabs `apps/web`

---

## File Map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/pages/dashboard/superadminDashboardTabMeta.js` | Meta + section/shortLabel/icon |
| `packages/shared/src/pages/dashboard/superadminDashboardTabMeta.test.js` | Assert meta shape + portal nav contents |
| `packages/shared/src/features/navigation/navConfig.js` | `superadminPortalNavItems` từ meta |
| `packages/shared/src/layouts/components/AppSidebar.jsx` | Section headers; `title`; mobile scroll; display short label |
| `packages/shared/src/pages/dashboard/SuperadminDashboardLayout.jsx` | Bỏ tab strip |
| `packages/shared/src/pages/dashboard/SuperadminDashboardLayout.test.js` | Assert no tablist strip |
| `packages/shared/src/pages/dashboard/DashboardTabPages.jsx` | Bỏ link `/users` trên `DashboardUsersPage` |
| `packages/shared/src/pages/dashboard/DashboardTabPages.test.js` | Assert no `/users` deep link (create if needed) |
| `apps/superadmin/app/(private)/lttp-nhap-xuat/**` | Delete |
| `apps/superadmin/app/(private)/users/**` | Delete |
| `apps/superadmin/app/(private)/so-sach-bep-an/**` | Delete |
| `apps/superadmin/app/(private)/meal-roster/**` | Delete |

`apps/superadmin/app/(private)/layout.jsx` đã truyền `navItems={superadminPortalNavItems}` — không đổi trừ khi import path vẫn đúng sau Task 1.

---

### Task 1: Meta + `superadminPortalNavItems`

**Files:**
- Modify: `packages/shared/src/pages/dashboard/superadminDashboardTabMeta.js`
- Modify: `packages/shared/src/features/navigation/navConfig.js`
- Create: `packages/shared/src/pages/dashboard/superadminDashboardTabMeta.test.js`

**Interfaces:**
- Produces: each meta entry `{ path, label, shortLabel, section, icon, routeAccessKey }`
- Produces: `superadminPortalNavItems` items `{ to, label, title, icon, section, requiresAuth, routeAccessKey }` where `label === shortLabel`, `title === label` (full), `to === `/dashboard/${path}``

- [ ] **Step 1: Write failing test**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { DASHBOARD_SUPERADMIN_TAB_META } from "./superadminDashboardTabMeta.js";
import { superadminPortalNavItems } from "@/features/navigation/navConfig.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("superadmin tab meta has section shortLabel icon for 8 paths", () => {
  assert.equal(DASHBOARD_SUPERADMIN_TAB_META.length, 8);
  const paths = DASHBOARD_SUPERADMIN_TAB_META.map((t) => t.path);
  assert.deepEqual(paths, [
    "units",
    "users",
    "pending-registrations",
    "lttp-groups",
    "meal-allowance-rates",
    "permission-matrix",
    "permission-descriptions",
    "chung-tu-pdf-templates",
  ]);
  for (const t of DASHBOARD_SUPERADMIN_TAB_META) {
    assert.ok(t.section);
    assert.ok(t.shortLabel);
    assert.equal(typeof t.icon, "function");
    assert.ok(t.routeAccessKey);
    assert.ok(t.label);
  }
  assert.equal(DASHBOARD_SUPERADMIN_TAB_META[0].section, "Hệ thống");
  assert.equal(DASHBOARD_SUPERADMIN_TAB_META[3].section, "Danh mục");
  assert.equal(DASHBOARD_SUPERADMIN_TAB_META[5].section, "Quyền");
  assert.equal(DASHBOARD_SUPERADMIN_TAB_META[7].section, "Chứng từ");
});

test("superadminPortalNavItems is dashboard-only from meta", () => {
  assert.equal(superadminPortalNavItems.length, 8);
  for (const item of superadminPortalNavItems) {
    assert.match(item.to, /^\/dashboard\//);
    assert.ok(item.section);
    assert.ok(item.title);
    assert.equal(item.requiresAuth, true);
  }
  const blob = JSON.stringify(superadminPortalNavItems.map((i) => i.to));
  assert.doesNotMatch(blob, /lttp-nhap-xuat/);
  assert.doesNotMatch(blob, /so-sach-bep-an/);
  assert.equal(
    superadminPortalNavItems.some((i) => i.to === "/users"),
    false,
  );
  const navSrc = readFileSync(join(root, "src/features/navigation/navConfig.js"), "utf8");
  assert.doesNotMatch(navSrc, /getMainAppOrigin\(\)/);
  assert.match(navSrc, /DASHBOARD_SUPERADMIN_TAB_META/);
});
```

Adjust import path for `navConfig` to match package test runner (relative `../features/navigation/navConfig.js` if `@/` unsupported in node:test). Prefer relative imports that already work in sibling tests.

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/shared && node --test src/pages/dashboard/superadminDashboardTabMeta.test.js
```

Expected: FAIL (missing fields / old portal nav)

- [ ] **Step 3: Implement meta**

In `superadminDashboardTabMeta.js`, import icons from `lucide-react` (pick stable set):

| path | shortLabel | section | icon suggestion |
|------|------------|---------|-----------------|
| units | Đơn vị | Hệ thống | `Building2` |
| users | Người dùng | Hệ thống | `Users` |
| pending-registrations | Đăng ký | Hệ thống | `UserPlus` |
| lttp-groups | Nhóm LTTP | Danh mục | `Layers` |
| meal-allowance-rates | Mức tiền ăn | Danh mục | `Wallet` |
| permission-matrix | Ma trận | Quyền | `Shield` |
| permission-descriptions | Mô tả quyền | Quyền | `BookOpen` |
| chung-tu-pdf-templates | Mẫu CT | Chứng từ | `FileText` |

Keep existing `label` + `routeAccessKey` strings.

- [ ] **Step 4: Implement `superadminPortalNavItems`**

Replace array body in `navConfig.js`:

```js
import { DASHBOARD_SUPERADMIN_TAB_META } from "@/pages/dashboard/superadminDashboardTabMeta";

export const superadminPortalNavItems = DASHBOARD_SUPERADMIN_TAB_META.map((t) => ({
  to: `/dashboard/${t.path}`,
  label: t.shortLabel,
  title: t.label,
  icon: t.icon,
  section: t.section,
  requiresAuth: true,
  routeAccessKey: t.routeAccessKey,
}));
```

Remove unused `getMainAppOrigin` import **from this file** only if nothing else uses it (`superadminNavItems` still needs `getSuperadminAppOrigin`; keep `getMainAppOrigin` import only if still referenced — after change it should not be).

Do **not** change `mainNavItems` or `superadminNavItems` (app chính still links to cổng).

- [ ] **Step 5: Run test — expect PASS**

```bash
cd packages/shared && node --test src/pages/dashboard/superadminDashboardTabMeta.test.js
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/pages/dashboard/superadminDashboardTabMeta.js \
  packages/shared/src/pages/dashboard/superadminDashboardTabMeta.test.js \
  packages/shared/src/features/navigation/navConfig.js
git commit -m "$(cat <<'EOF'
feat(superadmin): derive portal sidebar nav from dashboard meta

EOF
)"
```

---

### Task 2: `AppSidebar` section + title + mobile scroll

**Files:**
- Modify: `packages/shared/src/layouts/components/AppSidebar.jsx`
- Create or extend: `packages/shared/src/layouts/components/AppSidebar.test.js` (source assert OK)

**Interfaces:**
- Consumes: nav items may include optional `section`, optional `title` (full string for native `title` attr)
- Display text remains `item.label` (short on portal)
- Desktop: before first item of each new `section`, render muted section label
- Mobile bottom `<nav>`: add horizontal scroll (`overflow-x-auto`) + `shrink-0` on items so 8 mục không vỡ

- [ ] **Step 1: Failing source test**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "AppSidebar.jsx"),
  "utf8",
);

test("AppSidebar supports section headers and item title", () => {
  assert.match(src, /item\.section/);
  assert.match(src, /item\.title \?\? item\.label|title=\{item\.title/);
  assert.match(src, /overflow-x-auto/);
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd packages/shared && node --test src/layouts/components/AppSidebar.test.js
```

- [ ] **Step 3: Implement**

Desktop loop pattern:

```jsx
{visibleItems.map((item, index) => {
  const prev = visibleItems[index - 1];
  const showSection = item.section && item.section !== prev?.section;
  const title = item.title ?? item.label;
  // ... classNameBuilder unchanged ...
  return (
    <div key={item.to} className="flex flex-col gap-1">
      {showSection ? (
        <p className="px-1 pt-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {item.section}
        </p>
      ) : null}
      {/* GuardedNavLink / SidebarExternalLink with title={title} */}
    </div>
  );
})}
```

Mobile bottom nav: wrap flex row with `overflow-x-auto`, each item `shrink-0` (drop `flex-1` crowding if needed so labels readable). Section headers **optional on mobile** (spec: flat list) — skip section labels on bottom bar to save space.

Use `title={item.title ?? item.label}` on links.

Keep `mainNavItems` behavior unchanged when `section` absent.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(ui): AppSidebar section headers and scrollable mobile nav

EOF
)"
```

---

### Task 3: Strip dashboard tab strip + remove `/users` deep link

**Files:**
- Modify: `packages/shared/src/pages/dashboard/SuperadminDashboardLayout.jsx`
- Create: `packages/shared/src/pages/dashboard/SuperadminDashboardLayout.test.js`
- Modify: `packages/shared/src/pages/dashboard/DashboardTabPages.jsx` (`DashboardUsersPage`)
- Create or extend: `packages/shared/src/pages/dashboard/DashboardTabPages.test.js`

**Interfaces:**
- `SuperadminDashboardLayout`: guard + sticky header «Quản lý hệ thống» + `children`; pathname → `writePersistedNavTab("dashboard.primary", …)` giữ
- `DashboardUsersPage`: chỉ `SuperadminUsersPanel` (không Card link `/users`)

- [ ] **Step 1: Failing tests**

```js
// SuperadminDashboardLayout.test.js
assert.doesNotMatch(src, /ScrollableHorizontalStrip/);
assert.doesNotMatch(src, /role="tablist"/);
assert.match(src, /writePersistedNavTab/);
assert.match(src, /Quản lý hệ thống/);

// DashboardTabPages.test.js — DashboardUsersPage region
assert.doesNotMatch(usersPageSrcOrFull, /href="\/users"/);
assert.doesNotMatch(usersPageSrcOrFull, /Mở trang Người dùng/);
assert.match(fullSrc, /SuperadminUsersPanel/);
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement layout**

Remove imports: `GuardedNavLink`, `ScrollableHorizontalStrip`, `useRouteAccessByKey`, `DASHBOARD_SUPERADMIN_TAB_META`, `cn` if unused; remove `visibleTabs` / tablist JSX. Keep auth redirects + header + persist effect + `{children}` wrapper (may drop `role="tabpanel"` or keep as plain content div).

- [ ] **Step 4: Implement `DashboardUsersPage`**

```jsx
export function DashboardUsersPage() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <SuperadminUsersPanel />
    </div>
  );
}
```

Remove unused `Link` / `Users` / Card imports if nothing else in file needs them (check other exports in same file before deleting imports).

- [ ] **Step 5: Run — expect PASS**

```bash
cd packages/shared && node --test \
  src/pages/dashboard/SuperadminDashboardLayout.test.js \
  src/pages/dashboard/DashboardTabPages.test.js
```

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(superadmin): remove dashboard horizontal tabs and users deep link

EOF
)"
```

---

### Task 4: Delete non-dashboard private routes on `apps/superadmin`

**Files:**
- Delete: `apps/superadmin/app/(private)/lttp-nhap-xuat/` (entire tree)
- Delete: `apps/superadmin/app/(private)/users/` (entire tree)
- Delete: `apps/superadmin/app/(private)/so-sach-bep-an/` (entire tree)
- Delete: `apps/superadmin/app/(private)/meal-roster/` (entire tree)
- Create: `apps/superadmin/app/(private)/superadminPrivateRoutes.test.js` **or** root-level small assert under `packages/shared` / `apps/superadmin` — prefer a tiny node test that `fs.existsSync` those paths are false:

```js
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const privateRoot = join(
  /* resolve to apps/superadmin/app/(private) */,
);

for (const rel of ["lttp-nhap-xuat", "users", "so-sach-bep-an", "meal-roster"]) {
  test(`superadmin private route removed: ${rel}`, () => {
    assert.equal(existsSync(join(privateRoot, rel)), false);
  });
}
```

Place test at `apps/superadmin/scripts/assert-private-routes-removed.test.js` or `packages/shared/src/superadmin-app/superadminPrivateRoutesRemoved.test.js` with absolute-ish path via `fileURLToPath` walking to monorepo `apps/superadmin/app/(private)`.

Keep: `dashboard/**`, `profile`, `settings`, `loading.jsx`, `layout.jsx`.

Do **not** delete shared page components used by `apps/web`.

- [ ] **Step 1: Write failing existsSync tests**

- [ ] **Step 2: Run — expect FAIL** (paths still exist)

- [ ] **Step 3: Delete the four route trees** (`rm -rf` those directories)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Smoke grep**

```bash
rg -n 'lttp-nhap-xuat|so-sach-bep-an|meal-roster' apps/superadmin --glob '!**/node_modules/**'
# expect no private page imports left; middleware/config mentions OK if unrelated
```

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(superadmin): remove non-dashboard private routes

EOF
)"
```

---

## Spec coverage

| Spec requirement | Task |
|------------------|------|
| Meta section/shortLabel/icon | T1 |
| Portal nav from meta; no main-app / LTTP / users / kitchen | T1 |
| AppSidebar section + shortLabel + mobile | T2 |
| Remove horizontal tabs; persist primary | T3 |
| Remove DashboardUsers `/users` link | T3 |
| Delete private non-dashboard routes | T4 |
| Keep profile/settings; main app link to portal | unchanged (verify manually) |
| WorkingUnitScopeBar | unchanged |

## Self-review notes

- No path renames; landing redirect already safe.
- Icons live on meta to avoid duplicating icon map in navConfig.
- Mobile skips section headers (explicit in Task 2) — matches flat-list acceptance.

## Ops

None (FE-only). Manual: login cổng, click 8 sidebar items, confirm 404 on `/lttp-nhap-xuat`, profile from header, «Quản trị hệ thống» from app chính.
