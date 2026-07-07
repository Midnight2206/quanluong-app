# Sổ sách bếp ăn — Thực đơn MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship module **Sổ sách bếp ăn**: **danh mục món theo đơn vị** + **thực đơn ngày**; chọn món từ kho đơn vị; quân số readonly; tự tính tổng SL.

**Architecture:** Resolve kho qua **`LTTP_COMMODITY`** — đơn vị cùng scope LTTP dùng chung danh mục món + thực đơn ngày (`storageUnitId`). Quân số theo `logicalUnitId`.

**Tech Stack:** Node/Express, Prisma 7, MariaDB, React, TanStack Query, Zod, Vitest/node:test.

**Spec:** `docs/superpowers/specs/2026-07-06-kitchen-books-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | Models + enums |
| `kitchen-books-quantity.js` | Calc totals + classify measureUnit |
| `kitchen-books-headcount.service.js` | Aggregate headcount from meal roster |
| `kitchen-books.service.js` | CRUD menu, enrich lines with totals |
| `kitchen-books.validator.js` | Zod bodies |
| `kitchen-books.controller.js` / `.routes.js` | HTTP layer |
| `KitchenBooksPage.jsx` | Shell unit + tabs |
| `KitchenDishCatalogTab.jsx` | CRUD danh mục món global |
| `KitchenPickCatalogDialog.jsx` | Dialog chọn món vào thực đơn ngày |
| `kitchenBooksApi.js` | React Query hooks |

---

### Task 1: Prisma schema & migration

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma`
- Create: `quanluong-app-be/prisma/migrations/20260706100000_kitchen_books_menu/migration.sql`

- [ ] **Step 1: Add enums and models** — catalog (`KitchenDishCatalog`, `KitchenDishCatalogLine`) + menu day models; `KitchenMenuDish.sourceCatalogId` optional FK

Add relations on `Unit` and `LttpCommodity`:

```prisma
  kitchenMenuDays KitchenMenuDay[]
```

```prisma
  kitchenMenuDishLines KitchenMenuDishLine[]
```

- [ ] **Step 2: Generate migration**

Run: `cd quanluong-app-be && npm run prisma:migrate:dev -- --name kitchen_books_menu`

Expected: migration SQL creates 4 tables + enums.

- [ ] **Step 3: prisma generate**

Run: `npm run prisma:generate`

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(kitchen-books): add menu prisma models"
```

---

### Task 2: Quantity calculation utility + tests

**Files:**
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-quantity.js`
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-quantity.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// kitchen-books-quantity.test.js
import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCommodityCalcMode,
  computeLineTotalQuantity,
} from "./kitchen-books-quantity.js";

test("classify gói as per_unit_shared", () => {
  assert.equal(classifyCommodityCalcMode("Gói"), "per_unit_shared");
});

test("per_person g to kg", () => {
  const r = computeLineTotalQuantity({
    calcMode: "per_person",
    perPersonAmount: 150,
    perPersonUnit: "g",
    peoplePerUnit: null,
    headcount: 128,
  });
  assert.equal(r.totalQuantity, 19.2);
  assert.equal(r.totalUnit, "kg");
});

test("per_unit_shared ceil", () => {
  const r = computeLineTotalQuantity({
    calcMode: "per_unit_shared",
    perPersonAmount: null,
    perPersonUnit: null,
    peoplePerUnit: 8,
    headcount: 130,
    commodityMeasureUnit: "hộp",
  });
  assert.equal(r.totalQuantity, 17);
  assert.equal(r.totalUnit, "hộp");
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd quanluong-app-be && node --test src/modules/kitchen-books/kitchen-books-quantity.test.js`

- [ ] **Step 3: Implement**

```javascript
// kitchen-books-quantity.js
const SHARED_UNITS = new Set(["gói", "goi", "hộp", "hop", "cây", "cay"]);

export function normalizeMeasureUnit(u) {
  return String(u ?? "").trim().toLowerCase();
}

export function classifyCommodityCalcMode(measureUnit) {
  return SHARED_UNITS.has(normalizeMeasureUnit(measureUnit))
    ? "per_unit_shared"
    : "per_person";
}

export function computeLineTotalQuantity(input) {
  const hc = Math.max(0, Number(input.headcount) || 0);
  if (input.calcMode === "per_unit_shared") {
    const ppu = Number(input.peoplePerUnit);
    if (!Number.isFinite(ppu) || ppu <= 0) {
      return { totalQuantity: 0, totalUnit: input.commodityMeasureUnit ?? "—" };
    }
    return {
      totalQuantity: hc === 0 ? 0 : Math.ceil(hc / ppu),
      totalUnit: input.commodityMeasureUnit ?? "—",
    };
  }
  const amt = Number(input.perPersonAmount);
  const unit = input.perPersonUnit === "ml" ? "ml" : "g";
  if (!Number.isFinite(amt) || amt <= 0 || hc === 0) {
    return { totalQuantity: 0, totalUnit: unit === "ml" ? "L" : "kg" };
  }
  const raw = (amt * hc) / 1000;
  return {
    totalQuantity: Math.round(raw * 10000) / 10000,
    totalUnit: unit === "ml" ? "L" : "kg",
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/kitchen-books/
git commit -m "feat(kitchen-books): quantity calc with tests"
```

---

### Task 2b: Scope — dùng chung `LTTP_COMMODITY`

**Files:**
- Create: `kitchen-books-scope.helpers.js` — mirror `assertLttpLogicalMatchesDataScope`, `assertCommodityRowStorage`

- [ ] **Step 1: Mọi route** `unitDataScopeMiddleware({ dataKind: "LTTP_COMMODITY" })` — **không** đăng ký data kind riêng cho kitchen

- [ ] **Step 2: Persist/read** `KitchenDishCatalog` + `KitchenMenuDay` theo `dataScope.storageUnitId`

- [ ] **Step 3: Test** hai `logicalUnitId` cùng resolve một `storageUnitId` → cùng catalog + cùng menu ngày

- [ ] **Step 4: Commit**

---

### Task 3: Permission & route definitions

**Files:**
- Modify: `quanluong-app-be/src/shared/constants/permissions.js`
- Modify: `packages/shared/src/features/permissions/constants/permissions.js`
- Modify: `quanluong-app-be/src/shared/constants/permission-catalog.vi.js`
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books.constants.js`
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books.route-definitions.js`

- [ ] **Step 1: Add `KITCHEN_BOOKS_ACCESS: "kitchenBooks.access"`** to BE + FE permissions and `permission-catalog.vi.js`

- [ ] **Step 2: Route definitions** — catalog (require `unitId`) + menu day endpoints

- [ ] **Step 4: Register permissions** via existing seed/sync mechanism if project has `syncPermissions` on boot — follow how `mealRoster.access` is registered.

- [ ] **Step 5: Commit**

---

### Task 4: Headcount service

**Files:**
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-headcount.service.js`
- Test: `kitchen-books-headcount.test.js` (optional fixture-based)

- [ ] **Step 1: Implement `getHeadcountForPeriod({ unitId, menuDate, mealPeriod })`**

Reuse logic from `meal-roster.service.js` `listMealRosterDayMarks`:
- Parse `menuDate` → `yearMonth` + `dayOfMonth`
- Count standard marks for period
- Count extra marks allocated to period (read `MealRosterDayExtraSplit` + default equal split)

- [ ] **Step 2: Export `getHeadcountsForDay(unitId, menuDate)` → `{ sang, trua, chieu }`**

- [ ] **Step 3: Commit**

---

### Task 5: Catalog service + menu service + HTTP layer

**Files:**
- Create: `kitchen-books-catalog.service.js` (list/search CRUD global)
- Create: `kitchen-books-menu.service.js` (day menu + `importCatalogDish`)
- Create: `kitchen-books.validator.js`, `kitchen-books.controller.js`, `kitchen-books.routes.js`
- Modify: `quanluong-app-be/src/app/routes.js`

- [ ] **Step 1: Catalog service** — `listCatalog({ unitId, q })` with unit assert; CRUD scoped to `unitId`

- [ ] **Step 2: Validate** `catalog.unitId === commodity.unitId` on every line

- [ ] **Step 3: `importCatalogToPeriod`** — reject if catalog.unitId !== menu.unitId

- [ ] **Step 4: Wire routes** — `/catalog/*` + `/menu/*` + `POST /menu/import-catalog`

- [ ] **Step 5: Commit**

---

### Task 6: Frontend API + routing + nav

**Files:**
- Create: `packages/shared/src/features/kitchen-books/api/kitchenBooksApi.js`
- Modify: `packages/shared/src/features/queryKeys` (or equivalent `qk` module)
- Create: `apps/web/app/(private)/so-sach-bep-an/page.jsx`
- Modify: `navConfig.js`, `routeAccessRegistry.js`, `nextAuthMiddleware.js`

- [ ] **Step 1: Query keys** `kitchenBooks.menu(unitId, date)`, `kitchenBooks.monthMarkers(unitId, yearMonth)`

- [ ] **Step 2: Hooks** `useGetKitchenMenuQuery`, `usePutKitchenMenuMutation`, `useGetKitchenMenuMonthMarkersQuery`

- [ ] **Step 3: Route page** with `RouteApiGuard routeAccessKey="nav-kitchen-books"`

- [ ] **Step 4: Nav item** «Sổ sách bếp ăn» → `/so-sach-bep-an`, icon `BookOpen`

- [ ] **Step 5: Commit**

---

### Task 7: KitchenBooksPage shell

**Files:**
- Create: `packages/shared/src/pages/kitchen-books/KitchenBooksPage.jsx`
- Create: `packages/shared/src/pages/kitchen-books/KitchenMenuTab.jsx` (skeleton first)

- [ ] **Step 1: Page** — copy unit/yearMonth/date state pattern from `MealRosterPage.jsx`

- [ ] **Step 2: Tabs** — `Danh mục món` | `Thực đơn` | `Tổng hợp` (disabled)

### Task 7b: KitchenDishCatalogTab

**Files:**
- Create: `KitchenDishCatalogTab.jsx`

- [ ] **Step 1: List + search** catalog filtered by `selectedUnitId` from page shell

- [ ] **Step 2: Create/edit** — LTTP search scoped to same unit; gate on `kitchenBooks.access`

- [ ] **Step 3: Delete with confirm**

- [ ] **Step 4: Commit**

### Task 8: KitchenMenuTab UI

**Files:**
- Modify: `KitchenMenuTab.jsx`
- Create: `packages/shared/src/pages/kitchen-books/kitchenMenuQuantity.js` (re-export or duplicate calc from BE for display)
- Reuse: `IssueSlipCommoditySearch` — extract to shared component OR import from lttp path

- [ ] **Step 1: Day navigator** + period tabs S/T/C

- [ ] **Step 2: Headcount display** (readonly) from API response

- [ ] **Step 3: Dish list** — add/remove dish, name input

- [ ] **Step 4: Lines per dish** — commodity search, conditional fields, computed total

- [ ] **Step 5: `KitchenPickCatalogDialog`** — search catalog → pick → call `POST /menu/import-catalog` or merge into local state before save

- [ ] **Step 6: «Lưu vào danh mục»** on dish row → `POST /catalog` (if manage permission)

- [ ] **Step 7: Save** → `PUT /menu` for current period

- [ ] **Step 8: Commit**

---

### Task 9: Docker verify & permission assign

- [ ] **Step 1: Run migration in Docker**

```bash
docker exec quanluong-app-be npm run prisma:migrate:deploy
docker exec quanluong-app-be npm run prisma:generate
docker restart quanluong-app-be
```

- [ ] **Step 2: Assign `kitchenBooks.access` to test role via admin UI or seed

- [ ] **Step 3: E2E manual** — tạo món, nhập LTTP, verify totals, reload page

- [ ] **Step 4: Final commit** if fixes needed

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Danh mục món theo unitId | Task 1, 5, 7b |
| Data scope logical→storage | Task 2b |
| Catalog/LTTP cùng storageUnitId | Task 2b, 5 |
| Chọn món từ danh mục | Task 5, 8 |
| Lưu vào danh mục | Task 5, 8 |
| Nav `/so-sach-bep-an` | Task 6 |
| Tab Thực đơn ngày | Task 7–8 |
| Headcount readonly | Task 4, 8 |
| per_person / per_unit_shared | Task 2, 8 |
| Permission kitchenBooks.* | Task 3 |

## Out of scope (deferred)

- Tổng hợp tab logic → placeholder only
- Google Sheets export → not in this plan
